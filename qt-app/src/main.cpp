#include <QApplication>
#include <QIcon>
#include <QDebug>
#include <iostream>

#include "ui/FloatingWidget.h"
#include "core/DependencyManager.h"
#include "core/DownloadManager.h"
#include "core/LocalServer.h"
#include "updater/AutoUpdater.h"

int main(int argc, char *argv[]) {
    // Enable High DPI scaling
    QApplication app(argc, argv);
    app.setApplicationName("ClipFlowHelper");
    app.setApplicationDisplayName("ClipFlow Desktop Helper");
    app.setOrganizationName("ClipFlow");
    app.setApplicationVersion("1.0.0");
    app.setWindowIcon(QIcon(":/resources/logo.png"));

    std::cout << "================================================\n";
    std::cout << "  ClipFlow Desktop Companion Helper v1.0.0\n";
    std::cout << "  1:1 Floating Widget + Local Engine Active\n";
    std::cout << "================================================\n" << std::endl;

    // 1. Create Floating 1:1 Widget
    FloatingWidget floatingWidget;
    floatingWidget.show();

    // 2. Create Core Modules
    DependencyManager depManager;
    DownloadManager dlManager;
    LocalServer localServer(18942);
    AutoUpdater updater("1.0.0");

    // 3. Connect Dependency Manager
    QObject::connect(&depManager, &DependencyManager::progress,
                     &floatingWidget, &FloatingWidget::setDependencyDownloadProgress);

    QObject::connect(&depManager, &DependencyManager::dependenciesReady, [&]() {
        dlManager.setBinaryPaths(depManager.getYtDlpPath(), depManager.getFfmpegPath());
        qDebug() << "[Main] Binaries configured: yt-dlp ->" << depManager.getYtDlpPath()
                 << ", ffmpeg ->" << depManager.getFfmpegPath();
    });

    QObject::connect(&depManager, &DependencyManager::error,
                     &floatingWidget, &FloatingWidget::setDownloadError);

    // 4. Connect Download Manager to UI
    QObject::connect(&dlManager, &DownloadManager::downloadStarted,
                     &floatingWidget, &FloatingWidget::setDownloadStarting);

    QObject::connect(&dlManager, &DownloadManager::progressUpdated,
                     &floatingWidget, &FloatingWidget::setProgress);

    QObject::connect(&dlManager, &DownloadManager::processingStarted,
                     &floatingWidget, &FloatingWidget::setProcessing);

    QObject::connect(&dlManager, &DownloadManager::downloadFinished,
                     &floatingWidget, &FloatingWidget::setDownloadComplete);

    QObject::connect(&dlManager, &DownloadManager::downloadFailed,
                     &floatingWidget, &FloatingWidget::setDownloadError);

    // 5. Connect Local Server to Download Manager
    QObject::connect(&localServer, &LocalServer::downloadRequested,
                     &dlManager, &DownloadManager::startDownload);

    // 6. Start Local HTTP Server
    if (!localServer.start()) {
        qWarning() << "[Main] Local server could not start on port 18942!";
    }

    // 7. Check / Prepare Dependencies on First Run
    depManager.checkAndPrepareDependencies();

    // 8. Run Background Update Check
    updater.checkForUpdates();

    return app.exec();
}

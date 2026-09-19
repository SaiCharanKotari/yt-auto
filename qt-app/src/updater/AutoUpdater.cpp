#include "AutoUpdater.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QProcess>
#include <QDebug>
#include <QStringList>

AutoUpdater::AutoUpdater(const QString &currentVersion, QObject *parent)
    : QObject(parent)
    , m_currentVersion(currentVersion)
    , m_updateCheckUrl("http://localhost:3001/api/app/update-check")
{
}

void AutoUpdater::checkForUpdates() {
    if (m_checkReply) {
        m_checkReply->abort();
        m_checkReply->deleteLater();
    }

    qDebug() << "[Updater] Checking for updates at:" << m_updateCheckUrl;
    QNetworkRequest req((QUrl(m_updateCheckUrl)));
    req.setHeader(QNetworkRequest::UserAgentHeader, "ClipFlowHelper/" + m_currentVersion);

    m_checkReply = m_netManager.get(req);
    connect(m_checkReply, &QNetworkReply::finished, this, &AutoUpdater::handleCheckReply);
}

void AutoUpdater::handleCheckReply() {
    if (!m_checkReply) return;

    if (m_checkReply->error() != QNetworkReply::NoError) {
        qDebug() << "[Updater] Update check failed or server unreachable:" << m_checkReply->errorString();
        m_checkReply->deleteLater();
        m_checkReply = nullptr;
        emit noUpdateAvailable();
        return;
    }

    QByteArray data = m_checkReply->readAll();
    m_checkReply->deleteLater();
    m_checkReply = nullptr;

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (!doc.isObject()) {
        emit noUpdateAvailable();
        return;
    }

    QJsonObject obj = doc.object();
    QString remoteVer = obj.value("latestVersion").toString();
    QString dlUrl = obj.value("downloadUrl").toString();
    QString notes = obj.value("changelog").toString();
    bool mandatory = obj.value("mandatory").toBool(false);

    if (!remoteVer.isEmpty() && isVersionNewer(remoteVer, m_currentVersion)) {
        qDebug() << "[Updater] Newer version found:" << remoteVer << "(Current:" << m_currentVersion << ")";
        UpdateInfo info;
        info.version = remoteVer;
        info.downloadUrl = dlUrl;
        info.changelog = notes;
        info.isMandatory = mandatory;
        emit updateAvailable(info);
    } else {
        qDebug() << "[Updater] App is up to date (version" << m_currentVersion << ")";
        emit noUpdateAvailable();
    }
}

bool AutoUpdater::isVersionNewer(const QString &remoteVersion, const QString &currentVersion) const {
    QStringList rParts = remoteVersion.split('.');
    QStringList cParts = currentVersion.split('.');

    for (int i = 0; i < qMax(rParts.size(), cParts.size()); ++i) {
        int r = (i < rParts.size()) ? rParts[i].toInt() : 0;
        int c = (i < cParts.size()) ? cParts[i].toInt() : 0;
        if (r > c) return true;
        if (r < c) return false;
    }
    return false;
}

void AutoUpdater::downloadAndApplyUpdate(const QString &downloadUrl) {
    if (downloadUrl.isEmpty()) return;

    QString tempInstaller = QDir::temp().filePath("ClipFlowHelper_update.exe");
    QFile *file = new QFile(tempInstaller, this);
    if (!file->open(QIODevice::WriteOnly)) {
        emit updateError("Cannot create update temporary file");
        delete file;
        return;
    }

    QNetworkRequest req((QUrl(downloadUrl)));
    m_downloadReply = m_netManager.get(req);

    connect(m_downloadReply, &QNetworkReply::downloadProgress, this, [this](qint64 rec, qint64 tot) {
        if (tot > 0) emit downloadProgress(static_cast<int>((rec * 100) / tot));
    });

    connect(m_downloadReply, &QNetworkReply::readyRead, this, [this, file]() {
        file->write(m_downloadReply->readAll());
    });

    connect(m_downloadReply, &QNetworkReply::finished, this, [this, file, tempInstaller]() {
        file->close();
        file->deleteLater();

        if (m_downloadReply->error() == QNetworkReply::NoError) {
            emit updateReadyToInstall(tempInstaller);
        } else {
            emit updateError(m_downloadReply->errorString());
        }

        m_downloadReply->deleteLater();
        m_downloadReply = nullptr;
    });
}

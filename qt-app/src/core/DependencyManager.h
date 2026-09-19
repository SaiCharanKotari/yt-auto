#pragma once

#include <QObject>
#include <QString>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QFile>

class DependencyManager : public QObject {
    Q_OBJECT

public:
    explicit DependencyManager(QObject *parent = nullptr);
    ~DependencyManager() override = default;

    bool checkAndPrepareDependencies();
    QString getYtDlpPath() const;
    QString getFfmpegPath() const;

signals:
    void progress(const QString &depName, int percentage);
    void dependenciesReady();
    void error(const QString &errorMessage);

private:
    void downloadNext();
    void downloadFile(const QString &name, const QString &url, const QString &destPath);
    void handleRedirect(const QUrl &url, const QString &name, const QString &destPath);

    QString m_binDir;
    QString m_ytDlpPath;
    QString m_ffmpegPath;

    struct DownloadTask {
        QString name;
        QString url;
        QString destPath;
    };

    QList<DownloadTask> m_tasks;
    QNetworkAccessManager m_netManager;
    QNetworkReply *m_currentReply = nullptr;
    QFile *m_currentFile = nullptr;
};

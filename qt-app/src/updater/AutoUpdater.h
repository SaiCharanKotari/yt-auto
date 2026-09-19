#pragma once

#include <QObject>
#include <QString>
#include <QNetworkAccessManager>
#include <QNetworkReply>

struct UpdateInfo {
    QString version;
    QString downloadUrl;
    QString changelog;
    bool isMandatory = false;
};

class AutoUpdater : public QObject {
    Q_OBJECT

public:
    explicit AutoUpdater(const QString &currentVersion = "1.0.0", QObject *parent = nullptr);
    ~AutoUpdater() override = default;

    QString getCurrentVersion() const { return m_currentVersion; }
    void setUpdateUrl(const QString &url) { m_updateCheckUrl = url; }
    void checkForUpdates();
    void downloadAndApplyUpdate(const QString &downloadUrl);

signals:
    void updateAvailable(const UpdateInfo &info);
    void noUpdateAvailable();
    void downloadProgress(int percentage);
    void updateReadyToInstall(const QString &installerPath);
    void updateError(const QString &errorMessage);

private slots:
    void handleCheckReply();

private:
    bool isVersionNewer(const QString &remoteVersion, const QString &currentVersion) const;

    QString m_currentVersion;
    QString m_updateCheckUrl;
    QNetworkAccessManager m_netManager;
    QNetworkReply *m_checkReply = nullptr;
    QNetworkReply *m_downloadReply = nullptr;
};

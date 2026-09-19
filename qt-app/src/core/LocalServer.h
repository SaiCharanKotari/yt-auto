#pragma once

#include <QObject>
#include <QTcpServer>
#include <QTcpSocket>
#include "DownloadManager.h"

class LocalServer : public QObject {
    Q_OBJECT

public:
    explicit LocalServer(quint16 port = 18942, QObject *parent = nullptr);
    ~LocalServer() override = default;

    bool start();
    void stop();

signals:
    void downloadRequested(const DownloadOptions &options);

private slots:
    void handleNewConnection();
    void handleSocketRead();

private:
    bool isOriginAllowed(const QString &origin) const;
    void sendResponse(QTcpSocket *socket, int statusCode, const QString &statusText, const QByteArray &body, const QString &origin = QString(), const QString &contentType = "application/json");
    void handleHttpRequest(QTcpSocket *socket, const QString &method, const QString &path, const QString &origin, const QByteArray &body);

    quint16 m_port;
    QTcpServer *m_server = nullptr;
};

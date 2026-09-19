#include "LocalServer.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QDebug>

LocalServer::LocalServer(quint16 port, QObject *parent)
    : QObject(parent)
    , m_port(port)
{
    m_server = new QTcpServer(this);
    connect(m_server, &QTcpServer::newConnection, this, &LocalServer::handleNewConnection);
}

bool LocalServer::start() {
    if (!m_server->listen(QHostAddress::LocalHost, m_port)) {
        qCritical() << "[LocalServer] Failed to listen on port" << m_port << ":" << m_server->errorString();
        return false;
    }
    qDebug() << "[LocalServer] Listening for ClipFlow web requests on http://127.0.0.1:" << m_port;
    return true;
}

void LocalServer::stop() {
    if (m_server->isListening()) {
        m_server->close();
    }
}

void LocalServer::handleNewConnection() {
    QTcpSocket *socket = m_server->nextPendingConnection();
    if (!socket) return;

    connect(socket, &QTcpSocket::readyRead, this, &LocalServer::handleSocketRead);
    connect(socket, &QTcpSocket::disconnected, socket, &QTcpSocket::deleteLater);
}

bool LocalServer::isOriginAllowed(const QString &origin) const {
    if (origin.isEmpty()) return false;
    QString o = origin.trimmed().toLower();
    while (o.endsWith('/')) o.chop(1);

    if (o == "https://clipflow.com" || o == "https://www.clipflow.com" || o == "https://app.clipflow.com" ||
        o == "http://localhost:5173" || o == "http://127.0.0.1:5173" ||
        o == "http://localhost:3000" || o == "http://127.0.0.1:3000" ||
        o == "http://localhost:3001" || o == "http://127.0.0.1:3001") {
        return true;
    }
    if (o.endsWith(".clipflow.com") && (o.startsWith("https://") || o.startsWith("http://"))) {
        return true;
    }
    if (o.startsWith("http://localhost:") || o.startsWith("http://127.0.0.1:")) {
        return true;
    }
    return false;
}

void LocalServer::handleSocketRead() {
    QTcpSocket *socket = qobject_cast<QTcpSocket*>(sender());
    if (!socket) return;

    QByteArray requestData = socket->readAll();
    QString reqStr = QString::fromUtf8(requestData);

    int headerEnd = reqStr.indexOf("\r\n\r\n");
    if (headerEnd == -1) return;

    QString headerPart = reqStr.left(headerEnd);
    QByteArray body = requestData.mid(headerEnd + 4);

    QStringList lines = headerPart.split("\r\n");
    if (lines.isEmpty()) return;

    QStringList requestLine = lines[0].split(' ');
    if (requestLine.size() < 2) return;

    QString method = requestLine[0].toUpper();
    QString path = requestLine[1];

    QString origin;
    for (const QString &line : lines) {
        if (line.startsWith("Origin:", Qt::CaseInsensitive)) {
            origin = line.mid(7).trimmed();
            break;
        }
    }

    handleHttpRequest(socket, method, path, origin, body);
}

void LocalServer::handleHttpRequest(QTcpSocket *socket, const QString &method, const QString &path, const QString &origin, const QByteArray &body) {
    if (method == "OPTIONS") {
        if (isOriginAllowed(origin)) {
            sendResponse(socket, 200, "OK", QByteArray(), origin, "text/plain");
        } else {
            sendResponse(socket, 403, "Forbidden", QByteArray("Unauthorized origin"), QString(), "text/plain");
        }
        return;
    }

    if (!isOriginAllowed(origin)) {
        QJsonObject res;
        res["error"] = "Forbidden: Unauthorized Origin";
        sendResponse(socket, 403, "Forbidden", QJsonDocument(res).toJson(), QString());
        return;
    }

    if (method == "GET" && (path == "/status" || path == "/health" || path == "/")) {
        QJsonObject res;
        res["status"] = "ok";
        res["service"] = "ClipFlowHelper";
        res["version"] = "1.0.0";
        res["ready"] = true;
        sendResponse(socket, 200, "OK", QJsonDocument(res).toJson(), origin);
        return;
    }

    if (method == "POST" && path == "/download") {
        QJsonParseError err;
        QJsonDocument doc = QJsonDocument::fromJson(body, &err);
        if (err.error != QJsonParseError::NoError || !doc.isObject()) {
            QJsonObject res;
            res["error"] = "Invalid JSON payload";
            sendResponse(socket, 400, "Bad Request", QJsonDocument(res).toJson(), origin);
            return;
        }

        QJsonObject obj = doc.object();
        DownloadOptions opts;
        opts.url = obj.value("url").toString().trimmed();
        opts.format = obj.value("format").toString("mp4");
        opts.quality = obj.value("quality").toString("1080p");
        opts.audioQuality = obj.value("audioQuality").toString("0");
        opts.trimStart = obj.value("trimStart").toDouble(0);
        opts.trimEnd = obj.value("trimEnd").toDouble(-1);
        opts.aspectRatio = obj.value("aspectRatio").toString("16:9");
        opts.fitMode = obj.value("fitMode").toString("pad");
        opts.customFileName = obj.value("customFileName").toString();

        if (opts.url.isEmpty() || (!opts.url.startsWith("http://") && !opts.url.startsWith("https://"))) {
            QJsonObject res;
            res["error"] = "Valid HTTP/HTTPS URL is required";
            sendResponse(socket, 400, "Bad Request", QJsonDocument(res).toJson(), origin);
            return;
        }

        emit downloadRequested(opts);

        QJsonObject res;
        res["success"] = true;
        res["message"] = "Download captured by ClipFlow Helper!";
        sendResponse(socket, 200, "OK", QJsonDocument(res).toJson(), origin);
        return;
    }

    // Default 404
    QJsonObject res;
    res["error"] = "Endpoint not found";
    sendResponse(socket, 404, "Not Found", QJsonDocument(res).toJson(), origin);
}

void LocalServer::sendResponse(QTcpSocket *socket, int statusCode, const QString &statusText, const QByteArray &body, const QString &origin, const QString &contentType) {
    if (!socket || socket->state() != QAbstractSocket::ConnectedState) return;

    QByteArray response;
    response.append(QString("HTTP/1.1 %1 %2\r\n").arg(statusCode).arg(statusText).toUtf8());
    if (!origin.isEmpty()) {
        response.append(QString("Access-Control-Allow-Origin: %1\r\n").arg(origin).toUtf8());
        response.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
        response.append("Access-Control-Allow-Headers: Content-Type, Authorization\r\n");
        response.append("Access-Control-Max-Age: 86400\r\n");
    }
    response.append(QString("Content-Type: %1\r\n").arg(contentType).toUtf8());
    response.append(QString("Content-Length: %1\r\n").arg(body.size()).toUtf8());
    response.append("Connection: close\r\n\r\n");
    response.append(body);

    socket->write(response);
    socket->flush();
    socket->disconnectFromHost();
}

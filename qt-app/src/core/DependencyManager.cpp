#include "DependencyManager.h"
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QDebug>
#include <QRegularExpression>

DependencyManager::DependencyManager(QObject *parent)
    : QObject(parent)
{
    m_binDir = QCoreApplication::applicationDirPath() + "/bin";
    QDir().mkpath(m_binDir);

    m_ytDlpPath = m_binDir + "/yt-dlp.exe";
    m_ffmpegPath = m_binDir + "/ffmpeg.exe";
}

bool DependencyManager::checkAndPrepareDependencies() {
    // 1. Check if backend binaries exist locally in parent directory and copy if needed
    QString backendDir = QCoreApplication::applicationDirPath() + "/../backend";
    if (!QFile::exists(m_ytDlpPath) && QFile::exists(backendDir + "/yt-dlp.exe")) {
        QFile::copy(backendDir + "/yt-dlp.exe", m_ytDlpPath);
        qDebug() << "[Deps] Copied local yt-dlp.exe from backend";
    }
    if (!QFile::exists(m_ffmpegPath) && QFile::exists(backendDir + "/ffmpeg.exe")) {
        QFile::copy(backendDir + "/ffmpeg.exe", m_ffmpegPath);
        qDebug() << "[Deps] Copied local ffmpeg.exe from backend";
    }

    m_tasks.clear();

    // 2. Queue missing Google Drive downloads
    if (!QFile::exists(m_ytDlpPath)) {
        m_tasks.append({
            "yt-dlp",
            "https://drive.google.com/uc?export=download&id=1MV8P5WJ7YMk0IwUGmyoWt4FKnJmQI2vs",
            m_ytDlpPath
        });
    }

    if (!QFile::exists(m_ffmpegPath)) {
        m_tasks.append({
            "ffmpeg",
            "https://drive.google.com/uc?export=download&id=1LLfNgL6Y9R_oEXc8ODDhd1CpmNkwMT1Q",
            m_ffmpegPath
        });
    }

    if (m_tasks.isEmpty()) {
        qDebug() << "[Deps] All required binaries are verified and ready.";
        emit dependenciesReady();
        return true;
    }

    qDebug() << "[Deps] Starting download of" << m_tasks.size() << "missing binaries...";
    downloadNext();
    return false;
}

QString DependencyManager::getYtDlpPath() const {
    if (QFile::exists(m_ytDlpPath)) return m_ytDlpPath;
    QString local = QCoreApplication::applicationDirPath() + "/../backend/yt-dlp.exe";
    if (QFile::exists(local)) return local;
    return "yt-dlp.exe";
}

QString DependencyManager::getFfmpegPath() const {
    if (QFile::exists(m_ffmpegPath)) return m_ffmpegPath;
    QString local = QCoreApplication::applicationDirPath() + "/../backend/ffmpeg.exe";
    if (QFile::exists(local)) return local;
    return "ffmpeg.exe";
}

void DependencyManager::downloadNext() {
    if (m_tasks.isEmpty()) {
        qDebug() << "[Deps] All downloads finished successfully.";
        emit dependenciesReady();
        return;
    }

    DownloadTask task = m_tasks.takeFirst();
    downloadFile(task.name, task.url, task.destPath);
}

void DependencyManager::downloadFile(const QString &name, const QString &urlStr, const QString &destPath) {
    qDebug() << "[Deps] Downloading" << name << "from:" << urlStr;

    if (m_currentFile) {
        m_currentFile->close();
        delete m_currentFile;
    }

    m_currentFile = new QFile(destPath + ".tmp", this);
    if (!m_currentFile->open(QIODevice::WriteOnly)) {
        emit error(QString("Cannot create file: %1").arg(destPath));
        return;
    }

    QNetworkRequest req((QUrl(urlStr)));
    req.setHeader(QNetworkRequest::UserAgentHeader, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);

    m_currentReply = m_netManager.get(req);

    connect(m_currentReply, &QNetworkReply::downloadProgress, this, [this, name](qint64 received, qint64 total) {
        if (total > 0) {
            int pct = static_cast<int>((received * 100) / total);
            emit progress(name, pct);
        }
    });

    connect(m_currentReply, &QNetworkReply::readyRead, this, [this]() {
        if (m_currentFile && m_currentReply) {
            m_currentFile->write(m_currentReply->readAll());
        }
    });

    connect(m_currentReply, &QNetworkReply::finished, this, [this, name, destPath]() {
        if (m_currentReply->error() != QNetworkReply::NoError) {
            emit error(QString("Failed to download %1: %2").arg(name, m_currentReply->errorString()));
            m_currentFile->close();
            m_currentFile->remove();
            m_currentReply->deleteLater();
            return;
        }

        // Handle possible Google Drive virus scan warning page
        m_currentFile->close();
        QFile checkFile(destPath + ".tmp");
        if (checkFile.open(QIODevice::ReadOnly)) {
            QByteArray head = checkFile.read(2048);
            checkFile.close();

            if (head.contains("<!DOCTYPE html>") || head.contains("<html")) {
                // Parse confirm token for large file
                QString html(head);
                QRegularExpression re("confirm=([0-9A-Za-z_]+)");
                QRegularExpressionMatch match = re.match(html);
                if (match.hasMatch()) {
                    QString token = match.captured(1);
                    QString confirmUrl = QString("https://drive.google.com/uc?export=download&id=%1&confirm=%2")
                        .arg(name == "yt-dlp" ? "1MV8P5WJ7YMk0IwUGmyoWt4FKnJmQI2vs" : "1LLfNgL6Y9R_oEXc8ODDhd1CpmNkwMT1Q", token);
                    m_currentReply->deleteLater();
                    downloadFile(name, confirmUrl, destPath);
                    return;
                }
            }
        }

        // Move .tmp to final path
        QFile::remove(destPath);
        QFile::rename(destPath + ".tmp", destPath);
        qDebug() << "[Deps] Successfully saved:" << destPath;

        m_currentReply->deleteLater();
        m_currentReply = nullptr;

        downloadNext();
    });
}

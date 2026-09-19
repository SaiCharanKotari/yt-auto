#include "DownloadManager.h"
#include <QStandardPaths>
#include <QDir>
#include <QFileInfo>
#include <QDateTime>
#include <QDebug>
#include <iostream>

DownloadManager::DownloadManager(QObject *parent)
    : QObject(parent)
    , m_progressRegex(R"(\[download\]\s+([\d\.]+)%\s+of\s+[~]?([\d\.]+\w+)\s+at\s+([\d\.]+\w+\/s)\s+ETA\s+([\d:]+))")
{
}

void DownloadManager::setBinaryPaths(const QString &ytDlp, const QString &ffmpeg) {
    m_ytDlpBin = ytDlp;
    m_ffmpegBin = ffmpeg;
}

QString DownloadManager::formatSeconds(double seconds) const {
    int s = qMax(0, static_cast<int>(seconds));
    int hrs = s / 3600;
    int mins = (s % 3600) / 60;
    int secs = s % 60;
    return QString("%1:%2:%3")
        .arg(hrs, 2, 10, QChar('0'))
        .arg(mins, 2, 10, QChar('0'))
        .arg(secs, 2, 10, QChar('0'));
}

QString DownloadManager::getAspectFilter(const QString &ratio, const QString &mode) const {
    bool isCrop = (mode == "crop");
    if (ratio == "9:16") {
        return isCrop ? "crop=trunc(ih*(9/16)/2)*2:ih"
                      : "pad=ceil(max(iw,ih*9/16)/2)*2:ceil(max(ih,iw*16/9)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black";
    } else if (ratio == "1:1") {
        return isCrop ? "crop=ih:ih"
                      : "pad=ceil(max(iw,ih)/2)*2:ceil(max(ih,iw)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black";
    } else if (ratio == "4:5") {
        return isCrop ? "crop=trunc(ih*(4/5)/2)*2:ih"
                      : "pad=ceil(max(iw,ih*4/5)/2)*2:ceil(max(ih,iw*5/4)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black";
    }
    return "";
}

void DownloadManager::startDownload(const DownloadOptions &options) {
    cancelCurrentDownload();
    m_currentOptions = options;

    m_isAudio = (options.format == "mp3" || options.format == "wav" || options.format == "m4a" || options.format == "aac");
    QString ext = m_isAudio ? options.format : "mp4";

    QString safeName = options.customFileName.trimmed();
    if (safeName.isEmpty()) {
        safeName = "%(title)s";
    } else {
        safeName.replace(QRegularExpression(R"([<>:"/\\|?*])"), "_");
    }

    QString downloadsDir = QStandardPaths::writableLocation(QStandardPaths::DownloadLocation);
    QString baseName = QString("%1_clip").arg(safeName);

    // Auto-numbering if file already exists in Downloads
    QString finalPath = QDir(downloadsDir).filePath(QString("%1.%2").arg(baseName, ext));
    if (QFile::exists(finalPath)) {
        int counter = 1;
        while (QFile::exists(QDir(downloadsDir).filePath(QString("%1 (%2).%3").arg(baseName).arg(counter).arg(ext)))) {
            counter++;
        }
        finalPath = QDir(downloadsDir).filePath(QString("%1 (%2).%3").arg(baseName).arg(counter).arg(ext));
    }
    m_finalOutputPath = finalPath;
    m_tempRawPath = QDir(downloadsDir).filePath(QString("%1_raw_temp_%2.%3").arg(safeName).arg(QDateTime::currentMSecsSinceEpoch()).arg(ext));

    QString filter = getAspectFilter(options.aspectRatio, options.fitMode);
    m_needsCrop = (!m_isAudio && !filter.isEmpty());

    QString targetOut = m_needsCrop ? m_tempRawPath : m_finalOutputPath;

    // Quality selector
    QString ytFormat;
    if (m_isAudio) {
        ytFormat = "bestaudio/best";
    } else {
        int height = 1080;
        QString q = options.quality.toLower().remove('p');
        if (q == "4k" || q == "2160") height = 2160;
        else if (q == "1440" || q == "2k") height = 1440;
        else if (q == "1080") height = 1080;
        else if (q == "720") height = 720;
        else if (q == "480") height = 480;
        else if (q == "360") height = 360;
        else if (q == "240") height = 240;
        else if (q.toInt() > 0) height = q.toInt();

        ytFormat = QString("bestvideo[height<=%1]+bestaudio/best[height<=%1]").arg(height);
    }

    // Build argument list
    QStringList args;
    args << "--js-runtimes" << "node";

    if (options.trimEnd > options.trimStart) {
        QString timeRange = QString("*%1-%2")
            .arg(formatSeconds(options.trimStart), formatSeconds(options.trimEnd));
        args << "--download-sections" << timeRange;
        args << "--force-keyframes-at-cuts";
    }

    if (m_isAudio) {
        args << "-x" << "--audio-format" << options.format;
        args << "--audio-quality" << (options.audioQuality.isEmpty() ? "0" : options.audioQuality);
    } else {
        args << "-f" << ytFormat;
        args << "--merge-output-format" << "mp4";
    }

    args << "--no-playlist";
    args << "-o" << targetOut;
    args << options.url;

    std::cout << "\n========================================\n";
    std::cout << "[ClipFlow Helper] Launching yt-dlp:\n";
    std::cout << m_ytDlpBin.toStdString() << " " << args.join(" ").toStdString() << "\n";
    std::cout << "========================================\n" << std::endl;

    emit downloadStarted(safeName);

    m_process = new QProcess(this);
    connect(m_process, &QProcess::readyReadStandardOutput, this, &DownloadManager::handleProcessOutput);
    connect(m_process, &QProcess::readyReadStandardError, this, &DownloadManager::handleProcessOutput);
    connect(m_process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, &DownloadManager::handleProcessFinished);

    m_process->start(m_ytDlpBin, args);
}

void DownloadManager::cancelCurrentDownload() {
    if (m_process && m_process->state() != QProcess::NotRunning) {
        m_process->kill();
        m_process->waitForFinished(1000);
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void DownloadManager::handleProcessOutput() {
    if (!m_process) return;

    QString output = QString::fromUtf8(m_process->readAllStandardOutput());
    QString errOutput = QString::fromUtf8(m_process->readAllStandardError());
    QString combined = output + errOutput;

    std::cout << combined.toStdString();

    // Parse progress e.g. [download]  45.3% of ~33.00MiB at  5.23MiB/s ETA 00:04
    QRegularExpressionMatch match = m_progressRegex.match(combined);
    if (match.hasMatch()) {
        double pct = match.captured(1).toDouble();
        QString speed = match.captured(3);
        emit progressUpdated(static_cast<int>(pct), speed, speed);
    }
}

void DownloadManager::handleProcessFinished(int exitCode, QProcess::ExitStatus exitStatus) {
    if (exitStatus != QProcess::NormalExit || exitCode != 0) {
        emit downloadFailed(QString("yt-dlp exited with error code %1").arg(exitCode));
        return;
    }

    if (m_needsCrop) {
        runFfmpegCropping();
    } else {
        emit progressUpdated(100, "", "");
        emit downloadFinished(m_finalOutputPath);
    }
}

void DownloadManager::runFfmpegCropping() {
    emit processingStarted("Cropping aspect ratio...");

    QString filter = getAspectFilter(m_currentOptions.aspectRatio, m_currentOptions.fitMode);

    QStringList args;
    args << "-i" << m_tempRawPath;
    args << "-vf" << filter;
    args << "-c:v" << "libx264" << "-preset" << "fast" << "-crf" << "20";
    args << "-c:a" << "aac";
    args << "-y" << m_finalOutputPath;

    std::cout << "\n========================================\n";
    std::cout << "[ClipFlow Helper] Launching FFmpeg Post-Process:\n";
    std::cout << m_ffmpegBin.toStdString() << " " << args.join(" ").toStdString() << "\n";
    std::cout << "========================================\n" << std::endl;

    QProcess *cropProc = new QProcess(this);
    connect(cropProc, &QProcess::readyReadStandardError, this, [cropProc]() {
        std::cout << QString::fromUtf8(cropProc->readAllStandardError()).toStdString();
    });

    connect(cropProc, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, [this, cropProc](int exitCode, QProcess::ExitStatus) {
        cropProc->deleteLater();

        if (exitCode == 0) {
            // Delete intermediate uncropped raw video
            if (QFile::exists(m_tempRawPath)) {
                QFile::remove(m_tempRawPath);
                std::cout << "[ClipFlow Helper] Removed intermediate raw temp file: "
                          << m_tempRawPath.toStdString() << std::endl;
            }

            emit progressUpdated(100, "", "");
            emit downloadFinished(m_finalOutputPath);
        } else {
            emit downloadFailed(QString("FFmpeg cropping failed with code %1").arg(exitCode));
        }
    });

    cropProc->start(m_ffmpegBin, args);
}

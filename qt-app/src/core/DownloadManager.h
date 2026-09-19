#pragma once

#include <QObject>
#include <QString>
#include <QProcess>
#include <QJsonObject>
#include <QRegularExpression>

struct DownloadOptions {
    QString url;
    QString format = "mp4";
    QString quality = "1080p";
    QString audioQuality = "0";
    double trimStart = 0;
    double trimEnd = -1;
    QString aspectRatio = "16:9";
    QString fitMode = "pad";
    QString customFileName;
};

class DownloadManager : public QObject {
    Q_OBJECT

public:
    explicit DownloadManager(QObject *parent = nullptr);
    ~DownloadManager() override = default;

    void setBinaryPaths(const QString &ytDlp, const QString &ffmpeg);
    void startDownload(const DownloadOptions &options);
    void cancelCurrentDownload();

signals:
    void downloadStarted(const QString &title);
    void progressUpdated(int percent, const QString &speed, const QString &eta);
    void processingStarted(const QString &message);
    void downloadFinished(const QString &finalFilePath);
    void downloadFailed(const QString &errorMessage);

private slots:
    void handleProcessOutput();
    void handleProcessFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void runFfmpegCropping();

private:
    QString formatSeconds(double seconds) const;
    QString getAspectFilter(const QString &ratio, const QString &mode) const;

    QString m_ytDlpBin;
    QString m_ffmpegBin;
    DownloadOptions m_currentOptions;

    QProcess *m_process = nullptr;
    QString m_tempRawPath;
    QString m_finalOutputPath;
    bool m_isAudio = false;
    bool m_needsCrop = false;

    QRegularExpression m_progressRegex;
};

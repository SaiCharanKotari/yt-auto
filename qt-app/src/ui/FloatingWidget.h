#pragma once

#include <QWidget>
#include <QPixmap>
#include <QPoint>
#include <QString>
#include <QTimer>
#include <QMenu>

enum class WidgetState {
    Idle,
    DownloadingDeps,
    Downloading,
    Processing,
    Completed,
    Error
};

class FloatingWidget : public QWidget {
    Q_OBJECT

public:
    explicit FloatingWidget(QWidget *parent = nullptr);
    ~FloatingWidget() override = default;

public slots:
    void setProgress(int percentage, const QString &speed = QString(), const QString &eta = QString());
    void setDownloadStarting(const QString &title);
    void setProcessing(const QString &message);
    void setDownloadComplete(const QString &filePath);
    void setDownloadError(const QString &errorMsg);
    void setDependencyDownloadProgress(const QString &depName, int percentage);

protected:
    void paintEvent(QPaintEvent *event) override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void contextMenuEvent(QContextMenuEvent *event) override;
    void enterEvent(QEnterEvent *event) override;
    void leaveEvent(QEvent *event) override;

private:
    void setupUI();
    void resetToIdle();

    WidgetState m_state = WidgetState::Idle;
    int m_progress = 0;
    QString m_statusText;
    QString m_speedText;
    QString m_currentTitle;
    QPixmap m_logo;
    QPoint m_dragPosition;
    bool m_isHovered = false;
    QTimer m_revertTimer;
};

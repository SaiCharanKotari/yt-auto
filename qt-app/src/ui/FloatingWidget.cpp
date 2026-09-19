#include "FloatingWidget.h"
#include <QPainter>
#include <QPainterPath>
#include <QMouseEvent>
#include <QDesktopServices>
#include <QUrl>
#include <QStandardPaths>
#include <QApplication>
#include <QLinearGradient>
#include <QConicalGradient>
#include <QScreen>
#include <QGuiApplication>

FloatingWidget::FloatingWidget(QWidget *parent)
    : QWidget(parent)
{
    setupUI();
    m_logo.load(":/resources/logo.png");

    m_revertTimer.setSingleShot(true);
    connect(&m_revertTimer, &QTimer::timeout, this, &FloatingWidget::resetToIdle);
}

void FloatingWidget::setupUI() {
    setFixedSize(76, 76);
    setWindowFlags(Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint | Qt::Tool);
    setAttribute(Qt::WA_TranslucentBackground, true);
    setMouseTracking(true);

    // Position in bottom-right corner by default
    if (QScreen *screen = QGuiApplication::primaryScreen()) {
        QRect geom = screen->availableGeometry();
        move(geom.right() - width() - 16, geom.bottom() - height() - 36);
    }
}

void FloatingWidget::setProgress(int percentage, const QString &speed, const QString &eta) {
    m_state = WidgetState::Downloading;
    m_progress = qBound(0, percentage, 100);
    m_speedText = speed;
    m_statusText = eta.isEmpty() ? QString("%1%").arg(m_progress) : QString("%1%").arg(m_progress);
    m_revertTimer.stop();
    update();
}

void FloatingWidget::setDownloadStarting(const QString &title) {
    m_state = WidgetState::Downloading;
    m_currentTitle = title;
    m_progress = 0;
    m_statusText = "0%";
    m_speedText = "Starting...";
    m_revertTimer.stop();
    update();
}

void FloatingWidget::setProcessing(const QString &message) {
    m_state = WidgetState::Processing;
    m_statusText = "Crop";
    m_speedText = message;
    m_revertTimer.stop();
    update();
}

void FloatingWidget::setDownloadComplete(const QString &filePath) {
    Q_UNUSED(filePath);
    m_state = WidgetState::Completed;
    m_progress = 100;
    m_statusText = "Done!";
    m_speedText = "Saved";
    m_revertTimer.start(3000);
    update();
}

void FloatingWidget::setDownloadError(const QString &errorMsg) {
    m_state = WidgetState::Error;
    m_statusText = "Error";
    m_speedText = errorMsg.left(10);
    m_revertTimer.start(3500);
    update();
}

void FloatingWidget::setDependencyDownloadProgress(const QString &depName, int percentage) {
    m_state = WidgetState::DownloadingDeps;
    m_progress = qBound(0, percentage, 100);
    m_statusText = QString("%1%").arg(m_progress);
    m_speedText = depName;
    m_revertTimer.stop();
    update();
}

void FloatingWidget::resetToIdle() {
    m_state = WidgetState::Idle;
    m_progress = 0;
    m_statusText.clear();
    m_speedText.clear();
    m_currentTitle.clear();
    update();
}

void FloatingWidget::paintEvent(QPaintEvent *event) {
    Q_UNUSED(event);

    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setRenderHint(QPainter::SmoothPixmapTransform);

    const int w = width();
    const int h = height();
    const QRectF rect(2.5, 2.5, w - 5, h - 5);

    // 1. Draw 1:1 Rounded Glassmorphic Background Card
    QPainterPath bgPath;
    bgPath.addRoundedRect(rect, 18, 18);

    // Gradient fill
    QLinearGradient bgGrad(0, 0, w, h);
    if (m_state == WidgetState::Completed) {
        bgGrad.setColorAt(0, QColor(8, 28, 18, 250));
        bgGrad.setColorAt(1, QColor(4, 14, 9, 250));
    } else if (m_state == WidgetState::Error) {
        bgGrad.setColorAt(0, QColor(32, 10, 15, 250));
        bgGrad.setColorAt(1, QColor(14, 4, 7, 250));
    } else {
        bgGrad.setColorAt(0, QColor(18, 14, 32, m_isHovered ? 252 : 242));
        bgGrad.setColorAt(1, QColor(8, 11, 20, m_isHovered ? 252 : 242));
    }

    painter.fillPath(bgPath, bgGrad);

    // Outer border
    QColor borderColor = (m_state == WidgetState::Completed) ? QColor(52, 211, 153, 200)
                       : (m_state == WidgetState::Error)     ? QColor(248, 113, 113, 200)
                       : (m_state == WidgetState::Downloading || m_state == WidgetState::DownloadingDeps || m_state == WidgetState::Processing) ? QColor(168, 85, 247, 220)
                       : QColor(255, 255, 255, m_isHovered ? 80 : 35);
    painter.strokePath(bgPath, QPen(borderColor, m_isHovered ? 1.4 : 1.0));

    // 2. State-Driven Center Content
    if (m_state == WidgetState::Idle) {
        // Render Clean Cropped Logo (52x52)
        if (!m_logo.isNull()) {
            int logoSize = 52;
            int offset = (w - logoSize) / 2;
            QRect logoRect(offset, offset, logoSize, logoSize);
            painter.drawPixmap(logoRect, m_logo);
        } else {
            painter.setPen(QColor(255, 255, 255, 230));
            QFont font("Segoe UI", 13, QFont::Bold);
            painter.setFont(font);
            painter.drawText(rect, Qt::AlignCenter, "CF");
        }

        // Emerald Online status dot with glow
        painter.setBrush(QColor(16, 185, 129, 60));
        painter.setPen(Qt::NoPen);
        painter.drawEllipse(QPointF(w - 12, 12), 4.5, 4.5);
        painter.setBrush(QColor(16, 185, 129));
        painter.drawEllipse(QPointF(w - 12, 12), 2.5, 2.5);

    } else if (m_state == WidgetState::Downloading || m_state == WidgetState::DownloadingDeps || m_state == WidgetState::Processing) {
        // Render Circular Progress Ring
        const qreal ringMargin = 8.0;
        const QRectF ringRect(ringMargin, ringMargin, w - 2 * ringMargin, h - 2 * ringMargin);
        const qreal strokeWidth = 4.0;

        // Background Ring Track
        QPen trackPen(QColor(255, 255, 255, 20), strokeWidth, Qt::SolidLine, Qt::RoundCap);
        painter.setPen(trackPen);
        painter.setBrush(Qt::NoBrush);
        painter.drawEllipse(ringRect);

        // Active Progress Arc
        if (m_progress > 0 || m_state == WidgetState::Processing) {
            QConicalGradient grad(w / 2.0, h / 2.0, 90.0);
            grad.setColorAt(0.0, QColor(168, 85, 247));  // Purple
            grad.setColorAt(0.5, QColor(236, 72, 153));  // Pink
            grad.setColorAt(1.0, QColor(99, 102, 241));  // Indigo

            QPen progPen(QBrush(grad), strokeWidth, Qt::SolidLine, Qt::RoundCap);
            painter.setPen(progPen);

            int startAngle = 90 * 16;
            int spanAngle = -static_cast<int>((m_progress / 100.0) * 360.0 * 16);
            if (m_state == WidgetState::Processing) {
                spanAngle = -static_cast<int>(360.0 * 16);
            }
            painter.drawArc(ringRect, startAngle, spanAngle);
        }

        // Center Percentage Number
        painter.setPen(Qt::white);
        QFont numFont("Segoe UI", 11, QFont::Bold);
        painter.setFont(numFont);
        QRectF numRect(0, h / 2 - 14, w, 18);
        painter.drawText(numRect, Qt::AlignCenter, m_statusText);

        // Speed / ETA Subtitle
        if (!m_speedText.isEmpty()) {
            painter.setPen(QColor(200, 200, 225, 190));
            QFont subFont("Segoe UI", 6, QFont::DemiBold);
            painter.setFont(subFont);
            QRectF subRect(0, h / 2 + 3, w, 12);
            painter.drawText(subRect, Qt::AlignCenter, m_speedText);
        }

    } else if (m_state == WidgetState::Completed) {
        painter.setPen(QPen(QColor(52, 211, 153), 2.2));
        QFont iconFont("Segoe UI", 16, QFont::Bold);
        painter.setFont(iconFont);
        painter.drawText(QRectF(0, h / 2 - 16, w, 20), Qt.AlignCenter, "✓");

        painter.setPen(QColor(180, 255, 210));
        QFont textFont("Segoe UI", 7, QFont::Bold);
        painter.setFont(textFont);
        QRectF textRect(0, h / 2 + 5, w, 12);
        painter.drawText(textRect, Qt::AlignCenter, "Saved!");

    } else if (m_state == WidgetState::Error) {
        painter.setPen(QPen(QColor(248, 113, 113), 2.2));
        QFont iconFont("Segoe UI", 14, QFont::Bold);
        painter.setFont(iconFont);
        painter.drawText(QRectF(0, h / 2 - 16, w, 20), Qt.AlignCenter, "✕");

        painter.setPen(QColor(255, 190, 190));
        QFont textFont("Segoe UI", 7, QFont::Bold);
        painter.setFont(textFont);
        QRectF textRect(0, h / 2 + 5, w, 12);
        painter.drawText(textRect, Qt::AlignCenter, "Error");
    }
}


void FloatingWidget::mousePressEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton) {
        m_dragPosition = event->globalPosition().toPoint() - frameGeometry().topLeft();
        event->accept();
    }
}

void FloatingWidget::mouseMoveEvent(QMouseEvent *event) {
    if (event->buttons() & Qt::LeftButton) {
        move(event->globalPosition().toPoint() - m_dragPosition);
        event->accept();
    }
}

void FloatingWidget::mouseReleaseEvent(QMouseEvent *event) {
    Q_UNUSED(event);
}

void FloatingWidget::contextMenuEvent(QContextMenuEvent *event) {
    QMenu menu(this);
    menu.setStyleSheet(
        "QMenu { background-color: #0f1422; color: #ffffff; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 4px; }"
        "QMenu::item { padding: 6px 20px; border-radius: 4px; font-size: 11px; }"
        "QMenu::item:selected { background-color: #8b5cf6; }"
    );

    QAction *openDownloads = menu.addAction("📂 Open Downloads Folder");
    menu.addSeparator();
    QAction *resetPos = menu.addAction("🎯 Reset Widget Position");
    menu.addSeparator();
    QAction *quitApp = menu.addAction("✕ Exit ClipFlow Helper");

    QAction *selected = menu.exec(event->globalPos());
    if (selected == openDownloads) {
        QString dlPath = QStandardPaths::writableLocation(QStandardPaths::DownloadLocation);
        QDesktopServices::openUrl(QUrl::fromLocalFile(dlPath));
    } else if (selected == resetPos) {
        if (QScreen *screen = QGuiApplication::primaryScreen()) {
            QRect geom = screen->availableGeometry();
            move(geom.right() - width() - 25, geom.bottom() - height() - 50);
        }
    } else if (selected == quitApp) {
        qApp->quit();
    }
}

void FloatingWidget::enterEvent(QEnterEvent *event) {
    Q_UNUSED(event);
    m_isHovered = true;
    update();
}

void FloatingWidget::leaveEvent(QEvent *event) {
    Q_UNUSED(event);
    m_isHovered = false;
    update();
}

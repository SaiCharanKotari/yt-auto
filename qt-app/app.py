"""
ClipFlow Desktop Helper - 1:1 Floating Desktop Companion Widget
Captures web download requests from ClipFlow Web App on port 18942
and handles real-time circular download progress, trimming, and aspect ratio cropping.
"""

import sys
import os
import time
import json
import re
import shutil
import subprocess
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import urllib.request
import functools
import random
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler

# Platform-specific handlers
try:
    from handlers import (
        build_universal_download_args,
        build_universal_metadata_args,
        extract_twitch_live_segment,
        is_twitch_live_channel,
    )
except ImportError:
    from .handlers import (
        build_universal_download_args,
        build_universal_metadata_args,
        extract_twitch_live_segment,
        is_twitch_live_channel,
    )

# Unbuffered instant console printing
_orig_print = print
print = functools.partial(_orig_print, flush=True)

# Ensure Windows stdout supports UTF-8 cleanly if console is present
if sys.platform == "win32":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from PyQt6.QtWidgets import QApplication, QWidget, QMenu
    from PyQt6.QtCore import Qt, QPoint, QPointF, QRectF, QTimer, pyqtSignal, QObject, QPropertyAnimation, QEasingCurve
    from PyQt6.QtGui import (
        QPainter, QPainterPath, QColor, QLinearGradient, QConicalGradient,
        QPen, QBrush, QFont, QPixmap, QIcon, QDesktopServices, QGuiApplication
    )
    from PyQt6.QtCore import QUrl
except ImportError:
    try:
        from PySide6.QtWidgets import QApplication, QWidget, QMenu
        from PySide6.QtCore import Qt, QPoint, QPointF, QRectF, QTimer, Signal as pyqtSignal, QObject, QPropertyAnimation, QEasingCurve
        from PySide6.QtGui import (
            QPainter, QPainterPath, QColor, QLinearGradient, QConicalGradient,
            QPen, QBrush, QFont, QPixmap, QIcon, QDesktopServices, QGuiApplication
        )
        from PySide6.QtCore import QUrl
    except ImportError:
        print("[ClipFlow] PyQt6 or PySide6 is required. Run: pip install PyQt6 or pip install PySide6")
        sys.exit(1)

# Paths & User Data Folders
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).parent
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
else:
    APP_DIR = Path(__file__).resolve().parent
    BUNDLE_DIR = APP_DIR

# Dedicated Persistent AppData & Program Folders
SYS_LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
LOCAL_APPDATA = SYS_LOCAL_APPDATA / "ClipFlow"
PROGRAMS_BIN_DIR = SYS_LOCAL_APPDATA / "Programs" / "ClipFlow" / "bin"
LOCAL_BIN_DIR = LOCAL_APPDATA / "bin"
LOGS_DIR = LOCAL_APPDATA / "logs"
JOBS_DIR = LOCAL_APPDATA / "jobs"
DOWNLOADS_DIR = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Downloads"

PROGRAMS_BIN_DIR.mkdir(parents=True, exist_ok=True)
LOCAL_BIN_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOGS_DIR / "clipflow_helper.log"
logger = logging.getLogger("ClipFlowHelper")
logger.setLevel(logging.INFO)
file_handler = RotatingFileHandler(str(LOG_FILE), maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8")
file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

if sys.stdout and hasattr(sys.stdout, "write"):
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(file_formatter)
    logger.addHandler(console_handler)

def log_print(*args, **kwargs):
    msg = " ".join(str(a) for a in args)
    logger.info(msg)

print = log_print

def handle_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    logger.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))

sys.excepthook = handle_exception

SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

# Binary Resolution
def resolve_binary(name: str) -> Path:
    candidates = [
        APP_DIR / "bin" / name,
        BUNDLE_DIR / "bin" / name,
        PROGRAMS_BIN_DIR / name,
        LOCAL_BIN_DIR / name,
        APP_DIR / name,
        BUNDLE_DIR / name,
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c
    found = shutil.which(name)
    if found:
        return Path(found)
    return PROGRAMS_BIN_DIR / name

def get_yt_dlp_bin() -> Path:
    return resolve_binary("yt-dlp.exe")

def get_ffmpeg_bin() -> Path:
    return resolve_binary("ffmpeg.exe")

YT_DLP_BIN = get_yt_dlp_bin()
FFMPEG_BIN = get_ffmpeg_bin()
BIN_DIR = FFMPEG_BIN.parent if FFMPEG_BIN.exists() else PROGRAMS_BIN_DIR

# Copy from backend if running in dev mode
BACKEND_DIR = APP_DIR.parent / "backend"
if not YT_DLP_BIN.exists() and (BACKEND_DIR / "yt-dlp.exe").exists():
    shutil.copy(str(BACKEND_DIR / "yt-dlp.exe"), str(LOCAL_BIN_DIR / "yt-dlp.exe"))
    YT_DLP_BIN = get_yt_dlp_bin()
if not FFMPEG_BIN.exists() and (BACKEND_DIR / "ffmpeg.exe").exists():
    shutil.copy(str(BACKEND_DIR / "ffmpeg.exe"), str(LOCAL_BIN_DIR / "ffmpeg.exe"))
    FFMPEG_BIN = get_ffmpeg_bin()

LOGO_PATH = BUNDLE_DIR / "resources" / "logo.png"
if not LOGO_PATH.exists():
    LOGO_PATH = APP_DIR / "resources" / "logo.png"
if not LOGO_PATH.exists():
    LOGO_PATH = APP_DIR / "yt-dlp logo.png"

APP_VERSION = "1.0.0"


def parse_semver(v: str):
    m = re.findall(r"\d+", str(v))
    return tuple(map(int, m)) if m else (0, 0, 0)


def is_newer_version(remote_ver: str, current_ver: str) -> bool:
    return parse_semver(remote_ver) > parse_semver(current_ver)


def check_and_apply_updates():
    """Background thread: periodically checks backend for newer versions and auto-updates without requiring user re-downloads."""
    import urllib.request
    time.sleep(4)

    update_endpoints = [
        "https://clipflow.com/api/app/update-check",
        "https://app.clipflow.com/api/app/update-check",
        "http://localhost:3001/api/app/update-check",
        "http://127.0.0.1:3001/api/app/update-check",
    ]

    while True:
        for url in update_endpoints:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": f"ClipFlowHelper/{APP_VERSION}"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        remote_ver = data.get("version", "")
                        download_url = data.get("downloadUrl", "")

                        if remote_ver and is_newer_version(remote_ver, APP_VERSION) and download_url:
                            print(f"\n[ClipFlow Updater] New update available: v{remote_ver} (Current: v{APP_VERSION})")
                            print(f"[ClipFlow Updater] Auto-downloading patch from: {download_url}...")

                            temp_exe = Path(os.environ.get("TEMP", str(Path.home()))) / f"ClipFlowHelper_v{remote_ver}.exe"
                            urllib.request.urlretrieve(download_url, str(temp_exe))

                            if temp_exe.exists() and temp_exe.stat().st_size > 10000:
                                current_exe = sys.executable if getattr(sys, "frozen", False) else (APP_DIR / "ClipFlowHelper.exe")
                                bat_path = Path(os.environ.get("TEMP", str(Path.home()))) / "clipflow_update.bat"
                                bat_content = f"""@echo off
timeout /t 2 /nobreak > NUL
copy /y "{temp_exe}" "{current_exe}"
start "" "{current_exe}"
del "{temp_exe}"
del "%~f0"
"""
                                bat_path.write_text(bat_content, encoding="utf-8")
                                print(f"[ClipFlow Updater] Update ready. Restarting application seamlessly...")
                                flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                                subprocess.Popen(["cmd.exe", "/c", str(bat_path)], creationflags=flags)
                                sys.exit(0)
                        break
            except Exception:
                pass

        # Check every 60 minutes
        time.sleep(3600)


def ensure_dependencies_in_background():
    """Background thread: ensures yt-dlp, ffmpeg, and ffprobe are downloaded and ready on fresh empty computers."""
    global YT_DLP_BIN, FFMPEG_BIN, FFPROBE_BIN, BIN_DIR
    import zipfile

    # 1. yt-dlp.exe
    current_yt = get_yt_dlp_bin()
    if not current_yt.exists():
        try:
            print("[ClipFlow Deps] First-run: downloading yt-dlp.exe...")
            target = LOCAL_BIN_DIR / "yt-dlp.exe"
            url = "https://drive.usercontent.google.com/download?id=1MV8P5WJ7YMk0IwUGmyoWt4FKnJmQI2vs&export=download&confirm=t"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as resp, open(str(target), "wb") as f:
                f.write(resp.read())
            YT_DLP_BIN = get_yt_dlp_bin()
            print(f"[ClipFlow Deps] yt-dlp.exe ready -> {YT_DLP_BIN}")
        except Exception as e:
            print(f"[ClipFlow Deps] [ERROR] downloading yt-dlp: {e}")

    # 2. ffmpeg.exe
    current_ffmpeg = get_ffmpeg_bin()
    if not current_ffmpeg.exists():
        try:
            print("[ClipFlow Deps] First-run: downloading FFmpeg engine...")
            target = LOCAL_BIN_DIR / "ffmpeg.exe"
            url = "https://drive.usercontent.google.com/download?id=1LLfNgL6Y9R_oEXc8ODDhd1CpmNkwMT1Q&export=download&confirm=t"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=180) as resp, open(str(target), "wb") as f:
                f.write(resp.read())

            FFMPEG_BIN = get_ffmpeg_bin()
            BIN_DIR = FFMPEG_BIN.parent
            print(f"[ClipFlow Deps] FFmpeg engine ready -> {LOCAL_BIN_DIR}")
        except Exception as e:
            print(f"[ClipFlow Deps] [ERROR] downloading FFmpeg: {e}")


def format_seconds(seconds: float) -> str:
    s = max(0, int(seconds))
    hrs = s // 3600
    mins = (s % 3600) // 60
    secs = s % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"


def get_aspect_filter(ratio: str, mode: str = "pad", crop_pos: str = "center", crop_box: dict = None) -> str:
    if not ratio or ratio in ["16:9", "original"]:
        return ""
    if mode != "pad" and crop_box and isinstance(crop_box, dict) and float(crop_box.get("width", 0)) > 0 and float(crop_box.get("height", 0)) > 0:
        w = f"{max(0.05, min(1.0, float(crop_box['width']))):.4f}"
        h = f"{max(0.05, min(1.0, float(crop_box['height']))):.4f}"
        x = f"{max(0.0, min(1.0, float(crop_box.get('x', 0)))):.4f}"
        y = f"{max(0.0, min(1.0, float(crop_box.get('y', 0)))):.4f}"
        return f"crop=trunc(iw*{w}/2)*2:trunc(ih*{h}/2)*2:trunc(iw*{x}/2)*2:trunc(ih*{y}/2)*2"
    is_crop = (mode == "crop")
    if ratio == "9:16":
        if is_crop:
            if crop_pos == "left":
                return "crop=trunc(ih*(9/16)/2)*2:ih:0:0"
            elif crop_pos == "right":
                return "crop=trunc(ih*(9/16)/2)*2:ih:iw-trunc(ih*(9/16)/2)*2:0"
            else:
                return "crop=trunc(ih*(9/16)/2)*2:ih:(iw-trunc(ih*(9/16)/2)*2)/2:0"
        else:
            return "pad=ceil(max(iw\\,ih*9/16)/2)*2:ceil(max(ih\\,iw*16/9)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black"
    elif ratio == "1:1":
        if is_crop:
            if crop_pos == "left":
                return "crop=min(iw\\,ih):min(iw\\,ih):0:(ih-min(iw\\,ih))/2"
            elif crop_pos == "right":
                return "crop=min(iw\\,ih):min(iw\\,ih):iw-min(iw\\,ih):(ih-min(iw\\,ih))/2"
            else:
                return "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2"
        else:
            return "pad=ceil(max(iw\\,ih)/2)*2:ceil(max(ih\\,iw)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black"
    elif ratio == "4:5":
        if is_crop:
            if crop_pos == "left":
                return "crop=trunc(ih*(4/5)/2)*2:ih:0:0"
            elif crop_pos == "right":
                return "crop=trunc(ih*(4/5)/2)*2:ih:iw-trunc(ih*(4/5)/2)*2:0"
            else:
                return "crop=trunc(ih*(4/5)/2)*2:ih:(iw-trunc(ih*(4/5)/2)*2)/2:0"
        else:
            return "pad=ceil(max(iw\\,ih*4/5)/2)*2:ceil(max(ih\\,iw*5/4)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black"
    return ""


ALLOWED_ORIGINS = {
    "https://clipflow.com",
    "https://www.clipflow.com",
    "https://app.clipflow.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
}


def is_origin_allowed(origin: str) -> bool:
    if not origin or origin == "null" or origin == "*":
        return True
    origin = origin.strip().rstrip("/").lower()
    if origin in ALLOWED_ORIGINS:
        return True
    if origin.endswith(".clipflow.com") and (origin.startswith("https://") or origin.startswith("http://")):
        return True
    # Allow local development ports
    if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
        return True
    return True


class ServerBridge(QObject):
    download_requested = pyqtSignal(dict)
    progress_updated = pyqtSignal(int, str, str)
    processing_updated = pyqtSignal(str)
    completed = pyqtSignal()
    error_occurred = pyqtSignal(str)
    show_ui_requested = pyqtSignal()
    hide_ui_requested = pyqtSignal()


server_bridge = ServerBridge()


class LocalHTTPRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict, origin: str = "*"):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(encoded)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            print(f"[ClipFlow Helper] [INFO] Client disconnected before response delivery")

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "*")
        if self.path not in ["/status", "/health", "/"]:
            print(f"[RECV] OPTIONS {self.path}")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, Accept")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path == "/twitch/live-segment":
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, Accept")
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Cache-Control", "public, max-age=300")
            self.send_header("Connection", "close")
            self.end_headers()
        elif parsed.path in ["/status", "/health", "/"]:
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.send_header("Connection", "close")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        origin = self.headers.get("Origin", "")
        parsed = urlparse(self.path)

        if parsed.path in ["/status", "/health", "/"]:
            resp_body = {"status": "ok", "app": "ClipFlowHelper", "version": "1.0.0"}
            self._send_json(200, resp_body, origin)
            return

        print(f"[RECV] GET {self.path}")
        if not is_origin_allowed(origin):
            print(f"[ERR] 403 Forbidden - Origin '{origin}' not permitted")
            self._send_json(403, {"error": "Forbidden: Unauthorized Origin"}, origin)
            return

        if parsed.path == "/twitch/live-segment":
            # Live chunks are streamed in background; ensure UI is hidden
            server_bridge.hide_ui_requested.emit()
            import urllib.parse
            query_params = urllib.parse.parse_qs(parsed.query)
            target_url = query_params.get("url", [""])[0].strip()
            if not target_url:
                self._send_json(400, {"error": "Missing 'url' query parameter"}, origin)
                return

            if not is_twitch_live_channel(target_url):
                self._send_json(400, {"error": "Only live channel URLs are supported. Use /metadata for VODs and clips."}, origin)
                return

            try:
                start_time = max(0, int(query_params.get("t", ["0"])[0]))
            except (ValueError, IndexError):
                start_time = 0

            try:
                chunk_duration = min(20, max(2, int(query_params.get("dur", ["5"])[0])))
            except (ValueError, IndexError):
                chunk_duration = 5

            if not YT_DLP_BIN.exists() or not FFMPEG_BIN.exists():
                self._send_json(500, {"error": "yt-dlp or ffmpeg engine missing on local machine"}, origin)
                return

            chunks_dir = LOCAL_APPDATA / "temp" / "live-chunks"
            chunks_dir.mkdir(parents=True, exist_ok=True)

            print(f"[CHUNK] Extracting live segment: {target_url} @ t={start_time}s (dur={chunk_duration}s)")
            success, chunk_path, err_msg = extract_twitch_live_segment(
                target_url,
                start_time,
                chunk_duration,
                str(YT_DLP_BIN),
                str(FFMPEG_BIN),
                chunks_dir=chunks_dir
            )

            if not success or not chunk_path or not os.path.exists(chunk_path):
                print(f"[ERR] Live chunk extraction failed: {err_msg}")
                self._send_json(500, {"error": err_msg or "Failed to extract live Twitch chunk via local engine"}, origin)
                return

            try:
                size = os.path.getsize(chunk_path)
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization")
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(size))
                self.send_header("Cache-Control", "public, max-age=300")
                self.send_header("X-Chunk-Start", str(start_time))
                self.send_header("X-Chunk-Duration", str(chunk_duration))
                self.send_header("Connection", "close")
                self.end_headers()

                with open(chunk_path, "rb") as f:
                    shutil.copyfileobj(f, self.wfile)
                print(f"[SEND] Chunk @ t={start_time}s delivered ({size // 1024}KB)")
            except Exception as e:
                print(f"[ERR] Streaming live chunk: {e}")
        else:
            self._send_json(404, {"error": f"Endpoint '{self.path}' not found"}, origin)
            print(f"[ERR] 404 Not Found: {self.path}")

    def do_POST(self):
        origin = self.headers.get("Origin", "")
        print(f"[RECV] POST {self.path}")
        if not is_origin_allowed(origin):
            print(f"[ClipFlow Helper] [REJECT] 403 Forbidden - Origin '{origin}' not permitted")
            self._send_json(403, {"error": "Forbidden: Unauthorized Origin"}, origin)
            return

        parsed = urlparse(self.path)
        clean_path = parsed.path.rstrip("/")
        if clean_path in ["/metadata", "/api/video/metadata"]:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
                url = data.get("url", "").strip()
                print(f"[ClipFlow Helper] [METADATA REQ] URL: {url}")
                if not url or not (url.startswith("http://") or url.startswith("https://")):
                    raise ValueError("Invalid video URL")

                cmd = [str(YT_DLP_BIN)] + build_universal_metadata_args(url, str(FFMPEG_BIN.parent))
                print(f"[ClipFlow Helper] [EXEC] Running: {' '.join(cmd)}")
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    creationflags=SUBPROCESS_FLAGS
                )
                if proc.returncode == 0:
                    meta = json.loads(proc.stdout)
                    response = {
                        "id": meta.get("id"),
                        "title": meta.get("title"),
                        "thumbnail": meta.get("thumbnail"),
                        "duration": meta.get("duration"),
                        "duration_string": meta.get("duration_string"),
                        "uploader": meta.get("uploader"),
                        "view_count": meta.get("view_count"),
                        "upload_date": meta.get("upload_date"),
                        "formats": [
                            {
                                "format_id": f.get("format_id"),
                                "ext": f.get("ext"),
                                "resolution": f.get("resolution"),
                                "height": f.get("height"),
                                "filesize": f.get("filesize"),
                                "vcodec": f.get("vcodec"),
                                "acodec": f.get("acodec"),
                                "format_note": f.get("format_note"),
                                "tbr": f.get("tbr"),
                                "url": f.get("url"),
                            }
                            for f in meta.get("formats", [])
                        ]
                    }
                    self._send_json(200, response, origin)
                    print(f"[ClipFlow Helper] <-- RESP 200 OK -> Metadata returned: '{response.get('title')}' ({len(response.get('formats', []))} formats)")
                else:
                    err_msg = proc.stderr or "Metadata extraction failed"
                    self._send_json(500, {"error": err_msg}, origin)
                    print(f"[ClipFlow Helper] [ERROR] 500 -> {err_msg[:200]}")
            except Exception as e:
                self._send_json(400, {"error": str(e)}, origin)
                print(f"[ClipFlow Helper] [ERROR] 400 Bad Request -> {e}")
        elif clean_path in ["/download", "/api/video/download"]:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
                print(f"[ClipFlow Helper] [DOWNLOAD REQ] Payload Received:")
                print(json.dumps(data, indent=2))
                url = data.get("url", "").strip()
                if not url or not (url.startswith("http://") or url.startswith("https://")):
                    raise ValueError("Invalid media URL")

                server_bridge.download_requested.emit(data)
                resp = {"success": True, "message": "Captured by ClipFlow Helper!"}
                self._send_json(200, resp, origin)
                print(f"[ClipFlow Helper] <-- RESP 200 OK -> Sent confirmation to Web App")
            except Exception as e:
                self._send_json(400, {"error": str(e)}, origin)
                print(f"[ClipFlow Helper] [ERROR] 400 Bad Request -> {e}")
        else:
            self._send_json(404, {"error": f"Endpoint '{self.path}' not found"}, origin)
            print(f"[ClipFlow Helper] <-- RESP 404 Not Found for POST {self.path}")

    def log_message(self, format, *args):
        pass


class ResilientHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class IPCHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        if parsed.path == "/hide":
            server_bridge.hide_ui_requested.emit()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","action":"hidden"}')
            return

        if parsed.path == "/show":
            server_bridge.show_ui_requested.emit()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","action":"shown"}')
            return

        try:
            payload = json.loads(body)
            server_bridge.download_requested.emit(payload)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        except Exception as e:
            self.send_response(500)
            self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/hide":
            server_bridge.hide_ui_requested.emit()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","action":"hidden"}')
            return
        elif parsed.path == "/show":
            server_bridge.show_ui_requested.emit()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","action":"shown"}')
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


def start_ipc_server(port=18943):
    while True:
        try:
            server = ResilientHTTPServer(("127.0.0.1", port), IPCHandler)
            server.serve_forever()
        except Exception:
            time.sleep(1)


def start_http_server(port=18942):
    # If daemon is not running, fallback to listening on 18942
    try:
        server = ResilientHTTPServer(("127.0.0.1", port), LocalHTTPRequestHandler)
        print(f"[ClipFlow Helper] Local HTTP server listening on http://127.0.0.1:{port}")
        server.serve_forever()
    except Exception as e:
        print(f"[ClipFlow Helper] Port {port} notice: {e}")


class ContextPopup(QWidget):
    """Context menu: Solid black background, compact font, anchored at bottom-right corner of app."""

    POPUP_W   = 110
    ITEM_H    = 28
    FONT_PX   = 10
    RADIUS    = 4

    def __init__(self, parent, items: list, anchor_widget=None, global_pos: QPoint = None):
        super().__init__(parent, Qt.WindowType.Popup | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.items = items
        self._choice = -1
        self._hovered = -1

        total_h = self.ITEM_H * len(items)
        self.setFixedSize(self.POPUP_W, total_h)

        screen = QGuiApplication.primaryScreen()
        if anchor_widget:
            # Anchor at bottom-right corner of app widget so menu top-left connects to it
            br = anchor_widget.mapToGlobal(QPoint(anchor_widget.width(), anchor_widget.height()))
            x = br.x()
            y = br.y()
            if screen:
                sg = screen.availableGeometry()
                # If extending beyond bottom of screen, place above app widget
                if y + total_h > sg.bottom():
                    y = anchor_widget.mapToGlobal(QPoint(0, 0)).y() - total_h
                # If extending beyond right edge of screen, place to left or clamp
                if x + self.POPUP_W > sg.right():
                    left_x = anchor_widget.mapToGlobal(QPoint(0, 0)).x() - self.POPUP_W
                    if left_x >= sg.left():
                        x = left_x
                    else:
                        x = sg.right() - self.POPUP_W
                if x < sg.left():
                    x = sg.left()
            self.move(x, y)
        elif global_pos:
            if screen:
                sg = screen.availableGeometry()
                x = min(global_pos.x(), sg.right() - self.POPUP_W)
                y = min(global_pos.y(), sg.bottom() - total_h)
                self.move(x, y)
            else:
                self.move(global_pos)
        else:
            self.move(0, 0)

        self.setMouseTracking(True)

    def exec(self) -> int:
        self.show()
        import sys as _sys
        _qtcore = _sys.modules.get("PyQt6.QtCore") or _sys.modules.get("PySide6.QtCore")
        loop = _qtcore.QEventLoop()
        self.destroyed.connect(loop.quit)
        loop.exec()
        return self._choice

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        w, h = self.width(), self.height()
        r = self.RADIUS

        # Clip to rounded rect so hover/bg don't bleed outside corners
        clip = QPainterPath()
        clip.addRoundedRect(QRectF(0, 0, w, h), r, r)
        painter.setClipPath(clip)

        # Solid pure black background (no transparency)
        painter.setBrush(QColor(0, 0, 0, 255))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(QRectF(0, 0, w, h), r, r)

        # Smaller crisp font (10px)
        font = QFont("Segoe UI")
        font.setPixelSize(self.FONT_PX)
        font.setWeight(QFont.Weight.Medium)
        painter.setFont(font)

        for i, label in enumerate(self.items):
            y_top = i * self.ITEM_H
            item_rect = QRectF(0, y_top, w, self.ITEM_H)

            # Hover highlight
            if i == self._hovered:
                painter.setBrush(QColor(255, 255, 255, 25))
                painter.setPen(Qt.PenStyle.NoPen)
                painter.drawRect(item_rect)

            # Text centered, full width
            painter.setPen(QColor(235, 235, 235))
            painter.drawText(item_rect, Qt.AlignmentFlag.AlignCenter, label)

            # Subtle dark divider below each item except last
            if i < len(self.items) - 1:
                div_y = y_top + self.ITEM_H
                painter.setPen(QPen(QColor(35, 35, 40), 1.0))
                painter.drawLine(QPointF(0, div_y), QPointF(w, div_y))

        # Outer border: 1px subtle dark border
        painter.setClipping(False)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.setPen(QPen(QColor(45, 45, 50), 1.0))
        painter.drawRoundedRect(QRectF(0.5, 0.5, w - 1, h - 1), r, r)

    def mouseMoveEvent(self, event):
        idx = int(event.position().y()) // self.ITEM_H
        self._hovered = idx if 0 <= idx < len(self.items) else -1
        self.update()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            idx = int(event.position().y()) // self.ITEM_H
            if 0 <= idx < len(self.items):
                self._choice = idx
        self.close()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self.close()



class FloatingWidget(QWidget):
    def __init__(self, auto_close: bool = False):
        super().__init__()
        self.auto_close = auto_close
        self.state = "idle"  # idle, downloading, processing, completed, error
        self.progress = 0
        self.speed_text = ""
        self.status_text = ""
        self.is_hovered = False
        self.drag_position = QPoint()

        self.logo = QPixmap()
        if LOGO_PATH.exists():
            self.logo.load(str(LOGO_PATH))

        self._delay_timer = QTimer(self)
        self._delay_timer.setSingleShot(True)
        self._delay_timer.timeout.connect(self._start_fade_out)

        self._fade_anim = QPropertyAnimation(self, b"windowOpacity")
        self._fade_anim.finished.connect(self._on_fade_out_finished)

        self.revert_timer = QTimer(self)
        self.revert_timer.setSingleShot(True)
        self.revert_timer.timeout.connect(self.reset_to_idle)

        self.setup_ui()
        server_bridge.download_requested.connect(self.start_download_job)
        server_bridge.progress_updated.connect(self.set_progress)
        server_bridge.processing_updated.connect(self.set_processing)
        server_bridge.completed.connect(self.set_complete)
        server_bridge.error_occurred.connect(self.set_error)
        server_bridge.show_ui_requested.connect(self.display_ui)
        server_bridge.hide_ui_requested.connect(lambda: self.hide_ui(delay_ms=0))

    def setup_ui(self):
        # Compact, sleek 76x76 1:1 floating badge
        self.setFixedSize(76, 76)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setMouseTracking(True)

        screen = QGuiApplication.primaryScreen()
        if screen:
            geom = screen.availableGeometry()
            self.move(geom.right() - self.width() - 16, geom.bottom() - self.height() - 36)

    def display_ui(self):
        """Show the UI widget, canceling any pending fade-out."""
        if hasattr(self, "_delay_timer") and self._delay_timer.isActive():
            self._delay_timer.stop()
        if hasattr(self, "_fade_anim") and self._fade_anim.state() == QPropertyAnimation.State.Running:
            self._fade_anim.stop()
        self.setWindowOpacity(1.0)
        if not self.isVisible():
            self.show()
        self.raise_()
        self.activateWindow()
        self.update()

    def hide_ui(self, delay_ms: int = 0):
        """Hides the UI widget after an optional delay with a smooth fade-out."""
        if not self.isVisible() and self.windowOpacity() <= 0.01:
            return
        if hasattr(self, "_delay_timer") and self._delay_timer.isActive():
            self._delay_timer.stop()
        if hasattr(self, "_fade_anim") and self._fade_anim.state() == QPropertyAnimation.State.Running:
            self._fade_anim.stop()

        if delay_ms > 0:
            self._delay_timer.start(delay_ms)
        else:
            self._start_fade_out()

    def _start_fade_out(self):
        """Smoothly fades out opacity before hiding the widget."""
        if not self.isVisible():
            return
        if hasattr(self, "_fade_anim") and self._fade_anim.state() == QPropertyAnimation.State.Running:
            self._fade_anim.stop()

        self._fade_anim.setDuration(400)
        self._fade_anim.setStartValue(self.windowOpacity())
        self._fade_anim.setEndValue(0.0)
        self._fade_anim.setEasingCurve(QEasingCurve.Type.InOutQuad)
        self._fade_anim.start()

    def _on_fade_out_finished(self):
        self.hide()
        self.setWindowOpacity(1.0)
        self.reset_to_idle()
        if self.auto_close:
            QApplication.quit()

    def reset_to_idle(self):
        self.state = "idle"
        self.progress = 0
        self.status_text = ""
        self.speed_text = ""
        self.update()

    def set_progress(self, percent: int, speed: str = "", eta: str = ""):
        if self.state != "processing":
            self.state = "downloading"
        self.progress = max(0, min(100, percent))
        self.speed_text = speed
        self.status_text = f"{self.progress}%"
        self.revert_timer.stop()
        self.update()

    def set_processing(self, msg: str = "Cropping..."):
        self.state = "processing"
        self.status_text = "0%"
        self.progress = 0
        self.speed_text = msg
        self.revert_timer.stop()
        self.update()

    def set_complete(self):
        self.state = "completed"
        self.progress = 100
        self.status_text = "Done!"
        self.speed_text = "Saved"
        self.update()
        # Wait 1 sec, then smoothly fade out
        self.hide_ui(delay_ms=1000)

    def set_error(self, err: str = "Failed"):
        self.state = "error"
        self.status_text = "Error"
        self.speed_text = err[:10]
        self.update()
        # Give user time to see error status, then fade out
        self.hide_ui(delay_ms=2000)

    def start_download_job(self, options: dict):
        # ── Wake Up & Display Engine Widget for download ─────────────────────
        self.display_ui()
        threading.Thread(target=self._run_download_pipeline, args=(options,), daemon=True).start()

    def _run_download_pipeline(self, options: dict):
        url = options.get("url", "")
        fmt = options.get("format", "mp4")
        quality = options.get("quality", "1080p")
        audio_quality = str(options.get("audioQuality", "0"))
        trim_start = float(options.get("trimStart", 0))
        trim_end = float(options.get("trimEnd", -1))
        aspect_ratio = options.get("aspectRatio", "16:9")
        fit_mode = options.get("fitMode", "pad")
        crop_position = options.get("cropPosition", "center")
        custom_name = options.get("customFileName", "").strip() or "%(title)s"
        safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', custom_name).strip(". ")
        if not safe_name:
            safe_name = "clipflow_clip"

        # ── Captions Export (SRT / VTT / TXT) ──────────────────────────────────
        if fmt in ["srt", "vtt", "txt", "captions"]:
            target_ext = "vtt" if fmt == "vtt" else ("txt" if fmt == "txt" else "srt")
            final_out = DOWNLOADS_DIR / f"{safe_name}_clip.{target_ext}"
            if final_out.exists():
                counter = 1
                while (DOWNLOADS_DIR / f"{safe_name}_clip ({counter}).{target_ext}").exists():
                    counter += 1
                final_out = DOWNLOADS_DIR / f"{safe_name}_clip ({counter}).{target_ext}"

            server_bridge.progress_updated.emit(20, "Fetching...", "20%")
            lang = options.get("subtitleLang", "en") or "en"
            english_langs = "en,en-orig,en-US,en-GB,en-IN,en-CA,en-AU,en-IE,en-NZ,en-ZA,en-en"
            lang_arg = f"{lang},{english_langs}" if lang not in ["en", "auto"] else english_langs
            
            job_stamp = f"{int(time.time())}_{random.randint(1000, 9999)}"
            temp_prefix = BIN_DIR / f"subs_{job_stamp}"
            
            # Tier 1: Human uploaded subtitles (fast, high quality, no 429)
            sub_cmd1 = [
                str(YT_DLP_BIN),
                "--no-warnings",
                "--no-check-certificate",
                "--no-playlist",
                "--skip-download",
                "--ignore-errors",
                "--write-subs",
                "--sub-langs", f"{lang_arg},all",
                "-o", f"{temp_prefix}.%(ext)s",
                url
            ]
            print(f"[ClipFlow Helper] [CAPTIONS Tier 1] Running:\n  {' '.join(sub_cmd1)}")
            subprocess.run(sub_cmd1, capture_output=True, text=True)

            sub_files = list(BIN_DIR.glob(f"subs_{job_stamp}*"))

            # Tier 2: Auto-generated subtitles for targeted languages
            if not sub_files:
                print(f"[ClipFlow Helper] [CAPTIONS Tier 2] Downloading auto-subs for {lang_arg}...")
                sub_cmd2 = [
                    str(YT_DLP_BIN),
                    "--no-warnings",
                    "--no-check-certificate",
                    "--no-playlist",
                    "--skip-download",
                    "--ignore-errors",
                    "--write-auto-subs",
                    "--sub-langs", lang_arg,
                    "-o", f"{temp_prefix}.%(ext)s",
                    url
                ]
                subprocess.run(sub_cmd2, capture_output=True, text=True)
                sub_files = list(BIN_DIR.glob(f"subs_{job_stamp}*"))

            # Tier 3: Native auto-sub fallback
            if not sub_files:
                print(f"[ClipFlow Helper] [CAPTIONS Tier 3] Downloading native fallback auto-subs...")
                sub_cmd3 = [
                    str(YT_DLP_BIN),
                    "--no-warnings",
                    "--no-check-certificate",
                    "--no-playlist",
                    "--skip-download",
                    "--ignore-errors",
                    "--write-auto-subs",
                    "--sub-langs", f"auto,orig,{lang},en",
                    "-o", f"{temp_prefix}.%(ext)s",
                    url
                ]
                subprocess.run(sub_cmd3, capture_output=True, text=True)
                sub_files = list(BIN_DIR.glob(f"subs_{job_stamp}*"))

            server_bridge.progress_updated.emit(60, "Parsing...", "60%")

            # Find matching subtitle file
            raw_text = ""
            if sub_files:
                # Prefer human English .en.vtt/.en.srt, then auto .en-orig.vtt, .en-US.vtt, then any English, then any
                match_file = (
                    next((f for f in sub_files if f.name.endswith(".en.vtt") or f.name.endswith(".en.srt")), None) or
                    next((f for f in sub_files if ".en-orig." in f.name or ".en-US." in f.name or ".en-GB." in f.name or ".en-IN." in f.name or ".en-CA." in f.name or ".en-AU." in f.name), None) or
                    next((f for f in sub_files if ".en." in f.name or ".en-" in f.name or "-en." in f.name), None) or
                    next((f for f in sub_files if f.suffix in [".srt", ".vtt"]), None) or
                    sub_files[0]
                )
                try:
                    raw_text = match_file.read_text(encoding="utf-8", errors="replace")
                    print(f"[ClipFlow Helper] Successfully loaded subtitle file: {match_file.name} ({len(raw_text)} chars)")
                except Exception as e:
                    print(f"[ClipFlow Helper] Error reading subtitle file: {e}")
                for f in sub_files:
                    try: f.unlink(missing_ok=True)
                    except Exception: pass

            time_re_cue = re.compile(r"((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})")
            cues = []
            def parse_ts(ts_str):
                parts = ts_str.strip().replace(',', '.').split(':')
                if len(parts) == 3: return float(parts[0])*3600 + float(parts[1])*60 + float(parts[2])
                elif len(parts) == 2: return float(parts[0])*60 + float(parts[1])
                return float(parts[0])

            def clean_text(t):
                # Clean html tags, karaoke timestamps, html entities
                t = re.sub(r'<[^>]+>', '', t)
                t = t.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
                return t.strip()

            for block in raw_text.replace('\r\n', '\n').split('\n\n'):
                lines = [l.strip() for l in block.split('\n') if l.strip()]
                t_idx = next((i for i, l in enumerate(lines) if time_re_cue.search(l)), -1)
                if t_idx != -1:
                    m = time_re_cue.search(lines[t_idx])
                    st, et = parse_ts(m.group(1)), parse_ts(m.group(2))
                    txt_lines = [clean_text(l) for l in lines[t_idx+1:] if clean_text(l)]
                    txt = '\n'.join(txt_lines)
                    if txt and et >= st:
                        cues.append((st, et, txt))

            # Full length vs Trimmed
            is_full = trim_start <= 0 and (trim_end <= 0 or trim_end >= 99999)
            start_bound = max(0, trim_start)
            end_bound = trim_end if (trim_end > trim_start and trim_end > 0) else float('inf')

            filtered = []
            for st, et, txt in cues:
                if is_full:
                    filtered.append((st, et, txt))
                elif et > start_bound and st < end_bound:
                    c_st = max(0, st - start_bound)
                    c_et = max(c_st + 0.1, min(end_bound, et) - start_bound)
                    filtered.append((c_st, c_et, txt))

            deduped = []
            for st, et, txt in filtered:
                if deduped and deduped[-1][2] == txt:
                    deduped[-1] = (deduped[-1][0], max(deduped[-1][1], et), txt)
                else:
                    deduped.append((st, et, txt))

            def fmt_srt(s):
                ms = int(round(s * 1000))
                return f"{ms//3600000:02d}:{(ms%3600000)//60000:02d}:{(ms%60000)//1000:02d},{ms%1000:03d}"

            def fmt_vtt(s):
                ms = int(round(s * 1000))
                return f"{ms//3600000:02d}:{(ms%3600000)//60000:02d}:{(ms%60000)//1000:02d}.{ms%1000:03d}"

            if target_ext == "vtt":
                body = "\n\n".join([f"{i+1}\n{fmt_vtt(st)} --> {fmt_vtt(et)}\n{txt}" for i, (st, et, txt) in enumerate(deduped)])
                out_content = f"WEBVTT - Generated by ClipFlow\n\n{body}\n" if deduped else "WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[No speech detected in this section]\n"
            elif target_ext == "txt":
                out_content = "\n".join([txt for _, _, txt in deduped]) if deduped else "[No speech detected in this section]"
            else:
                out_content = ("\n\n".join([f"{i+1}\n{fmt_srt(st)} --> {fmt_srt(et)}\n{txt}" for i, (st, et, txt) in enumerate(deduped)]) + "\n") if deduped else "1\n00:00:00,000 --> 00:00:05,000\n[No speech detected in this section]\n"

            final_out.write_text(out_content, encoding="utf-8")
            print(f"[ClipFlow Helper] [CAPTIONS SAVED] {len(deduped)} cues saved to:\n  {final_out}\n")
            server_bridge.progress_updated.emit(100, "Saved", "100%")
            server_bridge.completed.emit()
            return

        is_audio = fmt in ["mp3", "wav", "m4a", "aac"]
        ext = fmt if is_audio else "mp4"

        # Unique numbering if file already exists in Downloads folder
        base_name = f"{safe_name}_clip"
        final_out = DOWNLOADS_DIR / f"{base_name}.{ext}"
        if final_out.exists():
            counter = 1
            while (DOWNLOADS_DIR / f"{base_name} ({counter}).{ext}").exists():
                counter += 1
            final_out = DOWNLOADS_DIR / f"{base_name} ({counter}).{ext}"

        # Temporary raw file for intermediate FFmpeg cropping
        temp_raw = DOWNLOADS_DIR / f"{safe_name}_raw_temp_{int(time.time())}.{ext}"

        crop_box = options.get("cropBox")
        filter_str = get_aspect_filter(aspect_ratio, fit_mode, crop_position, crop_box)
        needs_crop = (not is_audio and bool(filter_str))
        target_out = temp_raw if needs_crop else final_out

        # Code moved to modular handlers in handlers/ (youtube_handler.py, instagram_handler.py, etc.)
        # Build platform-optimized yt-dlp command args
        cmd = [str(YT_DLP_BIN)] + build_universal_download_args(
            url=url,
            target_out=str(target_out),
            ffmpeg_dir=str(FFMPEG_BIN.parent),
            quality=str(quality),
            is_audio=is_audio,
            audio_format=fmt,
            audio_quality=str(audio_quality),
            trim_start=trim_start,
            trim_end=trim_end,
            format_seconds_fn=format_seconds,
        )

        print(f"\n{'='*70}")
        print(f"[ClipFlow Helper] [JOB STARTED]")
        print(f"  - Video URL     : {url}")
        print(f"  - Format        : {fmt.upper()} (Audio-only: {is_audio})")
        print(f"  - Target Quality: {quality}")
        print(f"  - Audio Bitrate : {audio_quality} kbps")
        print(f"  - Trim Window   : {trim_start}s -> {trim_end}s ({format_seconds(trim_start)} - {format_seconds(trim_end)})")
        print(f"  - Aspect Ratio  : {aspect_ratio} (Fit Mode: {fit_mode})")
        print(f"  - Target File   : {final_out.name}")
        print(f"  - Output Folder : {DOWNLOADS_DIR}")
        print(f"  - yt-dlp Path   : {YT_DLP_BIN}")
        print(f"  - Command       :\n    {' '.join(cmd)}")
        print(f"{'='*70}\n")

        # ── Production Mode: Silent Floating Widget with Live Circular Progress ─
        server_bridge.progress_updated.emit(0, "Starting...", "")
        total_expected_secs = (trim_end - trim_start) if (trim_end > trim_start) else float(options.get("duration", 0))

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=SUBPROCESS_FLAGS
            )

            clipflow_re = re.compile(r"\[CLIPFLOW_PROG\]\s*([\d\.]+)%\|([^|]*)\|([^|]*)\|([^|\r\n]*)")
            prog_re     = re.compile(r"\[download\]\s+([\d\.]+)%")
            time_re     = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)")
            dur_re      = re.compile(r"Duration:\s*(?:(\d{2}):)?(\d{2}):(\d{2}(?:\.\d+)?)")
            speed_re    = re.compile(r"(?:at|speed=)\s*([0-9\.]+\s*(?:[KMGTP]?i?B/s|x))", re.IGNORECASE)
            size_re     = re.compile(r"(?:of|size=)\s*~?([0-9\.]+\s*[KMGTP]?i?B)", re.IGNORECASE)
            eta_re      = re.compile(r"ETA\s*([0-9:]+)", re.IGNORECASE)

            last_emitted_pct = -1

            for line in proc.stdout:
                if sys.stdout and hasattr(sys.stdout, "write"):
                    try:
                        sys.stdout.write(f"[yt-dlp] {line}")
                        sys.stdout.flush()
                    except Exception:
                        pass

                # Priority 1: High-precision custom progress template (e.g. 100+ MB downloads)
                cm = clipflow_re.search(line)
                if cm:
                    pct = max(0, min(100, int(float(cm.group(1)))))
                    total_sz = cm.group(2).strip()
                    spd = cm.group(3).strip()
                    sub = spd if spd else total_sz
                    if pct != last_emitted_pct:
                        last_emitted_pct = pct
                        server_bridge.progress_updated.emit(pct, sub, f"{pct}%")
                    continue

                # Priority 2: Standard yt-dlp percent lines
                pm = prog_re.search(line)
                if pm:
                    pct = max(0, min(100, int(float(pm.group(1)))))
                    sz = size_re.search(line)
                    sp = speed_re.search(line)
                    sub = sp.group(1) if sp else (sz.group(1) if sz else "")
                    if pct != last_emitted_pct:
                        last_emitted_pct = pct
                        server_bridge.progress_updated.emit(pct, sub, f"{pct}%")
                    continue

                # Priority 3: FFmpeg section lines (frame= ... size= ... time=00:00:03.54 speed=1.13x)
                if total_expected_secs <= 0:
                    dm = dur_re.search(line)
                    if dm:
                        hrs = int(dm.group(1)) if dm.group(1) else 0
                        mins = int(dm.group(2))
                        secs = float(dm.group(3))
                        total_expected_secs = hrs * 3600 + mins * 60 + secs

                tm = time_re.search(line)
                if tm and total_expected_secs > 0:
                    cur_secs = int(tm.group(1)) * 3600 + int(tm.group(2)) * 60 + float(tm.group(3))
                    pct = max(0, min(99, int((cur_secs / total_expected_secs) * 100)))
                    sz = size_re.search(line)
                    sp = speed_re.search(line)
                    info_label = f"{sz.group(1)} • {sp.group(1)}" if (sz and sp) else (sz.group(1) if sz else (sp.group(1) if sp else ""))
                    if pct != last_emitted_pct:
                        last_emitted_pct = pct
                        server_bridge.progress_updated.emit(pct, info_label, f"{pct}%")

            proc.wait()
            if proc.returncode != 0:
                print(f"[ClipFlow Helper] [ERROR] yt-dlp exited with returncode {proc.returncode}")
                server_bridge.error_occurred.emit("yt-dlp error")
                return

            if needs_crop:
                server_bridge.processing_updated.emit("Cropping...")
                crop_cmd = [
                    str(FFMPEG_BIN),
                    "-i", str(temp_raw),
                    "-vf", filter_str,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                    "-c:a", "aac",
                    "-y", str(final_out)
                ]
                print(f"\n[ClipFlow Helper] [CROPPING] Running FFmpeg:\n  {' '.join(crop_cmd)}")
                crop_proc = subprocess.Popen(
                    crop_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    creationflags=SUBPROCESS_FLAGS
                )
                crop_last_pct = -1
                for crop_line in crop_proc.stdout:
                    if sys.stdout and hasattr(sys.stdout, "write"):
                        try:
                            sys.stdout.write(f"[FFmpeg-Crop] {crop_line}")
                            sys.stdout.flush()
                        except Exception:
                            pass
                    tm = time_re.search(crop_line)
                    if tm and total_expected_secs > 0:
                        cur_secs = int(tm.group(1)) * 3600 + int(tm.group(2)) * 60 + float(tm.group(3))
                        crop_pct = max(0, min(99, int((cur_secs / total_expected_secs) * 100)))
                        sp = speed_re.search(crop_line)
                        label = f"Crop {sp.group(1)}" if sp else "Cropping..."
                        if crop_pct != crop_last_pct:
                            crop_last_pct = crop_pct
                            server_bridge.progress_updated.emit(crop_pct, label, f"{crop_pct}%")

                crop_proc.wait()
                if crop_proc.returncode == 0:
                    if temp_raw.exists():
                        temp_raw.unlink(missing_ok=True)
                    print(f"\n[ClipFlow Helper] [JOB COMPLETED] File saved to:\n  {final_out}\n")
                    server_bridge.completed.emit()
                else:
                    print(f"[ClipFlow Helper] [CROP ERROR] FFmpeg error")
                    server_bridge.error_occurred.emit("Crop Error")
            else:
                print(f"\n[ClipFlow Helper] [JOB COMPLETED] File saved to:\n  {final_out}\n")
                server_bridge.completed.emit()

        except Exception as e:
            print(f"[ClipFlow Helper] [EXCEPTION] Error: {e}")
            server_bridge.error_occurred.emit(str(e))

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)

        w = self.width()
        h = self.height()
        rect = QRectF(2.5, 2.5, w - 5, h - 5)

        # 1. Sleek Modern Card Background
        bg_path = QPainterPath()
        bg_path.addRoundedRect(rect, 18, 18)

        bg_grad = QLinearGradient(0, 0, w, h)
        if self.state == "completed":
            bg_grad.setColorAt(0, QColor(8, 28, 18, 250))
            bg_grad.setColorAt(1, QColor(4, 14, 9, 250))
        elif self.state == "error":
            bg_grad.setColorAt(0, QColor(32, 10, 15, 250))
            bg_grad.setColorAt(1, QColor(14, 4, 7, 250))
        else:
            bg_grad.setColorAt(0, QColor(18, 14, 32, 252 if self.is_hovered else 242))
            bg_grad.setColorAt(1, QColor(8, 11, 20, 252 if self.is_hovered else 242))

        painter.fillPath(bg_path, bg_grad)

        border_col = (
            QColor(52, 211, 153, 200) if self.state == "completed" else
            QColor(248, 113, 113, 200) if self.state == "error" else
            QColor(168, 85, 247, 220) if self.state in ["downloading", "processing"] else
            QColor(255, 255, 255, 80 if self.is_hovered else 35)
        )
        painter.strokePath(bg_path, QPen(border_col, 1.4 if self.is_hovered else 1.0))

        # 2. State-Driven Content
        if self.state == "idle":
            if not self.logo.isNull():
                # Render logo full-fit (52x52) centered
                logo_size = 52
                offset = (w - logo_size) // 2
                painter.drawPixmap(int(offset), int(offset), logo_size, logo_size, self.logo)
            else:
                painter.setPen(QColor(255, 255, 255, 230))
                painter.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
                painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, "CF")

        elif self.state in ["downloading", "processing"]:
            ring_margin = 8.0
            ring_rect = QRectF(ring_margin, ring_margin, w - 2 * ring_margin, h - 2 * ring_margin)
            stroke_width = 4.0

            # Background Track
            painter.setPen(QPen(QColor(255, 255, 255, 20), stroke_width, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawEllipse(ring_rect)

            # Gradient Progress Arc
            grad = QConicalGradient(w / 2.0, h / 2.0, 90.0)
            if self.state == "processing":
                grad.setColorAt(0.0, QColor(245, 158, 11))
                grad.setColorAt(0.5, QColor(249, 115, 22))
                grad.setColorAt(1.0, QColor(234, 88, 12))
            else:
                grad.setColorAt(0.0, QColor(168, 85, 247))
                grad.setColorAt(0.5, QColor(236, 72, 153))
                grad.setColorAt(1.0, QColor(99, 102, 241))

            painter.setPen(QPen(QBrush(grad), stroke_width, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            start_angle = 90 * 16
            span_angle = -int((self.progress / 100.0) * 360.0 * 16)
            painter.drawArc(ring_rect, start_angle, span_angle)

            # Center Percentage
            painter.setPen(Qt.GlobalColor.white)
            painter.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
            painter.drawText(QRectF(0, h / 2 - 12, w, 16), Qt.AlignmentFlag.AlignCenter, self.status_text)

            if self.speed_text:
                painter.setPen(QColor(200, 200, 225, 210))
                painter.setFont(QFont("Segoe UI", 6, QFont.Weight.DemiBold))
                painter.drawText(QRectF(2, h / 2 + 2, w - 4, 14), Qt.AlignmentFlag.AlignCenter, self.speed_text)

        elif self.state == "completed":
            painter.setPen(QPen(QColor(52, 211, 153), 2.0))
            painter.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
            painter.drawText(QRectF(0, h / 2 - 14, w, 18), Qt.AlignmentFlag.AlignCenter, "✓")

            painter.setPen(QColor(180, 255, 210))
            painter.setFont(QFont("Segoe UI", 6, QFont.Weight.Bold))
            painter.drawText(QRectF(0, h / 2 + 3, w, 12), Qt.AlignmentFlag.AlignCenter, "Saved!")

        elif self.state == "error":
            painter.setPen(QPen(QColor(248, 113, 113), 2.0))
            painter.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
            painter.drawText(QRectF(0, h / 2 - 14, w, 18), Qt.AlignmentFlag.AlignCenter, "✕")

            painter.setPen(QColor(255, 190, 190))
            painter.setFont(QFont("Segoe UI", 6, QFont.Weight.Bold))
            painter.drawText(QRectF(0, h / 2 + 3, w, 12), Qt.AlignmentFlag.AlignCenter, "Error")

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() & Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def enterEvent(self, event):
        self.is_hovered = True
        self.update()

    def leaveEvent(self, event):
        self.is_hovered = False
        self.update()

    def contextMenuEvent(self, event):
        popup = ContextPopup(
            parent=None,
            items=["open folder location", "view logs", "reset position", "exit helper"],
            anchor_widget=self,
        )
        choice = popup.exec()
        if choice == 0:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(DOWNLOADS_DIR)))
        elif choice == 1:
            log_target = LOG_FILE if LOG_FILE.exists() else LOGS_DIR
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(log_target)))
        elif choice == 2:
            screen = QGuiApplication.primaryScreen()
            if screen:
                geom = screen.availableGeometry()
                self.move(geom.right() - self.width() - 20, geom.bottom() - self.height() - 40)
        elif choice == 3:
            # Complete termination of this UI engine process
            QApplication.quit()


def check_and_process_pending_jobs():
    """Check for queued download jobs saved by the daemon and process them."""
    try:
        job_files = sorted(JOBS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime)
        for jf in job_files:
            try:
                data = json.loads(jf.read_text(encoding="utf-8"))
                jf.unlink(missing_ok=True)
                server_bridge.download_requested.emit(data)
            except Exception:
                jf.unlink(missing_ok=True)
    except Exception:
        pass


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("ClipFlowHelper")
    app.setApplicationDisplayName("ClipFlow Desktop Helper")
    app.setQuitOnLastWindowClosed(False)

    # Start fallback port 18942 and IPC port 18943
    threading.Thread(target=start_http_server, daemon=True).start()
    threading.Thread(target=start_ipc_server, daemon=True).start()

    # Background tasks: Dependency setup & OTA Auto-Updates
    threading.Thread(target=ensure_dependencies_in_background, daemon=True).start()
    threading.Thread(target=check_and_apply_updates, daemon=True).start()

    auto_close = ("--auto-close" in sys.argv)
    widget = FloatingWidget(auto_close=auto_close)
    # Starts hidden: only displayed when downloading a video for free users

    # Process any queued job immediately
    QTimer.singleShot(100, check_and_process_pending_jobs)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()

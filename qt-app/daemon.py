"""
ClipFlow Background Daemon Service
Runs 24/7 silently on port 18942. Listens for frontend browser requests,
serves status/metadata, and wakes up/spawns the ClipFlowHelper UI engine on-demand.
"""

import sys
import os
import time
import json
import subprocess
import threading
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
import shutil

# Platform-specific handlers
try:
    from handlers import (
        build_universal_metadata_args,
        extract_twitch_live_segment,
        is_twitch_live_channel,
        prune_old_chunks,
    )
except ImportError:
    from .handlers import (
        build_universal_metadata_args,
        extract_twitch_live_segment,
        is_twitch_live_channel,
        prune_old_chunks,
    )

# Paths
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).parent
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
else:
    APP_DIR = Path(__file__).resolve().parent
    BUNDLE_DIR = APP_DIR

SYS_LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
LOCAL_APPDATA = SYS_LOCAL_APPDATA / "ClipFlow"
PROGRAMS_DIR = SYS_LOCAL_APPDATA / "Programs" / "ClipFlow"
PROGRAMS_BIN_DIR = PROGRAMS_DIR / "bin"
LOCAL_BIN_DIR = LOCAL_APPDATA / "bin"
LOGS_DIR = LOCAL_APPDATA / "logs"
JOBS_DIR = LOCAL_APPDATA / "jobs"
LIVE_CHUNKS_DIR = LOCAL_APPDATA / "temp" / "live-chunks"

PROGRAMS_BIN_DIR.mkdir(parents=True, exist_ok=True)
LOCAL_BIN_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
LIVE_CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOGS_DIR / "clipflow_daemon.log"

logger = logging.getLogger("ClipFlowDaemon")
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

SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

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

def get_helper_exe() -> Path:
    candidates = [
        APP_DIR / "ClipFlowHelper.exe",
        PROGRAMS_DIR / "ClipFlowHelper.exe",
        APP_DIR / "dist" / "ClipFlow-Desktop-Companion" / "ClipFlowHelper.exe",
        LOCAL_APPDATA / "ClipFlowHelper.exe",
    ]
    for c in candidates:
        if c.exists():
            return c
    return APP_DIR / "ClipFlowHelper.exe"

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
    return True

def notify_or_launch_helper(payload: dict):
    """Save the job payload and ensure the ClipFlowHelper UI process is running."""
    job_id = f"job_{int(time.time() * 1000)}"
    job_file = JOBS_DIR / f"{job_id}.json"
    job_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[Daemon] Saved job file: {job_file.name}")

    # Try notifying running instance on internal IPC port 18943 first
    try:
        req_data = json.dumps(payload).encode("utf-8")
        ipc_req = urllib.request.Request(
            "http://127.0.0.1:18943/job",
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(ipc_req, timeout=1.5) as resp:
            if resp.status == 200:
                print("[Daemon] Successfully dispatched job to already running ClipFlowHelper.")
                return
    except Exception:
        pass

    # If helper is not running, spawn it with --auto-close so it shuts down after download completes
    helper_exe = get_helper_exe()
    if getattr(sys, "frozen", False) or helper_exe.exists():
        if helper_exe.exists():
            print(f"[Daemon] Launching ClipFlowHelper process with --auto-close: {helper_exe}")
            subprocess.Popen([str(helper_exe), "--auto-close"], cwd=str(helper_exe.parent))
        else:
            print(f"[Daemon] ClipFlowHelper.exe not found at {helper_exe}")
    else:
        # Dev mode: launch python app.py --auto-close
        app_script = APP_DIR / "app.py"
        print(f"[Daemon] Dev Mode: Launching {sys.executable} {app_script} --auto-close")
        subprocess.Popen([sys.executable, str(app_script), "--auto-close"], cwd=str(APP_DIR))

class DaemonHTTPHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict, origin: str = "*"):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(encoded)
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
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
            self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
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
        if not is_origin_allowed(origin):
            self._send_json(403, {"error": "Forbidden: Unauthorized Origin"}, origin)
            return

        parsed = urlparse(self.path)
        if parsed.path in ["/status", "/health", "/"]:
            resp_body = {"status": "ok", "app": "ClipFlowHelper", "version": "1.0.0", "daemon": True}
            self._send_json(200, resp_body, origin)
        elif parsed.path == "/twitch/live-segment":
            # Live chunks are streamed in background: ensure helper UI stays hidden
            try:
                hide_req = urllib.request.Request(
                    "http://127.0.0.1:18943/hide",
                    data=b"{}",
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(hide_req, timeout=0.15)
            except Exception:
                pass

            import urllib.parse
            query_params = urllib.parse.parse_qs(parsed.query)
            target_url = query_params.get("url", [""])[0].strip()
            if not target_url:
                self._send_json(400, {"error": "Missing 'url' query parameter"}, origin)
                return

            if not is_twitch_live_channel(target_url):
                self._send_json(400, {"error": "Only live channel URLs are supported. Use /metadata for VODs and clips."}, origin)
                return

            # t = start offset in seconds (default 0 = live edge)
            try:
                start_time = max(0, int(query_params.get("t", ["0"])[0]))
            except (ValueError, IndexError):
                start_time = 0

            try:
                chunk_duration = min(20, max(2, int(query_params.get("dur", ["5"])[0])))
            except (ValueError, IndexError):
                chunk_duration = 5

            yt_bin = get_yt_dlp_bin()
            ffmpeg_bin = get_ffmpeg_bin()
            if not yt_bin.exists() or not ffmpeg_bin.exists():
                self._send_json(500, {"error": "yt-dlp or ffmpeg engine missing on local machine"}, origin)
                return

            print(f"[Daemon] Extracting Twitch live chunk: {target_url} @ t={start_time}s (dur={chunk_duration}s)")
            success, chunk_path, err_msg = extract_twitch_live_segment(
                target_url,
                start_time,
                chunk_duration,
                str(yt_bin),
                str(ffmpeg_bin),
                chunks_dir=LIVE_CHUNKS_DIR
            )

            if not success or not chunk_path or not os.path.exists(chunk_path):
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
            except Exception as e:
                print(f"[Daemon Error] Streaming live chunk: {e}")
        else:
            self._send_json(404, {"error": f"Endpoint '{self.path}' not found"}, origin)

    def do_POST(self):
        origin = self.headers.get("Origin", "")
        if not is_origin_allowed(origin):
            self._send_json(403, {"error": "Forbidden: Unauthorized Origin"}, origin)
            return

        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "Invalid JSON payload"}, origin)
            return

        if parsed.path == "/download":
            print(f"[Daemon] --> RECV /download request from {origin}")
            notify_or_launch_helper(payload)
            self._send_json(200, {"status": "started", "message": "Download task dispatched to engine"}, origin)

        elif parsed.path == "/metadata":
            url = payload.get("url", "").strip()
            yt_bin = get_yt_dlp_bin()
            ffmpeg_bin = get_ffmpeg_bin()
            if not yt_bin.exists():
                self._send_json(500, {"error": "yt-dlp engine not ready"}, origin)
                return

            # Code moved to modular handlers in handlers/ (youtube_handler.py, instagram_handler.py, etc.)
            cmd = [str(yt_bin)] + build_universal_metadata_args(url, str(ffmpeg_bin.parent) if ffmpeg_bin.exists() else None)
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
                self._send_json(200, meta, origin)
            else:
                self._send_json(500, {"error": "Failed to fetch metadata"}, origin)
        else:
            self._send_json(404, {"error": f"Endpoint '{self.path}' not found"}, origin)

    def log_message(self, format, *args):
        pass


class DaemonHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def ensure_auto_start_persistence():
    """Ensure the background service automatically starts on Windows boot/login via user registry without startup folder clutter."""
    if os.name != "nt":
        return
    try:
        import winreg
        current_exe = sys.executable if getattr(sys, "frozen", False) else (PROGRAMS_DIR / "ClipFlowDaemon.exe")
        if not Path(current_exe).exists():
            return

        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, "ClipFlowDaemon", 0, winreg.REG_SZ, f'"{current_exe}"')
        winreg.CloseKey(key)
        print("[Daemon] Auto-start persistence active (HKCU\\Run).")
    except Exception as e:
        print(f"[Daemon] Persistence note: {e}")


def chunk_pruner_worker():
    """Background worker that periodically deletes cached chunks older than 15 minutes."""
    while True:
        try:
            time.sleep(120)
            prune_old_chunks(LIVE_CHUNKS_DIR, max_age_seconds=900)
        except Exception:
            pass


def run_daemon(port=18942):
    print(f"==================================================")
    print(f"  ClipFlow Background Daemon Service Active (:18942)")
    print(f"==================================================")
    threading.Thread(target=ensure_auto_start_persistence, daemon=True).start()
    threading.Thread(target=chunk_pruner_worker, daemon=True).start()
    while True:
        try:
            server = DaemonHTTPServer(("127.0.0.1", port), DaemonHTTPHandler)
            server.serve_forever()
        except Exception as e:
            print(f"[Daemon] Error on port {port}: {e}. Rebinding in 2s...")
            time.sleep(2)


if __name__ == "__main__":
    run_daemon()

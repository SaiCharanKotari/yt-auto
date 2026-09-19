"""
Twitch Handler for ClipFlow Qt Companion App
Constructs yt-dlp arguments for Twitch VODs, Clips, and Live Streams.
Provides robust live segment extraction, active DVR GQL resolution,
stream URL caching, in-flight request deduplication, and local chunk caching.
"""

import os
import re
import time
import json
import hashlib
import threading
import subprocess
import urllib.request
from typing import List, Optional, Tuple, Dict
from pathlib import Path

# Stream URL Resolution Cache (Key: "{url}_{quality}" -> (stream_url, source_type, expires_at))
_STREAM_CACHE: Dict[str, Tuple[str, str, float]] = {}
_STREAM_CACHE_LOCK = threading.Lock()

# In-flight chunk extractions map to prevent concurrent duplicate FFmpeg runs
_IN_FLIGHT_EXTRACTIONS: Dict[str, threading.Event] = {}
_IN_FLIGHT_RESULTS: Dict[str, Tuple[bool, Optional[str], Optional[str]]] = {}
_IN_FLIGHT_LOCK = threading.Lock()


def is_twitch_url(url: str) -> bool:
    if not url:
        return False
    return bool(re.search(r'(?:twitch\.tv|clips\.twitch\.tv)', url, re.IGNORECASE))


def is_twitch_live_channel(url: str) -> bool:
    """Detect if URL is a direct Twitch live channel (e.g., https://www.twitch.tv/username)."""
    if not url:
        return False
    clean = url.strip().rstrip('/')
    return bool(re.search(r'twitch\.tv\/([a-zA-Z0-9_]+)$', clean, re.IGNORECASE)) and not ('/videos' in clean or '/clip' in clean)


def extract_twitch_channel_name(url: str) -> Optional[str]:
    if not url:
        return None
    match = re.search(r'twitch\.tv\/([a-zA-Z0-9_]+)(?:[/?#]|$)', url, re.IGNORECASE)
    if match:
        name = match.group(1).lower()
        if name not in ['videos', 'clip', 'directory', 'p', 'settings']:
            return name
    return None


def resolve_active_dvr_vod(channel_name: str) -> Optional[str]:
    """Resolves the active recording DVR VOD ID for a live Twitch channel via GQL."""
    channel = channel_name.lower().strip()
    if not channel or channel in ['videos', 'clip', 'directory', 'p', 'settings']:
        return None

    try:
        query = json.dumps({
            "query": f'query {{ user(login: "{channel}") {{ stream {{ id createdAt }} videos(first: 3, sort: TIME) {{ edges {{ node {{ id status broadcastType createdAt }} }} }} }} }}'
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://gql.twitch.tv/gql",
            data=query,
            headers={
                "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status != 200:
                return None
            data = json.loads(resp.read().decode("utf-8"))
            edges = data.get("data", {}).get("user", {}).get("videos", {}).get("edges", [])
            for e in edges:
                node = e.get("node")
                if node and (node.get("status") == "RECORDING" or node.get("broadcastType") == "ARCHIVE"):
                    vod_id = str(node.get("id"))
                    if vod_id:
                        return vod_id
    except Exception as err:
        print(f"[Twitch Stream Resolver] GQL DVR check error for {channel}: {err}")

    return None


def resolve_stream_url(
    target_url: str,
    yt_dlp_bin: str,
    quality: str = "720p",
    force_refresh: bool = False,
) -> Tuple[str, str]:
    """
    Resolves direct HLS stream URL for any Twitch URL (Channel, DVR VOD, regular VOD, Clip).
    Returns (stream_url, source_type).
    """
    cache_key = f"{target_url.strip()}_{quality or 'best'}"

    if not force_refresh:
        with _STREAM_CACHE_LOCK:
            if cache_key in _STREAM_CACHE:
                stream_url, source_type, expires_at = _STREAM_CACHE[cache_key]
                if expires_at > time.time():
                    return stream_url, source_type

    channel = extract_twitch_channel_name(target_url)
    target_resolve_url = target_url
    source_type = "vod"

    if "/clip/" in target_url or "clips.twitch.tv" in target_url:
        source_type = "clip"
    elif is_twitch_live_channel(target_url) and channel:
        dvr_vod_id = resolve_active_dvr_vod(channel)
        if dvr_vod_id:
            source_type = "dvr"
            target_resolve_url = f"https://www.twitch.tv/videos/{dvr_vod_id}"
            print(f"[Twitch Stream Resolver] 🎯 Resolved live channel '{channel}' to active DVR VOD: {target_resolve_url}")
        else:
            source_type = "live"
            print(f"[Twitch Stream Resolver] 📡 Live DVR VOD not found, using live channel stream: {target_resolve_url}")
    elif "/videos/" in target_url:
        source_type = "vod"

    format_filter = "best/bestvideo+bestaudio"
    if quality and quality not in ["source", "best"]:
        height_str = quality.replace("p", "")
        if height_str.isdigit():
            h = int(height_str)
            format_filter = f"best[height<={h}]/bestvideo[height<={h}]+bestaudio/best"

    print(f"[Twitch Stream Resolver] 🔗 Resolving HLS stream URL via yt-dlp (-g, format: {format_filter}) for: {target_resolve_url}")

    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    cmd = [
        yt_dlp_bin,
        "-g",
        "-f", format_filter,
        "--no-warnings",
        "--no-check-certificate",
        target_resolve_url
    ]

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=flags,
        timeout=25
    )

    if proc.returncode != 0 or not proc.stdout.strip():
        raise RuntimeError(f"Failed to resolve stream URL with yt-dlp: {proc.stderr or 'No output'}")

    stream_url = proc.stdout.strip().splitlines()[0].strip()
    if not stream_url.startswith("http"):
        raise RuntimeError(f"Invalid stream URL obtained: {stream_url}")

    with _STREAM_CACHE_LOCK:
        _STREAM_CACHE[cache_key] = (stream_url, source_type, time.time() + 10 * 60)  # 10-minute cache

    return stream_url, source_type


def prune_old_chunks(chunks_dir: Path, max_age_seconds: int = 900):
    """Remove temporary live MP4 chunks older than max_age_seconds (default 15 minutes)."""
    try:
        if not chunks_dir.exists():
            return
        now = time.time()
        for f in chunks_dir.glob("chunk_*.mp4"):
            try:
                if now - f.stat().st_mtime > max_age_seconds:
                    f.unlink(missing_ok=True)
            except Exception:
                pass
    except Exception:
        pass


def build_twitch_metadata_args(url: str, ffmpeg_dir: Optional[str] = None) -> List[str]:
    """Build yt-dlp argument list for Twitch metadata extraction."""
    args = [
        "--no-playlist",
        "--dump-json",
        "--retries", "10",
    ]
    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])
    args.append(url)
    return args


def build_twitch_download_args(
    url: str,
    target_out: str,
    ffmpeg_dir: Optional[str] = None,
    is_audio: bool = False,
    audio_format: str = "mp3",
    audio_quality: str = "320",
) -> List[str]:
    """Build yt-dlp argument list for Twitch stream / VOD / Clip download."""
    args = [
        "--newline",
        "--progress",
        "--progress-template", "download:[CLIPFLOW_PROG] %(progress._percent_str)s|%(progress._total_bytes_estimate_str,progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--retries", "10",
        "--fragment-retries", "10",
    ]
    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])

    if is_audio:
        args.extend(["-x", "--audio-format", audio_format, "--audio-quality", audio_quality])
    else:
        args.extend(["-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4"])

    args.extend(["--no-playlist", "-o", target_out, url])
    return args


def extract_twitch_live_segment(
    url: str,
    start_time: int,
    chunk_duration: int,
    yt_bin: str,
    ffmpeg_bin: str,
    chunks_dir: Optional[Path] = None
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Extracts a 5s-10s MP4 segment of a live Twitch channel stream with full caching,
    in-flight request deduplication, active DVR support, and fast copy with transcode fallback.

    Returns (success, output_path, error_message).
    """
    if not is_twitch_live_channel(url):
        return False, None, "URL is not a valid Twitch live channel"

    if chunks_dir is None:
        chunks_dir = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "ClipFlow" / "temp" / "live-chunks"

    chunks_dir.mkdir(parents=True, exist_ok=True)

    # Hash without timestamp so repeated seeks to the same chunk are instant cache hits
    chunk_hash = hashlib.md5(f"{url.strip()}-{start_time}-{chunk_duration}".encode("utf-8")).hexdigest()
    output_path = chunks_dir / f"chunk_{chunk_hash}.mp4"

    # 1. Instant Disk Cache Hit
    if output_path.exists() and output_path.stat().st_size > 1000:
        print(f"[Twitch Live Chunk] Instant local cache hit @ t={start_time}s ({round(output_path.stat().st_size / 1024)}KB)")
        return True, str(output_path), None

    # 2. In-flight Request Deduplication
    with _IN_FLIGHT_LOCK:
        if chunk_hash in _IN_FLIGHT_EXTRACTIONS:
            event = _IN_FLIGHT_EXTRACTIONS[chunk_hash]
            is_initiator = False
        else:
            event = threading.Event()
            _IN_FLIGHT_EXTRACTIONS[chunk_hash] = event
            is_initiator = True

    if not is_initiator:
        print(f"[Twitch Live Chunk] Joining existing in-flight extraction @ t={start_time}s")
        event.wait(timeout=30)
        with _IN_FLIGHT_LOCK:
            res = _IN_FLIGHT_RESULTS.get(chunk_hash)
        if res and res[0] and output_path.exists() and output_path.stat().st_size > 0:
            return res
        # If the joined request failed, fall through to fresh attempt

    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    t0 = time.time()
    try:
        # Resolve stream URL (with 10-minute cache)
        stream_url, source_type = resolve_stream_url(url, yt_bin, quality="720p")

        print(f"[Twitch Live Chunk] Extracting {chunk_duration}s at t={start_time}s ({source_type} mode)...")

        # Fast stream copy first
        ff_cmd = [
            ffmpeg_bin,
            "-y",
            "-ss", str(start_time),
            "-i", stream_url,
            "-t", str(chunk_duration),
            "-c", "copy",
            "-movflags", "+faststart",
            "-bsf:a", "aac_adtstoasc",
            str(output_path)
        ]

        proc = subprocess.run(ff_cmd, capture_output=True, text=True, errors="replace", creationflags=flags, timeout=20)
        
        # Fallback to ultrafast transcode if copy failed or produced empty output
        if proc.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
            print(f"[Twitch Live Chunk] Fast copy failed. Attempting ultrafast transcode...")
            transcode_cmd = [
                ffmpeg_bin,
                "-y",
                "-ss", str(start_time),
                "-i", stream_url,
                "-t", str(chunk_duration),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "26",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                str(output_path)
            ]
            proc = subprocess.run(transcode_cmd, capture_output=True, text=True, errors="replace", creationflags=flags, timeout=25)

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("FFmpeg produced no output. Stream may be unavailable at this timestamp.")

        elapsed = round(time.time() - t0, 2)
        size_kb = round(output_path.stat().st_size / 1024)
        print(f"[Twitch Live Chunk] Local chunk ready in {elapsed}s: {size_kb}KB -> {output_path.name}")

        result = (True, str(output_path), None)
        with _IN_FLIGHT_LOCK:
            _IN_FLIGHT_RESULTS[chunk_hash] = result
        return result

    except Exception as err:
        err_msg = str(err)
        print(f"[Twitch Live Chunk Error] {err_msg}")
        if output_path.exists():
            try:
                output_path.unlink()
            except Exception:
                pass
        result = (False, None, err_msg)
        with _IN_FLIGHT_LOCK:
            _IN_FLIGHT_RESULTS[chunk_hash] = result
        return result

    finally:
        event.set()
        with _IN_FLIGHT_LOCK:
            _IN_FLIGHT_EXTRACTIONS.pop(chunk_hash, None)

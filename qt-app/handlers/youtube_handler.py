"""
YouTube Handler for ClipFlow Qt Companion App
Constructs optimal yt-dlp arguments for metadata fetching and master-quality video downloads.
"""

import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

def find_cookies_file() -> Optional[str]:
    """Find YouTube cookies.txt across common directories."""
    candidates = [
        Path.cwd() / "cookies.txt",
        Path.cwd() / "backend" / "cookies.txt",
        Path(__file__).resolve().parent.parent / "cookies.txt",
        Path(__file__).resolve().parent.parent.parent / "cookies.txt",
        Path(__file__).resolve().parent.parent.parent / "backend" / "cookies.txt",
        Path(os.environ.get("LOCALAPPDATA", "")) / "ClipFlow" / "cookies.txt",
        Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Downloads" / "cookies.txt",
    ]
    for c in candidates:
        try:
            if c.exists() and c.is_file() and c.stat().st_size > 100:
                return str(c)
        except Exception:
            pass
    return None

def is_youtube_url(url: str) -> bool:
    if not url:
        return False
    return bool(re.search(r'(?:youtube\.com|youtu\.be)', url, re.IGNORECASE))

def build_youtube_metadata_args(url: str, ffmpeg_dir: Optional[str] = None) -> List[str]:
    """Build yt-dlp argument list for extracting YouTube video metadata."""
    args = [
        "--no-playlist",
        "--dump-json",
        "--js-runtimes", "node",
        "--retries", "10",
        "--fragment-retries", "10",
    ]
    cookies_path = find_cookies_file()
    if cookies_path:
        args.extend(["--cookies", cookies_path])

    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])
    args.append(url)
    return args

def build_youtube_download_args(
    url: str,
    target_out: str,
    ffmpeg_dir: Optional[str] = None,
    quality: str = "1080",
    is_audio: bool = False,
    audio_format: str = "mp3",
    audio_quality: str = "320",
    trim_start: float = 0,
    trim_end: float = 0,
    format_seconds_fn = None,
) -> List[str]:
    """
    Build yt-dlp argument list for master-quality YouTube download with zero throttling.
    """
    args = [
        "--newline",
        "--progress",
        "--progress-template", "download:[CLIPFLOW_PROG] %(progress._percent_str)s|%(progress._total_bytes_estimate_str,progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--js-runtimes", "node",
        "--retries", "10",
        "--fragment-retries", "10",
        "--buffersize", "16K",
        "--http-chunk-size", "10M",
    ]

    cookies_path = find_cookies_file()
    if cookies_path:
        args.extend(["--cookies", cookies_path])

    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])

    if is_audio:
        args.extend([
            "-x",
            "--audio-format", audio_format,
            "--audio-quality", audio_quality,
        ])
    else:
        q_str = str(quality).lower()
        if "4k" in q_str or "2160" in q_str:
            h = 2160
        elif "2k" in q_str or "1440" in q_str:
            h = 1440
        else:
            m = re.search(r'(\d+)', q_str)
            h = int(m.group(1)) if m else 1080

        yt_format = (
            f"bestvideo[height={h}]+bestaudio[ext=m4a]/bestvideo[height={h}]+bestaudio/"
            f"bestvideo[height<={h}]+bestaudio[ext=m4a]/bestvideo[height<={h}]+bestaudio/"
            f"bestvideo+bestaudio/best"
        )
        args.extend([
            "-f", yt_format,
            "--merge-output-format", "mp4",
        ])

    if trim_end > trim_start and format_seconds_fn:
        args.extend([
            "--download-sections", f"*{format_seconds_fn(trim_start)}-{format_seconds_fn(trim_end)}",
            "--force-keyframes-at-cuts"
        ])

    args.extend(["--no-playlist", "-o", target_out, url])
    return args


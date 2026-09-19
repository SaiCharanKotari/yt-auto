"""
Instagram Handler for ClipFlow Qt Companion App
Constructs yt-dlp arguments for Instagram Reels and posts.
"""

import re
from typing import List, Optional

INSTAGRAM_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

def is_instagram_url(url: str) -> bool:
    if not url:
        return False
    return bool(re.search(r'(?:instagram\.com|instagr\.am)', url, re.IGNORECASE))

def build_instagram_metadata_args(url: str, ffmpeg_dir: Optional[str] = None) -> List[str]:
    """Build yt-dlp argument list for Instagram metadata extraction."""
    args = [
        "--no-playlist",
        "--dump-json",
        "--user-agent", INSTAGRAM_USER_AGENT,
        "--add-header", "Referer:https://www.instagram.com/",
        "--retries", "10",
    ]
    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])
    args.append(url)
    return args

def build_instagram_download_args(
    url: str,
    target_out: str,
    ffmpeg_dir: Optional[str] = None,
    is_audio: bool = False,
    audio_format: str = "mp3",
    audio_quality: str = "320",
) -> List[str]:
    """Build yt-dlp argument list for Instagram Reels / Videos."""
    args = [
        "--newline",
        "--progress",
        "--progress-template", "download:[CLIPFLOW_PROG] %(progress._percent_str)s|%(progress._total_bytes_estimate_str,progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--user-agent", INSTAGRAM_USER_AGENT,
        "--add-header", "Referer:https://www.instagram.com/",
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

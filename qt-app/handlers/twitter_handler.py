"""
Twitter / X Handler for ClipFlow Qt Companion App
Constructs yt-dlp arguments for Twitter/X video and GIF downloads.
"""

import re
from typing import List, Optional

TWITTER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

def is_twitter_url(url: str) -> bool:
    if not url:
        return False
    return bool(re.search(r'(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com)', url, re.IGNORECASE))

def build_twitter_metadata_args(url: str, ffmpeg_dir: Optional[str] = None) -> List[str]:
    """Build yt-dlp argument list for Twitter/X metadata extraction."""
    args = [
        "--no-playlist",
        "--dump-json",
        "--user-agent", TWITTER_USER_AGENT,
        "--retries", "10",
    ]
    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])
    args.append(url)
    return args

def build_twitter_download_args(
    url: str,
    target_out: str,
    ffmpeg_dir: Optional[str] = None,
    is_audio: bool = False,
    audio_format: str = "mp3",
    audio_quality: str = "320",
) -> List[str]:
    """Build yt-dlp argument list for Twitter/X video downloads."""
    args = [
        "--newline",
        "--progress",
        "--progress-template", "download:[CLIPFLOW_PROG] %(progress._percent_str)s|%(progress._total_bytes_estimate_str,progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--user-agent", TWITTER_USER_AGENT,
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

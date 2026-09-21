"""
ClipFlow Qt Companion Platform Handlers
Modular dispatchers for YouTube, Instagram, Twitter/X, and Twitch.
"""

from typing import List, Optional

from .youtube_handler import (
    is_youtube_url,
    build_youtube_metadata_args,
    build_youtube_download_args,
)
from .instagram_handler import (
    is_instagram_url,
    build_instagram_metadata_args,
    build_instagram_download_args,
)
from .twitter_handler import (
    is_twitter_url,
    build_twitter_metadata_args,
    build_twitter_download_args,
)
from .twitch_handler import (
    is_twitch_url,
    is_twitch_live_channel,
    extract_twitch_channel_name,
    resolve_active_dvr_vod,
    resolve_stream_url,
    build_twitch_metadata_args,
    build_twitch_download_args,
    extract_twitch_live_segment,
    prune_old_chunks,
)

def build_universal_metadata_args(url: str, ffmpeg_dir: Optional[str] = None) -> List[str]:
    """Dispatch metadata extraction arguments to appropriate platform handler."""
    if is_youtube_url(url):
        return build_youtube_metadata_args(url, ffmpeg_dir)
    elif is_instagram_url(url):
        return build_instagram_metadata_args(url, ffmpeg_dir)
    elif is_twitter_url(url):
        return build_twitter_metadata_args(url, ffmpeg_dir)
    elif is_twitch_url(url):
        return build_twitch_metadata_args(url, ffmpeg_dir)
    
    # Generic fallback
    args = ["--no-playlist", "--dump-json", "--retries", "10"]
    if ffmpeg_dir:
        args.extend(["--ffmpeg-location", ffmpeg_dir])
    args.append(url)
    return args

def build_universal_download_args(
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
    """Dispatch download arguments to appropriate platform handler."""
    if is_youtube_url(url):
        return build_youtube_download_args(
            url=url,
            target_out=target_out,
            ffmpeg_dir=ffmpeg_dir,
            quality=quality,
            is_audio=is_audio,
            audio_format=audio_format,
            audio_quality=audio_quality,
            trim_start=trim_start,
            trim_end=trim_end,
            format_seconds_fn=format_seconds_fn,
        )
    elif is_instagram_url(url):
        return build_instagram_download_args(
            url=url,
            target_out=target_out,
            ffmpeg_dir=ffmpeg_dir,
            is_audio=is_audio,
            audio_format=audio_format,
            audio_quality=audio_quality,
        )
    elif is_twitter_url(url):
        return build_twitter_download_args(
            url=url,
            target_out=target_out,
            ffmpeg_dir=ffmpeg_dir,
            is_audio=is_audio,
            audio_format=audio_format,
            audio_quality=audio_quality,
        )
    elif is_twitch_url(url):
        return build_twitch_download_args(
            url=url,
            target_out=target_out,
            ffmpeg_dir=ffmpeg_dir,
            quality=quality,
            is_audio=is_audio,
            audio_format=audio_format,
            audio_quality=audio_quality,
        )

    # Generic fallback
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

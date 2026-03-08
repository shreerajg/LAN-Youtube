"""
thumbnailer.py — FFmpeg thumbnail extractor
Produces high-quality JPEG thumbnails at 1280x720 resolution.
"""
import subprocess
import os
import shutil

THUMB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "thumbnails")
os.makedirs(THUMB_DIR, exist_ok=True)

FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"


def get_duration(video_path: str) -> float:
    """Return video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        return float(result.stdout.decode().strip())
    except Exception:
        return 0.0


def generate_thumbnail(video_path: str, video_id: int) -> str | None:
    """
    Extract a high-quality frame at 10% of duration.
    Returns the absolute path of the saved thumbnail, or None on failure.
    """
    thumb_path = os.path.join(THUMB_DIR, f"{video_id}.jpg")
    
    if os.path.exists(thumb_path):
        return thumb_path

    duration = get_duration(video_path)
    seek_time = max(1.0, duration * 0.10)  # 10% of video, minimum 1 sec

    try:
        subprocess.run(
            [
                FFMPEG_PATH,
                "-ss", str(seek_time),
                "-i", video_path,
                "-vframes", "1",
                "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
                "-q:v", "2",          # quality 2 = highest JPEG quality
                "-y",
                thumb_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
        return thumb_path if os.path.exists(thumb_path) else None
    except Exception as e:
        print(f"[thumbnailer] ERROR for {video_path}: {e}")
        return None

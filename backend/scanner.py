"""
scanner.py — Multi-folder recursive video library discovery
Scans all WatchedFolder paths + default media/ directory.
Removes stale entries for files that no longer exist on disk.
"""
import os
import subprocess
from datetime import datetime
from database import SessionLocal, Video, WatchedFolder
from thumbnailer import generate_thumbnail, get_duration

DEFAULT_MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media")
SUPPORTED_EXTS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".ts", ".flv"}


def get_resolution(video_path: str) -> str | None:
    """Return resolution string like '1920x1080' using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                video_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
        )
        out = result.stdout.decode().strip()
        # out should be like "1920x1080"
        if "x" in out and out.replace("x", "").replace("\n", "").isdigit() is False:
            # validate it looks like NxN
            parts = out.split("x")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return out
        return None
    except Exception:
        return None


def scan_library() -> dict:
    """
    Walk all WatchedFolder paths + default media/ recursively.
    Index new video files, remove stale entries.
    Returns summary: { added, removed, skipped, total }
    """
    os.makedirs(DEFAULT_MEDIA_DIR, exist_ok=True)

    db = SessionLocal()
    try:
        # Collect all folders to scan
        watched = db.query(WatchedFolder).all()
        scan_dirs = []
        available_folder_ids = set()
        
        if os.path.isdir(DEFAULT_MEDIA_DIR):
            scan_dirs.append((None, os.path.abspath(DEFAULT_MEDIA_DIR)))
            available_folder_ids.add(None)

        for w in watched:
            if os.path.isdir(w.path):
                scan_dirs.append((w.id, w.path))
                available_folder_ids.add(w.id)

        # Build existing path map: abs_path -> video_id
        existing = {row.path: row.id for row in db.query(Video).with_entities(Video.path, Video.id).all()}
        found_paths = set()

        added = 0
        skipped = 0

        for folder_id, scan_dir in scan_dirs:
            for root, dirs, files in os.walk(scan_dir):
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for fname in files:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in SUPPORTED_EXTS:
                        continue

                    abs_path = os.path.abspath(os.path.join(root, fname))
                    found_paths.add(abs_path)

                    if abs_path in existing:
                        skipped += 1
                        continue

                    try:
                        file_size = os.path.getsize(abs_path)
                        duration = get_duration(abs_path)
                        resolution = get_resolution(abs_path)

                        # Category: subfolder name relative to scan_dir, or "Uncategorized"
                        rel = os.path.relpath(abs_path, scan_dir)
                        parts = rel.split(os.sep)
                        category = parts[0] if len(parts) > 1 else "Uncategorized"

                        video = Video(
                            filename=fname,
                            path=abs_path,
                            size=file_size,
                            duration=duration,
                            category=category,
                            folder_id=folder_id,
                            date_added=datetime.utcnow(),
                            watch_progress_secs=0,
                            is_favorite=False,
                            resolution=resolution,
                        )
                        db.add(video)
                        db.flush()

                        thumb = generate_thumbnail(abs_path, video.id)
                        video.thumbnail_path = thumb
                        db.add(video)
                        db.commit()
                        added += 1
                        print(f"[scanner] Added: {fname} ({resolution or 'unknown res'})")
                    except Exception as e:
                        db.rollback()
                        print(f"[scanner] Error processing {fname}: {e}")

        # Remove stale entries (file deleted from disk, but its root folder is available)
        all_videos = db.query(Video).all()
        removed = 0
        for v in all_videos:
            if v.folder_id in available_folder_ids:
                if not os.path.exists(v.path):
                    db.delete(v)
                    removed += 1
                    print(f"[scanner] Removed stale: {v.filename}")
        if removed:
            db.commit()

        total = db.query(Video).count()
        return {"added": added, "removed": removed, "skipped": skipped, "total": total}

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

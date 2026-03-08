"""
scanner.py — Multi-folder recursive video library discovery
Scans all WatchedFolder paths + default media/ directory.
Removes stale entries for files that no longer exist on disk.
"""
import os
from datetime import datetime
from database import SessionLocal, Video, WatchedFolder
from thumbnailer import generate_thumbnail, get_duration
DEFAULT_MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media")
SUPPORTED_EXTS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".ts", ".flv"}


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
        scan_dirs = [(None, os.path.abspath(DEFAULT_MEDIA_DIR))]
        for w in watched:
            if os.path.isdir(w.path):
                scan_dirs.append((w.id, w.path))

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

                    file_size = os.path.getsize(abs_path)
                    duration = get_duration(abs_path)

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
                    )
                    db.add(video)
                    db.flush()

                    thumb = generate_thumbnail(abs_path, video.id)
                    video.thumbnail_path = thumb
                    db.add(video)
                    db.commit()
                    added += 1
                    print(f"[scanner] Added: {fname}")

        # Remove stale entries (file deleted from disk)
        all_videos = db.query(Video).all()
        removed = 0
        for v in all_videos:
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

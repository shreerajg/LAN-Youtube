"""
main.py — FastAPI LAN Media Server
Multi-folder streaming, watch progress, folder management API.
"""
import os
import shutil
import subprocess
import socket
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, List

import aiofiles
import tempfile
from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks
from fastapi.responses import (
    StreamingResponse,
    FileResponse,
    JSONResponse,
    HTMLResponse,
)
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import init_db, get_db, Video, WatchedFolder, SessionLocal, Playlist, PlaylistItem
from scanner import scan_library

# ─── Constants ────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
THUMB_DIR   = os.path.join(BASE_DIR, "..", "thumbnails")
FRONT_DIST  = os.path.join(BASE_DIR, "..", "frontend", "dist")
CHUNK_SIZE  = 5 * 1024 * 1024   # 5 MB chunks for smoother streaming
FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"

HLS_DIR = os.path.join(tempfile.gettempdir(), "lan_youtube_hls")
os.makedirs(HLS_DIR, exist_ok=True)
active_transcodes = {}

MIME_MAP = {
    ".mp4":  "video/mp4",
    ".mkv":  "video/x-matroska",
    ".webm": "video/webm",
    ".avi":  "video/x-msvideo",
    ".mov":  "video/quicktime",
    ".m4v":  "video/mp4",
    ".ts":   "video/mp2t",
    ".flv":  "video/x-flv",
}

# ─── Startup ──────────────────────────────────────────────────────────────────
def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ip = get_local_ip()
    print("\n" + "="*55)
    print("      LAN YouTube - Media Server")
    print("="*55)
    print(f"  Local:    http://localhost:8000")
    print(f"  Network:  http://{ip}:8000  < share this with LAN devices")
    print("="*55 + "\n")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, scan_library)

    yield


app = FastAPI(title="LAN YouTube", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

os.makedirs(THUMB_DIR, exist_ok=True)

# ─── Pydantic Schemas ─────────────────────────────────────────────────────────
class VideoOut(BaseModel):
    id: int
    filename: str
    size: float
    duration: float
    category: str
    date_added: datetime
    thumbnail_url: str
    stream_url: str
    download_url: str
    path: str
    last_watched_at: Optional[datetime] = None
    watch_progress_secs: float = 0

    model_config = {"from_attributes": True}


class FolderOut(BaseModel):
    id: int
    path: str
    label: Optional[str] = None
    date_added: datetime

    model_config = {"from_attributes": True}


class FolderIn(BaseModel):
    path: str
    label: Optional[str] = None


class ProgressIn(BaseModel):
    seconds: float


class PlaylistIn(BaseModel):
    name: str
    description: Optional[str] = None


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


def video_to_out(v: Video) -> VideoOut:
    return VideoOut(
        id=v.id,
        filename=v.filename,
        size=v.size,
        duration=v.duration or 0,
        category=v.category or "Uncategorized",
        date_added=v.date_added,
        thumbnail_url=f"/api/thumbnail/{v.id}",
        stream_url=f"/api/stream/{v.id}",
        download_url=f"/api/download/{v.id}",
        path=v.path,
        last_watched_at=v.last_watched_at,
        watch_progress_secs=v.watch_progress_secs or 0,
    )


# ─── Video API Routes ─────────────────────────────────────────────────────────
@app.get("/api/videos", response_model=List[VideoOut])
def list_videos(
    skip: int = 0,
    limit: int = 200,
    sort: str = "date_added",
    db: Session = Depends(get_db),
):
    q = db.query(Video)
    if sort == "name":
        q = q.order_by(Video.filename.asc())
    elif sort == "size":
        q = q.order_by(Video.size.desc())
    elif sort == "duration":
        q = q.order_by(Video.duration.desc())
    elif sort == "recently_watched":
        q = q.filter(Video.last_watched_at.isnot(None)).order_by(Video.last_watched_at.desc())
    else:
        q = q.order_by(Video.date_added.desc())
    videos = q.offset(skip).limit(limit).all()
    return [video_to_out(v) for v in videos]


@app.get("/api/videos/search", response_model=List[VideoOut])
def search_videos(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Video)
    if q:
        query = query.filter(Video.filename.ilike(f"%{q}%"))
    videos = query.order_by(Video.date_added.desc()).all()
    return [video_to_out(v) for v in videos]


@app.get("/api/videos/in-progress", response_model=List[VideoOut])
def in_progress_videos(db: Session = Depends(get_db)):
    """Videos with watch progress > 30s but not fully watched (< 95% complete)."""
    videos = (
        db.query(Video)
        .filter(Video.watch_progress_secs > 30)
        .filter(Video.duration.isnot(None))
        .order_by(Video.last_watched_at.desc())
        .limit(20)
        .all()
    )
    # Filter out fully watched ones (>95% of duration)
    result = [v for v in videos if v.duration and v.watch_progress_secs < v.duration * 0.95]
    return [video_to_out(v) for v in result]


@app.get("/api/videos/{video_id}", response_model=VideoOut)
def get_video(video_id: int, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    return video_to_out(v)


@app.put("/api/videos/{video_id}/progress")
def update_progress(video_id: int, body: ProgressIn, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    v.watch_progress_secs = body.seconds
    v.last_watched_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ─── Thumbnail ────────────────────────────────────────────────────────────────
@app.get("/api/thumbnail/{video_id}")
def serve_thumbnail(video_id: int, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v or not v.thumbnail_path or not os.path.exists(v.thumbnail_path):
        svg = """<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'>
          <defs>
            <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' stop-color='#0d0d1a'/>
              <stop offset='100%' stop-color='#1a0a2e'/>
            </linearGradient>
          </defs>
          <rect width='1280' height='720' fill='url(#g)'/>
          <circle cx='640' cy='360' r='80' fill='rgba(139,92,246,0.15)' stroke='rgba(139,92,246,0.4)' stroke-width='2'/>
          <polygon points='620,330 620,390 680,360' fill='rgba(139,92,246,0.8)'/>
        </svg>"""
        return HTMLResponse(content=svg, media_type="image/svg+xml")
    return FileResponse(v.thumbnail_path, media_type="image/jpeg")


# ─── HLS Streaming ────────────────────────────────────────────────────────────

@app.get("/api/hls/{video_id}/playlist.m3u8")
async def serve_hls_playlist(video_id: int, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v or not os.path.exists(v.path):
        raise HTTPException(status_code=404, detail="Video not found")

    out_dir = os.path.join(HLS_DIR, str(video_id))
    os.makedirs(out_dir, exist_ok=True)
    playlist_path = os.path.join(out_dir, "playlist.m3u8")

    if video_id not in active_transcodes:
        # Clear previous segments
        for f in os.listdir(out_dir):
            try:
                os.remove(os.path.join(out_dir, f))
            except:
                pass
            
        cmd = [
            FFMPEG_PATH,
            "-i", v.path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_playlist_type", "event",
            "-hls_segment_filename", os.path.join(out_dir, "segment_%05d.ts"),
            playlist_path
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        active_transcodes[video_id] = proc
        
    for _ in range(50):
        if os.path.exists(playlist_path):
            with open(playlist_path, "r") as f:
                content = f.read()
                if "segment_" in content:
                    break
        await asyncio.sleep(0.2)
        
    if not os.path.exists(playlist_path):
        raise HTTPException(status_code=500, detail="Failed to initialize HLS stream")
        
    return FileResponse(playlist_path, media_type="application/vnd.apple.mpegurl")

@app.get("/api/hls/{video_id}/{file_name}")
async def serve_hls_segment(video_id: int, file_name: str):
    path = os.path.join(HLS_DIR, str(video_id), file_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    return FileResponse(path)

# ─── Streaming ────────────────────────────────────────────────────────────────
@app.get("/api/stream/{video_id}")
async def stream_video(video_id: int, request: Request, start: float = 0.0, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = v.path
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = os.path.getsize(video_path)
    ext = os.path.splitext(video_path)[1].lower()
    content_type = MIME_MAP.get(ext, "video/mp4")

    range_header = request.headers.get("Range")

    if range_header:
        try:
            range_val = range_header.strip().replace("bytes=", "")
            parts = range_val.split("-")
            start = int(parts[0]) if parts[0] else 0
            end   = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            raise HTTPException(status_code=416, detail="Invalid Range header")

        end = min(end, file_size - 1)
        content_length = end - start + 1

        async def range_generator():
            async with aiofiles.open(video_path, "rb") as f:
                await f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = await f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            range_generator(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(content_length),
                "Cache-Control":  "no-cache",
            },
        )

    async def full_generator():
        async with aiofiles.open(video_path, "rb") as f:
            while True:
                chunk = await f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        full_generator(),
        status_code=200,
        media_type=content_type,
        headers={
            "Accept-Ranges":  "bytes",
            "Content-Length": str(file_size),
            "Cache-Control":  "no-cache",
        },
    )


@app.get("/api/download/{video_id}")
async def download_video(video_id: int, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v or not os.path.exists(v.path):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(
        v.path,
        filename=v.filename,
        headers={"Content-Disposition": f'attachment; filename="{v.filename}"'},
    )


# ─── Folder Management ────────────────────────────────────────────────────────
@app.get("/api/folders", response_model=List[FolderOut])
def list_folders(db: Session = Depends(get_db)):
    return db.query(WatchedFolder).order_by(WatchedFolder.date_added.asc()).all()


@app.post("/api/folders", response_model=FolderOut)
def add_folder(body: FolderIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    path = os.path.abspath(body.path)
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Path does not exist or is not a directory: {path}")

    existing = db.query(WatchedFolder).filter(WatchedFolder.path == path).first()
    if existing:
        raise HTTPException(status_code=409, detail="Folder already watched")

    folder = WatchedFolder(
        path=path,
        label=body.label or os.path.basename(path),
        date_added=datetime.utcnow(),
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    # Kick off a background scan so videos appear immediately
    background_tasks.add_task(scan_library)
    return folder


@app.delete("/api/folders/{folder_id}")
def remove_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(WatchedFolder).filter(WatchedFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Remove all videos that came from this folder
    db.query(Video).filter(Video.folder_id == folder_id).delete()
    db.delete(folder)
    db.commit()
    return {"ok": True, "message": f"Removed folder and its videos"}


# ─── Scan & Stats ─────────────────────────────────────────────────────────────
@app.post("/api/scan")
def trigger_scan(background_tasks: BackgroundTasks):
    background_tasks.add_task(scan_library)
    return {"status": "scan started"}


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Video).count()
    total_size = db.query(Video).with_entities(Video.size).all()
    size_gb = sum(r[0] for r in total_size) / (1024 ** 3)
    categories = db.query(Video.category).distinct().all()
    folders = db.query(WatchedFolder).count()
    return {
        "total_videos": total,
        "total_size_gb": round(size_gb, 2),
        "categories": [c[0] for c in categories if c[0]],
        "total_folders": folders,
    }


# ─── Playlist API ──────────────────────────────────────────────────────────────
class PlaylistItemOut(BaseModel):
    id: int
    video_id: int
    position: int
    video: Optional[VideoOut] = None

    model_config = {"from_attributes": True}


class PlaylistOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    date_created: datetime
    item_count: int = 0
    items: Optional[List[PlaylistItemOut]] = None

    model_config = {"from_attributes": True}


@app.get("/api/playlists", response_model=List[PlaylistOut])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.date_created.desc()).all()
    result = []
    for p in playlists:
        item_count = db.query(PlaylistItem).filter(PlaylistItem.playlist_id == p.id).count()
        result.append(PlaylistOut(
            id=p.id,
            name=p.name,
            description=p.description,
            date_created=p.date_created,
            item_count=item_count,
        ))
    return result


@app.post("/api/playlists", response_model=PlaylistOut)
def create_playlist(body: PlaylistIn, db: Session = Depends(get_db)):
    playlist = Playlist(
        name=body.name,
        description=body.description or "",
        date_created=datetime.utcnow(),
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return PlaylistOut(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        date_created=playlist.date_created,
        item_count=0,
    )


@app.get("/api/playlists/{playlist_id}", response_model=PlaylistOut)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    items = db.query(PlaylistItem).filter(PlaylistItem.playlist_id == playlist_id).order_by(PlaylistItem.position).all()
    video_items = []
    for item in items:
        v = db.query(Video).filter(Video.id == item.video_id).first()
        if v:
            video_items.append(PlaylistItemOut(
                id=item.id,
                video_id=item.video_id,
                position=item.position,
                video=video_to_out(v),
            ))
    
    return PlaylistOut(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        date_created=playlist.date_created,
        item_count=len(video_items),
        items=video_items,
    )


@app.put("/api/playlists/{playlist_id}", response_model=PlaylistOut)
def update_playlist(playlist_id: int, body: PlaylistUpdate, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if body.name is not None:
        playlist.name = body.name
    if body.description is not None:
        playlist.description = body.description
    db.commit()
    db.refresh(playlist)
    return get_playlist(playlist_id, db)


@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(playlist)
    db.commit()
    return {"ok": True}


@app.post("/api/playlists/{playlist_id}/items")
def add_to_playlist(playlist_id: int, video_id: int = 0, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    max_pos = db.query(PlaylistItem).filter(PlaylistItem.playlist_id == playlist_id).count()
    
    existing = db.query(PlaylistItem).filter(
        PlaylistItem.playlist_id == playlist_id,
        PlaylistItem.video_id == video_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Video already in playlist")
    
    item = PlaylistItem(
        playlist_id=playlist_id,
        video_id=video_id,
        position=max_pos,
        date_added=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    return {"ok": True, "position": max_pos}


@app.delete("/api/playlists/{playlist_id}/items/{item_id}")
def remove_from_playlist(playlist_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.query(PlaylistItem).filter(
        PlaylistItem.id == item_id,
        PlaylistItem.playlist_id == playlist_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.put("/api/playlists/{playlist_id}/reorder")
def reorder_playlist(playlist_id: int, item_ids: List[int], db: Session = Depends(get_db)):
    for pos, item_id in enumerate(item_ids):
        item = db.query(PlaylistItem).filter(
            PlaylistItem.id == item_id,
            PlaylistItem.playlist_id == playlist_id,
        ).first()
        if item:
            item.position = pos
    db.commit()
    return {"ok": True}


# ─── Serve React SPA ──────────────────────────────────────────────────────────
if os.path.exists(FRONT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONT_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = os.path.join(FRONT_DIST, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return HTMLResponse("<h1>Frontend not built. Run: npm run build inside /frontend</h1>")
else:
    @app.get("/")
    async def root():
        return HTMLResponse(
            "<h1>LAN YouTube backend is running.</h1>"
            "<p>Build the frontend: <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code></p>"
        )

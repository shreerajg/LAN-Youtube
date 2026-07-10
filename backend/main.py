"""
main.py — FastAPI LAN Media Server
Multi-folder streaming, watch progress, folder management,
LAN file share, LAN chat, device discovery, clipboard sync.
"""
import os
import shutil
import subprocess
import socket
import asyncio
import uuid
import mimetypes
import io
import base64
import time
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

import aiofiles
import tempfile
from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import (
    StreamingResponse,
    FileResponse,
    JSONResponse,
    HTMLResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import init_db, get_db, Video, WatchedFolder, SessionLocal, Playlist, PlaylistItem, SharedFile, ClipboardItem
from scanner import scan_library

# ─── Constants ────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
THUMB_DIR     = os.path.join(BASE_DIR, "..", "thumbnails")
FRONT_DIST    = os.path.join(BASE_DIR, "..", "frontend", "dist")
SHARED_FILES  = os.path.join(BASE_DIR, "..", "shared_files")
CHUNK_SIZE    = 5 * 1024 * 1024   # 5 MB
FFMPEG_PATH   = shutil.which("ffmpeg") or "ffmpeg"
MAX_CLIPBOARD = 20
SERVER_START  = time.time()

HLS_DIR = os.path.join(tempfile.gettempdir(), "lan_youtube_hls")
os.makedirs(HLS_DIR, exist_ok=True)
os.makedirs(SHARED_FILES, exist_ok=True)
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

FILE_CATEGORY_MAP = {
    "image":    [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".heic"],
    "video":    [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv", ".ts"],
    "audio":    [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"],
    "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".odt"],
    "archive":  [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"],
    "code":     [".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".json", ".yaml", ".yml", ".xml", ".sh", ".bat"],
}

# ─── Chat Manager ─────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # client_id -> ws
        self.client_meta: Dict[str, Dict] = {}              # client_id -> {name, color, ip}
        self.message_history: List[Dict] = []
        self.COLORS = [
            "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981",
            "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
            "#f97316", "#a855f7",
        ]
        self._color_idx = 0

    def _next_color(self) -> str:
        c = self.COLORS[self._color_idx % len(self.COLORS)]
        self._color_idx += 1
        return c

    async def connect(self, websocket: WebSocket, client_id: str, name: str, ip: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.client_meta[client_id] = {
            "name": name,
            "color": self._next_color(),
            "ip": ip,
        }
        join_msg = {
            "type": "system",
            "text": f"{name} joined the chat",
            "timestamp": datetime.utcnow().isoformat(),
            "client_id": client_id,
        }
        self.message_history.append(join_msg)
        if len(self.message_history) > 200:
            self.message_history = self.message_history[-200:]
        await self.broadcast(join_msg)
        # Send history + roster to newcomer
        await websocket.send_json({
            "type": "init",
            "history": self.message_history[-100:],
            "roster": list(self.client_meta.values()),
            "your_id": client_id,
            "your_meta": self.client_meta[client_id],
        })

    def disconnect(self, client_id: str):
        name = self.client_meta.get(client_id, {}).get("name", "Unknown")
        self.active_connections.pop(client_id, None)
        self.client_meta.pop(client_id, None)
        return name

    async def broadcast(self, message: dict):
        dead = []
        for cid, ws in self.active_connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.active_connections.pop(cid, None)
            self.client_meta.pop(cid, None)

    def get_roster(self) -> List[Dict]:
        return [
            {"client_id": cid, **meta}
            for cid, meta in self.client_meta.items()
        ]


chat_manager = ConnectionManager()


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


LOCAL_IP = "127.0.0.1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global LOCAL_IP
    init_db()
    LOCAL_IP = get_local_ip()
    print("\n" + "="*55)
    print("      LAN YouTube - Media Server")
    print("="*55)
    print(f"  Local:    http://localhost:8000")
    print(f"  Network:  http://{LOCAL_IP}:8000  < share this with LAN devices")
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
    is_favorite: bool = False
    resolution: Optional[str] = None

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


class SharedFileOut(BaseModel):
    id: int
    filename: str
    size: float
    mime_type: Optional[str] = None
    category: str
    uploaded_by_ip: Optional[str] = None
    date_uploaded: datetime
    download_url: str

    model_config = {"from_attributes": True}


class ClipboardItemOut(BaseModel):
    id: int
    content: str
    device_ip: Optional[str] = None
    device_name: Optional[str] = None
    date_created: datetime

    model_config = {"from_attributes": True}


class ClipboardIn(BaseModel):
    content: str
    device_name: Optional[str] = None


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
        is_favorite=bool(v.is_favorite),
        resolution=v.resolution,
    )


def shared_file_to_out(f: SharedFile) -> SharedFileOut:
    return SharedFileOut(
        id=f.id,
        filename=f.filename,
        size=f.size,
        mime_type=f.mime_type,
        category=f.category,
        uploaded_by_ip=f.uploaded_by_ip,
        date_uploaded=f.date_uploaded,
        download_url=f"/api/files/download/{f.id}",
    )


def get_file_category(ext: str) -> str:
    ext = ext.lower()
    for cat, exts in FILE_CATEGORY_MAP.items():
        if ext in exts:
            return cat
    return "other"


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
    elif sort == "favorites":
        q = q.filter(Video.is_favorite == True).order_by(Video.date_added.desc())
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
    """Videos with watch progress >30s but not fully watched (< 95% complete)."""
    videos = (
        db.query(Video)
        .filter(Video.watch_progress_secs > 30)
        .filter(Video.duration.isnot(None))
        .order_by(Video.last_watched_at.desc())
        .limit(20)
        .all()
    )
    result = [v for v in videos if v.duration and v.watch_progress_secs < v.duration * 0.95]
    return [video_to_out(v) for v in result]


@app.get("/api/videos/history", response_model=List[VideoOut])
def watch_history(db: Session = Depends(get_db)):
    """All ever-watched videos ordered by most recently watched."""
    videos = (
        db.query(Video)
        .filter(Video.last_watched_at.isnot(None))
        .order_by(Video.last_watched_at.desc())
        .all()
    )
    return [video_to_out(v) for v in videos]


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


@app.put("/api/videos/{video_id}/favorite")
def toggle_favorite(video_id: int, db: Session = Depends(get_db)):
    """Toggle the is_favorite flag for a video."""
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    v.is_favorite = not bool(v.is_favorite)
    db.commit()
    return {"ok": True, "is_favorite": bool(v.is_favorite)}


@app.delete("/api/videos/{video_id}/history")
def clear_video_history(video_id: int, db: Session = Depends(get_db)):
    """Clear watch history (progress + timestamp) for a single video."""
    v = db.query(Video).filter(Video.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    v.watch_progress_secs = 0
    v.last_watched_at = None
    db.commit()
    return {"ok": True}


@app.delete("/api/videos/history/all")
def clear_all_history(db: Session = Depends(get_db)):
    """Clear watch history for ALL videos."""
    db.query(Video).update({
        "watch_progress_secs": 0,
        "last_watched_at": None,
    })
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

    background_tasks.add_task(scan_library)
    return folder


@app.delete("/api/folders/{folder_id}")
def remove_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(WatchedFolder).filter(WatchedFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

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
    favorites = db.query(Video).filter(Video.is_favorite == True).count()
    shared = db.query(SharedFile).count()
    shared_size = db.query(SharedFile).with_entities(SharedFile.size).all()
    shared_size_mb = sum(r[0] for r in shared_size) / (1024 ** 2)
    return {
        "total_videos": total,
        "total_size_gb": round(size_gb, 2),
        "categories": [c[0] for c in categories if c[0]],
        "total_folders": folders,
        "total_favorites": favorites,
        "shared_files": shared,
        "shared_size_mb": round(shared_size_mb, 2),
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


# ─── LAN File Share ───────────────────────────────────────────────────────────
@app.get("/api/files", response_model=List[SharedFileOut])
def list_shared_files(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(SharedFile).order_by(SharedFile.date_uploaded.desc())
    if category and category != "all":
        q = q.filter(SharedFile.category == category)
    return [shared_file_to_out(f) for f in q.all()]


@app.post("/api/files/upload", response_model=SharedFileOut)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Determine category & mime
    ext = os.path.splitext(file.filename or "")[1].lower()
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    category = get_file_category(ext)

    # Generate unique stored name
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(SHARED_FILES, stored_name)

    # Stream write to disk
    total_size = 0
    async with aiofiles.open(dest_path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)  # 1 MB chunks
            if not chunk:
                break
            await out.write(chunk)
            total_size += len(chunk)

    # Get client IP
    client_ip = request.client.host if request.client else "unknown"

    record = SharedFile(
        filename=file.filename or stored_name,
        stored_name=stored_name,
        size=total_size,
        mime_type=mime,
        category=category,
        uploaded_by_ip=client_ip,
        date_uploaded=datetime.utcnow(),
        path=dest_path,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Broadcast to chat that a file was shared
    await chat_manager.broadcast({
        "type": "system",
        "text": f"📁 {file.filename} was shared from {client_ip}",
        "timestamp": datetime.utcnow().isoformat(),
        "client_id": "system",
    })

    return shared_file_to_out(record)


@app.get("/api/files/download/{file_id}")
def download_shared_file(file_id: int, db: Session = Depends(get_db)):
    f = db.query(SharedFile).filter(SharedFile.id == file_id).first()
    if not f or not os.path.exists(f.path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        f.path,
        filename=f.filename,
        media_type=f.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{f.filename}"'},
    )


@app.delete("/api/files/{file_id}")
def delete_shared_file(file_id: int, db: Session = Depends(get_db)):
    f = db.query(SharedFile).filter(SharedFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(f.path):
        try:
            os.remove(f.path)
        except Exception:
            pass
    db.delete(f)
    db.commit()
    return {"ok": True}


# ─── LAN Chat (WebSocket) ─────────────────────────────────────────────────────
@app.websocket("/api/ws/chat")
async def chat_endpoint(websocket: WebSocket):
    client_id = str(uuid.uuid4())[:8]
    client_ip = websocket.client.host if websocket.client else "unknown"

    # Name from query param, fallback to Device_<ip_suffix>
    params = websocket.query_params
    raw_name = params.get("name", "").strip()
    name = raw_name if raw_name else f"Device_{client_ip.split('.')[-1]}"

    await chat_manager.connect(websocket, client_id, name, client_ip)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "message":
                text = data.get("text", "").strip()
                if not text:
                    continue
                meta = chat_manager.client_meta.get(client_id, {})
                msg = {
                    "type": "message",
                    "client_id": client_id,
                    "name": meta.get("name", name),
                    "color": meta.get("color", "#8b5cf6"),
                    "text": text[:2000],
                    "timestamp": datetime.utcnow().isoformat(),
                }
                chat_manager.message_history.append(msg)
                if len(chat_manager.message_history) > 200:
                    chat_manager.message_history = chat_manager.message_history[-200:]
                await chat_manager.broadcast(msg)
            elif data.get("type") == "rename":
                new_name = data.get("name", "").strip()
                if new_name and client_id in chat_manager.client_meta:
                    old_name = chat_manager.client_meta[client_id]["name"]
                    chat_manager.client_meta[client_id]["name"] = new_name[:30]
                    sys_msg = {
                        "type": "system",
                        "text": f"{old_name} renamed to {new_name}",
                        "timestamp": datetime.utcnow().isoformat(),
                        "client_id": "system",
                    }
                    await chat_manager.broadcast(sys_msg)
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        left_name = chat_manager.disconnect(client_id)
        leave_msg = {
            "type": "system",
            "text": f"{left_name} left the chat",
            "timestamp": datetime.utcnow().isoformat(),
            "client_id": "system",
        }
        chat_manager.message_history.append(leave_msg)
        await chat_manager.broadcast(leave_msg)


@app.get("/api/chat/history")
def get_chat_history():
    return {"messages": chat_manager.message_history[-100:]}


@app.get("/api/chat/roster")
def get_chat_roster():
    return {"roster": chat_manager.get_roster(), "online": len(chat_manager.active_connections)}


# ─── LAN Device Discovery & Presence ────────────────────────────────────────────
class HeartbeatIn(BaseModel):
    device_id: str
    name: str

active_peers: Dict[str, dict] = {}

@app.post("/api/lan/heartbeat")
def lan_heartbeat(body: HeartbeatIn, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    active_peers[body.device_id] = {
        "name": body.name,
        "ip": client_ip,
        "last_seen": time.time()
    }
    return {"ok": True}

@app.get("/api/lan/peers")
def get_lan_peers():
    now = time.time()
    valid_peers = []
    to_delete = []
    for d_id, data in active_peers.items():
        if now - data["last_seen"] < 30:
            valid_peers.append({"device_id": d_id, "name": data["name"], "ip": data["ip"]})
        else:
            to_delete.append(d_id)
            
    for d_id in to_delete:
        del active_peers[d_id]
        
    return {"peers": valid_peers, "total": len(valid_peers)}

async def ping_host(ip: str) -> Optional[Dict[str, Any]]:
    """Ping a single IP and return info if alive."""
    try:
        start = asyncio.get_event_loop().time()
        proc = await asyncio.create_subprocess_exec(
            "ping", "-n", "1", "-w", "300", ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=1.5)
        elapsed = (asyncio.get_event_loop().time() - start) * 1000
        output = stdout.decode(errors="replace")
        if "TTL=" in output or "ttl=" in output:
            # Try hostname
            hostname = ip
            try:
                hostname = socket.gethostbyaddr(ip)[0]
            except Exception:
                pass
            return {
                "ip": ip,
                "hostname": hostname,
                "ping_ms": round(elapsed, 1),
                "alive": True,
            }
    except Exception:
        pass
    return None


@app.get("/api/lan/devices")
async def discover_devices():
    """Scan the local subnet for active devices."""
    my_ip = get_local_ip()
    parts = my_ip.split(".")
    if len(parts) != 4:
        return {"devices": [], "my_ip": my_ip}

    subnet = ".".join(parts[:3])
    tasks = [ping_host(f"{subnet}.{i}") for i in range(1, 255)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    devices = []
    for r in results:
        if isinstance(r, dict) and r:
            r["is_server"] = (r["ip"] == my_ip)
            devices.append(r)

    devices.sort(key=lambda d: [int(x) for x in d["ip"].split(".")])
    return {"devices": devices, "my_ip": my_ip, "total": len(devices)}


# ─── Clipboard Sync ────────────────────────────────────────────────────────────
@app.get("/api/clipboard", response_model=List[ClipboardItemOut])
def get_clipboard(db: Session = Depends(get_db)):
    items = db.query(ClipboardItem).order_by(ClipboardItem.date_created.desc()).limit(MAX_CLIPBOARD).all()
    return items


@app.post("/api/clipboard", response_model=ClipboardItemOut)
async def add_clipboard(body: ClipboardIn, request: Request, db: Session = Depends(get_db)):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    client_ip = request.client.host if request.client else "unknown"
    item = ClipboardItem(
        content=body.content[:50000],  # 50KB limit per item
        device_ip=client_ip,
        device_name=body.device_name or f"Device_{client_ip.split('.')[-1]}",
        date_created=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Keep only last MAX_CLIPBOARD items
    all_items = db.query(ClipboardItem).order_by(ClipboardItem.date_created.desc()).all()
    if len(all_items) > MAX_CLIPBOARD:
        for old in all_items[MAX_CLIPBOARD:]:
            db.delete(old)
        db.commit()

    # Notify chat
    await chat_manager.broadcast({
        "type": "clipboard",
        "text": f"📋 Clipboard updated by {item.device_name}",
        "timestamp": datetime.utcnow().isoformat(),
        "client_id": "system",
        "item_id": item.id,
    })

    return item


@app.delete("/api/clipboard/{item_id}")
def delete_clipboard_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ClipboardItem).filter(ClipboardItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.delete("/api/clipboard")
def clear_clipboard(db: Session = Depends(get_db)):
    db.query(ClipboardItem).delete()
    db.commit()
    return {"ok": True}


# ─── LAN Info & QR Code ───────────────────────────────────────────────────────
@app.get("/api/lan/info")
def get_lan_info(db: Session = Depends(get_db)):
    my_ip = get_local_ip()
    uptime_secs = int(time.time() - SERVER_START)
    hours, rem = divmod(uptime_secs, 3600)
    mins, secs = divmod(rem, 60)
    total_videos = db.query(Video).count()
    shared_files = db.query(SharedFile).count()
    online_users = len(chat_manager.active_connections)
    return {
        "ip": my_ip,
        "port": 8000,
        "url": f"http://{my_ip}:8000",
        "uptime": f"{hours:02d}:{mins:02d}:{secs:02d}",
        "uptime_secs": uptime_secs,
        "total_videos": total_videos,
        "shared_files": shared_files,
        "online_users": online_users,
    }


@app.get("/api/lan/qrcode")
def get_qr_code():
    """Generate QR code PNG for the server URL."""
    try:
        import qrcode
        from PIL import Image

        my_ip = get_local_ip()
        url = f"http://{my_ip}:8000"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#8b5cf6", back_color="#0d0d1f")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        return Response(content=buf.getvalue(), media_type="image/png")
    except ImportError:
        # Fallback: return a simple SVG QR placeholder
        svg = """<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
          <rect width='200' height='200' fill='#0d0d1f'/>
          <text x='100' y='100' text-anchor='middle' fill='#8b5cf6' font-size='12' font-family='monospace'>
            Install qrcode lib
          </text>
        </svg>"""
        return Response(content=svg, media_type="image/svg+xml")


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
            "<p>Build the frontend: <code>cd frontend && npm install && npm run build</code></p>"
        )

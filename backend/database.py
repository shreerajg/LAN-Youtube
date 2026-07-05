"""
database.py — SQLite ORM via SQLAlchemy
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "media.db")

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class WatchedFolder(Base):
    __tablename__ = "watched_folders"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, nullable=False)
    label = Column(String, nullable=True)
    date_added = Column(DateTime, default=datetime.utcnow)


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    path = Column(String, unique=True, nullable=False)
    size = Column(Float, nullable=False)
    duration = Column(Float, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    date_added = Column(DateTime, default=datetime.utcnow)
    category = Column(String, default="Uncategorized")
    folder_id = Column(Integer, nullable=True)
    last_watched_at = Column(DateTime, nullable=True)
    watch_progress_secs = Column(Float, default=0)
    # New columns
    is_favorite = Column(Boolean, default=False)
    resolution = Column(String, nullable=True)   # e.g. "1920x1080"


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date_created = Column(DateTime, default=datetime.utcnow)
    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan")


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    position = Column(Integer, default=0)
    date_added = Column(DateTime, default=datetime.utcnow)

    playlist = relationship("Playlist", back_populates="items")


class SharedFile(Base):
    __tablename__ = "shared_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)          # original filename
    stored_name = Column(String, nullable=False)       # uuid-based stored name
    size = Column(Float, nullable=False)               # bytes
    mime_type = Column(String, nullable=True)
    category = Column(String, default="other")        # image, document, audio, video, archive, other
    uploaded_by_ip = Column(String, nullable=True)
    date_uploaded = Column(DateTime, default=datetime.utcnow)
    path = Column(String, nullable=False)              # absolute path on disk


class ClipboardItem(Base):
    __tablename__ = "clipboard_items"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    device_ip = Column(String, nullable=True)
    device_name = Column(String, nullable=True)
    date_created = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)

    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    existing_cols = {col["name"] for col in inspector.get_columns("videos")} if inspector.has_table("videos") else set()
    with engine.connect() as conn:
        if "last_watched_at" not in existing_cols and inspector.has_table("videos"):
            conn.execute(text("ALTER TABLE videos ADD COLUMN last_watched_at DATETIME"))
        if "watch_progress_secs" not in existing_cols and inspector.has_table("videos"):
            conn.execute(text("ALTER TABLE videos ADD COLUMN watch_progress_secs REAL DEFAULT 0"))
        if "folder_id" not in existing_cols and inspector.has_table("videos"):
            conn.execute(text("ALTER TABLE videos ADD COLUMN folder_id INTEGER"))
        if "is_favorite" not in existing_cols and inspector.has_table("videos"):
            conn.execute(text("ALTER TABLE videos ADD COLUMN is_favorite INTEGER DEFAULT 0"))
        if "resolution" not in existing_cols and inspector.has_table("videos"):
            conn.execute(text("ALTER TABLE videos ADD COLUMN resolution TEXT"))

        if not inspector.has_table("playlists"):
            conn.execute(text("CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, date_created DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        if not inspector.has_table("playlist_items"):
            conn.execute(text("CREATE TABLE IF NOT EXISTS playlist_items (id INTEGER PRIMARY KEY, playlist_id INTEGER NOT NULL, video_id INTEGER NOT NULL, position INTEGER DEFAULT 0, date_added DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(playlist_id) REFERENCES playlists(id), FOREIGN KEY(video_id) REFERENCES videos(id))"))

        # New tables
        if not inspector.has_table("shared_files"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS shared_files (
                    id INTEGER PRIMARY KEY,
                    filename TEXT NOT NULL,
                    stored_name TEXT NOT NULL,
                    size REAL NOT NULL,
                    mime_type TEXT,
                    category TEXT DEFAULT 'other',
                    uploaded_by_ip TEXT,
                    date_uploaded DATETIME DEFAULT CURRENT_TIMESTAMP,
                    path TEXT NOT NULL
                )
            """))
        if not inspector.has_table("clipboard_items"):
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS clipboard_items (
                    id INTEGER PRIMARY KEY,
                    content TEXT NOT NULL,
                    device_ip TEXT,
                    device_name TEXT,
                    date_created DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

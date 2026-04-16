"""
database.py — SQLite ORM via SQLAlchemy
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
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
        
        if not inspector.has_table("playlists"):
            conn.execute(text("CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, date_created DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        if not inspector.has_table("playlist_items"):
            conn.execute(text("CREATE TABLE IF NOT EXISTS playlist_items (id INTEGER PRIMARY KEY, playlist_id INTEGER NOT NULL, video_id INTEGER NOT NULL, position INTEGER DEFAULT 0, date_added DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(playlist_id) REFERENCES playlists(id), FOREIGN KEY(video_id) REFERENCES videos(id))"))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

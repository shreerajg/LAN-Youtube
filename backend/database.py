"""
database.py — SQLite ORM via SQLAlchemy
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
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
    size = Column(Float, nullable=False)          # bytes
    duration = Column(Float, nullable=True)       # seconds
    thumbnail_path = Column(String, nullable=True)
    date_added = Column(DateTime, default=datetime.utcnow)
    category = Column(String, default="Uncategorized")
    folder_id = Column(Integer, nullable=True)    # which WatchedFolder it came from
    last_watched_at = Column(DateTime, nullable=True)
    watch_progress_secs = Column(Float, default=0)


def init_db():
    Base.metadata.create_all(bind=engine)

    # Migrate existing DB: add new columns if missing
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
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

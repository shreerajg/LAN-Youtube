# 🎬 LAN YouTube — Local Media Server

A high-performance, self-hosted media server for your local network. Stream your videos at full quality on any device on the same WiFi/Ethernet.

---

## 🚀 Quick Start (Windows)

> **Requirements:** Python 3.9+, Node.js 18+, FFmpeg (for thumbnails)

**Double-click `start.bat`** — it installs everything and launches the server automatically.

The console will print:
```
  Network:  http://192.168.x.x:8000  ← open this on any LAN device
```

Open that URL in any browser on your network. Done.

---

## 📁 Adding Videos

Drop your `.mp4`, `.mkv`, or `.webm` files into the **`media/`** folder.

```
LAN YOUTUBE/
└── media/
    ├── Movies/
    │   └── myfilm.mp4
    ├── Shows/
    │   └── episode.mkv
    └── standalone.webm
```

> **Tip:** Subfolders become **categories** in the UI (e.g., `Movies/`, `Shows/`)

After dropping files, click the **"Scan Library"** button in the top-right of the UI. The server also auto-scans on every startup.

---

## ⚙️ Manual Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend (build once)
```bash
cd frontend
npm install
npm run build
```

### Frontend (dev mode with hot-reload)
```bash
cd frontend
npm run dev
```
Access at `http://localhost:5173` — proxies API calls to FastAPI on port 8000.

---

## 🎯 Features

| Feature | Details |
|---|---|
| **Instant Seeking** | HTTP 206 byte-range streaming — seek to any point instantly |
| **High-Quality Thumbnails** | FFmpeg extracts 1280×720 JPEG at 10% of duration |
| **Dark Netflix UI** | Responsive 5-column grid, hover animations, glassmorphism |
| **Video Player** | Plyr.js with speed control (0.5×–2×), fullscreen, keyboard shortcuts |
| **Download Button** | One-click download of any video |
| **Live Search** | Real-time filter as you type |
| **Category Filter** | Subfolders auto-become categories |
| **Multi-Device** | Serves all LAN devices simultaneously |
| **Auto IP Print** | Shows your `192.168.x.x:8000` address on startup |

---

## ⌨️ Player Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `← →` | Seek ±5 seconds |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `↑ ↓` | Volume up / down |

---

## 🔧 Installing FFmpeg (Windows)

1. Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Unzip and place `ffmpeg.exe` anywhere
3. Add the folder to your Windows `PATH` environment variable

Or using winget:
```powershell
winget install Gyan.FFmpeg
```

---

## 📡 Networking

The server listens on `0.0.0.0:8000` — all network interfaces.

- **Same machine:** `http://localhost:8000`
- **LAN devices:** `http://<printed-IP>:8000`

Make sure Windows Firewall allows inbound connections on port 8000, or temporarily disable it for the local network.

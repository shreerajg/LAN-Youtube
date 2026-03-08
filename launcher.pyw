"""
launcher.pyw — PHANTOM System Tray Launcher
Double-click to start. Right-click tray icon to open or stop.
Runs completely silently — no console window.

Fixes:
- Killing orphaned uvicorn processes on start/stop using taskkill by port
- Windows Job Object so uvicorn dies with the launcher, even after a crash
- Proper cleanup on all exit paths
"""
import sys
import os
import subprocess
import threading
import webbrowser
import time
import socket
import atexit
import ctypes
import ctypes.wintypes

# ── Auto-install dependencies if missing ──────────────────────────────────────
def ensure_deps():
    _py = sys.executable
    if _py.lower().endswith('pythonw.exe'):
        _py = _py[:-len('pythonw.exe')] + 'python.exe'
    missing = []
    try:
        import pystray
    except ImportError:
        missing.append('pystray')
    try:
        from PIL import Image
    except ImportError:
        missing.append('Pillow')
    if missing:
        subprocess.run(
            [_py, '-m', 'pip', 'install'] + missing + ['--quiet'],
            creationflags=subprocess.CREATE_NO_WINDOW
        )

ensure_deps()

import pystray
from PIL import Image, ImageDraw

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
PORT        = 8000
URL         = f'http://localhost:{PORT}'

# pythonw.exe has no console — swap to python.exe so uvicorn spawns correctly
_exe = sys.executable
if _exe.lower().endswith('pythonw.exe'):
    _exe = _exe[:-len('pythonw.exe')] + 'python.exe'
PYTHON_EXE = _exe

server_proc = None

# ── Windows Job Object — kills child when parent dies ─────────────────────────
_job_handle = None

def _create_job_object():
    """Create a Windows Job Object with kill-on-close semantics."""
    global _job_handle
    try:
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
        kernel32 = ctypes.windll.kernel32

        job = kernel32.CreateJobObjectW(None, None)
        if not job:
            return

        info = (ctypes.c_uint * 8)()   # JOBOBJECT_EXTENDED_LIMIT_INFORMATION (simplified)
        size = ctypes.sizeof(info)

        # Use SetInformationJobObject with class 9 (JobObjectExtendedLimitInformation)
        # We set LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        limit_info = (ctypes.c_uint64 * 16)()
        limit_info[4] = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE  # BasicLimitInformation.LimitFlags offset

        kernel32.SetInformationJobObject(job, 9, limit_info, ctypes.sizeof(limit_info))
        _job_handle = job
    except Exception:
        pass


def _assign_to_job(proc_handle):
    """Assign a subprocess to the job object."""
    if _job_handle is None:
        return
    try:
        ctypes.windll.kernel32.AssignProcessToJobObject(_job_handle, proc_handle)
    except Exception:
        pass

_create_job_object()


# ── Kill any process using our port (by PID via netstat) ─────────────────────
def kill_port(port=PORT):
    """Kill whatever process is occupying the given port, silently."""
    try:
        # netstat -ano lists TCP connections with PIDs
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True, text=True,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        for line in result.stdout.splitlines():
            if f':{port}' in line and ('LISTENING' in line or 'ESTABLISHED' in line):
                parts = line.split()
                pid = parts[-1]
                if pid.isdigit() and int(pid) != os.getpid():
                    subprocess.run(
                        ['taskkill', '/F', '/PID', pid],
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        capture_output=True
                    )
    except Exception:
        pass


# ── Tray icon image (purple + white play ▶) ───────────────────────────────────
def create_icon_image(size=64):
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=14,
                            fill=(20, 10, 40, 255))
    draw.ellipse([8, 8, size - 9, size - 9],
                 fill=(90, 40, 180, 80))
    margin = size // 5
    pts = [
        (margin + 4, margin),
        (margin + 4, size - margin),
        (size - margin, size // 2),
    ]
    draw.polygon(pts, fill=(220, 200, 255, 240))
    return img


# ── Server management ─────────────────────────────────────────────────────────
def is_port_open(port=PORT):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.5):
            return True
    except Exception:
        return False


def wait_for_server(timeout=30):
    for _ in range(timeout):
        if is_port_open():
            return True
        time.sleep(1)
    return False


def start_server_thread(tray_icon):
    global server_proc

    # If something is already on the port, kill it first for a clean start
    if is_port_open():
        kill_port()
        time.sleep(1)

    tray_icon.notify('PHANTOM', 'Starting server…')

    log_file = open('C:/tmp/uvicorn_error.log', 'w')
    server_proc = subprocess.Popen(
        [PYTHON_EXE, '-m', 'uvicorn', 'main:app',
         '--host', '0.0.0.0', f'--port={PORT}'],
        cwd=BACKEND_DIR,
        creationflags=subprocess.CREATE_NO_WINDOW,
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )

    # Assign to job object so it dies with us
    _assign_to_job(server_proc._handle)

    if wait_for_server():
        webbrowser.open(URL)
        tray_icon.notify('PHANTOM is live 🎬', f'Open at {URL}')
    else:
        tray_icon.notify('PHANTOM — Error', 'Server failed to start. Check Python/uvicorn.')


# ── Cleanup helper — terminates server proc AND kills by port ─────────────────
def _cleanup_server():
    global server_proc
    if server_proc and server_proc.poll() is None:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=5)
        except Exception:
            server_proc.kill()
        server_proc = None
    # Belt-and-suspenders: also kill by port in case proc ref is stale
    kill_port()


# Register cleanup for unexpected exits (crash, process kill, etc.)
atexit.register(_cleanup_server)


# ── Tray menu actions ─────────────────────────────────────────────────────────
def on_open(icon, item):
    webbrowser.open(URL)


def on_stop(icon, item):
    _cleanup_server()
    icon.stop()


def on_restart(icon, item):
    global server_proc
    icon.notify('PHANTOM', 'Restarting server…')
    _cleanup_server()
    time.sleep(1)
    threading.Thread(target=start_server_thread, args=(icon,), daemon=True).start()


# ── Build tray menu ───────────────────────────────────────────────────────────
menu = pystray.Menu(
    pystray.MenuItem('🎬  Open PHANTOM in Browser', on_open, default=True),
    pystray.Menu.SEPARATOR,
    pystray.MenuItem('↺   Restart Server',           on_restart),
    pystray.Menu.SEPARATOR,
    pystray.MenuItem('⏹  Stop & Exit',               on_stop),
)

icon = pystray.Icon(
    name    = 'PHANTOM',
    icon    = create_icon_image(64),
    title   = 'PHANTOM — Local Media Server',
    menu    = menu,
)

# Start server in background, then run the tray loop (blocking)
threading.Thread(target=start_server_thread, args=(icon,), daemon=True).start()
icon.run()

# icon.run() returns when the tray is stopped — clean up here too
_cleanup_server()

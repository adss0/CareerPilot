"""Starts the CareerPilot backend on this computer only (used by the desktop app).

The desktop app runs this (bundled as careerpilot-server.exe) with:
  CAREERPILOT_HOME        folder for the database, CVs and .env (Windows app-data folder)
  CAREERPILOT_PORT        port to listen on (default 8765)
  CAREERPILOT_PARENT_PID  the desktop app's process: when it's gone, this server exits too
"""

import os
import sys
import threading
import time

# The desktop window loads the app from Tauri's own origin; allow it to call the API.
os.environ.setdefault(
    "CORS_ORIGINS", "http://tauri.localhost,https://tauri.localhost,tauri://localhost"
)

WAIT_TIMEOUT = 0x102
SYNCHRONIZE = 0x00100000


def process_alive(pid: int) -> bool:
    if sys.platform == "win32":
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if not handle:
            return False
        try:
            return kernel32.WaitForSingleObject(handle, 0) == WAIT_TIMEOUT
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def watch_parent(pid: int, interval: float = 2.0) -> None:
    """Exits when the desktop app is gone, so the server never keeps running on its own.

    (A one-file bundle runs as two processes; when the app stops its launcher, or crashes,
    this process would otherwise keep holding the port.)
    """
    while process_alive(pid):
        time.sleep(interval)
    os._exit(0)


def use_log_file(home: str) -> None:
    """The desktop build has no console (sys.stdout/stderr are None), and logging would crash.

    Send output to a log file in the data folder instead, which also helps with support.
    """
    if sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(home, exist_ok=True)
    log = open(os.path.join(home, "careerpilot-server.log"), "a", encoding="utf-8", buffering=1)  # noqa: SIM115
    sys.stdout = sys.stdout or log
    sys.stderr = sys.stderr or log


def main() -> None:
    # The watchdog starts first, so even a failed start can't leave a process behind.
    parent = os.environ.get("CAREERPILOT_PARENT_PID")
    if parent and parent.isdigit():
        threading.Thread(target=watch_parent, args=(int(parent),), daemon=True).start()

    from app.core.config import HOME_DIR

    use_log_file(str(HOME_DIR))
    try:
        import uvicorn

        from app.main import app

        HOME_DIR.mkdir(parents=True, exist_ok=True)
        port = int(os.environ.get("CAREERPILOT_PORT", "8765"))
        # 127.0.0.1 only: the API is never reachable from other computers on the network.
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    except BaseException:
        import traceback

        traceback.print_exc()  # into the log file; never a dialog box
        os._exit(1)


if __name__ == "__main__":
    main()

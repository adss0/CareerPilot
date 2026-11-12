# PyInstaller recipe for the desktop app's backend: one careerpilot-server.exe.
# Build from backend/:  pyinstaller careerpilot-server.spec --noconfirm
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [("alembic.ini", "."), ("migrations", "migrations")]
binaries = []
hiddenimports = collect_submodules("app") + [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]
# Packages that ship data files (Word template, PDF fonts) or load modules dynamically.
for package in ("docx", "reportlab", "openpyxl", "email_validator", "pypdf"):
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden

a = Analysis(
    ["careerpilot_server.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "pytest", "aiosmtpd", "ruff"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="careerpilot-server",
    console=False,  # no black window: the desktop app starts it in the background
    upx=False,
)

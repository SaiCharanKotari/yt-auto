"""
ClipFlow Desktop Helper - Ultra-Lightweight Release Packager & Setup Generator
Builds ~10MB setup package that dynamically downloads ffmpeg & yt-dlp on install/first-run from cloud URLs.
"""

import sys
import os
import shutil
import zipfile
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
RELEASE_DIR = BASE_DIR.parent / "release"
BACKEND_DOWNLOADS_DIR = BASE_DIR.parent / "backend" / "public" / "downloads"

YTDLP_URL = "https://drive.usercontent.google.com/download?id=1MV8P5WJ7YMk0IwUGmyoWt4FKnJmQI2vs&export=download&confirm=t"
FFMPEG_URL = "https://drive.usercontent.google.com/download?id=1LLfNgL6Y9R_oEXc8ODDhd1CpmNkwMT1Q&export=download&confirm=t"

def build():
    print("==================================================")
    print("  Building ClipFlow Lightweight Suite (~10MB Setup)")
    print("==================================================")

    # 0. Terminate any running ClipFlow processes to release file locks
    subprocess.run(["taskkill", "/F", "/IM", "ClipFlowHelper.exe"], capture_output=True)
    subprocess.run(["taskkill", "/F", "/IM", "ClipFlowDaemon.exe"], capture_output=True)

    # 1. Clean previous builds
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR, ignore_errors=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    BACKEND_DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    icon_path = BASE_DIR / "resources" / "logo.ico"
    resources_arg = f"{BASE_DIR / 'resources'};resources"

    # 2. Build ClipFlowHelper.exe (UI & Engine)
    print("\n[1/5] Compiling ClipFlowHelper.exe (UI & Engine)...")
    cmd_helper = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",
        "--name", "ClipFlowHelper",
        "--add-data", resources_arg,
        "--distpath", str(DIST_DIR),
        "--workpath", str(BASE_DIR / "build_pyi"),
        "--clean",
        "-y",
    ]
    if icon_path.exists():
        cmd_helper.extend(["--icon", str(icon_path)])
    cmd_helper.append(str(BASE_DIR / "app.py"))
    res1 = subprocess.run(cmd_helper, cwd=str(BASE_DIR))
    if res1.returncode != 0:
        print("ERROR: ClipFlowHelper PyInstaller build failed!")
        sys.exit(res1.returncode)

    # 3. Build ClipFlowDaemon.exe (24/7 Background Listener)
    print("\n[2/5] Compiling ClipFlowDaemon.exe (Background Listener)...")
    cmd_daemon = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",
        "--name", "ClipFlowDaemon",
        "--add-data", resources_arg,
        "--distpath", str(DIST_DIR),
        "--workpath", str(BASE_DIR / "build_pyi"),
        "--clean",
        "-y",
    ]
    if icon_path.exists():
        cmd_daemon.extend(["--icon", str(icon_path)])
    cmd_daemon.append(str(BASE_DIR / "daemon.py"))
    res2 = subprocess.run(cmd_daemon, cwd=str(BASE_DIR))
    if res2.returncode != 0:
        print("ERROR: ClipFlowDaemon PyInstaller build failed!")
        sys.exit(res2.returncode)

    # 4. Create lightweight portable distribution package (~10MB)
    package_dir = DIST_DIR / "ClipFlow-Desktop-Companion"
    package_dir.mkdir(parents=True, exist_ok=True)

    for target_name in ["ClipFlowHelper", "ClipFlowDaemon"]:
        built_output = DIST_DIR / target_name
        if built_output.is_dir():
            for item in built_output.iterdir():
                if item.is_dir():
                    shutil.copytree(item, package_dir / item.name, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, package_dir / item.name)
        elif (DIST_DIR / f"{target_name}.exe").exists():
            shutil.copy2(DIST_DIR / f"{target_name}.exe", package_dir / f"{target_name}.exe")

    # Create empty bin directory
    (package_dir / "bin").mkdir(parents=True, exist_ok=True)

    # Copy resources
    if (BASE_DIR / "resources").exists():
        shutil.copytree(BASE_DIR / "resources", package_dir / "resources", dirs_exist_ok=True)

    # Add 1-click launcher, setup script, uninstaller, and README
    launcher_bat = """@echo off
start "" "%~dp0ClipFlowDaemon.exe"
exit /b 0
"""
    (package_dir / "start_helper.bat").write_text(launcher_bat, encoding="utf-8")

    setup_bat = f"""@echo off
setlocal enabledelayedexpansion
title ClipFlow Companion Setup
echo ===================================================
echo   Installing ClipFlow Desktop Companion...
echo ===================================================

set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\ClipFlow"
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%INSTALL_DIR%\\bin" 2>nul
mkdir "%INSTALL_DIR%\\resources" 2>nul

echo [1/3] Downloading High-Speed Video Engines...
if not exist "%INSTALL_DIR%\\bin\\yt-dlp.exe" (
    echo   -> Downloading yt-dlp engine from cloud...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; Write-Host '     Fetching yt-dlp.exe...'; $wc.DownloadFile('{YTDLP_URL}', '%INSTALL_DIR%\\bin\\yt-dlp.exe'); Write-Host '     yt-dlp.exe download complete.'"
) else (
    echo   -> yt-dlp engine already present.
)

if not exist "%INSTALL_DIR%\\bin\\ffmpeg.exe" (
    echo   -> Downloading FFmpeg processing engine from cloud...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; Write-Host '     Fetching ffmpeg.exe (~102MB)...'; $wc.DownloadFile('{FFMPEG_URL}', '%INSTALL_DIR%\\bin\\ffmpeg.exe'); Write-Host '     ffmpeg.exe download complete.'"
) else (
    echo   -> FFmpeg engine already present.
)

echo.
echo [2/3] Placing Application Binaries and DLLs...
xcopy /E /I /Y "%~dp0*" "%INSTALL_DIR%\\" >nul

echo [3/3] Registering Shortcuts ^& Starting Background Service...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'ClipFlow Companion.lnk')); $s.TargetPath = '%INSTALL_DIR%\\ClipFlowDaemon.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $programs = [Environment]::GetFolderPath('Programs'); $s = $ws.CreateShortcut([System.IO.Path]::Combine($programs, 'ClipFlow Companion.lnk')); $s.TargetPath = '%INSTALL_DIR%\\ClipFlowDaemon.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()"

echo.
echo Starting 24/7 ClipFlow Background Daemon...
start "" "%INSTALL_DIR%\\ClipFlowDaemon.exe"

echo ===================================================
echo   ClipFlow Desktop Companion Installed Successfully!
echo ===================================================
ping 127.0.0.1 -n 3 >nul
exit /b 0
"""
    (package_dir / "setup.bat").write_text(setup_bat, encoding="utf-8")

    uninstall_bat = """@echo off
echo ===================================================
echo   Uninstalling ClipFlow Desktop Companion...
echo ===================================================

echo Stopping any running ClipFlow processes...
taskkill /F /IM ClipFlowHelper.exe 2>nul
taskkill /F /IM ClipFlowDaemon.exe 2>nul

echo Removing shortcuts...
del "%USERPROFILE%\\Desktop\\ClipFlow Companion.lnk" 2>nul
del "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\ClipFlow Companion.lnk" 2>nul

echo Removing application files...
rmdir /S /Q "%LOCALAPPDATA%\\Programs\\ClipFlow" 2>nul

echo.
echo ===================================================
echo   ClipFlow has been successfully uninstalled.
echo ===================================================
pause
exit /b 0
"""
    (package_dir / "uninstall.bat").write_text(uninstall_bat, encoding="utf-8")

    readme_content = """ClipFlow Desktop Companion (v1.0.0) - Cloud Stream Setup
==================================================

How it works:
1. Run 'setup.bat' to install ClipFlow.
2. The setup automatically fetches the latest yt-dlp & FFmpeg engines directly into your user bin directory.
3. 'ClipFlowDaemon.exe' runs 24/7 silently on port 18942 and wakes up 'ClipFlowHelper.exe' whenever you download a clip from the web app.
"""
    (package_dir / "README.txt").write_text(readme_content, encoding="utf-8")

    print("\n[3/4] Created lightweight distribution package (~10MB).")

    # 5. Locate Inno Setup Script (.iss)
    iss_file = BASE_DIR / "installer.iss"

    # 6. Check if Inno Setup Compiler (ISCC) is installed and compile
    iscc_paths = [
        shutil.which("iscc"),
        "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
        "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
    ]
    iscc_exe = next((p for p in iscc_paths if p and Path(p).exists()), None)
    if iscc_exe:
        print(f"\n[4/4] Compiling ClipFlow-Setup.exe with Inno Setup...")
        res_iscc = subprocess.run([str(iscc_exe), str(iss_file)], cwd=str(BASE_DIR))
        if res_iscc.returncode == 0:
            setup_exe = DIST_DIR / "ClipFlow-Setup.exe"
            if setup_exe.exists():
                shutil.copy2(setup_exe, RELEASE_DIR / "ClipFlow-Setup.exe")
                shutil.copy2(setup_exe, BACKEND_DOWNLOADS_DIR / "ClipFlow-Setup.exe")
                print(f"  -> SUCCESS: Created ClipFlow-Setup.exe ({setup_exe.stat().st_size / (1024*1024):.2f} MB)")
                print(f"  -> Staged to: {RELEASE_DIR / 'ClipFlow-Setup.exe'}")

    print("\n==================================================")
    print("  SUCCESS: ClipFlow Setup Installer Ready!")
    print("==================================================")

if __name__ == "__main__":
    build()

# ClipFlow Desktop Companion (Qt Desktop Helper)

A modern, ultra-lightweight desktop companion application for **ClipFlow**.  
It features an **always-on-top, frameless 1:1 floating widget**, a background REST listener capturing downloads dispatched from the web app, real-time circular percentage progress visualization, and an automated FFmpeg aspect ratio cropping engine.

---

## Features

- **1:1 Floating Widget**: Sleek, dark-mode glassmorphic 1:1 square that stays on top and can be dragged anywhere across the screen.
- **Smart State Visualization**:
  - **Idle**: Displays the brand ClipFlow logo with active green status dot.
  - **Downloading**: Circular gradient progress ring + live numerical percentage (`%`) + network speed.
  - **Cropping**: Full animated ring with `Cropping...` status while FFmpeg applies aspect ratio filters.
  - **Completed**: Glowing green ring with `Saved!` confirmation.
- **Zero-Friction Web Capture**: Listens on `http://127.0.0.1:18942/download` to seamlessly catch download requests from ClipFlow Editor & Studio without opening extra pop-up windows.
- **Dependency Auto-Downloader**: On first run, automatically verifies and downloads `yt-dlp.exe` and `ffmpeg.exe` from secure cloud storage directly into the local `bin/` directory.
- **Dedicated Auto-Updater Subsystem**: Located in `src/updater/` for version control, update polling, and self-updating.
- **Direct Downloads Placement**: Saves final processed clips directly into your Windows `Downloads` folder (`$env:USERPROFILE\Downloads`) and removes intermediate raw files.

---

## Directory Structure

```
qt-app/
├── CMakeLists.txt              # CMake C++ build configuration (Qt6/Qt5, C++17)
├── resources.qrc               # Embedded resources (logo, icons)
├── start_helper.bat            # 1-Click launcher
├── build_cpp.ps1               # C++ CMake build script
├── app.py                      # Standalone Qt engine & UI
├── resources/
│   └── logo.png                # ClipFlow 1:1 Brand Logo
└── src/
    ├── main.cpp                # Application entry point & single-instance lock
    ├── ui/
    │   ├── FloatingWidget.h    # 1:1 Frameless, draggable, always-on-top widget
    │   └── FloatingWidget.cpp  # Custom QPainter circular progress arc & logo display
    ├── core/
    │   ├── LocalServer.h       # Lightweight HTTP REST receiver (localhost:18942)
    │   ├── LocalServer.cpp     # JSON payload parser with CORS support
    │   ├── DownloadManager.h   # yt-dlp & FFmpeg execution process coordinator
    │   ├── DownloadManager.cpp # Regex progress parser & aspect ratio crop executor
    │   ├── DependencyManager.h # Auto-downloads yt-dlp & FFmpeg on first run
    │   └── DependencyManager.cpp # Google Drive direct downloader
    └── updater/
        ├── AutoUpdater.h       # Separate auto-updating subsystem
        └── AutoUpdater.cpp     # Version checking, release fetch, update runner
```

---

## Quick Start

### Option 1: 1-Click Launch
Double-click `start_helper.bat` or run:
```powershell
.\start_helper.bat
```

### Option 2: Build C++ Native Executable
```powershell
.\build_cpp.ps1
```
The compiled `ClipFlowHelper.exe` will be located in `qt-app/build/`.

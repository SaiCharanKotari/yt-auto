# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:/Users/saich/Desktop/yt down/qt-app/installer_gui.py'],
    pathex=[],
    binaries=[],
    datas=[('C:/Users/saich/Desktop/yt down/qt-app/payload.zip', '.'), ('C:/Users/saich/Desktop/yt down/qt-app/resources', 'resources')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='setup',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['C:/Users/saich/Desktop/yt down/qt-app/resources/logo.ico'],
)

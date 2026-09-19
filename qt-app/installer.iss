; ClipFlow Inno Setup Script
#define MyAppName "ClipFlow Desktop Companion"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ClipFlow"
#define MyAppURL "https://clipflow.com"
#define MyAppDaemonExe "ClipFlowDaemon.exe"
#define MyAppHelperExe "ClipFlowHelper.exe"

[Setup]
AppId={{E8A4B819-21F6-4A59-8669-65A6BC584A22}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\ClipFlow
DisableProgramGroupPage=yes
OutputDir=C:\Users\saich\Desktop\yt down\qt-app\dist
OutputBaseFilename=ClipFlow-Setup
SetupIconFile=C:\Users\saich\Desktop\yt down\qt-app\resources\logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\{#MyAppDaemonExe}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "C:\Users\saich\Desktop\yt down\qt-app\dist\ClipFlow-Desktop-Companion\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppDaemonExe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppDaemonExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ClipFlowDaemon"; ValueData: """{app}\{#MyAppDaemonExe}"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppDaemonExe}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  DownloadPage: TDownloadWizardPage;

function OnDownloadProgress(const Url, FileName: String; const Progress, ProgressMax: Int64): Boolean;
begin
  if Pos('1MV8P5WJ', Url) > 0 then
  begin
    DownloadPage.Msg1Label.Caption := 'Downloading Engine (Part 1 of 2)...';
    DownloadPage.Msg2Label.Caption := 'Configuring core pipeline...';
  end
  else
  begin
    DownloadPage.Msg1Label.Caption := 'Downloading Engine (Part 2 of 2)...';
    DownloadPage.Msg2Label.Caption := 'Configuring high-speed processor...';
  end;
  Result := True;
end;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage('Downloading Engine Components', 'Downloading high-speed media processing engine...', @OnDownloadProgress);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  NeedsPart1, NeedsPart2: Boolean;
  BinDir1, BinDir2: String;
begin
  if CurPageID = wpReady then begin
    BinDir1 := ExpandConstant('{app}\bin');
    BinDir2 := ExpandConstant('{localappdata}\ClipFlow\bin');

    NeedsPart1 := not (FileExists(BinDir1 + '\yt-dlp.exe') or FileExists(BinDir2 + '\yt-dlp.exe'));
    NeedsPart2 := not (FileExists(BinDir1 + '\ffmpeg.exe') or FileExists(BinDir2 + '\ffmpeg.exe'));

    // If both files already exist in user bin, skip download entirely
    if (not NeedsPart1) and (not NeedsPart2) then begin
      Result := True;
      Exit;
    end;

    DownloadPage.Clear;
    if NeedsPart1 then
      DownloadPage.Add('https://drive.usercontent.google.com/download?id=1MV8P5WJ7YMk0IwUGmyoWt4FKnJmQI2vs&export=download&confirm=t', 'yt-dlp.exe', '');
    if NeedsPart2 then
      DownloadPage.Add('https://drive.usercontent.google.com/download?id=1LLfNgL6Y9R_oEXc8ODDhd1CpmNkwMT1Q&export=download&confirm=t', 'ffmpeg.exe', '');

    DownloadPage.Show;
    try
      try
        DownloadPage.Download;
        Result := True;
      except
        if DownloadPage.AbortedByUser then
          Log('Download aborted by user.')
        else
          SuppressibleMsgBox(AddPeriod(GetExceptionMessage), mbCriticalError, MB_OK, IDOK);
        Result := False;
      end;
    finally
      DownloadPage.Hide;
    end;
  end else
    Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  BinDir1, BinDir2: String;
begin
  if CurStep = ssPostInstall then begin
    BinDir1 := ExpandConstant('{app}\bin');
    BinDir2 := ExpandConstant('{localappdata}\ClipFlow\bin');
    ForceDirectories(BinDir1);

    if FileExists(ExpandConstant('{tmp}\yt-dlp.exe')) then
      FileCopy(ExpandConstant('{tmp}\yt-dlp.exe'), BinDir1 + '\yt-dlp.exe', False)
    else if FileExists(BinDir2 + '\yt-dlp.exe') and (not FileExists(BinDir1 + '\yt-dlp.exe')) then
      FileCopy(BinDir2 + '\yt-dlp.exe', BinDir1 + '\yt-dlp.exe', False);

    if FileExists(ExpandConstant('{tmp}\ffmpeg.exe')) then
      FileCopy(ExpandConstant('{tmp}\ffmpeg.exe'), BinDir1 + '\ffmpeg.exe', False)
    else if FileExists(BinDir2 + '\ffmpeg.exe') and (not FileExists(BinDir1 + '\ffmpeg.exe')) then
      FileCopy(BinDir2 + '\ffmpeg.exe', BinDir1 + '\ffmpeg.exe', False);
  end;
end;

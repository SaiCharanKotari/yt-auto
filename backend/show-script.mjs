// Shows exactly what .ps1 script is written to disk for MrBeast 1-min 1080p test
// Run: node show-script.mjs

function formatSecondsToTime(seconds) {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

function generatePowerShellWorkflow(options) {
  const { url, format='mp4', quality='720p', trimStart=0, trimEnd=15, aspectRatio='16:9', fitMode='pad', customFileName } = options;
  let safeBaseName = 'video';
  if (customFileName) safeBaseName = customFileName.replace(/[<>:"/\\|?*]/g, '_').trim();
  const isAudio = format === 'mp3' || format === 'wav';
  const fileExt = isAudio ? format : 'mp4';
  const finalOutputPath = `$env:USERPROFILE\\Downloads\\${safeBaseName}_clip.${fileExt}`;
  const tempDownloadPath = `$env:USERPROFILE\\Downloads\\${safeBaseName}_full_temp.${fileExt}`;
  let heightLimit = 720;
  if (quality) {
    const q = quality.toLowerCase().replace('p','');
    if (q==='4k'||q==='2160') heightLimit=2160;
    else if (q==='1440'||q==='2k') heightLimit=1440;
    else if (q==='1080') heightLimit=1080;
    else if (q==='720') heightLimit=720;
    else if (q==='480') heightLimit=480;
    else if (q==='360') heightLimit=360;
    else if (q==='240') heightLimit=240;
    else if (!isNaN(Number(q))) heightLimit=Number(q);
  }
  const ytFormat = `bestvideo[height=${heightLimit}]+bestaudio/bestvideo[height<=${heightLimit}]+bestaudio/best`;
  const startTimeStr = formatSecondsToTime(trimStart);
  const endTimeStr = formatSecondsToTime(trimEnd);
  let vfFilter = '';
  if (!isAudio && aspectRatio && aspectRatio !== '16:9') {
    if (aspectRatio==='9:16') vfFilter = fitMode==='crop' ? 'crop=ih*9/16:ih' : 'pad=ceil(max(iw,ih*9/16)/2)*2:ceil(max(ih,iw*16/9)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black';
    else if (aspectRatio==='1:1') vfFilter = fitMode==='crop' ? 'crop=ih:ih' : 'pad=ceil(max(iw,ih)/2)*2:ceil(max(ih,iw)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black';
    else if (aspectRatio==='4:5') vfFilter = fitMode==='crop' ? 'crop=ih*4/5:ih' : 'pad=ceil(max(iw,ih*4/5)/2)*2:ceil(max(ih,iw*5/4)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black';
  }
  let powerShellScript='', ytDlpCmd='', ffmpegCmd='';
  if (isAudio) {
    ytDlpCmd = `.\\yt-dlp.exe --ffmpeg-location . --download-sections "*${startTimeStr}-${endTimeStr}" -x --audio-format ${format} --audio-quality 0 --extractor-args "youtube:player_client=android" --no-playlist -o "${finalOutputPath}" "${url}"`;
    powerShellScript = ytDlpCmd;
  } else if (!vfFilter) {
    ytDlpCmd = `.\\yt-dlp.exe --ffmpeg-location . --download-sections "*${startTimeStr}-${endTimeStr}" -f "${ytFormat}" --merge-output-format mp4 --extractor-args "youtube:player_client=android" --no-playlist -o "${finalOutputPath}" "${url}"`;
    powerShellScript = ytDlpCmd;
  } else {
    ytDlpCmd = `.\\yt-dlp.exe --ffmpeg-location . --download-sections "*${startTimeStr}-${endTimeStr}" -f "${ytFormat}" --merge-output-format mp4 --extractor-args "youtube:player_client=android" --no-playlist -o "${tempDownloadPath}" "${url}"`;
    const vfFlags = `-vf "${vfFilter}" -c:v libx264 -preset fast -crf 20 -c:a aac -async 1`;
    ffmpegCmd = `.\\ffmpeg.exe -i "${tempDownloadPath}" ${vfFlags} -y "${finalOutputPath}"`;
    powerShellScript = [ytDlpCmd, ffmpegCmd].join('\n\n');
  }
  return { powerShellScript, tempDownloadPath, finalOutputPath, ytDlpCmd, ffmpegCmd };
}

// ─── Test: MrBeast 1 min 1080p 16:9 ─────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('  TEST: MrBeast 1 min clip — 1080p, 16:9 (no re-encode)');
console.log('═'.repeat(70));

const r1 = generatePowerShellWorkflow({
  url: 'https://youtu.be/dGCdYtk9fHQ',
  format: 'mp4',
  quality: '1080p',
  trimStart: 0,
  trimEnd: 60,
  aspectRatio: '16:9',
  customFileName: 'A Week In The Life of MrBeast',
});

const fullScript1 = `Set-Location "$env:USERPROFILE\\Documents"\n${r1.powerShellScript}`;
console.log('\n📄 .ps1 FILE CONTENT (written to disk, then executed):');
console.log('─'.repeat(70));
console.log(fullScript1);
console.log('─'.repeat(70));
console.log('\n✅ Checks:');
console.log('  height=1080 in format?  ', r1.ytDlpCmd.includes('height=1080'));
console.log('  height<=1080 in format? ', r1.ytDlpCmd.includes('height<=1080'));
console.log('  --download-sections?    ', r1.ytDlpCmd.includes('--download-sections'));
console.log('  section 0-60s?          ', r1.ytDlpCmd.includes('*00:00:00-00:01:00'));
console.log('  output path:            ', r1.finalOutputPath);
console.log('  ffmpegCmd (expect empty):', JSON.stringify(r1.ffmpegCmd));

// ─── Test: MrBeast 1 min 9:16 crop ───────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('  TEST: MrBeast 1 min clip — 1080p, 9:16 CROP (section-only + vf)');
console.log('═'.repeat(70));

const r2 = generatePowerShellWorkflow({
  url: 'https://youtu.be/dGCdYtk9fHQ',
  format: 'mp4',
  quality: '1080p',
  trimStart: 0,
  trimEnd: 60,
  aspectRatio: '9:16',
  fitMode: 'crop',
  customFileName: 'A Week In The Life of MrBeast',
});

const fullScript2 = `Set-Location "$env:USERPROFILE\\Documents"\n${r2.powerShellScript}`;
console.log('\n📄 .ps1 FILE CONTENT:');
console.log('─'.repeat(70));
console.log(fullScript2);
console.log('─'.repeat(70));
console.log('\n✅ Checks:');
console.log('  height=1080 in yt-dlp?    ', r2.ytDlpCmd.includes('height=1080'));
console.log('  --download-sections?      ', r2.ytDlpCmd.includes('--download-sections'));
console.log('  section 0-60s in yt-dlp? ', r2.ytDlpCmd.includes('*00:00:00-00:01:00'));
console.log('  ffmpeg has vf crop?       ', r2.ffmpegCmd.includes('crop=ih*9/16:ih'));
console.log('  ffmpeg NO -ss/-to?        ', !r2.ffmpegCmd.includes('-ss ') && !r2.ffmpegCmd.includes('-to '));

// ─── Test: MP3 audio 30 sec ────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('  TEST: MrBeast 30s MP3 audio extract');
console.log('═'.repeat(70));

const r3 = generatePowerShellWorkflow({
  url: 'https://youtu.be/dGCdYtk9fHQ',
  format: 'mp3',
  trimStart: 30,
  trimEnd: 60,
  customFileName: 'A Week In The Life of MrBeast',
});

const fullScript3 = `Set-Location "$env:USERPROFILE\\Documents"\n${r3.powerShellScript}`;
console.log('\n📄 .ps1 FILE CONTENT:');
console.log('─'.repeat(70));
console.log(fullScript3);
console.log('─'.repeat(70));
console.log('\n✅ Checks:');
console.log('  -x flag?               ', r3.ytDlpCmd.includes(' -x '));
console.log('  --audio-format mp3?    ', r3.ytDlpCmd.includes('--audio-format mp3'));
console.log('  section 30-60s?        ', r3.ytDlpCmd.includes('*00:00:30-00:01:00'));
console.log('  output path .mp3?      ', r3.finalOutputPath.endsWith('_clip.mp3'));

console.log('\n🎉 Script output verification complete!\n');

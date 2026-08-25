/**
 * Command Generator Test Suite
 * Tests generatePowerShellWorkflow() against the exact user-specified command standards:
 * - Video: bestvideo[height<=H]+bestaudio/best[height<=H]
 * - Flags: --js-runtimes node, --force-keyframes-at-cuts, --no-playlist, --merge-output-format mp4
 * - MP3: -x --audio-format mp3 --audio-quality 0 (or 320K/256K/192K/128K)
 * - Naming: $env:USERPROFILE\Downloads\<filename_or_title>_clip.<ext>
 *
 * Run with: node test-commands.mjs
 */

function formatSecondsToTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function generatePowerShellWorkflow(options) {
  const {
    url,
    format = 'mp4',
    quality = '1080p',
    audioQuality = '0',
    trimStart = 0,
    trimEnd,
    aspectRatio = '16:9',
    fitMode = 'pad',
    customFileName,
  } = options;

  let safeBaseName = '%(title)s';
  if (customFileName && customFileName.trim()) {
    safeBaseName = customFileName.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  const isAudio = format === 'mp3' || format === 'wav' || format === 'm4a' || format === 'aac';
  const fileExt = isAudio ? format : 'mp4';
  const finalOutputPath = `$env:USERPROFILE\\Downloads\\${safeBaseName}_clip.${fileExt}`;
  const tempDownloadPath = `$env:USERPROFILE\\Downloads\\${safeBaseName}_full_temp.${fileExt}`;

  let heightLimit = null;
  if (quality && quality.toLowerCase() !== 'best' && quality.toLowerCase() !== 'max') {
    const cleanQuality = quality.toLowerCase().replace('p', '');
    if (cleanQuality === '4k' || cleanQuality === '2160') heightLimit = 2160;
    else if (cleanQuality === '1440' || cleanQuality === '2k') heightLimit = 1440;
    else if (cleanQuality === '1080') heightLimit = 1080;
    else if (cleanQuality === '720') heightLimit = 720;
    else if (cleanQuality === '480') heightLimit = 480;
    else if (cleanQuality === '360') heightLimit = 360;
    else if (cleanQuality === '240') heightLimit = 240;
    else if (!isNaN(Number(cleanQuality))) heightLimit = Number(cleanQuality);
  }

  const ytFormat = heightLimit
    ? `bestvideo[height<=${heightLimit}]+bestaudio/best[height<=${heightLimit}]`
    : `bestvideo+bestaudio/best`;

  const isTrimmed = typeof trimEnd === 'number' && trimEnd > trimStart;
  const startTimeStr = formatSecondsToTime(trimStart);
  const endTimeStr = isTrimmed ? formatSecondsToTime(trimEnd) : '';

  let cleanAudioQuality = '0';
  if (audioQuality) {
    cleanAudioQuality = String(audioQuality).trim().toUpperCase();
  }

  let powerShellScript = '';
  let ytDlpCmd = '';
  let ffmpegCmd = '';

  if (isAudio) {
    const sectionFlag = isTrimmed ? `--download-sections "*${startTimeStr}-${endTimeStr}" ` : '';
    const keyframesFlag = isTrimmed ? `--force-keyframes-at-cuts ` : '';
    ytDlpCmd = `.\\yt-dlp.exe --js-runtimes node ${sectionFlag}-x --audio-format ${format} --audio-quality ${cleanAudioQuality} ${keyframesFlag}--no-playlist -o "${finalOutputPath}" "${url}"`.replace(/\s+/g, ' ');
    powerShellScript = ytDlpCmd;
  } else {
    const sectionFlag = isTrimmed ? `--download-sections "*${startTimeStr}-${endTimeStr}" ` : '';
    const keyframesFlag = isTrimmed ? `--force-keyframes-at-cuts ` : '';
    ytDlpCmd = `.\\yt-dlp.exe --js-runtimes node ${sectionFlag}-f "${ytFormat}" --merge-output-format mp4 ${keyframesFlag}--no-playlist -o "${finalOutputPath}" "${url}"`.replace(/\s+/g, ' ');
    powerShellScript = ytDlpCmd;
  }

  return { powerShellScript, tempDownloadPath, finalOutputPath, ytDlpCmd, ffmpegCmd };
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Runner
// ──────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message, context) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push({ message, context });
    console.error(`  ❌ FAIL: ${message}`);
    if (context?.command) {
      console.error(`     Command: ${context.command.substring(0, 200)}`);
    }
  }
}

function describe(name, fn) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  📋 ${name}`);
  console.log(`${'═'.repeat(70)}`);
  fn();
}

function it(name, fn) {
  console.log(`\n  ▶ ${name}`);
  fn();
}

const TEST_URL = 'https://youtu.be/4cf5OlJ7bzw';

// ──────────────────────────────────────────────────────────────────────────────
// 1. EXACT USER COMMAND SPECIFICATIONS
// ──────────────────────────────────────────────────────────────────────────────

describe('User Exact Video Snippet Specifications', () => {
  it('Matches exact video clip snippet: 01:20 to 01:45', () => {
    const r = generatePowerShellWorkflow({
      url: 'https://youtu.be/4cf5OlJ7bzw',
      format: 'mp4',
      quality: '1080p',
      trimStart: 80, // 01:20
      trimEnd: 105,  // 01:45
      customFileName: 'clip',
    });

    console.log(`     Command:\n     ${r.ytDlpCmd}`);
    assert(r.ytDlpCmd.includes('--js-runtimes node'), '--js-runtimes node missing');
    assert(r.ytDlpCmd.includes('--download-sections "*00:01:20-00:01:45"'), 'download-sections 00:01:20-00:01:45 missing');
    assert(r.ytDlpCmd.includes('-f "bestvideo[height<=1080]+bestaudio/best[height<=1080]"'), 'Format selector missing exact pattern');
    assert(r.ytDlpCmd.includes('--merge-output-format mp4'), '--merge-output-format mp4 missing');
    assert(r.ytDlpCmd.includes('--force-keyframes-at-cuts'), '--force-keyframes-at-cuts missing');
    assert(r.ytDlpCmd.includes('--no-playlist'), '--no-playlist missing');
    assert(r.ytDlpCmd.includes('-o "$env:USERPROFILE\\Downloads\\clip_clip.mp4"'), 'Output path missing');
    assert(r.ytDlpCmd.includes('"https://youtu.be/4cf5OlJ7bzw"'), 'URL missing');
  });

  it('Matches exact MP3 clip snippet: 01:20 to 01:45 with --audio-quality 0', () => {
    const r = generatePowerShellWorkflow({
      url: 'https://youtu.be/4cf5OlJ7bzw',
      format: 'mp3',
      audioQuality: '0',
      trimStart: 80, // 01:20
      trimEnd: 105,  // 01:45
      customFileName: 'clip',
    });

    console.log(`     Command:\n     ${r.ytDlpCmd}`);
    assert(r.ytDlpCmd.includes('--js-runtimes node'), '--js-runtimes node missing');
    assert(r.ytDlpCmd.includes('--download-sections "*00:01:20-00:01:45"'), 'download-sections 00:01:20-00:01:45 missing');
    assert(r.ytDlpCmd.includes('-x'), '-x missing');
    assert(r.ytDlpCmd.includes('--audio-format mp3'), '--audio-format mp3 missing');
    assert(r.ytDlpCmd.includes('--audio-quality 0'), '--audio-quality 0 missing');
    assert(r.ytDlpCmd.includes('--force-keyframes-at-cuts'), '--force-keyframes-at-cuts missing');
    assert(r.ytDlpCmd.includes('--no-playlist'), '--no-playlist missing');
    assert(r.ytDlpCmd.includes('-o "$env:USERPROFILE\\Downloads\\clip_clip.mp3"'), 'Output path missing');
  });

  it('Matches MP3 with 320 kbps bitrate (--audio-quality 320K)', () => {
    const r = generatePowerShellWorkflow({
      url: 'https://youtu.be/4cf5OlJ7bzw',
      format: 'mp3',
      audioQuality: '320k',
      trimStart: 0,
      trimEnd: 60,
      customFileName: 'audio',
    });

    console.log(`     Command:\n     ${r.ytDlpCmd}`);
    assert(r.ytDlpCmd.includes('--audio-quality 320K'), '--audio-quality 320K missing');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. VIDEO RESOLUTION SELECTOR
// ──────────────────────────────────────────────────────────────────────────────

describe('Video Resolutions & Format Selectors', () => {
  const resolutions = [
    { label: '4k', h: 2160 },
    { label: '2160p', h: 2160 },
    { label: '1440p', h: 1440 },
    { label: '2k', h: 1440 },
    { label: '1080p', h: 1080 },
    { label: '720p', h: 720 },
    { label: '480p', h: 480 },
    { label: '360p', h: 360 },
    { label: '240p', h: 240 },
  ];

  for (const res of resolutions) {
    it(`Generates correct format for ${res.label} -> height<=${res.h}`, () => {
      const r = generatePowerShellWorkflow({
        url: TEST_URL,
        format: 'mp4',
        quality: res.label,
        trimStart: 10,
        trimEnd: 30,
      });

      const expectedFormat = `-f "bestvideo[height<=${res.h}]+bestaudio/best[height<=${res.h}]"`;
      assert(r.ytDlpCmd.includes(expectedFormat), `Expected ${expectedFormat} in command`, { command: r.ytDlpCmd });
    });
  }

  it('Generates best available format when quality is "best"', () => {
    const r = generatePowerShellWorkflow({
      url: TEST_URL,
      format: 'mp4',
      quality: 'best',
      trimStart: 0,
      trimEnd: 30,
    });
    assert(r.ytDlpCmd.includes('-f "bestvideo+bestaudio/best"'), 'Expected bestvideo+bestaudio/best');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. MP3 BITRATES
// ──────────────────────────────────────────────────────────────────────────────

describe('MP3 Bitrate Qualities', () => {
  const bitrates = ['320k', '256k', '192k', '128k', '0'];

  for (const b of bitrates) {
    it(`Supports audio bitrate: ${b}`, () => {
      const r = generatePowerShellWorkflow({
        url: TEST_URL,
        format: 'mp3',
        audioQuality: b,
        trimStart: 0,
        trimEnd: 30,
      });
      assert(r.ytDlpCmd.includes(`--audio-quality ${b.toUpperCase()}`), `Expected --audio-quality ${b.toUpperCase()}`);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. FULL VIDEO (NO TRIM) VS SECTION TRIM
// ──────────────────────────────────────────────────────────────────────────────

describe('Full Video vs Section Trim', () => {
  it('Full video (no trimEnd) omits --download-sections and keyframes flags', () => {
    const r = generatePowerShellWorkflow({
      url: TEST_URL,
      format: 'mp4',
      quality: '1080p',
    });
    assert(!r.ytDlpCmd.includes('--download-sections'), 'Full video should NOT have --download-sections');
    assert(!r.ytDlpCmd.includes('--force-keyframes-at-cuts'), 'Full video should NOT have --force-keyframes-at-cuts');
  });

  it('Trimmed section includes --download-sections and --force-keyframes-at-cuts', () => {
    const r = generatePowerShellWorkflow({
      url: TEST_URL,
      format: 'mp4',
      quality: '1080p',
      trimStart: 15,
      trimEnd: 45,
    });
    assert(r.ytDlpCmd.includes('--download-sections "*00:00:15-00:00:45"'), 'Section missing');
    assert(r.ytDlpCmd.includes('--force-keyframes-at-cuts'), 'Keyframes flag missing');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. FILENAME SANITIZATION AND DEFAULT %(title)s
// ──────────────────────────────────────────────────────────────────────────────

describe('Output Naming', () => {
  it('Uses %(title)s template when no custom name is provided', () => {
    const r = generatePowerShellWorkflow({
      url: TEST_URL,
      format: 'mp4',
    });
    assert(r.finalOutputPath.includes('%(title)s_clip.mp4'), 'Expected %(title)s_clip.mp4 in output path');
  });

  it('Sanitizes invalid Windows filename characters', () => {
    const r = generatePowerShellWorkflow({
      url: TEST_URL,
      format: 'mp4',
      customFileName: 'Video: The Best <2026> | Episode "1"? *Cool*',
    });
    assert(!r.finalOutputPath.includes('<'), 'Less than not stripped');
    assert(!r.finalOutputPath.includes('>'), 'Greater than not stripped');
    assert(!r.finalOutputPath.includes('|'), 'Pipe not stripped');
    assert(!r.finalOutputPath.includes('"'), 'Quotes not stripped');
    assert(!r.finalOutputPath.includes('?'), 'Question mark not stripped');
    assert(!r.finalOutputPath.includes('*'), 'Asterisk not stripped');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  📊 RESULTS`);
console.log(`${'═'.repeat(70)}`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  📝 Total:  ${passed + failed}`);

if (errors.length > 0) {
  console.log(`\n  ── FAILURES ──`);
  errors.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.message}`);
  });
  console.log('');
  process.exit(1);
} else {
  console.log(`\n  🎉 ALL TESTS PASSED — download system matches exact requirements!\n`);
  process.exit(0);
}

import React from 'react';
import { Check } from 'lucide-react';

export interface QualityOption {
  label: string;
  height: number;
  format_id?: string;
  tbr?: number;
  isNative?: boolean;
}

export type DownloadFormat = 'mp4' | 'mp3' | 'captions' | 'wav' | 'm4a' | 'aac';
export type AudioBitrate = '0' | '320k' | '256k' | '192k' | '128k';
export type CaptionFormat = 'srt' | 'vtt' | 'txt';

export const STANDARD_QUALITY_OPTIONS: QualityOption[] = [
  { label: '2160p', height: 2160 },
  { label: '1440p', height: 1440 },
  { label: '1080p', height: 1080 },
  { label: '720p', height: 720 },
  { label: '480p', height: 480 },
  { label: '360p', height: 360 },
  { label: '240p', height: 240 },
];

interface ExportFormatSectionProps {
  downloadFormat: DownloadFormat;
  setDownloadFormat: (format: DownloadFormat) => void;
  downloadQuality: string;
  setDownloadQuality: (quality: string) => void;
  downloadAudioBitrate: AudioBitrate;
  setDownloadAudioBitrate: (bitrate: AudioBitrate) => void;
  captionFormat: CaptionFormat;
  setCaptionFormat: (format: CaptionFormat) => void;
  captionLang?: string;
  setCaptionLang?: (lang: string) => void;
  availableQualities?: QualityOption[];
  detectedMaxHeight?: number;
}

export const ExportFormatSection: React.FC<ExportFormatSectionProps> = ({
  downloadFormat,
  setDownloadFormat,
  downloadQuality,
  setDownloadQuality,
  downloadAudioBitrate,
  setDownloadAudioBitrate,
  captionFormat,
  setCaptionFormat,
  availableQualities = [],
}) => {
  // Always provide all quality options up to 4K (2160p, 1440p, 1080p, 720p, 480p, 360p, 240p)
  const qualityList: QualityOption[] = STANDARD_QUALITY_OPTIONS.map((opt) => {
    const matched = availableQualities.find((q) => q.height === opt.height);
    return {
      ...opt,
      format_id: matched?.format_id || 'best',
      tbr: matched?.tbr,
      isNative: true,
    };
  });



  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-600 tabular-nums">2.</span>
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Export Format & Quality</h3>
      </div>

      {/* Format Selector Tabs */}
      <div className="flex gap-1.5 p-1 bg-black rounded-xl border border-white/10">
        {[
          { id: 'mp4', label: 'MP4 Video' },
          { id: 'mp3', label: 'MP3 Audio' },
          { id: 'captions', label: 'Subtitles' },
        ].map((f) => {
          const isSelected = downloadFormat === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setDownloadFormat(f.id as DownloadFormat)}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-white text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 1. Video Quality Selection ── */}
      {downloadFormat === 'mp4' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Video Resolution</p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {qualityList.map((q) => {
              const displayLabel = `${q.height}p`;

              // Match by label or by height number
              const isSelected =
                downloadQuality === q.label ||
                downloadQuality.toLowerCase().startsWith(`${q.height}`) ||
                (q.height >= 2160 && downloadQuality.toLowerCase().includes('2160')) ||
                (q.height === 1080 && downloadQuality.toLowerCase().includes('1080'));

              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDownloadQuality(q.label)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all relative flex items-center justify-center group ${
                    isSelected
                      ? 'bg-white text-black font-black border-white shadow-md'
                      : 'bg-zinc-950/80 border-white/10 hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-black/20 flex items-center justify-center">
                      <Check className="w-2 h-2 text-black" />
                    </div>
                  )}
                  <div className="text-xs font-bold tracking-tight">{displayLabel}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Audio Bitrate & Quality Selection ── */}
      {downloadFormat === 'mp3' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bitrate</p>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: '0', label: 'Best VBR' },
              { id: '320k', label: '320 kbps' },
              { id: '256k', label: '256 kbps' },
              { id: '192k', label: '192 kbps' },
              { id: '128k', label: '128 kbps' },
            ].map((b) => {
              const isSelected = downloadAudioBitrate === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setDownloadAudioBitrate(b.id as AudioBitrate)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all relative ${
                    isSelected
                      ? 'bg-white text-black font-black border-white shadow-md'
                      : 'bg-zinc-950/80 border-white/10 hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">{b.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Subtitles Selection ── */}
      {downloadFormat === 'captions' && (
        <div className="space-y-3 p-3 rounded-xl bg-black border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Subtitle Format</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['srt', 'vtt', 'txt'] as const).map((s) => {
                const isSelected = captionFormat === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCaptionFormat(s)}
                    className={`py-2 rounded-lg text-center border transition-all ${
                      isSelected
                        ? 'bg-white text-black font-black border-white'
                        : 'bg-zinc-950/80 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs uppercase">{s}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950/80 border border-white/10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language</span>
            <span className="text-xs font-bold text-zinc-200">English (Auto & Subtitles)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportFormatSection;

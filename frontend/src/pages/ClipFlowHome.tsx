import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, Sparkles, Download, 
  History, ArrowUpRight, ShieldCheck, Layers, 
  CheckCircle2, AlertCircle, Trash2
} from 'lucide-react';

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

interface ClipHistoryItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  timestamp: string;
  quality: string;
  aspectRatio: string;
}

export default function ClipFlowHome() {
  const [urlInput, setUrlInput] = useState('');
  const [quickInstaUrl, setQuickInstaUrl] = useState('');
  const [isQuickInstaLoading, setIsQuickInstaLoading] = useState(false);
  const [instaSuccessMsg, setInstaSuccessMsg] = useState('');
  const [instaErrorMsg, setInstaErrorMsg] = useState('');

  // History
  const [clipHistory, setClipHistory] = useState<ClipHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clipflow_history');
      if (saved) setClipHistory(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Open Editor in New Tab
  const openInNewTab = (videoUrl: string) => {
    if (!videoUrl.trim()) return;
    const targetUrl = `/editor?url=${encodeURIComponent(videoUrl.trim())}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    openInNewTab(urlInput.trim());
  };

  // Direct Instagram Download
  const handleQuickInstaDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInstaUrl) return;
    setIsQuickInstaLoading(true);
    setInstaSuccessMsg('');
    setInstaErrorMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: quickInstaUrl,
          format: 'mp4',
          quality: '1080p',
          customFileName: 'Instagram_ClipFlow_Video',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInstaSuccessMsg('Instagram video download initiated to your Downloads folder!');
      setQuickInstaUrl('');
    } catch (e: any) {
      setInstaErrorMsg(e.message || 'Failed to download Instagram video');
    } finally {
      setIsQuickInstaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f8fafc] flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090d16]/80 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 ring-1 ring-white/20">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-purple-400">
                  ClipFlow
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  AI Studio
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">AI-Powered Video Clipper & Shorts Generator</p>
            </div>
          </div>

          {/* Right Status & Tools */}
          <div className="flex items-center gap-3">
            {clipHistory.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 hover:text-white border border-white/10 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span>Recent ({clipHistory.length})</span>
              </button>
            )}

            <a
              href="http://localhost:3001/api/video/tools/download-dlp"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-xs font-medium text-purple-300 border border-purple-500/20 transition-colors"
              title="Download FFmpeg + yt-dlp bundle"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Engine Bundle</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-12">
        
        {/* ── Hero / URL Importer ───────────────────────────────────────────── */}
        <section className="space-y-6 pt-6 sm:pt-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-xs font-semibold text-purple-300"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Tab AI Video Repurposing & Clipping</span>
            </motion.div>
            
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Clip Long Videos into Viral Shorts with <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">ClipFlow</span>
            </h1>
            
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
              Enter any YouTube, Shorts, Twitch, or Instagram link to launch your high-precision AI clipping canvas in a dedicated workspace tab.
            </p>
          </div>

          {/* Smart Input Form */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleUrlSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-300" />
              <div className="relative flex items-center bg-[#0d1424] border border-white/15 rounded-2xl p-2.5 shadow-2xl">
                <div className="pl-3 pr-2 text-gray-400">
                  <YoutubeIcon className="w-6 h-6 text-red-500" />
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube, Shorts, Twitch, or video URL..."
                  className="flex-1 bg-transparent py-3 px-2 text-white placeholder-gray-500 focus:outline-none text-sm sm:text-base font-medium"
                />

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 group"
                >
                  <span>Clip</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Quick Instagram Grabber Card & Options ────────────────────────── */}
        <section className="space-y-8 max-w-4xl mx-auto">
          
          {/* Instagram Quick Box */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/25 shrink-0">
                  <InstagramIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg sm:text-xl">Instant Instagram Reel Grabber</h3>
                  <p className="text-xs sm:text-sm text-gray-400">Download or open reels in full HD with one click</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (quickInstaUrl.trim()) openInNewTab(quickInstaUrl.trim());
                }}
                disabled={!quickInstaUrl.trim()}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>Clip in Editor</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleQuickInstaDownload} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={quickInstaUrl}
                onChange={(e) => setQuickInstaUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 font-medium"
              />
              <button
                type="submit"
                disabled={isQuickInstaLoading || !quickInstaUrl.trim()}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 shrink-0"
              >
                {isQuickInstaLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Direct Download</span>
                  </>
                )}
              </button>
            </form>

            {instaSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{instaSuccessMsg}</span>
              </div>
            )}
            {instaErrorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{instaErrorMsg}</span>
              </div>
            )}
          </div>

          {/* Feature Highlights Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'AI Hook Scanner',
                desc: 'Gemini AI automatically scans transcripts & audio dynamics to isolate the highest-retention viral moments.',
                color: 'from-purple-500 to-indigo-500',
                badge: 'Smart Engine'
              },
              {
                icon: Layers,
                title: '9:16 Auto-Reframing',
                desc: 'Effortlessly convert widescreen videos into vertical 9:16 Shorts & Reels with instant center crop previews.',
                color: 'from-pink-500 to-rose-500',
                badge: 'One-Click'
              },
              {
                icon: ShieldCheck,
                title: 'Lossless Local Speed',
                desc: 'Powered directly by local FFmpeg & yt-dlp. No server compression limits, zero watermarks, and full 4K output.',
                color: 'from-cyan-500 to-blue-500',
                badge: '100% Free'
              }
            ].map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center text-white shadow-lg`}>
                  <feat.icon className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">{feat.title}</h3>
                  <span className="text-[10px] font-semibold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                    {feat.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

      </main>

      {/* ── Recent History Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-lg">Recent Export History</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {clipHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">No recent clips found.</p>
                ) : (
                  clipHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 hover:border-purple-500/40 transition-colors"
                    >
                      <img
                        src={item.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'}
                        alt={item.title}
                        className="w-16 aspect-video rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{item.duration}</p>
                        <span className="text-[10px] text-purple-300 font-medium">{item.quality} • {item.aspectRatio}</span>
                      </div>
                      <button
                        onClick={() => {
                          openInNewTab(item.url);
                          setShowHistoryModal(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white text-xs font-semibold transition-all shrink-0 flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {clipHistory.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs">
                  <button
                    onClick={() => {
                      setClipHistory([]);
                      localStorage.removeItem('clipflow_history');
                    }}
                    className="text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear History
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#090d16]/90 py-6 px-6 text-center text-xs text-gray-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
              <Scissors className="w-3 h-3 text-purple-400" />
            </div>
            <span className="font-bold text-gray-300">ClipFlow Studio</span>
            <span>— Free & Open Video Repurposing</span>
          </div>
          <p className="text-gray-600 text-[11px]">
            Direct FFmpeg & yt-dlp Engine • Local Processing • Zero Watermarks
          </p>
        </div>
      </footer>

    </div>
  );
}

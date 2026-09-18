import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors, Globe, Users, TrendingUp,
  Play, Download, ArrowRight, Star,
  Sparkles, Film, Music, Share2, X,
  Laugh, Plane, Check, Cpu, HardDrive,
  Video, Plug
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { ClipDownloadModal } from '../components/ClipDownloadModal';

// Use real server URL from env if deployed, otherwise fallback to localhost for dev
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={className}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const STATS = [
  { value: '226k+', label: 'Total Visits', icon: Globe },
  { value: '400+', label: 'Creators', icon: Users },
  { value: '890+', label: 'Pro Members', icon: Star },
  { value: '6', label: 'Platforms', icon: Share2 },
];

const USE_CASES = [
  {
    icon: Film,
    title: 'Content Creators',
    desc: 'Clip your best YouTube moments and convert them into Shorts, Reels, and TikToks — all in seconds.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-purple-400',
  },
  {
    icon: TrendingUp,
    title: 'Marketing Teams',
    desc: 'Extract brand highlights, campaign clips, and testimonials from long-form video content at scale.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: Music,
    title: 'Podcasters & Audio',
    desc: 'Export crisp MP3 audio from any video. Perfect for podcast clips, music snippets, and voice notes.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-pink-400',
  },
  {
    icon: Laugh,
    title: 'Meme Channels & Creators',
    desc: 'Clip popular funny videos, viral punchlines, and trending moments to fuel and scale your social media pages on autopilot.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-amber-400',
  },
  {
    icon: Plane,
    title: 'Travelers & Mobile Creators',
    desc: 'Cut long travel videos at any specific timestamp directly on the website for free in seconds — ready to post as your Stories, Reels, and Shorts.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Sparkles,
    title: 'Brand Builders',
    desc: 'Repurpose interview clips, launch videos, and testimonials into platform-ready social media content.',
    accent: 'bg-[#0e0e14] border-white/10',
    iconColor: 'text-violet-400',
  },
];

export default function ClipFlowHome() {
  const [urlInput, setUrlInput] = useState('');
  const [quickInstaUrl, setQuickInstaUrl] = useState('');
  const [quickTwitchUrl, setQuickTwitchUrl] = useState('');
  const [quickTwitterUrl, setQuickTwitterUrl] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const [selectedClipUrl, setSelectedClipUrl] = useState('');

  // Close video modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVideoModalOpen(false);
    };
    if (isVideoModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen]);

  const handleClipClick = (videoUrl: string) => {
    if (!videoUrl.trim()) return;
    setSelectedClipUrl(videoUrl.trim());
    setIsClipModalOpen(true);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) handleClipClick(urlInput.trim());
  };

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col selection:bg-purple-500/30">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/95 backdrop-blur-xl px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.ico" alt="ClipFlow" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span className="text-sm font-bold tracking-tight text-white">ClipFlow</span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {['How to use', 'Why Download Engine', 'Terms & Conditions'].map((t) => (
              <button key={t} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                {t}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Download Engine Button (Positioned left of profile) */}
            <a
              href={`${BACKEND_URL}/api/video/tools/download-dlp`}
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-xl transition-all hover:opacity-90 shrink-0 shadow-md shadow-purple-600/20"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              title="Download ClipFlow Processing Engine"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Engine</span>
            </a>

            <UserProfileMenu onOpenAuth={() => setShowAuthModal(true)} />
          </div>
        </div>
      </header>

      <main className="flex-1 bg-black">

        {/* ── Section 1: Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 pb-16 px-6 bg-black">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-purple-600/15 via-indigo-600/8 to-transparent rounded-full blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto text-center space-y-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {/* Badge with NO leading logo */}
              <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold mb-2 shadow-sm shadow-purple-500/10">
                <span>Next-Gen Video Clipping & Framing Studio</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Clip, Convert &{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400">
                  Create
                </span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Paste any YouTube, Instagram, Twitch, or Twitter / X link. Trim your clip, choose your aspect ratio, and download instantly — directly to your device.
              </p>
            </motion.div>

            {/* URL Inputs with Brand Colored Clip Buttons & OR Spacers */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="space-y-2.5 max-w-2xl mx-auto"
            >
              {/* 1. YouTube Input (Red Brand Button) */}
              <form onSubmit={handleUrlSubmit}>
                <div className="flex items-center bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden focus-within:border-red-500/60 transition-colors shadow-lg shadow-black/40">
                  <div className="pl-4 pr-2.5 shrink-0">
                    <YoutubeIcon className="text-[#ff0000]" />
                  </div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste YouTube, Shorts, or Video URL..."
                    className="flex-1 bg-transparent py-3 px-1 text-white placeholder-gray-500 focus:outline-none text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#ff0000] hover:bg-[#e60000] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-md shadow-red-600/25 active:scale-95"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Clip</span>
                  </button>
                </div>
              </form>

              {/* OR Divider 1 */}
              <div className="flex items-center justify-center my-1 py-0.5">
                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 select-none">OR</span>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>
              </div>

              {/* 2. Instagram Input (Pink/Orange Gradient Brand Button) */}
              <form onSubmit={(e) => { e.preventDefault(); if (quickInstaUrl.trim()) handleClipClick(quickInstaUrl.trim()); }}>
                <div className="flex items-center bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden focus-within:border-pink-500/60 transition-colors shadow-lg shadow-black/40">
                  <div className="pl-4 pr-2.5 shrink-0">
                    <InstagramIcon className="text-[#e1306c]" />
                  </div>
                  <input
                    type="url"
                    value={quickInstaUrl}
                    onChange={(e) => setQuickInstaUrl(e.target.value)}
                    placeholder="Paste Instagram Reel, Video, or Post URL..."
                    className="flex-1 bg-transparent py-3 px-1 text-white placeholder-gray-500 focus:outline-none text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!quickInstaUrl.trim()}
                    className="flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-md shadow-pink-600/25 active:scale-95"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Clip</span>
                  </button>
                </div>
              </form>

              {/* OR Divider 2 */}
              <div className="flex items-center justify-center my-1 py-0.5">
                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 select-none">OR</span>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>
              </div>

              {/* 3. Twitch Input (Purple Brand Button) */}
              <form onSubmit={(e) => { e.preventDefault(); if (quickTwitchUrl.trim()) handleClipClick(quickTwitchUrl.trim()); }}>
                <div className="flex items-center bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden focus-within:border-purple-500/60 transition-colors shadow-lg shadow-black/40">
                  <div className="pl-4 pr-2.5 shrink-0">
                    <TwitchIcon className="text-[#9146ff]" />
                  </div>
                  <input
                    type="url"
                    value={quickTwitchUrl}
                    onChange={(e) => setQuickTwitchUrl(e.target.value)}
                    placeholder="Paste Twitch Clip, VOD, or Stream URL..."
                    className="flex-1 bg-transparent py-3 px-1 text-white placeholder-gray-500 focus:outline-none text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!quickTwitchUrl.trim()}
                    className="flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#9146ff] hover:bg-[#772ce8] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-md shadow-purple-600/25 active:scale-95"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Clip</span>
                  </button>
                </div>
              </form>

              {/* OR Divider 3 */}
              <div className="flex items-center justify-center my-1 py-0.5">
                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 select-none">OR</span>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>
              </div>

              {/* 4. Twitter / X Input (Twitter Blue Brand Button) */}
              <form onSubmit={(e) => { e.preventDefault(); if (quickTwitterUrl.trim()) handleClipClick(quickTwitterUrl.trim()); }}>
                <div className="flex items-center bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden focus-within:border-sky-500/60 transition-colors shadow-lg shadow-black/40">
                  <div className="pl-4 pr-2.5 shrink-0">
                    <TwitterIcon className="text-[#1d9bf0]" />
                  </div>
                  <input
                    type="url"
                    value={quickTwitterUrl}
                    onChange={(e) => setQuickTwitterUrl(e.target.value)}
                    placeholder="Paste Twitter / X Video or Post URL..."
                    className="flex-1 bg-transparent py-3 px-1 text-white placeholder-gray-500 focus:outline-none text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!quickTwitterUrl.trim()}
                    className="flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-md shadow-sky-600/25 active:scale-95"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Clip</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </section>

        {/* ── Section 2: How to Use (Clean, Animated Glowing Neon Serpentine Pipeline) ── */}
        <section className="pt-10 pb-20 px-4 sm:px-6 bg-black relative overflow-hidden">
          <div className="max-w-[1360px] mx-auto space-y-12 relative z-10">

            {/* Header */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                How to Use ClipFlow
              </h2>
              <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
                4 streamlined stages from raw online video to finished 4K clip.
              </p>
            </div>

            {/* ── DESKTOP ANIMATED SERPENTINE CANVAS (Screen >= 1200px) ── */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="hidden xl:block relative w-[1340px] h-[520px] mx-auto select-none my-4"
            >

              {/* Glowing Green Neon Cable SVG Canvas with Laser Pulse Animation */}
              <svg
                viewBox="0 0 1340 520"
                className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* High Intensity Soft Glow Filter */}
                  <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
                    <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="laser-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>

                {/* 1. Wire: Plug (x:53, y:108) -> Flow 01 (x:160, y:107) */}
                <motion.path
                  d="M 53 108 C 80 130, 120 128, 160 107"
                  stroke="url(#laser-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#laser-glow)"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: 'easeOut', delay: 0.1 } },
                  }}
                />

                {/* 2. Wire: Flow 01 (x:510, y:107) -> Flow 02 (x:790, y:107) - Reversed curvature (sagging down) */}
                <motion.path
                  d="M 510 107 C 600 155, 700 155, 790 107"
                  stroke="url(#laser-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#laser-glow)"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: 'easeInOut', delay: 0.7 } },
                  }}
                />

                {/* 3. Wire: Flow 02 (x:1140, y:107) -> Sweeping Right Loop -> Flow 03 (x:1140, y:397) */}
                <motion.path
                  d="M 1140 107 C 1275 107, 1335 185, 1325 252 C 1315 320, 1255 397, 1140 397"
                  stroke="url(#laser-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#laser-glow)"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.9, ease: 'easeInOut', delay: 1.4 } },
                  }}
                />

                {/* 4. Wire: Flow 03 (x:790, y:397) -> Flow 04 (x:510, y:397) - Reversed curvature (arching up) */}
                <motion.path
                  d="M 790 397 C 700 350, 600 350, 510 397"
                  stroke="url(#laser-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#laser-glow)"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: 'easeInOut', delay: 2.3 } },
                  }}
                />

                {/* 5. Wire: Flow 04 (x:160, y:397) -> Video Output (x:75, y:397) */}
                <motion.path
                  d="M 160 397 C 125 400, 100 397, 75 397"
                  stroke="url(#laser-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#laser-glow)"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: 'easeOut', delay: 3.0 } },
                  }}
                />
              </svg>

              {/* 🔌 Plug Logo Only (Pure White, Positioned on wire) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
                }}
                style={{ position: 'absolute', left: '10px', top: '65px', width: '60px', height: '60px' }}
                className="flex items-center justify-center text-white z-10 select-none"
              >
                <Plug className="w-12 h-12 text-white -rotate-45 drop-shadow-[0_0_18px_rgba(255,255,255,0.6)]" />
              </motion.div>

              {/* Card 1: Flow 01 (Paste Any Video Link) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, delay: 0.4 } },
                }}
                style={{
                  position: 'absolute',
                  left: '160px',
                  top: '0px',
                  width: '350px',
                  height: '215px',
                  transform: 'rotate(-2deg)',
                }}
                className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 hover:border-zinc-500/80 transition-all duration-300 shadow-2xl shadow-black/80 z-10 flex flex-col justify-start group"
              >
                <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  FLOW 01
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1 mb-2">
                  Paste Any Video Link
                </h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed font-normal">
                  Drop any video link from YouTube, Shorts, Instagram Reels, Twitch, TikTok, or Twitter / X. The high-speed ingestion engine analyzes and parses master streams, multi-bitrate codecs, audio tracks, and chapter metadata automatically.
                </p>
              </motion.div>

              {/* Card 2: Flow 02 (Precision Timeline Trimming) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, delay: 1.1 } },
                }}
                style={{
                  position: 'absolute',
                  left: '790px',
                  top: '0px',
                  width: '350px',
                  height: '215px',
                  transform: 'rotate(2deg)',
                }}
                className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 hover:border-zinc-500/80 transition-all duration-300 shadow-2xl shadow-black/80 z-10 flex flex-col justify-start group"
              >
                <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  FLOW 02
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1 mb-2">
                  Precision Trimming
                </h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed font-normal">
                  Scrub the video filmstrip frame-by-frame with sub-second accuracy. Set precise in and out cut points using millisecond timestamps, keyboard shortcuts, and instant seamless looping preview without re-rendering delays.
                </p>
              </motion.div>

              {/* Card 3: Flow 03 (Reframe & Pro Tools) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, delay: 1.9 } },
                }}
                style={{
                  position: 'absolute',
                  left: '790px',
                  top: '290px',
                  width: '350px',
                  height: '215px',
                  transform: 'rotate(2deg)',
                }}
                className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 hover:border-zinc-500/80 transition-all duration-300 shadow-2xl shadow-black/80 z-10 flex flex-col justify-start group"
              >
                <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  FLOW 03
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1 mb-2">
                  Reframe & Pro Tools
                </h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed font-normal">
                  Transform video aspect ratios to 9:16 vertical Shorts/Reels, 1:1 square, or 4:5 portrait with AI-powered focus tracking. Extract studio-grade 320kbps MP3 audio, add dynamic captions, and tweak playback velocity.
                </p>
              </motion.div>

              {/* Card 4: Flow 04 (Instant 4K Export) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, delay: 2.7 } },
                }}
                style={{
                  position: 'absolute',
                  left: '160px',
                  top: '290px',
                  width: '350px',
                  height: '215px',
                  transform: 'rotate(-2deg)',
                }}
                className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 hover:border-zinc-500/80 transition-all duration-300 shadow-2xl shadow-black/80 z-10 flex flex-col justify-start group"
              >
                <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  FLOW 04
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1 mb-2">
                  Instant 4K Export
                </h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed font-normal">
                  Generate production-ready video clips up to 4K 60FPS using hardware GPU acceleration or cloud rendering. Download directly to your local storage or stream securely with zero compression loss.
                </p>
              </motion.div>

              {/* 🎥 Video Output Logo Only (Turned 180°, Lights up at end) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 3.3 } },
                }}
                style={{
                  position: 'absolute',
                  left: '15px',
                  top: '367px',
                  width: '60px',
                  height: '60px',
                }}
                className="flex items-center justify-center text-white z-10 select-none"
              >
                <Video className="w-12 h-12 text-white scale-x-[-1] drop-shadow-[0_0_18px_rgba(255,255,255,0.6)]" />
              </motion.div>

            </motion.div>

            {/* ── MOBILE / TABLET VIEW: Responsive Flow Stack (Screens < 1280px) ── */}
            <div className="xl:hidden space-y-6">
              {/* Plug Source */}
              <div className="flex items-center justify-center text-white">
                <Plug className="w-10 h-10 text-white -rotate-45 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
              </div>

              {/* Flow Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    tag: 'FLOW 01',
                    title: 'Paste Any Video Link',
                    desc: 'Drop any video link from YouTube, Shorts, Instagram Reels, Twitch, TikTok, or Twitter / X. The high-speed ingestion engine analyzes and parses master streams, multi-bitrate codecs, audio tracks, and chapter metadata automatically.',
                  },
                  {
                    tag: 'FLOW 02',
                    title: 'Precision Trimming',
                    desc: 'Scrub the video filmstrip frame-by-frame with sub-second accuracy. Set precise in and out cut points using millisecond timestamps, keyboard shortcuts, and instant seamless looping preview without re-rendering delays.',
                  },
                  {
                    tag: 'FLOW 03',
                    title: 'Reframe & Pro Tools',
                    desc: 'Transform video aspect ratios to 9:16 vertical Shorts/Reels, 1:1 square, or 4:5 portrait with AI-powered focus tracking. Extract studio-grade 320kbps MP3 audio, add dynamic captions, and tweak playback velocity.',
                  },
                  {
                    tag: 'FLOW 04',
                    title: 'Instant 4K Export',
                    desc: 'Generate production-ready video clips up to 4K 60FPS using hardware GPU acceleration or cloud rendering. Download directly to your local storage or stream securely with zero compression loss.',
                  },
                ].map((item) => (
                  <div
                    key={item.tag}
                    className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 shadow-xl flex flex-col justify-start"
                  >
                    <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      {item.tag}
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight mt-1 mb-2">{item.title}</h3>
                    <p className="text-xs text-zinc-300 leading-relaxed font-normal">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Video Output Logo Only */}
              <div className="flex items-center justify-center text-white">
                <Video className="w-10 h-10 text-white scale-x-[-1] drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: Large Video Frame Showcase (Click to Open Pop-up) ── */}
        <section className="pt-2 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden bg-black">
          <div className="max-w-5xl mx-auto relative z-10">

            {/* Video Thumbnail Frame Container (Clickable macOS App Mockup) */}
            <div
              onClick={() => setIsVideoModalOpen(true)}
              className="relative rounded-2xl sm:rounded-3xl bg-[#08080c] border border-white/10 shadow-2xl shadow-purple-950/20 cursor-pointer group hover:border-white/20 transition-all duration-300 select-none overflow-hidden"
            >
              {/* macOS Top Bar with 3 Colored Dots */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#0b0b10]/90">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-[#dc2626]" />
                  <span className="w-3 h-3 rounded-full bg-[#eab308] border border-[#ca8a04]" />
                  <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-[#16a34a]" />
                  <span className="text-[11px] font-mono text-zinc-500 ml-2">Overview · ClipFlow Studio</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">Auto-Reframing</span>
                </div>
              </div>

              {/* Inside Mock Dashboard Screen */}
              <div className="relative w-full aspect-[16/9.5] sm:aspect-[16/9] bg-[#050508] p-4 sm:p-8 flex flex-col justify-between">
                {/* Visual Backdrop with Grid / Interface Cards */}
                <div className="grid grid-cols-3 gap-4 opacity-40">
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-zinc-800/80 rounded" />
                    <div className="h-24 bg-zinc-900/60 rounded-xl border border-white/5" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-zinc-800/80 rounded" />
                    <div className="h-24 bg-zinc-900/60 rounded-xl border border-white/5" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-zinc-800/80 rounded" />
                    <div className="h-24 bg-zinc-900/60 rounded-xl border border-white/5" />
                  </div>
                </div>

                {/* Center Glowing Play Button */}
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/80 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-2xl shadow-purple-600/30 transform group-hover:scale-110 group-hover:border-white/60 transition-all duration-300">
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1 fill-white text-white" />
                  </div>
                </div>

                {/* Bottom Frame Blend into Black */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: How People Use It ────────────────────────────── */}
        <section className="py-20 px-6 bg-black">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-purple-400">Use Cases</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                How people are using ClipFlow
              </h2>
              <p className="text-gray-500 text-sm max-w-xl mx-auto">
                From solo creators to marketing teams — ClipFlow fits every workflow.
              </p>
            </div>

            {/* Use case grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {USE_CASES.map((uc, i) => (
                <motion.div
                  key={uc.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09090e] p-6 group hover:border-white/20 transition-all duration-200 cursor-default"
                >
                  <div className="relative z-10 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center">
                      <uc.icon className={`w-5 h-5 ${uc.iconColor}`} />
                    </div>
                    <h3 className="font-bold text-white text-base">{uc.title}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{uc.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: Stats & Supported Platforms ── */}
        <section className="py-16 px-6 bg-black">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* Header with Live Blinking Green Dot */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Join thousands of creators already using ClipFlow
                </h2>
                <span className="relative flex h-2.5 w-2.5 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-gray-500 text-xs sm:text-sm">
                Creators all over the world clipping across all major platforms.
              </p>
            </div>

            {/* Clean Monochrome Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09090e] p-6 flex flex-col items-center text-center gap-2 group hover:border-white/20 transition-colors"
                >
                  <stat.icon className="w-5 h-5 text-zinc-400 mb-1" />
                  <p className="text-3xl font-extrabold text-white tracking-tight">{stat.value}</p>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Social platforms row */}
            <div className="space-y-3 text-center pt-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                People all over all platforms use this
              </p>
              <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
                {[
                  { name: 'YouTube', color: '#ff0000' },
                  { name: 'Instagram', color: '#e1306c' },
                  { name: 'TikTok', color: '#69c9d0' },
                  { name: 'Twitter / X', color: '#1d9bf0' },
                  { name: 'Twitch', color: '#9147ff' },
                  { name: 'Facebook', color: '#1877f2' },
                ].map((p) => (
                  <span key={p.name} className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-default flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5: Why Download Engine ── */}
        <section className="py-20 px-6 bg-black">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400">
                Processing Architecture
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Why Download ClipFlow Engine?
              </h2>
              <p className="text-zinc-400 text-sm max-w-xl mx-auto leading-relaxed">
                Choose between using your own device's hardware power for 100% free exports or high-speed cloud infrastructure.
              </p>
            </div>

            {/* 2 Clean Monochrome Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: With Engine */}
              <div className="p-7 sm:p-8 rounded-3xl bg-[#09090e] border border-white/10 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-white/25 transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                      <Cpu className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white bg-white/10 border border-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                      With Engine · 100% Free
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    Client-Side Hardware Power
                  </h3>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Since cloud servers require significant bandwidth and compute costs to transfer and re-encode high-bitrate video, we give you the freedom to choose. Use your own laptop or computer to process clips directly on your hardware.
                  </p>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Download the lightweight engine once and forget it — it connects automatically in the background with zero configuration or terminal popups needed. Enjoy unlimited 4K video exports and instant sub-second trims completely free forever.
                  </p>

                  <div className="pt-2 space-y-2 text-xs text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span>Zero cloud queue times or file size limits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span>Automatic companion — no extra windows or setup required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span>Saves directly into your local PC Downloads folder</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <a
                    href={`${BACKEND_URL}/api/video/tools/download-dlp`}
                    download
                    className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Free Engine</span>
                  </a>
                </div>
              </div>

              {/* Box 2: Without Engine */}
              <div className="p-7 sm:p-8 rounded-3xl bg-[#09090e] border border-white/10 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-white/25 transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300">
                      <HardDrive className="w-5 h-5 text-zinc-300" />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                      Without Engine · Cloud Sync
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    Cloud Processing & Storage
                  </h3>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Prefer not to install anything on your machine? Run everything seamlessly through our high-speed cloud infrastructure directly from your web browser.
                  </p>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Edit and format clips from any browser, save them securely to your personal Cloud Storage library, and come back later whenever you want to download or post them. Zero memory, disk space, or battery used on your laptop.
                  </p>

                  <div className="pt-2 space-y-2 text-xs text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>100% in-browser — zero downloads or installation needed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Dedicated Cloud Storage to store and organize your clips</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Access, download, and publish anytime from mobile or desktop</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                      if (input) input.focus();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 transition-all"
                  >
                    <span>Use Browser & Cloud Mode</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 6: CTA Join ─────────────────────────────────────── */}
        <section className="py-24 px-6 bg-black">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Social proof avatars */}
            <div className="flex items-center justify-center gap-1">
              {['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'].map((c, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-black -ml-2 first:ml-0 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: c, zIndex: 5 - i }}
                >
                  {['S', 'A', 'M', 'R', 'K'][i]}
                </div>
              ))}
              <span className="ml-3 text-xs text-gray-400 font-medium">+400 creators & teams</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Join{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400">
                  400+ Creators & Media Teams
                </span>{' '}
                Today
              </h2>
              <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                The next generation of video creators and high-growth brands clip and scale with ClipFlow.
              </p>
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                  if (input) input.focus();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Scissors className="w-4 h-4" />
                <span>Start ClipFlow</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                  if (input) input.focus();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all hover:border-white/25"
              >
                <span>Try a Demo URL</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-600">
              No credit card required &nbsp;·&nbsp; Free forever core &nbsp;·&nbsp; Instant download
            </p>
          </div>
        </section>

        {/* ── Section 7: Footer ─────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] py-8 px-6 bg-black">
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.ico" alt="ClipFlow" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <span className="text-xs font-bold text-gray-400">ClipFlow</span>
              <span className="text-xs text-gray-600">— Professional Video Studio</span>
            </div>
            <p className="text-[11px] text-gray-700">
              © 2026 ClipFlow. All rights reserved.
            </p>
          </div>
        </footer>

      </main>

      {/* ── Auth Modal ─────────────────────────────────────────────────── */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* ── Clip Download Selection Modal (5s Ad & Pro Option) ───────────── */}
      <ClipDownloadModal
        isOpen={isClipModalOpen}
        onClose={() => setIsClipModalOpen(false)}
        videoUrl={selectedClipUrl}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {/* ── Video Player 80% Pop-up Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div
            onClick={() => setIsVideoModalOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-200"
          >
            {/* Modal Container covering 80% of screen */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[86vw] max-w-6xl aspect-video max-h-[82vh] bg-black border border-white/20 rounded-2xl sm:rounded-3xl shadow-[0_0_90px_rgba(168,85,247,0.35)] overflow-hidden flex items-center justify-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 transition-all shadow-lg hover:scale-105 active:scale-95"
                title="Close Video"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Video Element */}
              <video
                id="clipflow-popup-video"
                className="w-full h-full object-contain bg-black"
                controls
                autoPlay
                playsInline
              >
                {/* 
                  Add your source file here, e.g.:
                  <source src="/demo.mp4" type="video/mp4" />
                */}
                Your browser does not support HTML5 video.
              </video>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

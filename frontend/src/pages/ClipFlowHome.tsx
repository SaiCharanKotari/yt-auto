import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors, Globe, Users,
  Download, ArrowRight, Star,
  Share2, X,
  Check, Cpu, HardDrive
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { UserProfileMenu } from '../components/UserProfileMenu';
// import { ClipDownloadModal } from '../components/ClipDownloadModal';
import { setStoredProcessingMode } from '../utils/editorSession';

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



export default function ClipFlowHome() {
  const [urlInput, setUrlInput] = useState('');
  const [quickInstaUrl, setQuickInstaUrl] = useState('');
  const [quickTwitchUrl, setQuickTwitchUrl] = useState('');
  const [quickTwitterUrl, setQuickTwitterUrl] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  // const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  // const [selectedClipUrl, setSelectedClipUrl] = useState('');

  // Desktop App email request state
  const [showEngineEmailBox, setShowEngineEmailBox] = useState(false);
  const [appEmail, setAppEmail] = useState('');
  const [appEmailStatus, setAppEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [appEmailMsg, setAppEmailMsg] = useState('');

  const handleAppEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appEmail.trim() || !appEmail.includes('@')) {
      setAppEmailStatus('error');
      setAppEmailMsg('Please enter a valid email address.');
      return;
    }

    try {
      setAppEmailStatus('loading');
      setAppEmailMsg('');
      const res = await fetch(`${BACKEND_URL}/api/app-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: appEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppEmailStatus('success');
        setAppEmailMsg('Thank you! Your email has been recorded for Desktop App access.');
        setAppEmail('');
      } else {
        setAppEmailStatus('error');
        setAppEmailMsg(data.error || 'Failed to submit email. Please try again.');
      }
    } catch {
      setAppEmailStatus('error');
      setAppEmailMsg('Network error. Please try again later.');
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // setIsVideoModalOpen(false);
        setPreviewImage(null);
      }
    };
    if (previewImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  const handleClipClick = (videoUrl: string) => {
    if (!videoUrl.trim()) return;

    // Desktop Helper App is currently on hold: take user directly to Pro mode
    setStoredProcessingMode('pro');
    window.open(
      `/editor/studio?url=${encodeURIComponent(videoUrl.trim())}&mode=pro&engine=server`,
      '_blank',
      'noopener,noreferrer'
    );

    /* 
    // ON HOLD: Previously opened Free vs Pro selection modal
    setSelectedClipUrl(videoUrl.trim());
    setIsClipModalOpen(true);
    */
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) handleClipClick(urlInput.trim());
  };

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col selection:bg-blue-500/30">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/95 backdrop-blur-xl px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.ico" alt="ClipFlow" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span className="text-sm font-bold tracking-tight text-white">ClipFlow</span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => {
                const el = document.getElementById('how-to-use');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              How to use
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('why-engine');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Download Engine
            </button>
            <Link
              to="/upgrade"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Upgrade
            </Link>
            <Link
              to="/terms"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Terms & Conditions
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <UserProfileMenu onOpenAuth={() => setShowAuthModal(true)} />
          </div>
        </div>
      </header>

      <main className="flex-1 bg-black">

        {/* ── Section 1: Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 pb-16 px-6 bg-black">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-blue-600/15 via-sky-600/8 to-transparent rounded-full blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto text-center space-y-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {/* Badge with NO leading logo */}
              <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-white bg-white text-black text-xs font-bold mb-2 shadow-md">
                <span>Next-Gen Video Clipping & Framing Studio</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Clip, Convert &{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400">
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

        {/* ── Section 2: How to Use (4 Steps: Top to Bottom with Edge-Blurred Images Blending into Black) ── */}
        <section id="how-to-use" className="pt-6 pb-12 px-4 sm:px-6 bg-black relative overflow-hidden scroll-mt-16">
          <div className="max-w-5xl mx-auto space-y-6 relative z-10">

            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                How to Use ClipFlow
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                4 streamlined steps from online video URL to finished export.
              </p>
            </div>

            {/* 4 Steps Stack with Divider Lines */}
            <div className="divide-y divide-zinc-800/80 border-y border-zinc-800/80">

              {/* ── STEP 1 ── */}
              <div className="py-4 sm:py-5 flex flex-col md:flex-row items-center gap-6 lg:gap-10">
                {/* Left: Uniform Image with Feathered Edge Blur Blending into Black */}
                <div
                  onClick={() => setPreviewImage('/steps/step1.png')}
                  className="w-full md:w-[440px] lg:w-[460px] h-[200px] sm:h-[220px] shrink-0 relative flex items-center justify-center cursor-pointer group select-none bg-black overflow-hidden rounded-xl"
                  title="Click to view full image"
                >
                  <img
                    src="/steps/step1.png"
                    alt="Step 1: Paste Link and Clip"
                    style={{
                      maskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                      WebkitMaskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                {/* Right: Matter */}
                <div className="flex-1 space-y-2.5 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">01</span>
                    <div className="h-[1px] w-8 bg-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Step One</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Paste Video Link &amp; Click Clip
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Paste any video URL from YouTube, Instagram Reels, Twitch, or Twitter / X directly into the input bar and click <strong className="text-white font-semibold">Clip</strong>. ClipFlow automatically ingests and prepares the video stream.
                  </p>
                </div>
              </div>

              {/* ── STEP 2 ── */}
              <div className="py-4 sm:py-5 flex flex-col md:flex-row items-center gap-6 lg:gap-10">
                {/* Left: Uniform Image with Feathered Edge Blur Blending into Black */}
                <div
                  onClick={() => setPreviewImage('/steps/step2.png')}
                  className="w-full md:w-[440px] lg:w-[460px] h-[200px] sm:h-[220px] shrink-0 relative flex items-center justify-center cursor-pointer group select-none bg-black overflow-hidden rounded-xl"
                  title="Click to view full image"
                >
                  <img
                    src="/steps/step2.png"
                    alt="Step 2: Precision Trimming"
                    style={{
                      maskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                      WebkitMaskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                {/* Right: Matter */}
                <div className="flex-1 space-y-2.5 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">02</span>
                    <div className="h-[1px] w-8 bg-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Step Two</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Set Start &amp; End Cut Points
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Scrub through the timeline with sub-second accuracy. Drag the interactive start and end trim handles on the video filmstrip to pinpoint the exact portion you want to clip.
                  </p>
                </div>
              </div>

              {/* ── STEP 3 ── */}
              <div className="py-4 sm:py-5 flex flex-col md:flex-row items-center gap-6 lg:gap-10">
                {/* Left: Uniform Image with Feathered Edge Blur Blending into Black */}
                <div
                  onClick={() => setPreviewImage('/steps/step3.png')}
                  className="w-full md:w-[440px] lg:w-[460px] h-[200px] sm:h-[220px] shrink-0 relative flex items-center justify-center cursor-pointer group select-none bg-black overflow-hidden rounded-xl"
                  title="Click to view full image"
                >
                  <img
                    src="/steps/step3.png"
                    alt="Step 3: Crop & Framing, Format & Quality"
                    style={{
                      maskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                      WebkitMaskImage: 'radial-gradient(ellipse 92% 86% at 50% 50%, black 50%, transparent 100%)',
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                {/* Right: Matter */}
                <div className="flex-1 space-y-2.5 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">03</span>
                    <div className="h-[1px] w-8 bg-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Step Three</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Choose Framing, Format &amp; Resolution
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Select your aspect ratio (16:9 Landscape, 9:16 Shorts/Reels, 1:1 Square, 4:5 Portrait, or Custom), pick your export format (MP4 Video, MP3 Audio, Subtitles), and choose resolutions up to 4K / 1080p.
                  </p>
                </div>
              </div>

              {/* ── STEP 4 (Two Images Stacked Vertically on Left, Same Total Size) ── */}
              <div className="py-4 sm:py-5 flex flex-col md:flex-row items-center gap-6 lg:gap-10">
                {/* Left: Two Images Stacked on Top of Each Other (Same Exact Container Footprint) */}
                <div className="w-full md:w-[440px] lg:w-[460px] h-[200px] sm:h-[220px] shrink-0 relative flex flex-col justify-between gap-2.5 bg-black">

                  {/* Top Image: Local Save File Dialog */}
                  <div
                    onClick={() => setPreviewImage('/steps/step4_save.png')}
                    className="relative flex-1 rounded-lg overflow-hidden bg-black cursor-pointer group select-none flex items-center justify-center"
                    title="Click to view full image"
                  >
                    <img
                      src="/steps/step4_save.png"
                      alt="Step 4: Save As Dialog"
                      style={{
                        maskImage: 'radial-gradient(ellipse 94% 84% at 50% 50%, black 50%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 94% 84% at 50% 50%, black 50%, transparent 100%)',
                      }}
                      className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  {/* Bottom Image: Cloud Storage Vault */}
                  <div
                    onClick={() => setPreviewImage('/steps/step4_storage.png')}
                    className="relative flex-1 rounded-lg overflow-hidden bg-black cursor-pointer group select-none flex items-center justify-center"
                    title="Click to view full image"
                  >
                    <img
                      src="/steps/step4_storage.png"
                      alt="Step 4: Cloud Storage Table"
                      style={{
                        maskImage: 'radial-gradient(ellipse 94% 84% at 50% 50%, black 50%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 94% 84% at 50% 50%, black 50%, transparent 100%)',
                      }}
                      className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                </div>

                {/* Right: Matter */}
                <div className="flex-1 space-y-2.5 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">04</span>
                    <div className="h-[1px] w-8 bg-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Step Four</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Instant Download &amp; Cloud Storage
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Download your trimmed clip directly to your computer with zero compression loss, and access your saved video library anytime from your personal Cloud Storage vault.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── OLD HOW TO USE UI (COMMENTED OUT AS REQUESTED) ──
        <section id="how-to-use-old" className="pt-10 pb-20 px-4 sm:px-6 bg-black relative overflow-hidden scroll-mt-16">
          <div className="max-w-[1360px] mx-auto space-y-12 relative z-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                How to Use ClipFlow
              </h2>
              <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
                4 streamlined stages from raw online video to finished 4K clip.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { tag: 'FLOW 01', title: 'Paste Any Video Link', desc: 'Drop any video link from YouTube, Shorts, Instagram Reels, Twitch, TikTok, or Twitter / X.' },
                { tag: 'FLOW 02', title: 'Precision Trimming', desc: 'Scrub the video filmstrip frame-by-frame with sub-second accuracy.' },
                { tag: 'FLOW 03', title: 'Reframe & Pro Tools', desc: 'Transform video aspect ratios to 9:16 vertical Shorts/Reels, 1:1 square, or 4:5 portrait.' },
                { tag: 'FLOW 04', title: 'Instant 4K Export', desc: 'Generate production-ready video clips up to 4K 60FPS using hardware GPU acceleration or cloud rendering.' },
              ].map((item) => (
                <div key={item.tag} className="p-6 rounded-2xl bg-[#18181c] border border-zinc-700/60 shadow-xl flex flex-col justify-start">
                  <span className="text-[12px] font-mono font-bold text-emerald-400 uppercase tracking-wider">{item.tag}</span>
                  <h3 className="text-base font-bold text-white tracking-tight mt-1 mb-2">{item.title}</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed font-normal">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        ── END OF OLD HOW TO USE UI ── */}

        {/* ── Section 3: Large Video Frame Showcase (COMMENTED OUT FOR NOW) ──
        <section className="pt-2 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden bg-black">
          <div className="max-w-5xl mx-auto relative z-10">
            <div
              onClick={() => setIsVideoModalOpen(true)}
              className="relative rounded-2xl sm:rounded-3xl bg-[#08080c] border border-white/10 shadow-2xl shadow-purple-950/20 cursor-pointer group hover:border-white/20 transition-all duration-300 select-none overflow-hidden"
            >
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

              <div className="relative w-full aspect-[16/9.5] sm:aspect-[16/9] bg-[#050508] p-4 sm:p-8 flex flex-col justify-between">
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

                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/80 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-2xl shadow-purple-600/30 transform group-hover:scale-110 group-hover:border-white/60 transition-all duration-300">
                    <span className="text-white font-bold">Play</span>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
              </div>
            </div>
          </div>
        </section>
        ── */}



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

        {/* ── Section 5: Engine Comparison & Download / Access Request ── */}
        <section id="why-engine" className="py-20 px-6 bg-black scroll-mt-16">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <span className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-zinc-400">
                Desktop Performance Engine
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Why Download ClipFlow Engine?
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
                Both browser and desktop versions deliver incredible speed. The standalone Desktop Engine is specifically built for business holders and organizations needing lifetime unlimited capacity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Box 1: With Engine (Client-Side Hardware Power - For Business Holders) */}
              <div className="relative rounded-2xl border border-white/20 bg-[#0a0a0f] p-6 sm:p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Desktop Engine</span>
                        <h3 className="text-lg font-bold text-white">With Desktop Engine</h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-black border border-white">
                      For Business Holders
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Engineered for organizations requiring maximum scale. 1-time purchase with unlimited processing power and all future updates included.
                  </p>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    {[
                      'No limitations — unlimited export minutes & batch clipping',
                      'Max settings unlocked (4K 60FPS, maximum bitrate)',
                      'All future platform changes & engine upgrades included',
                      '1-time lifetime organization ownership with zero recurring fees',
                      'Direct local CPU/GPU acceleration with 100% privacy & zero queues',
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs text-zinc-200">
                        <div className="w-4 h-4 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action: Download Button OR Inline Email Input Box */}
                <div className="pt-8">
                  {showEngineEmailBox ? (
                    <form onSubmit={handleAppEmailSubmit} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          required
                          value={appEmail}
                          onChange={(e) => setAppEmail(e.target.value)}
                          placeholder="Enter your organization email..."
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={appEmailStatus === 'loading'}
                          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {appEmailStatus === 'loading' ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                      {appEmailMsg && (
                        <p className={`text-[11px] font-medium ${appEmailStatus === 'success' ? 'text-zinc-200' : 'text-red-400'}`}>
                          {appEmailMsg}
                        </p>
                      )}
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowEngineEmailBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all active:scale-[0.99] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Desktop Engine</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Box 2: Without Engine (Cloud Processing & Storage) */}
              <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 sm:p-8 flex flex-col justify-between hover:border-white/20 transition-colors">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Cloud Processing</span>
                        <h3 className="text-lg font-bold text-white">Without Engine</h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/5 text-zinc-300 border border-white/15">
                      Browser
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Uses our high-performance cloud servers to fetch, trim, and render clips with zero local setup required.
                  </p>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    {[
                      'Zero installation — runs instantly in any modern web browser',
                      'Works seamlessly on mobile phones, Mac, PC, Chromebook',
                      'Secure cloud storage vault for your clipped video library',
                      'Instant link sharing, real-time waveform, & online preview',
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs text-zinc-400">
                        <div className="w-4 h-4 rounded-full bg-white/10 text-zinc-300 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action: Use Browser Mode */}
                <div className="pt-8">
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                      if (input) input.focus();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-all hover:border-white/30 active:scale-[0.99] cursor-pointer"
                  >
                    <span>Use Browser &amp; Cloud Mode</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 6: CTA Join ─────────────────────────────────────── */}
        <section className="py-20 px-6 bg-black">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Social proof avatars */}
            <div className="flex items-center justify-center gap-1">
              {['#0284c7', '#0ea5e9', '#06b6d4', '#10b981', '#3b82f6'].map((c, i) => (
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
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400">
                  400+ Creators &amp; Media Teams
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
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-sm shadow-xl shadow-blue-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Scissors className="w-4 h-4" />
                <span>Start ClipFlow</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="mailto:clipflovv@gmail.com"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all hover:border-white/25 cursor-pointer"
              >
                <span>Contact Us</span>
              </a>
            </div>

            {/* Direct Contact Information (Clean seamless text, no extra boxes) */}
            <div className="pt-4 flex items-center justify-center gap-2 sm:gap-3 text-xs text-zinc-400 flex-wrap">
              <span>Contact: <strong className="text-white font-semibold">Cliy</strong></span>
              <span className="text-zinc-600">•</span>
              <span>Email: <a href="mailto:clipflovv@gmail.com" className="text-zinc-300 hover:text-white hover:underline font-mono">clipflovv@gmail.com</a></span>
            </div>
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
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <Link to="/editor" className="hover:text-gray-300 transition-colors">
                Studio
              </Link>
              <Link to="/upgrade" className="hover:text-gray-300 transition-colors">
                Upgrade
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-sky-400 transition-colors">
                Terms of Service
              </Link>
              <span className="text-[11px] text-gray-700">
                © 2026 ClipFlow. All rights reserved.
              </span>
            </div>
          </div>
        </footer>

      </main>

      {/* ── Auth Modal ─────────────────────────────────────────────────── */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* ── Clip Download Selection Modal (ON HOLD - routing directly to Pro) ───────────── */}
      {/* <ClipDownloadModal
        isOpen={isClipModalOpen}
        onClose={() => setIsClipModalOpen(false)}
        videoUrl={selectedClipUrl}
        onOpenAuthModal={() => setShowAuthModal(true)}
      /> */}

      {/* ── Video Player 80% Pop-up Modal (COMMENTED OUT FOR NOW) ──
      <AnimatePresence>
        {isVideoModalOpen && (
          <div
            onClick={() => setIsVideoModalOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[86vw] max-w-6xl aspect-video max-h-[82vh] bg-black border border-white/20 rounded-2xl sm:rounded-3xl shadow-[0_0_90px_rgba(168,85,247,0.35)] overflow-hidden flex items-center justify-center"
            >
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 transition-all shadow-lg hover:scale-105 active:scale-95"
                title="Close Video"
              >
                <X className="w-5 h-5" />
              </button>

              <video
                id="clipflow-popup-video"
                className="w-full h-full object-contain bg-black"
                controls
                autoPlay
                playsInline
              >
                Your browser does not support HTML5 video.
              </video>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      ── */}

      {/* ── Fullscreen Image Preview Modal (Exact Image Size with Attached Close Button) ── */}
      <AnimatePresence>
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative inline-block max-w-[95vw] max-h-[92vh] select-none cursor-default"
            >
              {/* Close X Button attached directly to top-right of image */}
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/80 hover:bg-black text-white/90 hover:text-white border border-white/25 shadow-xl transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Exact image display */}
              <img
                src={previewImage}
                alt="Full Preview"
                className="w-auto h-auto max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-white/10 block"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

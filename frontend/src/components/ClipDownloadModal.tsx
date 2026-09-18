import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, HardDrive, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ClipDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  onOpenAuthModal?: () => void;
}

export function ClipDownloadModal({
  isOpen,
  onClose,
  videoUrl,
  onOpenAuthModal
}: ClipDownloadModalProps) {
  const { isPro } = useAuth();

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProceedFree = () => {
    if (!videoUrl.trim()) return;
    onClose();
    window.open(
      `/editor/studio?url=${encodeURIComponent(videoUrl.trim())}&engine=local`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleProceedPro = () => {
    if (!videoUrl.trim()) return;
    if (!isPro && onOpenAuthModal) {
      onClose();
      onOpenAuthModal();
      return;
    }
    onClose();
    window.open(
      `/editor/studio?url=${encodeURIComponent(videoUrl.trim())}&engine=server&mode=pro`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#09090b] border border-white/15 rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden text-[#f8fafc] flex flex-col"
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Select Download Mode
            </h2>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Main Content: 2 Option Cards */}
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            
            {/* ── Block 1: Free with local download ───────────────────────── */}
            <div
              onClick={handleProceedFree}
              className="group relative flex flex-col justify-between bg-black border border-white/15 hover:border-white/40 rounded-xl p-5 transition-all cursor-pointer shadow-md shadow-black/50"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <HardDrive className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/5 text-zinc-400">
                      Free Engine
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-zinc-100 transition-colors">
                  Free with local download
                </h3>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Video processing and downloading will take place directly on your device via the local companion engine. Enjoy unlimited clipping with brief ad support.
                </p>
              </div>

              <div className="pt-5 mt-4 border-t border-white/10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProceedFree();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 border border-white/15 transition-all group-hover:border-white/30"
                >
                  <span>Start Free Download</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {/* ── Block 2: Pro with server download ───────────────────────── */}
            <div
              onClick={handleProceedPro}
              className="group relative flex flex-col justify-between bg-gradient-to-b from-white/[0.08] to-black border border-white/30 hover:border-white/60 rounded-xl p-5 transition-all cursor-pointer shadow-lg shadow-black/70"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                      <Zap className="w-4 h-4 text-black" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-black">
                      {isPro ? 'Pro Active' : 'Pro Server'}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 group-hover:text-zinc-100 transition-colors">
                  Pro with server download
                </h3>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  High-speed processing executed on dedicated cloud servers. Store and access your saved clips directly in your cloud vault anytime, enjoy a 100% ad-free experience, and gain early access to upcoming features and future updates.
                </p>
              </div>

              <div className="pt-5 mt-4 border-t border-white/15">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProceedPro();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                >
                  <span>{isPro ? 'Launch Pro Server' : 'Download with Pro Server'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Footer Bar */}
          <div className="px-5 py-2.5 bg-black border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500">
            <span>ClipFlow Studio</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

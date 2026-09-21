import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, X,
  ArrowRight, Mail, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from '../components/AuthModal';

export default function UpgradePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleProClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      navigate('/editor');
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col selection:bg-white/20 selection:text-white">
      {/* ── Top Header Navigation ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-black/95 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <img src="/logo.ico" alt="ClipFlow" className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
            <span className="text-sm font-black tracking-tight text-white">ClipFlow</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-14 sm:pb-16 w-full space-y-10">
        
        {/* Title & Header */}
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Upgrade Your Video Workflow
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
            Choose the perfect plan for your creation needs. Run directly in the cloud or own the standalone desktop engine for infinite scale.
          </p>
        </div>

        {/* ── 3 Pricing Cards Grid (Monochrome Theme - No Blue Backgrounds) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* ── 1. FREE TIER (0 Rupees) ── */}
          <div className="relative rounded-2xl border border-white/10 bg-[#09090c] p-6 sm:p-8 flex flex-col justify-between hover:border-white/20 transition-all">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                  Starter Plan
                </span>
                <h3 className="text-2xl font-bold text-white">Free</h3>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                  Basic video trimming and quick cuts directly in your web browser.
                </p>
              </div>

              {/* Price */}
              <div className="pt-2 border-t border-white/[0.06] flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">₹0</span>
                <span className="text-xs text-zinc-500 font-medium">/ forever</span>
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">What's Included</p>
                <ul className="space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Limited clipping minutes per day</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Cloud storage videos auto-deleted after 1 hour</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Resolutions up to 1080p (No 4K)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Standard cloud processing queue</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-zinc-500">
                    <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                    <span>No Twitch live stream or long VOD processing</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-zinc-500">
                    <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                    <span>No AI tools or early feature access</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action */}
            <div className="pt-8">
              <button
                onClick={() => navigate('/editor')}
                className="w-full py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all hover:border-white/30 cursor-pointer"
              >
                Use Free Mode
              </button>
            </div>
          </div>

          {/* ── 2. PRO TIER (₹499) ── */}
          <div className="relative rounded-2xl border-2 border-white bg-[#0f0f14] p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-white/5">
            {/* Top Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-300">
                  Creator & Pro
                </span>
                <h3 className="text-2xl font-bold text-white">Pro</h3>
                <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px]">
                  Massive minutes pool, pristine 4K exports, and permanent video cloud storage.
                </p>
              </div>

              {/* Price */}
              <div className="pt-2 border-t border-white/10 flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">₹499</span>
                <span className="text-xs text-zinc-400 font-medium">/ access</span>
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Everything in Free, plus:</p>
                <ul className="space-y-2.5 text-xs text-zinc-200">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span className="font-semibold text-white">Large pool of export minutes</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span className="font-semibold text-white">Crisp 4K 60FPS master quality rendering</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span>Permanent Cloud Storage (videos never deleted)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span>Priority high-speed download & fast cloud queue</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span>Full Twitch VOD, YouTube, Reels & long-stream support</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <span>Early access to AI auto-highlights & all new updates</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action */}
            <div className="pt-8">
              <button
                onClick={handleProClick}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-black text-xs transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Upgrade to Pro</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── 3. BUSINESS TIER (1-Time Payment / Unlimited Desktop App) ── */}
          <div className="relative rounded-2xl border border-white/20 bg-[#09090c] p-6 sm:p-8 flex flex-col justify-between hover:border-white/30 transition-all">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                  Organizations & Teams
                </span>
                <h3 className="text-2xl font-bold text-white">Business</h3>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                  1-time purchase. Standalone Desktop App acting as your dedicated private server.
                </p>
              </div>

              {/* Price */}
              <div className="pt-2 border-t border-white/[0.06] flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">1-Time Payment</span>
                <span className="text-xs text-zinc-400 font-medium">(Lifetime)</span>
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Includes All PRO features, plus:</p>
                <ul className="space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span className="font-semibold text-white">Unlimited minutes & unlimited video exports</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>ClipFlow Standalone Desktop App / Engine included</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Acts like a private server on your local hardware</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Zero server delays, zero queues, 100% private</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>All future updates & engine changes applied</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                    <span>Direct priority support from founder (Cliy)</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action */}
            <div className="pt-8">
              <a
                href="mailto:clipflovv@gmail.com?subject=ClipFlow%20Business%20Plan%20Inquiry"
                className="w-full py-3 px-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact for Business</span>
              </a>
            </div>
          </div>

        </div>

        {/* ── Contact Section (Seamless borderless text) ── */}
        <div className="pt-8 border-t border-white/[0.07] text-center space-y-2">
          <h4 className="text-base font-bold text-white">Need a custom plan or have questions?</h4>
          <p className="text-xs text-zinc-400">
            Contact: <strong className="text-white font-medium">Cliy</strong> &bull; <a href="mailto:clipflovv@gmail.com" className="text-zinc-200 hover:text-white hover:underline font-mono">clipflovv@gmail.com</a>
          </p>
        </div>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 px-6 bg-black">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <img src="/logo.ico" alt="ClipFlow" className="w-5 h-5 object-contain" />
            <span className="text-zinc-400 font-bold">ClipFlow</span>
            <span>— by Cliy</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-zinc-300 transition-colors">Home</Link>
            <Link to="/editor" className="hover:text-zinc-300 transition-colors">Studio</Link>
            <Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
            <span>© 2026 ClipFlow</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

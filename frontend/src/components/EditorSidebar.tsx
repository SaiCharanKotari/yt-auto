import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors,
  Film,
  Sparkles,
  Sliders,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

interface EditorSidebarProps {
  width?: number;
  onWidthChange?: (newWidth: number) => void;
  showUrlChange?: boolean;
  newUrlInput?: string;
  setNewUrlInput?: (val: string) => void;
  onLoadVideo?: (url: string) => void;
  isLoadingMeta?: boolean;
  currentVideoUrl?: string;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  width = 230,
  onWidthChange,
  showUrlChange = false,
  newUrlInput = '',
  setNewUrlInput,
  onLoadVideo,
  isLoadingMeta = false,
  currentVideoUrl = '',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isDragging, setIsDragging] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Sync width if external prop changes
  useEffect(() => {
    setSidebarWidth(width);
  }, [width]);

  // Determine active nav item from route
  const getActiveNav = () => {
    const path = location.pathname;
    if (path.includes('/storage')) return 'Cloud';
    if (path.includes('/settings')) return 'Settings';
    return 'Studio';
  };

  const activeNav = getActiveNav();

  // Handle resizing drag
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const newW = e.clientX;
      if (newW >= 170 && newW <= 420) {
        setSidebarWidth(newW);
        if (onWidthChange) onWidthChange(newW);
      }
    };
    const onMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, onWidthChange]);

  const NAV_ITEMS = [
    { id: 'Studio', icon: Scissors, label: 'Studio', isSoon: false },
    { id: 'Cloud', icon: Film, label: 'Cloud Storage', isSoon: false },
    { id: 'AI', icon: Sparkles, label: 'AI Tools', isSoon: true },
    { id: 'Settings', icon: Sliders, label: 'Settings', isSoon: false },
  ];

  const getActiveVideoUrl = () => {
    if (currentVideoUrl) return currentVideoUrl;
    try {
      const sp = new URLSearchParams(location.search);
      const urlFromQuery = sp.get('url');
      if (urlFromQuery) return urlFromQuery;
      return localStorage.getItem('clipflow_active_video_url') || '';
    } catch {
      return '';
    }
  };

  const handleNavClick = (id: string) => {
    const activeVideo = getActiveVideoUrl();
    const search = activeVideo ? `?url=${encodeURIComponent(activeVideo)}` : '';

    if (id === 'Studio') {
      navigate(`/editor/studio${search}`);
    } else if (id === 'Cloud') {
      navigate(`/editor/storage${search}`);
    } else if (id === 'AI') {
      setAiNotice('Coming Soon! AI Video Assistant & Auto-Highlights are currently under development.');
      setTimeout(() => setAiNotice(null), 4000);
    } else if (id === 'Settings') {
      navigate(`/editor/settings${search}`);
    }
  };

  return (
    <>
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="shrink-0 flex flex-col bg-[#080808] border-r border-white/[0.06] overflow-hidden select-text h-full z-20"
      >
        {/* Logo at Top */}
        <div className="h-[54px] flex items-center justify-between px-3.5 border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 overflow-hidden group focus:outline-none cursor-pointer w-full text-left py-1"
            title="ClipFlow Home"
          >
            <img
              src="/logo.ico"
              alt="ClipFlow"
              className="w-7 h-7 object-contain shrink-0 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(168,85,247,0.35)]"
            />
            <span className="text-[15px] font-black text-white tracking-tight truncate group-hover:text-purple-300 transition-colors">ClipFlow</span>
          </button>
        </div>

        {/* URL Switcher (if in Studio) */}
        {showUrlChange && setNewUrlInput && onLoadVideo && (
          <div className="px-3 py-3 border-b border-white/[0.06]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newUrlInput.trim()) onLoadVideo(newUrlInput.trim());
              }}
              className="space-y-2"
            >
              <input
                type="url"
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                placeholder="Paste new video URL..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isLoadingMeta || !newUrlInput.trim()}
                className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Load Video
              </button>
            </form>
          </div>
        )}

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${
                  isActive
                    ? 'bg-purple-600/20 text-white border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-white'
                    }`}
                  />
                  <span className="text-xs font-semibold truncate">{item.label}</span>
                </div>
                {item.isSoon && (
                  <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[9px] font-extrabold text-purple-300 uppercase tracking-wider shrink-0">
                    SOON
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info bottom card */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm border border-white/20">
                K
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate" title={user.name || 'Kotari Sai Charan'}>
                  {user.name || 'Kotari Sai Charan 23BRS1009'}
                </p>
                <p className="text-[10px] text-purple-400 truncate font-medium">Pro Member</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-semibold transition-all"
            >
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Draggable Vertical Splitter */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className={`w-2.5 hover:w-2.5 -mx-1 z-30 flex items-center justify-center cursor-col-resize group transition-colors select-none ${
          isDragging ? 'bg-white/20' : 'bg-transparent hover:bg-white/10'
        }`}
        title="Drag to resize left sidebar"
      >
        <div
          className={`w-[2px] h-10 rounded-full transition-all ${
            isDragging
              ? 'bg-white h-16 shadow-md shadow-white/50'
              : 'bg-white/20 group-hover:bg-white group-hover:h-16'
          }`}
        />
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* AI Coming Soon Toast */}
      <AnimatePresence>
        {aiNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#121124]/95 border border-purple-500/40 text-purple-200 text-xs font-semibold shadow-2xl flex items-center gap-2.5 backdrop-blur-xl"
          >
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
            <span>{aiNotice}</span>
            <button
              onClick={() => setAiNotice(null)}
              className="ml-2 text-gray-400 hover:text-white p-0.5 rounded-md hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

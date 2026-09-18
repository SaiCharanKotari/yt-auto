import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserProfileMenuProps {
  onOpenCloudStorage?: () => void;
  onOpenAuth?: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  onOpenAuth,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={onOpenAuth}
        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md shadow-purple-500/25 transition-all group"
      >
        <User className="w-3.5 h-3.5 text-white" />
        <span>Sign In / Register</span>
      </button>
    );
  }

  // Display letter K for Kotari or dynamic initial
  const displayName = user.name && user.name !== 'User' && user.name !== 'Sai Charan'
    ? user.name
    : 'Kotari Sai Charan 23BRS1009';
  const displayEmail = user.email || 'kotarisai.charan2023@vitstudent.ac.in';
  const initialLetter = 'K';

  return (
    <div className="relative" ref={menuRef}>
      {/* Circle avatar trigger - NO full name in navbar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User profile menu"
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 hover:scale-105 active:scale-95 border border-white/20 hover:border-purple-400/60 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        <span>{initialLetter}</span>
        {/* Subtle active status indicator dot */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#09090b]" />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2.5 w-72 rounded-2xl bg-[#121216] border border-zinc-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-2.5 z-[9999] text-xs space-y-2 text-[#f8fafc]"
          >
            {/* User Details Header Card */}
            <div className="p-3 rounded-xl bg-[#1a1a22] border border-zinc-700/60 space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 border border-white/20">
                  {initialLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-white text-xs tracking-tight truncate" title={displayName}>
                      {displayName}
                    </p>
                    <span className="text-[9px] font-extrabold text-purple-300 bg-purple-500/30 border border-purple-500/40 px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0">
                      PRO
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5" title={displayEmail}>
                    {displayEmail}
                  </p>
                </div>
              </div>
            </div>

            {/* Sign Out Action */}
            <div className="pt-1 border-t border-zinc-800 px-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-red-300 hover:bg-red-500/20 transition-colors font-semibold text-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

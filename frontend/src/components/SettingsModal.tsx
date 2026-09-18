import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Cloud,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const displayName =
    user?.name && user.name !== 'User' && user.name !== 'Sai Charan'
      ? user.name
      : 'Kotari Sai Charan 23BRS1009';
  const displayEmail = user?.email || 'kotarisai.charan2023@vitstudent.ac.in';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setSuccessMsg('Password successfully changed! Your active session is protected.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-[#0c0c10] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden text-[#f8fafc]"
        >
          {/* Background subtle glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Account Settings</h2>
                <p className="text-xs text-gray-400">Manage profile details and security</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* User Info Section */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                User Information
              </span>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span>Full Name</span>
                </label>
                <div className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold text-white">
                  {displayName}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  <span>Email Address</span>
                </label>
                <div className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold text-white flex items-center justify-between">
                  <span className="truncate">{displayEmail}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                    <Check className="w-2.5 h-2.5" /> Verified
                  </span>
                </div>
              </div>

              {/* Plan & Drive */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium">Subscription</p>
                    <p className="text-xs font-bold text-purple-300 uppercase">
                      {user?.plan || 'PRO'} Tier
                    </p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium">Cloud Storage</p>
                    <p className="text-xs font-bold text-emerald-300">Connected (50 GB)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Change Form */}
            <form
              onSubmit={handlePasswordChange}
              className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3"
            >
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Change Password
              </span>

              {/* Alerts */}
              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  <span>Current Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  <span>New Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  <span>Confirm New Password</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-md shadow-purple-600/20"
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

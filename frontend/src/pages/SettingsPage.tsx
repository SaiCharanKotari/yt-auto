import React, { useState, useEffect } from 'react';
import {
  SquarePen,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  LogOut,
  Check,
  ShieldCheck,
  X,
  Mail,
  Lock,
  User as UserIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EditorSidebar } from '../components/EditorSidebar';
import { UserProfileMenu } from '../components/UserProfileMenu';

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, isPro, logout, selectPlan, refreshUser, resendVerification } = useAuth();

  const [sidebarWidth, setSidebarWidth] = useState(230);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // Edit Mode States
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [nameBackup, setNameBackup] = useState('');
  const [emailBackup, setEmailBackup] = useState('');

  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loading / Feedback States
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const uName = user.name || 'Kotari Sai Charan 23BRS1009';
      const uEmail = user.email || 'kotarisai.charan2023@vitstudent.ac.in';
      setFullName(uName);
      setEmail(uEmail);
      setNameBackup(uName);
      setEmailBackup(uEmail);
    } else {
      setFullName('Kotari Sai Charan 23BRS1009');
      setEmail('kotarisai.charan2023@vitstudent.ac.in');
      setNameBackup('Kotari Sai Charan 23BRS1009');
      setEmailBackup('kotarisai.charan2023@vitstudent.ac.in');
    }
  }, [user]);

  // Save Name Handler
  const handleSaveName = async () => {
    if (!fullName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }
    setIsSavingName(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: fullName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Full name updated successfully.');
        setNameBackup(fullName.trim());
        setIsEditingName(false);
        if (refreshUser) await refreshUser();
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setErrorMsg(data.error || 'Failed to update name');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setFullName(nameBackup);
    setIsEditingName(false);
    setErrorMsg(null);
  };

  // Save Email Handler
  const handleSaveEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Email cannot be empty.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSavingEmail(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailBackup(trimmed);
        setIsEditingEmail(false);
        if (data.emailChanged) {
          setSuccessMsg(
            `Email updated! A verification link has been sent to ${trimmed}. Please check your inbox and verify.`
          );
        } else {
          setSuccessMsg('Email saved successfully.');
        }
        if (refreshUser) await refreshUser();
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        setErrorMsg(data.error || 'Failed to update email');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleCancelEmail = () => {
    setEmail(emailBackup);
    setIsEditingEmail(false);
    setErrorMsg(null);
  };

  // Resend Email Verification
  const handleSendVerificationEmail = async () => {
    setIsResendingVerify(true);
    setErrorMsg(null);
    try {
      const res = await resendVerification(email);
      if (res.success) {
        setSuccessMsg(`Verification email sent to ${email}! Please check your inbox.`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.error || 'Failed to send verification email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending verification email');
    } finally {
      setIsResendingVerify(false);
    }
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg('Current password is wrong (required).');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password does not meet standards (must be at least 8 characters).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Re-entered password is wrong (does not match new password).');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Failed to update password';
        if (err.toLowerCase().includes('current') || err.toLowerCase().includes('incorrect')) {
          throw new Error('Current password is wrong.');
        }
        throw new Error(err);
      }

      setSuccessMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Handle Plan Upgrade
  const handleUpgrade = async () => {
    setIsUpgrading(true);
    setErrorMsg(null);
    try {
      if (selectPlan) {
        const res = await selectPlan('pro');
        if (res.success) {
          setSuccessMsg('Upgraded to Pro Plan successfully!');
          setTimeout(() => setSuccessMsg(null), 3500);
        } else {
          setErrorMsg(res.error || 'Failed to upgrade plan');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upgrade plan');
    } finally {
      setIsUpgrading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    navigate('/login');
  };

  const initialLetter = (fullName || 'U').charAt(0).toUpperCase();
  const isEmailVerified = user ? Boolean(user.emailVerified) : true;

  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#ededed] font-sans antialiased selection:bg-zinc-800">
      {/* Persistent Left Sidebar */}
      <EditorSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />

      {/* Main Settings Content */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0 bg-[#0a0a0c]">
        {/* Top Header Bar */}
        <header className="h-[52px] flex items-center justify-between px-6 border-b border-zinc-800/80 bg-black/90 backdrop-blur-md shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Account Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            <UserProfileMenu />
          </div>
        </header>

        {/* Compressed Central Workspace */}
        <div className="max-w-xl w-full mx-auto px-6 py-8 space-y-5">
          {/* Main Card */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Header / Avatar Row */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                  {initialLetter}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Profile Settings</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Account Security & Preferences
                  </p>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {/* 1. Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Full Name
                </label>

                <div
                  className={`min-h-[38px] flex items-center bg-[#18181b] border rounded-lg px-3 transition-all shadow-inner ${
                    isEditingName
                      ? 'border-purple-500/80 bg-purple-950/10 ring-1 ring-purple-500/30'
                      : 'border-zinc-800'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 text-zinc-500 mr-2.5 shrink-0" />
                  
                  {isEditingName ? (
                    <input
                      type="text"
                      autoFocus
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelName();
                      }}
                      placeholder="Enter full name"
                      className="w-full bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  ) : (
                    <div className="w-full text-xs font-medium text-zinc-200 select-all cursor-default">
                      {fullName || 'No name set'}
                    </div>
                  )}

                  {/* Actions on Right */}
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {isEditingName ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveName}
                          disabled={isSavingName}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow cursor-pointer disabled:opacity-50"
                          title="Save to database"
                        >
                          {isSavingName ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelName}
                          disabled={isSavingName}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                          title="Cancel editing"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNameBackup(fullName);
                          setIsEditingName(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 transition-colors text-[11px] font-semibold cursor-pointer"
                        title="Edit Full Name"
                      >
                        <SquarePen className="w-3 h-3 text-purple-400" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Email */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Email
                </label>

                <div
                  className={`min-h-[38px] flex items-center bg-[#18181b] border rounded-lg px-3 transition-all shadow-inner ${
                    isEditingEmail
                      ? 'border-purple-500/80 bg-purple-950/10 ring-1 ring-purple-500/30'
                      : 'border-zinc-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-zinc-500 mr-2.5 shrink-0" />

                  {isEditingEmail ? (
                    <input
                      type="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEmail();
                        if (e.key === 'Escape') handleCancelEmail();
                      }}
                      placeholder="Enter email address"
                      className="w-full bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  ) : (
                    <div className="w-full text-xs font-medium text-zinc-200 select-all cursor-default">
                      {email}
                    </div>
                  )}

                  {/* Actions & Verification on Right */}
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {/* Left of Edit Button: Verification Badge / Resend Button */}
                    {!isEditingEmail && (
                      <>
                        {isEmailVerified ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded"
                            title="Email is verified"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendVerificationEmail}
                            disabled={isResendingVerify}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded transition-all cursor-pointer disabled:opacity-50"
                            title="Click to send verification email"
                          >
                            {isResendingVerify ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            <span>Verify Email</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Edit or Save/Cancel Buttons */}
                    {isEditingEmail ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEmail}
                          disabled={isSavingEmail}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow cursor-pointer disabled:opacity-50"
                          title="Save to database and send verification"
                        >
                          {isSavingEmail ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEmail}
                          disabled={isSavingEmail}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                          title="Cancel editing"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailBackup(email);
                          setIsEditingEmail(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 transition-colors text-[11px] font-semibold cursor-pointer"
                        title="Edit Email Address"
                      >
                        <SquarePen className="w-3 h-3 text-purple-400" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5 pt-3 border-t border-zinc-800/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Change Password
                  </label>
                </div>

                {/* 3. Current password */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Current Password</span>
                  <div className="h-9 flex items-center bg-[#18181b] border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-500 rounded-lg px-3 transition-all shadow-inner">
                    <Lock className="w-3.5 h-3.5 text-zinc-500 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter existing password"
                      className="w-full bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. New password */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">New Password (at least 8 characters)</span>
                  <div className="h-9 flex items-center bg-[#18181b] border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-500 rounded-lg px-3 transition-all shadow-inner">
                    <Lock className="w-3.5 h-3.5 text-zinc-500 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 5. Re-enter New Password */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Re-enter New Password</span>
                  <div className="h-9 flex items-center bg-[#18181b] border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-500 rounded-lg px-3 transition-all shadow-inner">
                    <Lock className="w-3.5 h-3.5 text-zinc-500 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Save Password button when user types */}
                {(currentPassword || newPassword || confirmPassword) && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingPassword}
                      className="h-8 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingPassword ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Save Password</span>
                    </button>
                  </div>
                )}
              </form>

              {/* 6. Plan Section */}
              <div className="space-y-1.5 pt-3 border-t border-zinc-800/60">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Plan
                </label>
                <div className="flex items-center gap-3">
                  {/* Plan Badge */}
                  <div className="h-9 px-4 rounded-lg bg-[#18181b] border border-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center min-w-[90px] shadow-inner select-none">
                    {isPro ? 'Pro' : 'User'}
                  </div>

                  {/* Upgrade Button */}
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={isUpgrading || isPro}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {isUpgrading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Upgrade</span>
                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 7. Logout Button */}
              <div className="pt-4 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-9 px-5 rounded-lg bg-red-600/90 hover:bg-red-600 active:scale-95 text-white font-semibold text-xs transition-all shadow flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

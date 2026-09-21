import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { loginWithGoogle, loginWithEmail, registerWithEmail, requestPasswordReset, resetPassword } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      if (forgotStep === 'request') {
        if (!email.trim()) {
          setError('Please enter your email address');
          return;
        }

        setLoading(true);
        try {
          const res = await requestPasswordReset(email.trim());
          if (!res.success) {
            setError(res.error || 'Failed to request password reset code');
          } else {
            setSuccessMsg(res.message || 'Verification code generated! Enter it below.');
            if (res.resetCode) {
              setResetCode(res.resetCode);
            }
            setForgotStep('verify');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to request reset');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Step: verify & reset password
      if (!resetCode.trim() || !password) {
        setError('Please enter verification code and new password');
        return;
      }
      if (password.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      try {
        const res = await resetPassword(email.trim(), resetCode.trim(), password);
        if (!res.success) {
          setError(res.error || 'Failed to reset password');
        } else {
          setSuccessMsg('Password reset successfully! You are now logged in.');
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to reset password');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await registerWithEmail(email.trim(), password, name.trim());
        if (!res.success) {
          setError(res.error || 'Registration failed');
        } else {
          setSuccessMsg('Account created successfully! Welcome to ClipFlow.');
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        const res = await loginWithEmail(email.trim(), password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password');
        } else {
          setSuccessMsg('Signed in successfully!');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="bg-[#0c0c0f] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6 relative overflow-hidden text-[#f8fafc]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6 space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 mb-2">
            {mode === 'forgot' ? (
              <KeyRound className="w-5 h-5 text-purple-400" />
            ) : (
              <User className="w-5 h-5 text-purple-400" />
            )}
          </div>
          <h2 className="text-lg font-bold text-white">
            {mode === 'register'
              ? 'Create your ClipFlow Account'
              : mode === 'forgot'
              ? 'Reset Your Password'
              : 'Welcome back to ClipFlow'}
          </h2>
          <p className="text-xs text-gray-400">
            {mode === 'register'
              ? 'Export unlimited clips & sync directly with Cloud Storage'
              : mode === 'forgot'
              ? 'Enter your email to receive a secure password reset code'
              : 'Sign in to access your cloud exports and custom settings'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Hidden in forgot mode) */}
        {mode !== 'forgot' ? (
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/[0.08] mb-5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => { setMode('login'); setForgotStep('request'); setError(null); setSuccessMsg(null); }}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span className="text-[10px] uppercase font-bold text-gray-500">
              {forgotStep === 'request' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </span>
          </div>
        )}

        {/* Google OAuth Button (Only when not in forgot mode) */}
        {mode !== 'forgot' && (
          <>
            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all shadow-sm group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">or with email</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
          </>
        )}

        {/* Error / Success Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sai Charan"
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                />
              </div>
            </div>
          )}

          {/* Email field (Editable in login/reg/forgot step 1, read-only in step 2) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                disabled={mode === 'forgot' && forgotStep === 'verify'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium disabled:opacity-60"
              />
            </div>
          </div>

          {/* Verification code in Forgot Password Step 2 */}
          {mode === 'forgot' && forgotStep === 'verify' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">6-Digit Reset Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-black/40 border border-purple-500/40 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white tracking-widest font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Password fields */}
          {(mode !== 'forgot' || forgotStep === 'verify') && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {mode === 'forgot' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setForgotStep('request'); setError(null); setSuccessMsg(null); }}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {((mode === 'register') || (mode === 'forgot' && forgotStep === 'verify')) && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {mode === 'forgot' ? 'Confirm New Password' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 group"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <span>
                  {mode === 'register'
                    ? 'Create Account'
                    : mode === 'forgot'
                    ? (forgotStep === 'request' ? 'Send Verification Code' : 'Reset Password & Sign In')
                    : 'Sign In'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="mt-5 text-center text-xs text-gray-400">
          {mode === 'register' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
              >
                Sign In
              </button>
            </p>
          ) : mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Remember your credentials?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotStep('request'); setError(null); setSuccessMsg(null); }}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
              >
                Sign In
              </button>
            </p>
          )}

          <p className="text-[11px] text-zinc-500 text-center mt-3 pt-3 border-t border-white/[0.06]">
            By continuing, you agree to ClipFlow's{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-purple-300 underline transition-colors"
            >
              Terms of Service
            </a>.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Home,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth, type UserPlan } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlMode = searchParams.get('mode');

  const getInitialMode = (): 'login' | 'register' | 'forgot' => {
    if (urlMode === 'register' || location.pathname === '/register') return 'register';
    if (
      urlMode === 'forgot' ||
      urlMode === 'reset' ||
      location.pathname === '/forgot-password' ||
      location.pathname === '/forgot'
    )
      return 'forgot';
    return 'login';
  };

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(getInitialMode);
  const returnTo = searchParams.get('returnTo') || '/storage';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>('free');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { isAuthenticated, login, register, forgotPassword, loginWithGoogle } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }
      setLoading(true);
      try {
        const res = await forgotPassword(email.trim());
        setSuccessMsg(res.message || 'If an account exists, a password reset link has been sent.');
      } catch (err: any) {
        setError(err.message || 'Failed to request reset');
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
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
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
        const res = await register(email.trim(), password, name.trim(), selectedPlan);
        if (!res.success) {
          setError(res.error || 'Registration failed');
        } else {
          setSuccessMsg(res.message || 'Account created! Please check your email for verification.');
          setTimeout(() => {
            navigate(returnTo, { replace: true });
          }, 1200);
        }
      } else {
        const res = await login(email.trim(), password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password');
        } else {
          setSuccessMsg('Signed in successfully! Redirecting...');
          setTimeout(() => {
            navigate(returnTo, { replace: true });
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
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-purple-500/30">
      {/* Background glow & accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Home shortcut button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4 text-purple-400" />
        <span>Back to Home</span>
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0c0c0f] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-8 relative z-10 space-y-6"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center gap-2.5 mb-1 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <img src="/logo.ico" alt="ClipFlow" className="w-8 h-8 object-contain" />
            <span className="text-lg font-extrabold tracking-tight text-white">ClipFlow</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {mode === 'register'
              ? 'Create your account'
              : mode === 'forgot'
              ? 'Reset Your Password'
              : 'Sign in to your account'}
          </h1>
          <p className="text-xs text-gray-400">
            {mode === 'register'
              ? 'Start clipping, formatting, and storing videos in Cloud Storage'
              : mode === 'forgot'
              ? 'Enter your email to receive a password reset link'
              : 'Access your cloud exports, presets, and studio'}
          </p>
        </div>

        {/* Tab switcher */}
        {mode !== 'forgot' && (
          <div className="flex bg-black/50 p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Google 1-Click Sign In / Register Button */}
        {mode !== 'forgot' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all shadow-sm group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{mode === 'register' ? 'Sign up with Google (Cloud Sync)' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center my-2">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">or with email</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
          </div>
        )}

        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2"
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
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-300">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sai Charan"
                    className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              {/* Plan Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-purple-400" />
                  <span>Choose Your Plan</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'free', label: 'Free', limit: 'Local Only', icon: Zap },
                    { id: 'pro', label: 'Pro', limit: '50 GB Cloud', icon: Crown, popular: true },
                    { id: 'business', label: 'Business', limit: '500 GB Cloud', icon: Sparkles },
                  ].map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedPlan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlan(p.id as UserPlan)}
                        className={`p-2.5 rounded-xl border text-center transition-all relative ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm shadow-purple-600/30'
                            : 'bg-black/40 border-white/[0.08] text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full">
                            Popular
                          </span>
                        )}
                        <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
                        <div className="text-[11px] font-bold">{p.label}</div>
                        <div className="text-[9px] text-gray-500 mt-0.5">{p.limit}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-medium"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 group"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'register'
                    ? 'Create Account'
                    : mode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Sign In'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Bottom Switcher */}
        <div className="pt-2 border-t border-white/[0.06] text-center text-xs text-gray-400">
          {mode === 'register' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
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
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Argon2id + Secure Server-Side Sessions</span>
        </div>
      </motion.div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, ArrowRight, Mail, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();

  const queryToken = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState(queryToken);
  const [emailInput, setEmailInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    queryToken ? 'loading' : 'idle'
  );
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (queryToken) {
      handleVerification(queryToken);
    }
  }, [queryToken]);

  const handleVerification = async (tokenToVerify: string) => {
    setStatus('loading');
    setMessage('');
    const res = await verifyEmail(tokenToVerify.trim());
    if (res.success) {
      setStatus('success');
      setMessage(res.message || 'Email verified successfully! You now have full access.');
      setTimeout(() => {
        navigate('/storage');
      }, 2000);
    } else {
      setStatus('error');
      setMessage(res.error || 'Verification failed. The link may have expired or is invalid.');
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setStatus('loading');
    const res = await resendVerification(emailInput.trim());
    setStatus('idle');
    setMessage(res.message || 'Verification link sent if account exists.');
  };

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow & accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4 text-purple-400" />
        <span>Back to Home</span>
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0c0c0f] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-8 relative z-10 text-center space-y-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-white">Email Verification</h1>
          <p className="text-xs text-gray-400">
            Activate your ClipFlow account to unlock cloud storage and all features.
          </p>
        </div>

        {status === 'loading' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Verifying your email token...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex flex-col items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span>{message}</span>
            <span className="text-[11px] text-gray-400 mt-1">Redirecting in a moment...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{message}</span>
            </div>

            <form onSubmit={handleResend} className="space-y-3 pt-2 text-left">
              <label className="text-[11px] font-bold text-gray-300">Resend Verification Email</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter your email address"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Resend Verification Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {status === 'idle' && !queryToken && (
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300">Paste Verification Token</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token from email link"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={() => handleVerification(tokenInput)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Verify Token</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

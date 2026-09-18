import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 1000);
    return () => clearTimeout(timer);
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0c0c0f] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
          <LogOut className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white">Signing Out</h2>
          <p className="text-xs text-gray-400">Clearing active session and secure tokens...</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>Logged out successfully</span>
        </div>
      </motion.div>
    </div>
  );
}

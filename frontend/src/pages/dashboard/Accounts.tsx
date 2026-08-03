import { Plus, Video, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Account {
  id: string;
  channelId: string;
  name: string;
  avatar: string;
  subscribers: string;
  status: string;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const fetchAccounts = async () => {
    console.log('[Accounts] Fetching connected accounts from backend...');
    try {
      const res = await fetch('http://localhost:3001/api/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      console.log(`[Accounts] Fetched ${data.length} accounts.`);
      setAccounts(data);
    } catch (error) {
      console.error('[Accounts] Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();

    // Check for OAuth status in URL
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      console.log('[Accounts] Successfully connected new account via OAuth!');
      // Clean up URL
      window.history.replaceState({}, document.title, '/dashboard/accounts');
    }
    if (error) {
      console.error(`[Accounts] Failed to connect account: ${error}`);
      if (error === 'no_channel') {
        setErrorMsg('Your Google account does not have a YouTube channel created. Please go to youtube.com, create a channel for this account, and try again.');
      } else {
        setErrorMsg(`Failed to connect account: ${error}`);
      }
      window.history.replaceState({}, document.title, '/dashboard/accounts');
    }
  }, [searchParams]);

  const handleConnect = () => {
    console.log('[Accounts] Redirecting to Google OAuth flow...');
    window.location.href = 'http://localhost:3001/api/auth/google';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    console.log(`[Accounts] Deleting account ${id}...`);
    try {
      const res = await fetch(`http://localhost:3001/api/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      console.log(`[Accounts] Successfully deleted account ${id}.`);
      setAccounts(accounts.filter(a => a.id !== id));
    } catch (error) {
      console.error('[Accounts] Error deleting account:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">YouTube Accounts</h1>
          <p className="text-gray-400">Manage your connected channels for automated uploading and data extraction.</p>
        </div>
        <button 
          onClick={handleConnect}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Connect New Account
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between">
          <p>{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
          <h3 className="text-xl font-semibold text-white mb-2">No accounts connected</h3>
          <p className="text-gray-400 mb-6">Connect your YouTube channel to start automating Clip Flow.</p>
          <button 
            onClick={handleConnect}
            className="inline-flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" /> Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {accounts.map((account, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={account.id} 
              className="group relative bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-purple-500" />
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-full bg-white/10 p-1">
                  <img src={account.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt={account.name} className="w-full h-full rounded-full" />
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/20">
                  {account.status}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-1 truncate" title={account.name}>{account.name}</h3>
              <p className="text-gray-400 text-sm mb-6 flex items-center gap-2">
                <Video className="w-4 h-4 text-red-500" /> 
                {account.subscribers} subscribers
              </p>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  <RefreshCw className="w-4 h-4" /> Sync
                </button>
                <button 
                  onClick={() => handleDelete(account.id)}
                  className="flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

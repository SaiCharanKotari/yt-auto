import { Activity, Plus, X, Video, PlusCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Account {
  id: string;
  channelId: string;
  name: string;
  avatar: string;
  subscribers: string;
  status: string;
}

interface AnalyticsData {
  subscribers: string;
  summary: {
    views: number;
    watchTimeHours: string;
  };
  latestVideo: {
    title: string;
    thumbnail: string;
    publishedAt: string;
    views: string;
    ctr: string;
    avd: string;
  } | null;
  topContent: Array<{
    title: string;
    views: string;
  }>;
}

export default function Overview() {
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [openTabs, setOpenTabs] = useState<Account[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [analyticsData, setAnalyticsData] = useState<Record<string, AnalyticsData>>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    // Fetch accounts
    fetch('http://localhost:3001/api/accounts')
      .then(res => res.json())
      .then((data: Account[]) => {
        setAllAccounts(data);
      })
      .catch(err => console.error(err));
  }, []);

  // Fetch analytics when active tab changes
  useEffect(() => {
    if (activeTabId && !analyticsData[activeTabId]) {
      setLoadingAnalytics(true);
      fetch(`http://localhost:3001/api/accounts/${activeTabId}/analytics`)
        .then(res => res.json())
        .then(data => {
          setAnalyticsData(prev => ({ ...prev, [activeTabId]: data }));
          setLoadingAnalytics(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingAnalytics(false);
        });
    }
  }, [activeTabId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openTab = (account: Account) => {
    if (!openTabs.find(t => t.id === account.id)) {
      setOpenTabs([...openTabs, account]);
    }
    setActiveTabId(account.id);
    setShowDropdown(false);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== id);
    setOpenTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleConnect = () => {
    window.location.href = 'http://localhost:3001/api/auth/google';
  };

  const activeAccount = openTabs.find(t => t.id === activeTabId);
  const availableAccounts = allAccounts.filter(a => !openTabs.find(t => t.id === a.id));
  const activeAnalytics = activeTabId ? analyticsData[activeTabId] : null;

  return (
    <div className="h-full flex flex-col bg-black/20 rounded-xl border border-white/10">
      {/* VS Code Style Tab Bar */}
      <div className="flex bg-black/40 border-b border-white/5 flex-wrap">
        {openTabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group flex items-center gap-2 px-4 py-3 min-w-[150px] max-w-[200px] cursor-pointer border-r border-white/5 transition-colors relative ${
              activeTabId === tab.id 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            {activeTabId === tab.id && (
              <motion.div layoutId="activeTabTopBorder" className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
            )}
            <img src={tab.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Avatar" className="w-5 h-5 rounded-full" />
            <span className="truncate text-sm font-medium flex-1">{tab.name}</span>
            <button 
              onClick={(e) => closeTab(e, tab.id)}
              className={`p-1 rounded hover:bg-white/10 transition-opacity ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <div className="relative flex items-center px-2" ref={dropdownRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-1 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1.5 mb-1">Available Accounts</div>
                  {availableAccounts.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-gray-400">All accounts are open.</div>
                  ) : (
                    availableAccounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => openTab(acc)}
                        className="w-full flex items-center gap-3 px-2 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <img src={acc.avatar} className="w-6 h-6 rounded-full" />
                        <span className="truncate">{acc.name}</span>
                      </button>
                    ))
                  )}
                  
                  <div className="h-px bg-white/10 my-2" />
                  
                  <button
                    onClick={handleConnect}
                    className="w-full flex items-center gap-2 px-2 py-2 text-left text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Connect New Account
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tab Content area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!activeAccount ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Video className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No account selected</p>
            <p className="text-sm">Click the + icon in the tab bar to open an account overview.</p>
          </div>
        ) : loadingAnalytics && !activeAnalytics ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
             <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
             <p className="text-sm">Loading YouTube Analytics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={activeAccount.avatar} className="w-16 h-16 rounded-full border-2 border-primary/50 p-1" />
                <div>
                  <h2 className="text-2xl font-bold text-white">{activeAccount.name}</h2>
                  <div className="flex items-center gap-2 text-primary mt-1 text-sm font-medium bg-primary/10 w-fit px-2.5 py-1 rounded-full border border-primary/20">
                    <Video className="w-4 h-4" />
                    {activeAnalytics?.subscribers || activeAccount.subscribers} Subscribers
                  </div>
                </div>
              </div>
              <a 
                href={`https://studio.youtube.com/channel/${activeAccount.channelId}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                YouTube Studio
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latest Video Performance Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4">Latest video performance</h3>
                
                {!activeAnalytics?.latestVideo ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-10">
                    <Activity className="w-12 h-12 mb-2 opacity-30" />
                    <p className="text-sm">No recent videos found</p>
                  </div>
                ) : (
                  <>
                    <div className="aspect-video bg-black/40 rounded-xl mb-4 overflow-hidden relative group shrink-0 border border-white/5">
                      <img 
                        src={activeAnalytics.latestVideo.thumbnail} 
                        alt="Thumbnail" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="text-white font-medium text-sm mb-4 line-clamp-2" title={activeAnalytics.latestVideo.title}>
                      {activeAnalytics.latestVideo.title}
                    </h4>
                    
                    <div className="space-y-3 text-sm mb-6">
                      <div className="flex justify-between items-center group cursor-pointer hover:bg-white/5 p-1 -mx-1 rounded transition-colors">
                        <span className="text-gray-400">Views</span>
                        <span className="text-white font-medium">{activeAnalytics.latestVideo.views}</span>
                      </div>
                      <div className="flex justify-between items-center group cursor-pointer hover:bg-white/5 p-1 -mx-1 rounded transition-colors">
                        <span className="text-gray-400">Impressions click-through rate</span>
                        <span className="text-white font-medium">{activeAnalytics.latestVideo.ctr}</span>
                      </div>
                      <div className="flex justify-between items-center group cursor-pointer hover:bg-white/5 p-1 -mx-1 rounded transition-colors">
                        <span className="text-gray-400">Average view duration</span>
                        <span className="text-white font-medium">{activeAnalytics.latestVideo.avd}</span>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-white/10">
                      <a href={`https://studio.youtube.com/channel/${activeAccount.channelId}`} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 font-medium text-sm transition-colors uppercase tracking-wider block text-center w-full">
                        Catch me up on this video
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* Channel Analytics Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4">Channel analytics</h3>
                <div className="mb-6">
                  <div className="text-gray-400 text-sm">Current subscribers</div>
                  <div className="text-3xl font-bold text-white mt-1">{activeAnalytics?.subscribers || activeAccount.subscribers}</div>
                </div>
                
                <div className="border-t border-white/10 pt-4 mb-6">
                  <div className="text-white font-medium text-sm mb-1">Summary</div>
                  <div className="text-gray-400 text-xs mb-3">Last 28 days</div>
                  <div className="flex justify-between items-center mb-2 hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors">
                    <span className="text-sm text-gray-300">Views</span>
                    <span className="text-white font-medium text-sm">{activeAnalytics?.summary.views || 0}</span>
                  </div>
                  <div className="flex justify-between items-center hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors">
                    <span className="text-sm text-gray-300">Watch time (hours)</span>
                    <span className="text-white font-medium text-sm">{activeAnalytics?.summary.watchTimeHours || '0.0'}</span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex-1">
                  <div className="text-white font-medium text-sm mb-1">Top content</div>
                  <div className="text-gray-400 text-xs mb-3">Recent</div>
                  <div className="space-y-2">
                    {!activeAnalytics?.topContent || activeAnalytics.topContent.length === 0 ? (
                      <div className="text-sm text-gray-500 py-2">No recent content available</div>
                    ) : (
                      activeAnalytics.topContent.map((vid, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4 hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors">
                          <span className="text-sm text-gray-300 line-clamp-1" title={vid.title}>{vid.title}</span>
                          <span className="text-white font-medium text-sm shrink-0">{vid.views}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

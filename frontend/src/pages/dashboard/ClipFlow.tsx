import { Scissors, Settings2, Play, AlertCircle, Link as LinkIcon, ArrowRight, Download } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function ClipFlow() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [instaUrl, setInstaUrl] = useState('');
  const [isInstaLoading, setIsInstaLoading] = useState(false);
  const navigate = useNavigate();

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    console.log(`[ClipFlow] Processing URL: ${url}`);
    setIsLoading(true);
    try {
      const encodedUrl = encodeURIComponent(url);
      navigate(`/video/new?url=${encodedUrl}`);
    } catch (error) {
      console.error('[ClipFlow] Error navigating to video:', error);
      setIsLoading(false);
    }
  };

  const handleInstaDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instaUrl) return;
    setIsInstaLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: instaUrl,
          format: 'mp4',
          quality: '1080p',
          customFileName: 'Instagram_Video'
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setInstaUrl('');
    } catch (error) {
      console.error('Error downloading Instagram video:', error);
    } finally {
      setIsInstaLoading(false);
    }
  };


  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Clip Flow</h1>
        <p className="text-gray-400">Automate your video clipping, editing, and shorts generation pipeline.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4">Start New Clip Flow</h2>
          <form onSubmit={handleProcess} className="relative group w-full">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <LinkIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube or Twitch URL here..."
              className="w-full pl-12 pr-16 py-4 bg-black/40 border border-white/10 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-white shadow-inner"
              required
            />
            <button
              type="submit"
              disabled={isLoading || !url}
              className="absolute inset-y-2 right-2 px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-pink-500/10 to-orange-500/10 border border-pink-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <InstagramIcon className="text-pink-400" /> Instagram Quick Download
          </h2>
          <form onSubmit={handleInstaDownload} className="relative group w-full">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <InstagramIcon className="w-5 h-5 text-pink-400/50" />
            </div>
            <input
              type="url"
              value={instaUrl}
              onChange={(e) => setInstaUrl(e.target.value)}
              placeholder="Paste Instagram URL here..."
              className="w-full pl-12 pr-16 py-4 bg-black/40 border border-pink-500/20 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all text-white shadow-inner"
              required
            />
            <button
              type="submit"
              disabled={isInstaLoading || !instaUrl}
              className="absolute inset-y-2 right-2 px-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isInstaLoading ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 mt-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Scissors className="text-primary" /> Active Workflows
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Latest Twitch VOD &rarr; Shorts</h3>
                  <p className="text-sm text-gray-400 mt-1">Extracts top 3 highlights and posts to Main Gaming Channel</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                    <Play className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors">
                    <Settings2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            <button className="mt-6 w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/30 transition-all font-medium flex items-center justify-center gap-2">
              <PlusIcon /> Create New Workflow
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-4">Pipeline Status</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-white text-sm font-medium">Processing VOD #1293</p>
                  <p className="text-gray-500 text-xs">Finding highlights (65%)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-50">
                <div className="w-2 h-2 mt-2 rounded-full bg-gray-500" />
                <div>
                  <p className="text-white text-sm font-medium">Upload Queue</p>
                  <p className="text-gray-500 text-xs">2 items waiting</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm flex gap-3">
             <AlertCircle className="text-blue-400 w-6 h-6 flex-shrink-0" />
             <div>
               <h3 className="text-blue-100 font-semibold mb-1">Local Processing</h3>
               <p className="text-blue-200/70 text-sm">Clip Flow relies on local FFmpeg execution. Ensure your machine stays powered on during active workflows.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

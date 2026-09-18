import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  HardDrive,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Crown,
  FileVideo,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { EditorSidebar } from '../components/EditorSidebar';

interface CloudVideo {
  id: string;
  fileName: string;
  size: number;
  duration: number;
  mimeType: string;
  thumbnail?: string;
  driveFileId: string;
  createdAt: string;
}

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

export default function CloudStoragePage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isPro,
    selectPlan,
  } = useAuth();

  const [videos, setVideos] = useState<CloudVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(230);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format duration helper (seconds to MM:SS)
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper for file type
  const getFileType = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext && ['mp4', 'mp3', 'txt', 'srt', 'vtt', 'webm', 'wav', 'mkv', 'mov'].includes(ext)) {
      return ext;
    }
    if (mimeType?.includes('video')) return 'mp4';
    if (mimeType?.includes('audio')) return 'mp3';
    if (mimeType?.includes('vtt')) return 'vtt';
    if (mimeType?.includes('text') || mimeType?.includes('srt')) return 'srt';
    return ext || 'file';
  };

  const fetchVideos = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/videos`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.videos) {
        setVideos(data.videos);
      } else {
        setError(data.error || 'Failed to load videos');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching cloud videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?returnTo=/editor/storage');
      return;
    }

    if (isAuthenticated) {
      fetchVideos();
    }
  }, [isAuthenticated, authLoading]);

  const handleDelete = async (videoId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    setDeletingId(videoId);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/videos/${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete video');
      }

      setSuccessMsg(`"${fileName}" deleted successfully.`);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (videoId: string, fileName?: string) => {
    const downloadUrl = `${BACKEND_URL}/api/videos/${videoId}/download`;
    try {
      const res = await fetch(downloadUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'clipflow_video.mp4';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 3000);
    } catch (err) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleUpgradeToPro = async () => {
    const res = await selectPlan('pro');
    if (res.success) {
      setSuccessMsg('Upgraded to PRO plan! Cloud Storage is now active.');
      fetchVideos();
    } else {
      setError(res.error || 'Upgrade failed');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const sortedVideos = [...videos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#ededed] font-sans antialiased selection:bg-zinc-800">
      {/* Persistent Left Sidebar */}
      <EditorSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0 bg-[#0a0a0c]">
        {/* Top Navigation */}
        <header className="h-[52px] flex items-center justify-between px-6 border-b border-zinc-800/80 bg-black/90 backdrop-blur-md shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-zinc-400" />
            <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Cloud Storage</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchVideos()}
              disabled={loading}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              title="Refresh Files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserProfileMenu />
          </div>
        </header>

        {/* Content Container */}
        <div className="max-w-[1400px] w-full mx-auto p-6 md:p-8 space-y-6">
          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2.5"
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
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-300" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Free Tier Upgrade Banner - Minimalist Pro Banner */}
          {!isPro && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">Upgrade to Pro for Cloud Storage</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Unlock 50 GB high-speed cloud backup and automated cloud clip history.
                  </p>
                </div>
              </div>
              <button
                onClick={handleUpgradeToPro}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-black font-semibold text-xs transition-colors shrink-0"
              >
                Upgrade to PRO
              </button>
            </div>
          )}

          {/* Table Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400">
                  Files ({videos.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/40 p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="h-10 rounded bg-zinc-900/60 animate-pulse"
                  />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="border border-zinc-800/80 rounded-xl bg-black/40 py-16 px-4 text-center space-y-2">
                <FileVideo className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <h3 className="text-xs font-semibold text-zinc-300">No files found</h3>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  {isPro
                    ? 'Clips and downloads will automatically appear in your cloud storage table.'
                    : 'Upgrade to Pro to save clips directly to your cloud library.'}
                </p>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    {/* Table Header matching wireframe */}
                    <thead>
                      <tr className="border-b border-zinc-800 text-[11px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-950/70 select-none">
                        <th className="py-3 px-4 w-20 border-r border-zinc-800/60 font-medium">
                          SL.No
                        </th>
                        <th className="py-3 px-4 border-r border-zinc-800/60 font-medium">
                          FILE NAME
                        </th>
                        <th className="py-3 px-4 w-32 border-r border-zinc-800/60 font-medium">
                          Date
                        </th>
                        <th className="py-3 px-4 w-28 border-r border-zinc-800/60 font-medium">
                          Time
                        </th>
                        <th className="py-3 px-4 w-24 border-r border-zinc-800/60 font-medium">
                          Duration
                        </th>
                        <th className="py-3 px-4 w-24 border-r border-zinc-800/60 font-medium">
                          Size
                        </th>
                        <th className="py-3 px-4 w-24 border-r border-zinc-800/60 font-medium">
                          TYPE
                        </th>
                        <th className="py-3 px-4 w-32 text-center font-medium">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>

                    {/* Table Body with Bold Text & Increased Font Size */}
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-xs sm:text-[13px]">
                      {sortedVideos.map((video, index) => {
                        const fileType = getFileType(video.fileName, video.mimeType);
                        const dateObj = new Date(video.createdAt);
                        const formattedDate = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                            })
                          : '—';
                        const formattedTime = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '—';

                        return (
                          <tr
                            key={video.id}
                            className="group transition-colors duration-150 hover:bg-white/[0.04]"
                          >
                            {/* SL.No */}
                            <td className="py-3 px-4 text-zinc-300 font-bold border-r border-zinc-800/60 whitespace-nowrap">
                              {index + 1}
                            </td>

                            {/* FILE NAME (No icon, bold) */}
                            <td
                              className="py-3 px-4 font-sans text-xs sm:text-[13px] font-bold text-zinc-200 group-hover:text-white border-r border-zinc-800/60 min-w-[200px] max-w-[360px] truncate transition-colors"
                              title={video.fileName}
                            >
                              {video.fileName}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-4 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                              {formattedDate}
                            </td>

                            {/* Time */}
                            <td className="py-3 px-4 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                              {formattedTime}
                            </td>

                            {/* Duration */}
                            <td className="py-3 px-4 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                              {formatDuration(video.duration)}
                            </td>

                            {/* Size */}
                            <td className="py-3 px-4 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                              {formatBytes(video.size)}
                            </td>

                            {/* TYPE */}
                            <td className="py-3 px-4 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 uppercase whitespace-nowrap transition-colors">
                              {fileType}
                            </td>

                            {/* ACTIONS */}
                            <td className="py-3 px-4 whitespace-nowrap text-center font-bold">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => handleDownload(video.id, video.fileName)}
                                  className="px-2.5 py-1 rounded text-xs sm:text-[13px] font-sans font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                                  title="Download"
                                >
                                  Download
                                </button>

                                <button
                                  onClick={() => handleDelete(video.id, video.fileName)}
                                  disabled={deletingId === video.id}
                                  className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingId === video.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 stroke-[2.2]" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


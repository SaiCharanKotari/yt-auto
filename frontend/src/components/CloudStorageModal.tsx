import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RefreshCw,
  Trash2,
  ExternalLink,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Cloud,
  FileVideo,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  bytes?: number;
  createdTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
}

interface StorageQuota {
  limitBytes: number;
  usageBytes: number;
  limitFormatted: string;
  usageFormatted: string;
  percentUsed: number;
}

interface CloudStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudStorageModal: React.FC<CloudStorageModalProps> = ({ isOpen, onClose }) => {
  const { user, token, isAuthenticated, loginWithGoogle } = useAuth();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const fetchDriveData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch Files
      const filesRes = await fetch(`${BACKEND_URL}/api/drive/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filesData = await filesRes.json();
      if (filesData.error) throw new Error(filesData.error);
      setFiles(filesData.files || []);

      // Fetch Quota
      const quotaRes = await fetch(`${BACKEND_URL}/api/drive/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const quotaData = await quotaRes.json();
      if (quotaData.quota) {
        setQuota(quotaData.quota);
      }
    } catch (err: any) {
      console.error('[CloudStorageModal] Error fetching drive data:', err);
      setError(err.message || 'Failed to load Cloud Storage files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchDriveData();
    }
  }, [isOpen, isAuthenticated]);

  const handleDelete = async (fileId: string) => {
    if (!token) return;
    setDeletingId(fileId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/drive/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Remove from list
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setSuccessMessage('File deleted successfully');

      // Refresh Quota
      const quotaRes = await fetch(`${BACKEND_URL}/api/drive/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const quotaData = await quotaRes.json();
      if (quotaData.quota) {
        setQuota(quotaData.quota);
      }
    } catch (err: any) {
      console.error('[CloudStorageModal] Error deleting file:', err);
      setError(err.message || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  const sortedFiles = [...files].sort((a, b) => {
    const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-[#09090b] border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-[#ededed] font-sans antialiased"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">ClipFlow Cloud Storage</h2>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={fetchDriveData}
                disabled={loading}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors disabled:opacity-50"
                title="Refresh Files"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Status alerts */}
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

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-300" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {!isAuthenticated ? (
            /* Unauthenticated state */
            <div className="text-center py-14 px-4 space-y-4">
              <HardDrive className="w-10 h-10 text-zinc-600 mx-auto stroke-[1.5]" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">Connect Cloud Storage</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Sign in with your account to export clips directly to Cloud Storage and manage your library.
                </p>
              </div>
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-black font-semibold text-xs transition-colors"
              >
                <span>Sign In with Google</span>
              </button>
            </div>
          ) : (
            /* Authenticated Interface */
            <div className="space-y-4">
              {/* Account & Quota Bar */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-300">
                        {(user?.name || 'U').charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-zinc-300">{user?.email}</span>
                  </div>
                  {quota && (
                    <span className="text-zinc-500 font-mono text-[11px]">
                      {quota.usageFormatted} / {quota.limitFormatted} ({quota.percentUsed}% used)
                    </span>
                  )}
                </div>

                {/* Quota Progress Bar */}
                {quota && (
                  <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-400 transition-all duration-500"
                      style={{ width: `${Math.max(2, quota.percentUsed)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Files Table Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-zinc-400">
                    Files ({files.length})
                  </span>
                </div>

                {loading && files.length === 0 ? (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/40 p-6 space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-9 rounded bg-zinc-900/60 animate-pulse" />
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  <div className="border border-zinc-800/80 rounded-xl bg-black/40 py-12 px-4 text-center space-y-2">
                    <FileVideo className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                    <h3 className="text-xs font-semibold text-zinc-300">No clips in Cloud Storage yet</h3>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                      Clips exported from the Studio Editor will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/50">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        {/* Table Header matching wireframe */}
                        <thead>
                          <tr className="border-b border-zinc-800 text-[11px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-950/70 select-none">
                            <th className="py-2.5 px-3 w-16 border-r border-zinc-800/60 font-medium">
                              SL.No
                            </th>
                            <th className="py-2.5 px-3 border-r border-zinc-800/60 font-medium">
                              FILE NAME
                            </th>
                            <th className="py-2.5 px-3 w-28 border-r border-zinc-800/60 font-medium">
                              Date
                            </th>
                            <th className="py-2.5 px-3 w-24 border-r border-zinc-800/60 font-medium">
                              Time
                            </th>
                            <th className="py-2.5 px-3 w-20 border-r border-zinc-800/60 font-medium">
                              Duration
                            </th>
                            <th className="py-2.5 px-3 w-20 border-r border-zinc-800/60 font-medium">
                              Size
                            </th>
                            <th className="py-2.5 px-3 w-20 border-r border-zinc-800/60 font-medium">
                              TYPE
                            </th>
                            <th className="py-2.5 px-3 w-28 text-center font-medium">
                              ACTIONS
                            </th>
                          </tr>
                        </thead>

                        {/* Table Body with Bold Text & Increased Font Size */}
                        <tbody className="divide-y divide-zinc-800/60 font-mono text-xs sm:text-[13px]">
                          {sortedFiles.map((file, index) => {
                            const fileType = getFileType(file.name, file.mimeType);
                            const dateObj = file.createdTime ? new Date(file.createdTime) : null;
                            const formattedDate =
                              dateObj && !isNaN(dateObj.getTime())
                                ? dateObj.toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit',
                                  })
                                : '—';
                            const formattedTime =
                              dateObj && !isNaN(dateObj.getTime())
                                ? dateObj.toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : '—';

                            return (
                              <tr
                                key={file.id}
                                className="group transition-colors duration-150 hover:bg-white/[0.04]"
                              >
                                {/* SL.No */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold border-r border-zinc-800/60 whitespace-nowrap">
                                  {index + 1}
                                </td>

                                {/* FILE NAME (No icon, bold) */}
                                <td
                                  className="py-2.5 px-3 font-sans text-xs sm:text-[13px] font-bold text-zinc-200 group-hover:text-white border-r border-zinc-800/60 max-w-[260px] truncate transition-colors"
                                  title={file.name}
                                >
                                  {file.name}
                                </td>

                                {/* Date */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                                  {formattedDate}
                                </td>

                                {/* Time */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                                  {formattedTime}
                                </td>

                                {/* Duration */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                                  —
                                </td>

                                {/* Size */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 whitespace-nowrap transition-colors">
                                  {file.size || '—'}
                                </td>

                                {/* TYPE */}
                                <td className="py-2.5 px-3 text-zinc-300 font-bold group-hover:text-white border-r border-zinc-800/60 uppercase whitespace-nowrap transition-colors">
                                  {fileType}
                                </td>

                                {/* ACTIONS */}
                                <td className="py-2.5 px-3 whitespace-nowrap text-center font-bold">
                                  <div className="flex items-center justify-center gap-2">
                                    {file.webContentLink && (
                                      <a
                                        href={file.webContentLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        download
                                        className="px-2.5 py-1 rounded text-xs sm:text-[13px] font-sans font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                                        title="Download"
                                      >
                                        Download
                                      </a>
                                    )}

                                    <a
                                      href={file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                                      title="Open in Drive"
                                    >
                                      <ExternalLink className="w-4 h-4 stroke-[2.2]" />
                                    </a>

                                    <button
                                      onClick={() => handleDelete(file.id)}
                                      disabled={deletingId === file.id}
                                      className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                      title="Delete"
                                    >
                                      {deletingId === file.id ? (
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
          )}
        </div>
      </motion.div>
    </div>
  );
};


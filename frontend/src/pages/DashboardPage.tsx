import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-black/40 relative backdrop-blur-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 p-8 max-w-7xl mx-auto h-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}

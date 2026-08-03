import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scissors, Settings, Users, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const navItems = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', path: '/dashboard/accounts', icon: Users },
  { name: 'Clip Flow', path: '/dashboard/clip-flow', icon: Scissors },
  { name: 'Settings', path: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col p-4 hidden md:flex">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Video className="w-8 h-8 text-red-500" />
        <span className="text-xl font-bold tracking-tight text-white">YT Studio</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-white/10 rounded-lg"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className={clsx("w-5 h-5 relative z-10", isActive ? "text-primary" : "text-gray-400")} />
              <span className={clsx("relative z-10", isActive ? "text-white" : "text-gray-400 hover:text-gray-200")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto p-4 bg-white/5 rounded-xl border border-white/10 text-xs text-gray-400 shadow-inner">
        <p className="font-semibold text-gray-300 mb-1 flex items-center gap-1"><Settings className="w-3 h-3"/> API Config</p>
        <p className="truncate text-[10px] opacity-70">Client: 93723823038-...</p>
      </div>
    </aside>
  );
}

import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Lightbulb, LineChart as LineChartIcon, User, LogOut, Code2, Menu, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const { user, userData, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-brand">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navItems = [
    { name: 'Overview', href: '/app/overview', icon: LayoutDashboard },
    { name: 'Insights', href: '/app/insights', icon: Lightbulb },
    { name: 'Reports', href: '/app/reports', icon: LineChartIcon },
    { name: 'Team Benchmarks', href: '/app/team', icon: Users },
    { name: 'Profile', href: '/app/profile', icon: User },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-bg-dark">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-bg-surface/80 backdrop-blur-xl border-r border-border-subtle flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:w-64 lg:shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center h-16 px-6 border-b border-border-subtle/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-indigo-500 flex items-center justify-center mr-3 shadow-lg shadow-brand/20">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">DevInsight</span>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 px-3 flex items-center">
             <span className="flex-1">Analytics</span>
             <div className="h-px bg-border-subtle flex-1 ml-2"></div>
          </div>
          <div className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                  isActive 
                    ? "text-brand" 
                    : "text-text-secondary hover:text-white hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-brand/10 border border-brand/20 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className={cn("w-5 h-5 mr-3 flex-shrink-0 transition-colors relative z-10", isActive ? "text-brand" : "text-text-muted group-hover:text-text-secondary")} />
                <span className="relative z-10">{item.name}</span>
              </NavLink>
            );
          })}
          </div>
        </nav>

        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-brand flex items-center justify-center font-bold text-sm">
              {userData?.displayName?.charAt(0) || 'D'}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{userData?.displayName || 'Developer'}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-black/20 backdrop-blur-xl z-10 supports-[backdrop-filter]:bg-bg-dark/40 border-b-border-subtle">
          <div className="flex items-center flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 mr-3 -ml-2 text-text-muted hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-white capitalize hidden sm:block tracking-tight drop-shadow-md">
               {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
             <div className="text-sm border border-border-subtle bg-bg-elevated px-3 py-1.5 rounded-full flex items-center shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                <span className="text-text-secondary">Analyzing GitHub</span>
             </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

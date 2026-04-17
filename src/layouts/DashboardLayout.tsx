import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Lightbulb, LineChart as LineChartIcon, User, LogOut, Code2, Menu, Users, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Overview', href: '/app/overview', icon: LayoutDashboard, desc: 'Activity & stats' },
  { name: 'Insights', href: '/app/insights', icon: Lightbulb, desc: 'AI analysis' },
  { name: 'Reports', href: '/app/reports', icon: LineChartIcon, desc: 'Weekly summaries' },
  { name: 'Team', href: '/app/team', icon: Users, desc: 'Benchmarks' },
  { name: 'Profile', href: '/app/profile', icon: User, desc: 'Settings & integrations' },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-brand to-violet-500 animate-pulse" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-brand to-violet-500 animate-ping opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-text-muted text-sm font-medium">Loading your workspace…</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const handleLogout = async () => {
    await signOut(auth);
  };

  const currentPageName = location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-bg-dark">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:w-64 lg:shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: 'rgba(10, 11, 20, 0.92)',
          backdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center shadow-lg shrink-0" style={{ boxShadow: '0 0 12px rgba(99,102,241,0.35)' }}>
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">DevInsight</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted px-3 mb-4">Navigation</p>
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className="block"
              >
                <div className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "text-white"
                    : "text-text-secondary hover:text-white hover:bg-white/4"
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.10))',
                        border: '1px solid rgba(99,102,241,0.22)',
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn(
                    "w-4.5 h-4.5 shrink-0 transition-colors relative z-10",
                    isActive ? "text-brand" : "text-text-muted group-hover:text-text-secondary"
                  )} />
                  <div className="flex-1 relative z-10">
                    <span className={isActive ? 'text-white' : ''}>{item.name}</span>
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-brand relative z-10 animate-pulse-glow" />
                  )}
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="px-5 py-1">
          <div className="sidebar-divider" />
        </div>

        {/* User Area */}
        <div className="p-3 shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/4 transition-colors cursor-default group">
            <div className="relative shrink-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={userData?.displayName || 'User'}
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-brand/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand/40 to-violet-500/30 border border-brand/20 flex items-center justify-center font-bold text-sm text-brand">
                  {userData?.displayName?.charAt(0) || 'D'}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-bg-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{userData?.displayName || 'Developer'}</p>
              <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl text-sm text-text-muted hover:text-rose-400 hover:bg-rose-500/8 transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-10"
          style={{
            background: 'rgba(3, 7, 18, 0.7)',
            backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-text-muted text-sm">DevInsight</span>
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
              <h1 className="text-sm font-semibold text-white capitalize">{currentPageName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                color: '#34d399',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              GitHub Connected
            </motion.div>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-brand/20 cursor-pointer hover:ring-2 hover:ring-brand/30 transition-all">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand/40 to-violet-500/30 flex items-center justify-center font-bold text-sm text-brand">
                  {userData?.displayName?.charAt(0) || 'D'}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
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

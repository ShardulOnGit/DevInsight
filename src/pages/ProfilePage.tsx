import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Github, CheckCircle2, RefreshCw, LogOut, LinkIcon,
  Mail, Shield, Bell, ExternalLink, AlertTriangle, X, Gitlab, User, Settings, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { syncGitHubActivity } from '@/services/githubSync';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } }
};

type ToastType = 'success' | 'error' | 'info';
function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const config = {
    success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> },
    error: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.25)', text: '#fda4af', icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> },
    info: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', text: '#a5b4fc', icon: <Bell className="w-4 h-4 text-brand shrink-0" /> },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.94 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl text-sm font-medium max-w-xs"
      style={{ background: config.bg, borderColor: config.border, color: config.text }}
    >
      {config.icon}
      <span className="flex-1 leading-relaxed">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-bg-dark ${checked ? 'bg-brand shadow-lg shadow-brand/25' : 'bg-border-strong'}`}
    >
      <motion.span
        layout
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ translateX: checked ? 22 : 2 }}
      />
    </button>
  );
}

export default function ProfilePage() {
  const { user, userData, refreshUserData } = useAuth();
  const navigate = useNavigate();

  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [showGithubInput, setShowGithubInput] = useState(false);
  const [githubInput, setGithubInput] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [emailReports, setEmailReports] = useState(true);
  const [burnoutAlerts, setBurnoutAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const isConnected = !!userData?.githubUsername;
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleSync = async (username: string) => {
    if (!username.trim()) return;
    setSyncState('syncing');
    setSyncError(null);
    try {
      await syncGitHubActivity(user!.uid, username.trim());
      await refreshUserData();
      setSyncState('idle');
      setShowGithubInput(false);
      setGithubInput('');
      showToast(`GitHub synced for @${username.trim()} 🎉`, 'success');
    } catch (err: any) {
      setSyncState('error');
      setSyncError(err?.message || 'Sync failed. Check the username and try again.');
    }
  };

  const handleConnectSubmit = () => {
    if (!showGithubInput) { setShowGithubInput(true); return; }
    handleSync(githubInput);
  };

  const handleResync = () => handleSync(userData!.githubUsername);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  const connectedAt = userData?.githubConnectedAt?.toDate?.();

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Settings className="w-5 h-5 text-brand" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Profile & Settings</h1>
        </div>
        <p className="text-text-secondary text-sm ml-12">Manage your identity, integrations and preferences.</p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

        {/* ── Profile Card ── */}
        <motion.div variants={item}>
          <div className="rounded-2xl overflow-hidden border border-border-subtle glass-elevated relative">
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-brand/8 blur-[80px] rounded-full pointer-events-none" />

            <div className="p-6 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userData?.displayName || 'Avatar'}
                      className="w-20 h-20 rounded-2xl object-cover"
                      style={{ boxShadow: '0 0 0 2px rgba(99,102,241,0.3), 0 8px 24px rgba(0,0,0,0.4)' }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl text-brand"
                      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {userData?.displayName?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                  )}
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-bg-dark shadow"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{userData?.displayName || user?.displayName || 'Developer'}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-text-muted">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>{userData?.role === 'manager' ? 'Team Manager' : 'Developer'}</span>
                  </div>
                </div>

                {/* Sign Out */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0"
                  style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── GitHub Integration ── */}
        <motion.div variants={item}>
          <div className="rounded-2xl border border-border-subtle glass-elevated overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 mb-1">
                <Github className="w-5 h-5 text-white" />
                <h2 className="text-base font-bold text-white">GitHub Integration</h2>
                {isConnected && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted">Connect your GitHub to analyse your coding activity and generate insights.</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Connected state */}
              {isConnected && (
                <div className="rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Github className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <a
                        href={`https://github.com/${userData.githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-brand transition-colors"
                      >
                        @{userData.githubUsername}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-xs text-text-muted mt-0.5">
                        {connectedAt ? `Last synced ${formatDistanceToNow(connectedAt, { addSuffix: true })}` : 'Synced recently'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResync}
                      disabled={syncState === 'syncing'}
                      className="border-white/10 text-text-secondary hover:border-brand/40 hover:text-white"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                      {syncState === 'syncing' ? 'Syncing…' : 'Re-sync'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowGithubInput(true); setSyncError(null); }}
                      className="border-white/10 text-text-secondary hover:border-brand/40 hover:text-white"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {/* Recent repos */}
              {isConnected && userData?.recentFocusAreas?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Most active repos</p>
                  <div className="flex flex-wrap gap-2">
                    {userData.recentFocusAreas.map((area: any, i: number) => (
                      <a
                        key={i}
                        href={`https://github.com/${area.repoName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
                      >
                        <Github className="w-3 h-3" />
                        {area.repoName.split('/')[1] ?? area.repoName}
                        <span className="text-text-muted">· {area.commits}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Not connected prompt */}
              {!isConnected && !showGithubInput && (
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Github className="w-4.5 h-4.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Not connected</p>
                      <p className="text-xs text-text-muted">Link GitHub to unlock AI insights</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowGithubInput(true)}
                    className="bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/25"
                  >
                    <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                    Connect
                  </Button>
                </div>
              )}

              {/* Input form */}
              <AnimatePresence>
                {(!isConnected || showGithubInput) && (
                  <motion.div
                    key="github-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono select-none">@</span>
                          <input
                            type="text"
                            value={githubInput}
                            onChange={e => { setGithubInput(e.target.value); setSyncError(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleConnectSubmit()}
                            placeholder={userData?.githubUsername || 'your-github-username'}
                            autoFocus={showGithubInput}
                            className="w-full h-10 pl-7 pr-3 rounded-xl text-sm text-white placeholder:text-text-muted transition-all font-mono input-glow"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </div>
                        <Button
                          onClick={handleConnectSubmit}
                          disabled={syncState === 'syncing' || !githubInput.trim()}
                          size="sm"
                          className="h-10 px-4 bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/20 disabled:opacity-50"
                        >
                          {syncState === 'syncing' ? (
                            <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Syncing…</>
                          ) : (
                            <><LinkIcon className="w-3.5 h-3.5 mr-2" />{isConnected ? 'Update' : 'Connect'}</>
                          )}
                        </Button>
                        {showGithubInput && isConnected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setShowGithubInput(false); setGithubInput(''); setSyncError(null); }}
                            className="h-10 border-white/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Sync error */}
                      <AnimatePresence>
                        {syncError && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="flex items-start gap-2 p-3 rounded-xl text-xs"
                            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fda4af' }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {syncError}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!isConnected && (
                        <p className="text-xs text-text-muted">Enter your public GitHub username. DevInsight will sync your last 14 days of activity.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Other Integrations ── */}
        <motion.div variants={item}>
          <div className="rounded-2xl border border-border-subtle glass-elevated overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <h2 className="text-base font-bold text-white mb-0.5">Other Integrations</h2>
              <p className="text-sm text-text-muted">More platforms coming soon.</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 rounded-xl opacity-40 cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Gitlab className="w-4.5 h-4.5 text-[#fc6d26]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">GitLab</p>
                    <p className="text-xs text-text-muted">Coming soon</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4b5568' }}>Soon</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Notification Preferences ── */}
        <motion.div variants={item}>
          <div className="rounded-2xl border border-border-subtle glass-elevated overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 mb-0.5">
                <Bell className="w-4.5 h-4.5 text-text-muted" />
                <h2 className="text-base font-bold text-white">Notification Preferences</h2>
              </div>
              <p className="text-sm text-text-muted">Control when and how DevInsight contacts you.</p>
            </div>
            <div className="px-6 divide-y divide-white/4">
              {[
                { label: 'Weekly email summary', desc: 'A digest of your activity every Monday morning', value: emailReports, set: setEmailReports },
                { label: 'Burnout risk alerts', desc: 'Notified immediately if your patterns look risky', value: burnoutAlerts, set: setBurnoutAlerts },
                { label: 'Daily digest', desc: 'Receive your stats every morning at 9am', value: weeklyDigest, set: setWeeklyDigest },
              ].map(({ label, desc, value, set }) => (
                <div key={label} className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                  </div>
                  <Toggle checked={value} onChange={set} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}

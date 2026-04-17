import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, Gitlab, Slack, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { syncGitHubActivity } from '@/services/githubSync';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function ProfilePage() {
  const { user, userData, refreshUserData } = useAuth();
  const [gitHubState, setGitHubState] = useState<'disconnected' | 'syncing' | 'connected'>('disconnected');
  const [githubInput, setGithubInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (userData?.githubUsername) {
      setGitHubState('connected');
    }
  }, [userData]);

  const onConnectGitHub = async () => {
    if (!showInput) {
        setShowInput(true);
        return;
    }
    if (!githubInput) return;

    setGitHubState('syncing');
    try {
      await syncGitHubActivity(user!.uid, githubInput);
      await refreshUserData();
      setGitHubState('connected');
      setShowInput(false);
    } catch (error) {
      console.error(error);
      setGitHubState('disconnected');
      alert("Failed to connect GitHub. Check username.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-white tracking-tight">Account & Integrations</h2>
        <p className="text-text-secondary mt-1">Manage your connected accounts and notification settings.</p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
      <motion.div variants={itemVariants}>
      <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-xl shadow-lg shadow-black/10 overflow-hidden relative">
        {userData?.githubUsername && (
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full mix-blend-screen pointer-events-none fade-in"></div>
        )}
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Your personal information and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 rounded-full bg-indigo-500/20 text-brand flex items-center justify-center font-bold text-2xl border-2 border-brand/30">
              {userData?.displayName?.charAt(0) || 'D'}
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">{userData?.displayName || 'Developer'}</h3>
              <p className="text-sm text-text-muted">{user?.email}</p>
              <Button variant="outline" size="sm" className="mt-3">Edit Profile</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
      <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md">
        <CardHeader>
          <CardTitle>Connected Workspaces</CardTitle>
          <CardDescription>Integrate your coding environments for deep analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <IntegrationCard 
            icon={<Github className="w-6 h-6" />}
            title="GitHub"
            account={gitHubState === 'connected' ? userData?.githubUsername : gitHubState === 'syncing' ? 'Fetching events & tracking history...' : 'Not connected'}
            status={gitHubState}
            onConnect={onConnectGitHub}
            showInput={showInput}
            inputValue={githubInput}
            onInputChange={setGithubInput}
            inputPlaceholder="GitHub username"
          />
          <IntegrationCard 
            icon={<Gitlab className="w-6 h-6 text-[#fc6d26]" />}
            title="GitLab"
            account="Not connected"
            status="disconnected"
          />
        </CardContent>
      </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
      <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md">
         <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>When and how the AI Mentor should contact you.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <IntegrationCard 
              icon={<Slack className="w-6 h-6 text-[#E01E5A]" />}
              title="Slack Mentorship Bot"
              account="#dev-insights-private"
              status="connected"
            />
            <div className="pt-4 mt-4 border-t border-border-subtle">
               <label className="flex items-center space-x-3 cursor-pointer">
                 <input type="checkbox" className="form-checkbox h-4 w-4 text-brand rounded border-border-strong bg-bg-dark focus:ring-brand focus:ring-offset-bg-surface" defaultChecked />
                 <span className="text-sm text-text-secondary">Send weekly summary email reports</span>
               </label>
            </div>
         </CardContent>
      </Card>
      </motion.div>
      </motion.div>
    </div>
  );
}

function IntegrationCard({ icon, title, account, status, onConnect, showInput, inputValue, onInputChange, inputPlaceholder }: { icon: React.ReactNode, title: string, account: string, status: 'connected' | 'disconnected' | 'syncing', onConnect?: () => void, showInput?: boolean, inputValue?: string, onInputChange?: (v: string) => void, inputPlaceholder?: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-white/5 hover:border-brand/30 transition-all shadow-sm"
    >
      <div className="flex items-center space-x-4 mb-4 sm:mb-0">
        <div className="w-12 h-12 rounded-lg bg-bg-dark border border-white/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">{title}</h4>
          <p className="text-sm text-text-muted">{account}</p>
        </div>
      </div>
      <div className="ml-16 sm:ml-0">
        {status === 'connected' ? (
          <div className="flex items-center text-emerald-400 text-sm font-medium px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Connected
          </div>
        ) : status === 'syncing' ? (
          <div className="flex items-center text-brand text-sm font-medium px-3 py-1.5 rounded-md bg-brand/10 border border-brand/20">
            <div className="w-3.5 h-3.5 mr-2 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            Syncing...
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            {showInput && (
                <input 
                  type="text" 
                  value={inputValue || ''}
                  onChange={(e) => onInputChange && onInputChange(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="h-8 px-2 bg-bg-dark border border-border-strong rounded-md text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-brand"
                />
            )}
            <Button variant="outline" size="sm" onClick={onConnect}>{showInput ? 'Submit' : 'Connect Account'}</Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

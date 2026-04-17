import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Flame, Zap, BrainCircuit, Terminal, FileCode, CheckCircle2, RefreshCw, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { syncGitHubActivity } from '@/services/githubSync';
import { Button } from '@/components/ui/button';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}

export default function DashboardOverview() {
  const { user, userData, refreshUserData } = useAuth();
  const [activityData, setActivityData] = useState<any[]>([]);
  const [latestInsight, setLatestInsight] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({
    productivityScore: 0,
    burnoutRisk: 'Low',
    deepWorkHours: 0,
    totalCommits: 0
  });

  const handleSyncNow = async () => {
    if (!user || !userData?.githubUsername) return;
    setIsSyncing(true);
    try {
      await syncGitHubActivity(user.uid, userData.githubUsername);
      await refreshUserData();
    } catch (err) {
      console.error('Sync from dashboard failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const activitiesQuery = query(collection(db, 'dailyActivities'), where('uid', '==', user.uid));
    const unsubscribeActivities = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
      let loadedActivities: any[] = [];
      let totalDeepWork = 0;
      let totalCommits = 0;
      let lateNight = 0;
      let weekend = 0;

      activitiesSnapshot.forEach(doc => {
        const data = doc.data();
        loadedActivities.push(data);
        totalDeepWork += data.deepWorkHours || 0;
        totalCommits += data.commits || 0;
        lateNight += data.lateNightCommits || 0;
        weekend += data.weekendCommits || 0;
      });

      loadedActivities.sort((a, b) => a.date.localeCompare(b.date));

      let chartData = loadedActivities;
      if (loadedActivities.length === 0) {
        chartData = Array.from({ length: 14 }).map((_, i) => ({
          date: format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'),
          commits: 0,
          deepWorkHours: 0
        }));
      }

      const formattedChartData = chartData.map(d => ({
        ...d,
        dateLabel: format(parseISO(d.date), 'MMM dd')
      }));

      setActivityData(formattedChartData);

      const prodScore = totalCommits > 0 ? Math.min(100, Math.round((totalDeepWork * 2) + (totalCommits * 0.5))) : 0;

      let risk = 'Low';
      if (lateNight > 10 || weekend > 15) risk = 'High';
      else if (lateNight > 4 || weekend > 5) risk = 'Medium';

      setStats({ productivityScore: prodScore, burnoutRisk: risk, deepWorkHours: totalDeepWork, totalCommits: totalCommits });
    });

    const insightsQuery = query(collection(db, 'insights'), where('uid', '==', user.uid), limit(1));
    const unsubscribeInsights = onSnapshot(insightsQuery, (insightsSnapshot) => {
      let fetchedInsights: any[] = [];
      insightsSnapshot.forEach(doc => fetchedInsights.push(doc.data()));
      if (fetchedInsights.length > 0) setLatestInsight(fetchedInsights[0]);
    });

    return () => { unsubscribeActivities(); unsubscribeInsights(); };
  }, [user]);

  const scoreColor = stats.productivityScore >= 70 ? '#10b981' : stats.productivityScore >= 40 ? '#f59e0b' : '#f43f5e';
  const riskColor = stats.burnoutRisk === 'High' ? '#f43f5e' : stats.burnoutRisk === 'Medium' ? '#f59e0b' : '#10b981';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
            Welcome back,{' '}
            <span className="gradient-text">{userData?.displayName?.split(' ')[0] || 'Developer'}</span>{' '}
            <span className="animate-[wave_2s_ease-in-out]">👋</span>
          </h2>
          <p className="text-text-secondary mt-1.5 text-sm">Here's your engineering activity summary for this week.</p>
        </div>

        <div className="flex items-center gap-2">
          <motion.span
            whileHover={{ scale: 1.03 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
              stats.burnoutRisk === 'High' ? 'badge-danger' : stats.burnoutRisk === 'Medium' ? 'badge-warning' : 'badge-success'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats.burnoutRisk === 'High' ? 'bg-rose-400' : stats.burnoutRisk === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {stats.burnoutRisk === 'High' ? 'At Risk' : stats.burnoutRisk === 'Medium' ? 'Warning Pattern' : 'Healthy Pattern'}
          </motion.span>
        </div>
      </motion.div>

      {/* Main Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {/* Activity Chart — spans 2 cols */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <div className="h-full rounded-2xl overflow-hidden border border-border-subtle glass-elevated p-5 flex flex-col" style={{ minHeight: '360px' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Activity Trends</h3>
                <p className="text-xs text-text-muted mt-0.5">Commit history over the last 30 days</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                <span className="text-xs text-text-muted">Commits</span>
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(99,102,241,1)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="rgba(99,102,241,1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="dateLabel" stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131626', borderColor: '#2d3055', borderRadius: '12px', padding: '10px 14px', fontSize: '13px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                    cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    stroke="rgba(99,102,241,1)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCommits)"
                    activeDot={{ r: 5, fill: '#131626', stroke: '#6366f1', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Stat Cards — right column */}
        <motion.div variants={itemVariants} className="md:col-span-1 flex flex-col gap-5">
          <StatCard
            title="Productivity Score"
            value={`${stats.productivityScore}`}
            unit="/100"
            trend={stats.productivityScore > 0 ? "Based on recent activity" : "Awaiting sync"}
            trendUp={stats.productivityScore > 50}
            icon={<Zap className="w-4.5 h-4.5" style={{ color: '#f59e0b' }} />}
            valueColor={scoreColor}
            progress={stats.productivityScore}
          />
          <StatCard
            title="Burnout Risk"
            value={stats.burnoutRisk}
            trend={stats.burnoutRisk === 'High' ? "Elevated weekend & night work" : "Stable pattern detected"}
            trendUp={stats.burnoutRisk === 'Low'}
            icon={<Flame className={`w-4.5 h-4.5 ${stats.burnoutRisk === 'High' ? 'text-rose-400' : 'text-emerald-400'}`} />}
            valueColor={riskColor}
          />
        </motion.div>

        {/* AI Insight Card — spans 2 */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <div className="h-full rounded-2xl border overflow-hidden relative flex flex-col"
            style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))', backdropFilter: 'blur(24px)' }}>
            {/* Glow orb in corner */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />

            <div className="px-6 pt-5 pb-4 relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <SparklesIcon className="w-4.5 h-4.5 text-brand" />
                <h3 className="text-sm font-bold text-brand uppercase tracking-widest">AI Mentor Insight</h3>
              </div>
              <p className="text-xs text-white/60">Behavioral observation from your latest activity.</p>
            </div>

            <div className="flex-1 px-6 pb-6 relative z-10">
              {latestInsight ? (
                <div className="space-y-4">
                  <p className="text-[15px] text-white/90 leading-relaxed">{latestInsight.content}</p>
                  {latestInsight.recommendation && (
                    <div className="flex gap-3 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <CheckCircle2 className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                      <p className="text-sm text-white/80 leading-relaxed">
                        <strong className="text-white">Recommendation: </strong>{latestInsight.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ) : userData?.githubUsername ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[15px] text-white/70 leading-relaxed">
                    Your GitHub account (<span className="text-white font-mono">@{userData.githubUsername}</span>) is connected, but no insights have been generated yet. Sync to generate your first insight.
                  </p>
                  <Button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    size="sm"
                    className="w-fit bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/25 transition-all disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Generating insights…' : 'Sync & Generate Insights'}
                  </Button>
                </div>
              ) : (
                <p className="text-[15px] text-white/70 leading-relaxed">
                  Connect your GitHub account in your{' '}
                  <a href="/app/profile" className="text-brand hover:underline font-medium">Profile</a>{' '}
                  to start generating AI insights.
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Deep Work & Commits */}
        <motion.div variants={itemVariants} className="md:col-span-1 flex flex-col gap-5">
          <StatCard
            title="Deep Work Hours"
            value={`${stats.deepWorkHours}`}
            unit="h"
            trend="Est. from commit intensity"
            trendUp={stats.deepWorkHours > 10}
            icon={<BrainCircuit className="w-4.5 h-4.5 text-brand" />}
          />
          <StatCard
            title="Total Commits"
            value={`${stats.totalCommits}`}
            trend={userData?.githubUsername ? "Across active repositories" : "Connect GitHub to sync"}
            trendUp={stats.totalCommits > 0}
            icon={<Terminal className="w-4.5 h-4.5 text-slate-400" />}
          />
        </motion.div>
      </motion.div>

      {/* Recent Focus Areas */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">Recent Focus Areas</h3>
          <span className="text-xs text-text-muted">Last 2 weeks</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {userData?.recentFocusAreas && userData.recentFocusAreas.length > 0 ? (
            userData.recentFocusAreas.map((area: any, idx: number) => (
              <FocusCard
                key={idx}
                icon={<FileCode />}
                title={area.repoName}
                metrics={`${area.commits} commits merged`}
                time={formatDistanceToNow(new Date(area.lastActive), { addSuffix: true })}
              />
            ))
          ) : (
            <>
              <FocusCard icon={<FileCode />} title="Frontend Refactoring" metrics="5 files · 240 lines changed" time="2 hours ago" />
              <FocusCard icon={<Terminal />} title="API Integrations" metrics="2 files · 85 lines changed" time="Yesterday" />
              <FocusCard icon={<Activity />} title="Issue Triage" metrics="Closed 4 tickets" time="2 days ago" />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, unit, trend, trendUp, icon, valueColor, progress, className }: any) {
  return (
    <div className={`flex-1 rounded-2xl p-5 border glass-elevated hover:border-brand/20 transition-all card-lift ${className || ''}`}
      style={{ borderColor: 'rgba(255,255,255,0.04)', minHeight: '100px' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</p>
        <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tight stat-number" style={{ color: valueColor || '#f1f5f9' }}>{value}</span>
        {unit && <span className="text-base text-text-muted font-semibold">{unit}</span>}
      </div>
      {progress !== undefined && (
        <div className="progress-bar mt-3">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-2">
        {trendUp !== undefined && (
          trendUp ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />
        )}
        <p className="text-xs text-text-muted">{trend}</p>
      </div>
    </div>
  );
}

function FocusCard({ icon, title, metrics, time }: any) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="flex items-center gap-4 p-4 rounded-xl border border-border-subtle glass hover:border-brand/25 transition-all cursor-pointer group"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-text-muted group-hover:text-brand transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate group-hover:text-brand transition-colors">{title}</h4>
        <p className="text-xs text-text-muted truncate mt-0.5">{metrics}</p>
      </div>
      <div className="text-xs text-text-muted font-mono shrink-0">{time}</div>
    </motion.div>
  );
}

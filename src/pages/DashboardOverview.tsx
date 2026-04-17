import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Flame, Zap, BrainCircuit, Terminal, FileCode, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { format, subDays, parseISO, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

export default function DashboardOverview() {
  const { user, userData } = useAuth();
  const [activityData, setActivityData] = useState<any[]>([]);
  const [latestInsight, setLatestInsight] = useState<any>(null);
  const [stats, setStats] = useState({
    productivityScore: 0,
    burnoutRisk: 'Low',
    deepWorkHours: 0,
    totalCommits: 0
  });

  useEffect(() => {
    if (!user) return;

    // Fetch Activities real-time
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

      // Sort by date ascending
      loadedActivities.sort((a, b) => a.date.localeCompare(b.date));
      
      // Fill missing days if no data
      let chartData = loadedActivities;
      if (loadedActivities.length === 0) {
          chartData = Array.from({ length: 14 }).map((_, i) => ({
              date: format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'),
              commits: 0,
              deepWorkHours: 0
          }));
      }

      // Format for Chart
      const formattedChartData = chartData.map(d => ({
          ...d,
          dateLabel: format(parseISO(d.date), 'MMM dd')
      }));
      
      setActivityData(formattedChartData);

      // Calc scores
      const prodScore = totalCommits > 0 ? Math.min(100, Math.round((totalDeepWork * 2) + (totalCommits * 0.5))) : 0;
      
      // Burnout heuristic
      let risk = 'Low';
      if (lateNight > 10 || weekend > 15) risk = 'High';
      else if (lateNight > 4 || weekend > 5) risk = 'Medium';

      setStats({
          productivityScore: prodScore,
          burnoutRisk: risk,
          deepWorkHours: totalDeepWork,
          totalCommits: totalCommits
      });
    }, (error) => {
      console.error("Error fetching activities", error);
    });

    // Fetch latest Insight real-time
    const insightsQuery = query(collection(db, 'insights'), where('uid', '==', user.uid), limit(1));
    const unsubscribeInsights = onSnapshot(insightsQuery, (insightsSnapshot) => {
      let fetchedInsights: any[] = [];
      insightsSnapshot.forEach(doc => fetchedInsights.push(doc.data()));
      if (fetchedInsights.length > 0) {
          setLatestInsight(fetchedInsights[0]);
      }
    }, (error) => {
      console.error("Error fetching insights", error);
    });

    return () => {
      unsubscribeActivities();
      unsubscribeInsights();
    };
  }, [user]);
  return (
    <div className="space-y-6">
      {/* Welcome & Top Level Stats */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-indigo-400">{userData?.displayName?.split(' ')[0] || 'Developer'}</span> 👋</h2>
          <p className="text-text-secondary mt-1">Here's an overview of your engineering activity this week.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={stats.burnoutRisk === 'High' ? 'danger' : stats.burnoutRisk === 'Medium' ? 'warning' : 'success'} className="px-3 py-1 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${stats.burnoutRisk === 'High' ? 'bg-rose-400' : stats.burnoutRisk === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'} mr-2 animate-pulse`}></span>
             {stats.burnoutRisk === 'High' ? 'At Risk' : stats.burnoutRisk === 'Medium' ? 'Warning Pattern' : 'Healthy Pattern'}
          </Badge>
        </div>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8"
      >
        {/* Main Chart */}
        <motion.div variants={itemVariants} className="md:col-span-2 md:row-span-2 min-h-[350px]">
          <Card className="h-full border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-sm flex flex-col shadow-lg shadow-black/10">
          <CardHeader>
            <CardTitle>Activity Trends</CardTitle>
            <CardDescription>Commit history and code volume over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-6">
            <div className="h-full w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="dateLabel" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-strong)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                  <Area type="monotone" dataKey="commits" stroke="var(--color-brand)" strokeWidth={2} fillOpacity={1} fill="url(#colorCommits)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-1">
          <StatCard className="h-full productivity-score border-white/5 hover:border-brand/40 transition-colors shadow-sm" title="Productivity Score" value={`${stats.productivityScore}/100`} trend={stats.productivityScore > 0 ? "Based on recent activity" : "Awaiting sync"} icon={<Zap className="w-5 h-5 text-amber-400" />} />
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-1">
          <StatCard className="h-full burnout-risk border-white/5 hover:border-brand/40 transition-colors shadow-sm" title="Burnout Risk" value={stats.burnoutRisk} trend={stats.burnoutRisk === 'High' ? "Elevated weekend & night work" : "Stable pattern detected"} icon={<Flame className={`w-5 h-5 ${stats.burnoutRisk === 'High' ? 'text-rose-400' : 'text-emerald-400'}`} />} />
        </motion.div>

        {/* AI Insight Snippet */}
        <motion.div variants={itemVariants} className="md:col-span-2 md:row-span-2">
        <Card className="h-full relative overflow-hidden ai-insights border-brand/30 bg-brand/5 shadow-lg shadow-brand/5 flex flex-col">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
             <BrainCircuit className="w-32 h-32 text-brand" />
          </div>
          <CardHeader className="relative z-10">
            <div className="flex items-center space-x-2 mb-2">
              <SparklesIcon className="w-5 h-5 text-brand" />
              <CardTitle className="text-brand">AI Mentor Insight</CardTitle>
            </div>
            <CardDescription className="text-white/80">
              Daily behavioral observation based on your repository activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 flex-1 flex flex-col pb-6">
            <div className="space-y-4 flex-1">
              <p className="text-[15px] text-text-primary leading-relaxed max-w-xl">
                {latestInsight ? latestInsight.content : "Connect your GitHub account in your Profile to start generating AI insights on your behavior."}
              </p>
              
              {latestInsight?.recommendation && (
              <div className="insight-item border-l-brand/50 mt-4 bg-brand/10 p-4 rounded-r-xl border border-white/5">
                <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
                <span className="text-sm text-text-secondary leading-normal">
                  <strong className="text-white">Recommendation:</strong> {latestInsight.recommendation}
                </span>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-1">
          <StatCard className="h-full border-white/5 hover:border-brand/40 transition-colors shadow-sm" title="Deep Work Hours" value={`${stats.deepWorkHours}h`} trend="Est. from commit intensity" icon={<BrainCircuit className="w-5 h-5 text-brand" />} />
        </motion.div>
        
        <motion.div variants={itemVariants} className="md:col-span-1">
          <StatCard className="h-full border-white/5 hover:border-brand/40 transition-colors shadow-sm" title="Code Commits" value={`${stats.totalCommits}`} trend={userData?.githubUsername ? "Across active repositories" : "Connect GitHub"} icon={<Terminal className="w-5 h-5 text-slate-400" />} />
        </motion.div>
      </motion.div>

      {/* Recent Action Types */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="mt-10"
      >
        <h3 className="text-xl font-semibold text-white drop-shadow-sm">Recent Focus Areas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5">
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
              <FocusCard icon={<FileCode />} title="Frontend Refactoring" metrics="5 files • 240 lines changed" time="2 hours ago" />
              <FocusCard icon={<Terminal />} title="API Integrations" metrics="2 files • 85 lines changed" time="Yesterday" />
              <FocusCard icon={<Activity />} title="Issue Triage" metrics="Closed 4 tickets" time="2 days ago" />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, trend, icon, className }: { title: string, value: string, trend: string, icon: React.ReactNode, className?: string }) {
  return (
    <Card className={`${className} bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-sm overflow-hidden`}>
      <CardContent className="p-6 flex flex-col justify-between h-full"> 
        <div className="flex items-start justify-between mb-4">
          <CardTitle className="text-sm font-medium text-text-secondary w-2/3 leading-tight mb-0">{title}</CardTitle>
          <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 shadow-inner shadow-white/5 flex items-center justify-center">{icon}</div>
        </div>
        <div className="mt-auto">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
          </div>
          <p className="text-xs text-text-muted mt-2">{trend}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FocusCard({ icon, title, metrics, time }: any) {
  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }}
      className="flex items-center p-4 bg-bg-surface/50 backdrop-blur-md border border-white/5 shadow-md shadow-black/20 rounded-xl hover:bg-bg-elevated hover:border-brand/30 transition-all cursor-pointer group"
    >
      <div className="w-10 h-10 rounded-full bg-bg-dark border border-white/10 flex items-center justify-center text-text-secondary mr-4 group-hover:text-brand transition-colors group-hover:border-brand/30">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate group-hover:text-brand-light transition-colors">{title}</h4>
        <p className="text-xs text-text-muted truncate mt-0.5">{metrics}</p>
      </div>
      <div className="text-xs text-text-muted ml-4 font-mono">{time}</div>
    </motion.div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  );
}

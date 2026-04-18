import React, { useEffect, useState } from 'react';
import {
  Users, Activity, AlertTriangle, ShieldCheck, TrendingUp,
  BarChart2, Zap, Target, Trophy, Brain, FlameKindling
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, subDays } from 'date-fns';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function TeamDashboard() {
  const { user } = useAuth();
  const [teamVelocityData, setTeamVelocityData] = useState<any[]>([]);
  const [teamBurnoutData, setTeamBurnoutData] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [stats, setStats] = useState({ avgProductivity: 0, totalDevs: 0, highRiskCount: 0, teamScore: 0 });
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Fetch display names from users collection
  useEffect(() => {
    if (!user) return;
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      const names: Record<string, string> = {};
      snap.forEach(doc => {
        const d = doc.data();
        names[doc.id] = d.displayName || d.githubUsername || `Dev-${doc.id.slice(0, 6)}`;
      });
      setUserNames(names);
    });
    return () => usersUnsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'dailyActivities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allActivities: any[] = [];
      let uniqueDevs = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        allActivities.push(data);
        if (data.uid) uniqueDevs.add(data.uid);
      });

      const velocityMap: Record<string, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
        velocityMap[d] = 0;
      }

      const devMetrics: Record<string, { commits: number; deepWork: number; lateNight: number; weekend: number; activeDays: number }> = {};
      allActivities.forEach(act => {
        if (velocityMap[act.date] !== undefined) velocityMap[act.date] += (act.commits || 0);
        if (!devMetrics[act.uid]) devMetrics[act.uid] = { commits: 0, deepWork: 0, lateNight: 0, weekend: 0, activeDays: 0 };
        devMetrics[act.uid].commits += (act.commits || 0);
        devMetrics[act.uid].deepWork += (act.deepWorkHours || 0);
        devMetrics[act.uid].lateNight += (act.lateNightCommits || 0);
        devMetrics[act.uid].weekend += (act.weekendCommits || 0);
        if ((act.commits || 0) > 0) devMetrics[act.uid].activeDays += 1;
      });

      setTeamVelocityData(
        Object.entries(velocityMap).map(([date, velocity]) => ({ day: format(parseISO(date), 'MMM dd'), velocity }))
      );

      let totalProductivity = 0, riskCount = 0;
      const burnoutChart: any[] = [];
      const detectedBottlenecks: any[] = [];

      Object.entries(devMetrics).forEach(([uid, metrics]) => {
        const prodScore = metrics.commits > 0 ? Math.min(100, Math.round((metrics.deepWork * 2) + (metrics.commits * 0.5))) : 0;
        totalProductivity += prodScore;

        let riskScore = 20;
        if (metrics.lateNight > 10 || metrics.weekend > 15) riskScore = 85;
        else if (metrics.lateNight > 4 || metrics.weekend > 5) riskScore = 60;
        if (riskScore >= 75) riskCount++;

        // Use real name from userNames state, fallback to short uid
        const devLabel = userNames[uid] || `Dev-${uid.slice(0, 6)}`;
        burnoutChart.push({ name: devLabel, risk: riskScore, score: prodScore, uid });

        // Bottleneck detection
        if (riskScore >= 75) {
          detectedBottlenecks.push({
            dev: devLabel,
            type: 'burnout',
            msg: `High weekend/late-night activity (${metrics.lateNight} late-night commits)`,
            severity: 'high',
          });
        } else if (prodScore < 30 && metrics.commits > 0) {
          detectedBottlenecks.push({
            dev: devLabel,
            type: 'low-output',
            msg: `Low productivity score (${prodScore}/100) — possible blocker or context-switching`,
            severity: 'medium',
          });
        }
      });

      setTeamBurnoutData(burnoutChart);
      setBottlenecks(detectedBottlenecks);

      const avgProd = uniqueDevs.size > 0 ? Math.round(totalProductivity / uniqueDevs.size) : 0;
      const teamScore = Math.max(0, avgProd - (riskCount * 15));

      setStats({
        avgProductivity: avgProd,
        totalDevs: uniqueDevs.size,
        highRiskCount: riskCount,
        teamScore: Math.min(100, teamScore),
      });
    });
    return () => unsubscribe();
  }, [user, userNames]); // re-run when names load so chart labels update

  const isHealthy = stats.highRiskCount === 0;
  const teamScoreColor = stats.teamScore >= 70 ? '#10b981' : stats.teamScore >= 40 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Users className="w-5 h-5 text-brand" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Team Intelligence</h1>
          </div>
          <p className="text-text-secondary text-sm ml-12">
            Aggregated health, velocity, and bottleneck analysis for your engineering squad.
          </p>
        </div>
        <motion.span
          whileHover={{ scale: 1.02 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start md:self-auto"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Anonymized Data
        </motion.span>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          <QuickStat label="Active Developers" value={stats.totalDevs} suffix="" icon={Users} color="#6366f1" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <QuickStat label="Avg Productivity" value={stats.avgProductivity} suffix="/100" icon={Zap} color="#10b981" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <QuickStat label="At-Risk Engineers" value={stats.highRiskCount} suffix="" icon={AlertTriangle} color={stats.highRiskCount > 0 ? '#f43f5e' : '#10b981'} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-border-subtle glass-elevated p-5 hover:border-brand/20 transition-all card-lift">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Team Score</p>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Trophy className="w-4 h-4" style={{ color: teamScoreColor }} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black stat-number" style={{ color: teamScoreColor }}>{stats.teamScore}</span>
              <span className="text-sm text-text-muted font-semibold">/100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/5">
              <motion.div
                className="h-1.5 rounded-full"
                style={{ background: teamScoreColor }}
                initial={{ width: 0 }}
                animate={{ width: `${stats.teamScore}%` }}
                transition={{ delay: 0.4, duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottleneck Detector */}
      {bottlenecks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden border"
          style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(245,158,11,0.04))', borderColor: 'rgba(244,63,94,0.2)' }}
        >
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(244,63,94,0.1)' }}>
            <FlameKindling className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-rose-100">Team Bottleneck Detector</h3>
            <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-300 font-semibold">
              {bottlenecks.length} issue{bottlenecks.length > 1 ? 's' : ''} detected
            </span>
          </div>
          <div className="p-5 space-y-3">
            {bottlenecks.map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${b.severity === 'high' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${b.severity === 'high' ? 'text-rose-400' : 'text-amber-400'}`} />
                <div>
                  <span className="text-xs font-bold text-white">{b.dev}: </span>
                  <span className="text-xs text-text-secondary">{b.msg}</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-text-muted pt-1">
              💡 Consider running a 1:1 with flagged engineers to surface blockers before they cascade.
            </p>
          </div>
        </motion.div>
      )}

      {/* Charts Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {/* Burnout Risk Chart */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <div className="rounded-2xl border border-border-subtle glass-elevated p-5" style={{ minHeight: '340px' }}>
            <h3 className="text-sm font-bold text-white mb-1">Team Burnout Risk Matrix</h3>
            <p className="text-xs text-text-muted mb-5">Burnout risk score per squad member. Red = immediate action needed.</p>
            <div className="h-[240px]">
              {teamBurnoutData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  No team data — sync GitHub activity first.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamBurnoutData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                      contentStyle={{ backgroundColor: '#131626', borderColor: '#2d3055', borderRadius: '12px', padding: '10px 14px' }}
                      formatter={(value: number, name: string) => [
                        `${value}/100`,
                        name === 'risk' ? 'Burnout Risk' : 'Productivity'
                      ]}
                    />
                    <Bar dataKey="risk" radius={[0, 6, 6, 0]} barSize={20}>
                      {teamBurnoutData.map((entry, index) => {
                        let fill = '#10b981';
                        if (entry.risk >= 75) fill = '#f43f5e';
                        else if (entry.risk >= 60) fill = '#f59e0b';
                        return <Cell key={`cell-${index}`} fill={fill} opacity={0.85} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        {/* Manager Insights */}
        <motion.div variants={itemVariants} className="md:col-span-1">
          <div
            className="h-full rounded-2xl p-5 flex flex-col"
            style={{
              background: isHealthy
                ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.05))'
                : 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(245,158,11,0.05))',
              border: `1px solid ${isHealthy ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
              minHeight: '340px',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              {isHealthy ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
              <h3 className="text-sm font-bold text-white">Manager Insights</h3>
            </div>

            <div className="space-y-3 flex-1">
              {/* Team narrative */}
              <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {stats.totalDevs === 0
                    ? 'No team data yet. Sync GitHub activity across the team first.'
                    : isHealthy && stats.avgProductivity >= 50
                    ? `Your ${stats.totalDevs}-dev squad is in optimal state. Average productivity is ${stats.avgProductivity}/100 — steady delivery without burnout signals. Maintain current sprint pace.`
                    : stats.highRiskCount > 0
                    ? `${stats.highRiskCount} of ${stats.totalDevs} engineers show elevated burnout signals. Consider redistributing workload before the next sprint planning session.`
                    : `Team is functional but output is below peak (avg ${stats.avgProductivity}/100). Surface blockers in this week's retrospective.`}
                </p>
              </div>

              {stats.highRiskCount > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <p className="text-xs font-bold text-rose-300 mb-1">⚠ Load Balance Alert</p>
                  <p className="text-xs text-rose-200/80 leading-relaxed">
                    {stats.highRiskCount} engineer(s) show high weekend activity patterns. Consider offloading tasks before the next sprint begins.
                  </p>
                </div>
              )}

              {stats.avgProductivity < 40 && stats.totalDevs > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-xs font-bold text-amber-300 mb-1">↓ Low Team Output</p>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Team productivity is below threshold. Check for environment issues, unclear tickets, or unresolved blockers.
                  </p>
                </div>
              )}

              {isHealthy && stats.totalDevs > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-xs font-bold text-emerald-300 mb-1">✓ Healthy Squad</p>
                  <p className="text-xs text-emerald-200/80 leading-relaxed">
                    No burnout flags across the team. This is a strong foundation — protect it by keeping sprint scope realistic.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Velocity Chart — full width */}
        <motion.div variants={itemVariants} className="md:col-span-3">
          <div className="rounded-2xl border border-border-subtle glass-elevated p-5" style={{ height: '280px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" /> Aggregated Team Velocity
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Combined output across all connected engineers — last 14 days.</p>
              </div>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teamVelocityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(99,102,241,1)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="rgba(99,102,241,1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131626', borderColor: '#2d3055', borderRadius: '12px', padding: '10px 14px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="velocity" stroke="rgba(99,102,241,1)" strokeWidth={2} fillOpacity={1} fill="url(#colorVelocity)"
                    activeDot={{ r: 5, fill: '#131626', stroke: '#6366f1', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function QuickStat({ label, value, suffix, icon: Icon, color }: any) {
  return (
    <div className="rounded-2xl border border-border-subtle glass-elevated p-5 hover:border-brand/20 transition-all card-lift">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</p>
        <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tight stat-number" style={{ color }}>{value}</span>
        {suffix && <span className="text-sm text-text-muted font-semibold">{suffix}</span>}
      </div>
    </div>
  );
}

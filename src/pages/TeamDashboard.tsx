import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, AlertTriangle, ShieldCheck, TrendingUp, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, subDays } from 'date-fns';
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

export default function TeamDashboard() {
  const { user } = useAuth();
  const [teamVelocityData, setTeamVelocityData] = useState<any[]>([]);
  const [teamBurnoutData, setTeamBurnoutData] = useState<any[]>([]);
  const [stats, setStats] = useState({ avgProductivity: 0, totalDevs: 0, highRiskCount: 0 });

  useEffect(() => {
    if (!user) return;
    
    // Fetch all activities 
    const q = query(collection(db, 'dailyActivities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allActivities: any[] = [];
      let uniqueDevs = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        allActivities.push(data);
        if (data.uid) uniqueDevs.add(data.uid);
      });

      // Aggregate Velocity by Day
      const velocityMap: Record<string, number> = {};
      
      for (let i = 0; i < 14; i++) {
          const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
          velocityMap[d] = 0;
      }

      const devMetrics: Record<string, { commits: number, deepWork: number, lateNight: number, weekend: number }> = {};

      allActivities.forEach(act => {
        if (velocityMap[act.date] !== undefined) {
          velocityMap[act.date] += (act.commits || 0);
        } else {
            // Include dates beyond 14 days if needed, but let's stick to 14
        }

        if (!devMetrics[act.uid]) {
            devMetrics[act.uid] = { commits: 0, deepWork: 0, lateNight: 0, weekend: 0 };
        }
        devMetrics[act.uid].commits += (act.commits || 0);
        devMetrics[act.uid].deepWork += (act.deepWorkHours || 0);
        devMetrics[act.uid].lateNight += (act.lateNightCommits || 0);
        devMetrics[act.uid].weekend += (act.weekendCommits || 0);
      });

      const formattedVelocity = Object.entries(velocityMap).map(([date, velocity]) => ({
          day: format(parseISO(date), 'MMM dd'),
          velocity
      }));
      setTeamVelocityData(formattedVelocity);

      let totalProductivity = 0;
      let riskCount = 0;
      const burnoutChart: any[] = [];

      let i = 1;
      Object.entries(devMetrics).forEach(([uid, metrics]) => {
          const prodScore = metrics.commits > 0 ? Math.min(100, Math.round((metrics.deepWork * 2) + (metrics.commits * 0.5))) : 0;
          totalProductivity += prodScore;

          let riskScore = 20; // baseline
          if (metrics.lateNight > 10 || metrics.weekend > 15) riskScore = 85;
          else if (metrics.lateNight > 4 || metrics.weekend > 5) riskScore = 60;
          
          if (riskScore >= 75) riskCount++;

          burnoutChart.push({
              name: `Dev ${i++}`,
              risk: riskScore
          });
      });

      setTeamBurnoutData(burnoutChart);
      setStats({
          avgProductivity: uniqueDevs.size > 0 ? Math.round(totalProductivity / uniqueDevs.size) : 0,
          totalDevs: uniqueDevs.size,
          highRiskCount: riskCount
      });

    });

    return () => unsubscribe();
  }, [user]);
  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"
      >
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Team Benchmarks</h2>
          <p className="text-text-secondary mt-1">Aggregated insights on your engineering squad's health and velocity.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="default" className="px-3 py-1 bg-white/10 text-white hover:bg-white/20 border-0 backdrop-blur-md">
             <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
             Data is Anonymized
          </Badge>
        </div>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-4 auto-rows-min mt-4"
      >
        {/* Team Burnout Chart */}
        <motion.div variants={itemVariants} className="md:col-span-2 min-h-[300px]">
        <Card className="h-full border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md shadow-md">
          <CardHeader>
            <CardTitle>Team Burnout Risk Matrix</CardTitle>
            <CardDescription>Average burnout risk score per squad indicating where to balance workloads.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="h-[250px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamBurnoutData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
                    <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--color-bg-elevated)', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-strong)', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value}/100`, "Risk Score"]}
                    />
                    <Bar dataKey="risk" radius={[0, 4, 4, 0]} barSize={24}>
                      {teamBurnoutData.map((entry, index) => {
                        let fillUrl = 'var(--color-accent-green)';
                        if (entry.risk >= 75) fillUrl = '#f43f5e'; // rose-500
                        else if (entry.risk >= 60) fillUrl = 'var(--color-accent-orange)';
                        return <Cell key={`cell-${index}`} fill={fillUrl} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Aggregated Quick Stats */}
        <div className="md:col-span-1 flex flex-col gap-4">
            <motion.div variants={itemVariants} className="h-1/2">
            <Card className="h-full flex flex-col justify-center border-white/5 hover:border-brand/30 transition-all bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                        <CardTitle>Team Productivity</CardTitle>
                        <BarChart2 className="w-5 h-5 text-accent-blue" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-white">{stats.avgProductivity}<span className="text-xl text-text-muted">/100</span></div>
                    <p className="text-xs text-text-secondary mt-1">Average across {stats.totalDevs} developer(s)</p>
                </CardContent>
            </Card>
            </motion.div>
            <motion.div variants={itemVariants} className="h-1/2">
            <Card className={`h-full flex flex-col justify-center border-l-4 ${stats.highRiskCount > 0 ? 'border-l-rose-500 bg-rose-500/5' : 'border-l-emerald-500 bg-emerald-500/5'} border-white/5 backdrop-blur-sm`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                        <CardTitle className={stats.highRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>{stats.highRiskCount > 0 ? 'Attention Needed' : 'Healthy Team'}</CardTitle>
                        {stats.highRiskCount > 0 ? <AlertTriangle className="w-5 h-5 text-rose-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-text-primary leading-tight">
                        {stats.highRiskCount > 0 
                          ? <strong>{stats.highRiskCount} developer(s)</strong>
                          : "No developers"} show elevated burnout risk patterns based on weekend and late-night commits.
                    </div>
                </CardContent>
            </Card>
            </motion.div>
        </div>

        <motion.div variants={itemVariants} className="md:col-span-2 min-h-[250px]">
        <Card className="h-full border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-sm shadow-md">
          <CardHeader>
            <CardTitle>Aggregated Weekly Velocity</CardTitle>
            <CardDescription>Code output & PR merges across the entire engineering org.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teamVelocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-strong)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                  <Area type="step" dataKey="velocity" stroke="var(--color-brand)" strokeWidth={2} fillOpacity={1} fill="url(#colorVelocity)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Manager Actions / Tools */}
        <motion.div variants={itemVariants} className="md:col-span-1">
        <Card className="h-full flex flex-col justify-between border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Manager Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.highRiskCount > 0 && (
                <div className="insight-item mt-3 border-l-rose-500 bg-bg-elevated">
                    <p><b>Load Balance:</b> {stats.highRiskCount} engineer(s) carrying high weekend loads. Consider offloading tasks.</p>
                </div>
              )}
              {stats.avgProductivity < 50 && (
                <div className="insight-item mt-3 border-l-amber-500 bg-bg-elevated">
                    <p><b>Low Output:</b> Team productivity is dipping. Check for blockers or environment issues.</p>
                </div>
              )}
              {stats.avgProductivity >= 50 && stats.highRiskCount === 0 && (
                <div className="insight-item mt-3 border-l-emerald-500 bg-black/20 p-4 rounded-r-xl border border-white/5">
                    <p className="text-sm"><b className="text-emerald-400 font-medium">Optimal State:</b> Team is delivering steadily without raising burnout alarms. Maintain current sprint pace.</p>
                </div>
              )}
            </CardContent>
        </Card>
        </motion.div>
      </motion.div>

    </div>
  );
}

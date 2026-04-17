import React, { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Clock, Zap, Target, BookOpen, AlertCircle, HeartPulse, Coffee, ShieldAlert, Activity, Eye, ArrowRight, Moon, Sun, Sparkles, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

export default function InsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ burnoutRisk: false });
  const [rawActivities, setRawActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const insightsQuery = query(collection(db, 'insights'), where('uid', '==', user.uid));
    const unsubscribeInsights = onSnapshot(insightsQuery, (insightsSnapshot) => {
      let fetchedInsights: any[] = [];
      insightsSnapshot.forEach(doc => fetchedInsights.push(doc.data()));
      fetchedInsights.sort((a, b) => {
        if (a.createdAt && b.createdAt) return b.createdAt.toMillis() - a.createdAt.toMillis();
        return 0;
      });
      setInsights(fetchedInsights);
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });

    const activitiesQuery = query(collection(db, 'dailyActivities'), where('uid', '==', user.uid));
    const unsubscribeActivities = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
      let lateNight = 0, weekend = 0;
      let fetchedActivities: any[] = [];
      activitiesSnapshot.forEach(doc => {
        const data = doc.data();
        fetchedActivities.push(data);
        lateNight += data.lateNightCommits || 0;
        weekend += data.weekendCommits || 0;
      });
      setRawActivities(fetchedActivities);
      setStats({ burnoutRisk: lateNight > 4 || weekend > 5 });
    });

    return () => { unsubscribeInsights(); unsubscribeActivities(); };
  }, [user]);

  const { dynamicHourlyData, archetype, archetypeDesc, ArchetypeIcon } = useMemo(() => {
    let hourCounts = Array(24).fill(0);
    rawActivities.forEach(act => {
      if (act.commitsByHour) {
        Object.entries(act.commitsByHour).forEach(([hourStr, count]) => {
          hourCounts[parseInt(hourStr)] += (count as number);
        });
      }
    });

    const processed = [
      { hour: '6am', intensity: hourCounts[6] + hourCounts[7] },
      { hour: '8am', intensity: hourCounts[8] + hourCounts[9] },
      { hour: '10am', intensity: hourCounts[10] + hourCounts[11] },
      { hour: '12pm', intensity: hourCounts[12] + hourCounts[13] },
      { hour: '2pm', intensity: hourCounts[14] + hourCounts[15] },
      { hour: '4pm', intensity: hourCounts[16] + hourCounts[17] },
      { hour: '6pm', intensity: hourCounts[18] + hourCounts[19] },
      { hour: '8pm', intensity: hourCounts[20] + hourCounts[21] },
      { hour: '10pm', intensity: hourCounts[22] + hourCounts[23] },
      { hour: '12am', intensity: hourCounts[0] + hourCounts[1] + hourCounts[2] + hourCounts[3] + hourCounts[4] + hourCounts[5] },
    ];

    const totalCommits = hourCounts.reduce((a, b) => a + b, 0);
    let arch = 'The Sprinter', desc = 'You work in intense bursts followed by rest. This is highly effective if you protect your breaks.', Icon = Zap;

    if (totalCommits === 0) {
      arch = 'Observing Mode';
      desc = 'We are gathering data to determine your core development archetype.';
      Icon = Eye;
    } else {
      const nightSum = hourCounts[22] + hourCounts[23] + hourCounts[0] + hourCounts[1] + hourCounts[2] + hourCounts[3];
      const morningSum = hourCounts[5] + hourCounts[6] + hourCounts[7] + hourCounts[8];
      if (nightSum / totalCommits > 0.4) { arch = 'Night Owl'; desc = 'You find your deepest focus well after dark. Ensure you maintain a consistent rest schedule.'; Icon = Moon; }
      else if (morningSum / totalCommits > 0.4) { arch = 'Early Bird'; desc = 'You tackle complex problems early in the day. Guard your mornings against unnecessary meetings.'; Icon = Sun; }
      else if (Math.max(...hourCounts) < totalCommits * 0.15 && totalCommits > 10) { arch = 'The Marathoner'; desc = 'You work steadily throughout the day. Excellent for long-term consistency and team reliability.'; Icon = Activity; }
    }

    return { dynamicHourlyData: processed, archetype: arch, archetypeDesc: desc, ArchetypeIcon: Icon };
  }, [rawActivities]);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Brain className="w-5 h-5 text-brand" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Behavioral Insights</h1>
        </div>
        <p className="text-text-secondary text-sm ml-12 max-w-xl">
          Deep analysis of your working patterns. Let AI help you optimize your focus and prevent burnout.
        </p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Burnout Alert Banner */}
        <AnimatePresence>
          {stats.burnoutRisk && (
            <motion.div
              variants={itemVariants}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(244,63,94,0.05))', border: '1px solid rgba(244,63,94,0.2)' }}
            >
              <div className="px-6 py-4 flex items-center gap-3 border-b border-rose-500/10">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <h3 className="font-bold text-rose-100">⚠ Elevated Burnout Risk Detected</h3>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-300 font-semibold">Action Needed</span>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[15px] text-rose-200/80 leading-relaxed mb-5">
                    We've detected high levels of late-night and weekend commits — patterns that historically lead to diminished code quality and burnout.
                  </p>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-rose-400/80 mb-3">Observed Triggers</h4>
                  <ul className="space-y-2">
                    {['Multiple commits past 11:00 PM detected', 'Active consecutive weekends without rest gaps'].map((t, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-rose-200/80">
                        <Target className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(244,63,94,0.15)' }}>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-2">
                    <HeartPulse className="w-4 h-4" /> Recovery Protocol
                  </h4>
                  <div className="space-y-4">
                    {[
                      { icon: Coffee, title: 'Disconnect', desc: 'Take a full 48-hour break this weekend. Zero code commits.' },
                      { icon: Clock, title: 'Hard Stop', desc: 'Set IDE & notification silence after 7:00 PM daily.' },
                    ].map(({ icon: Icon, title, desc }, i) => (
                      <div key={i} className="flex gap-3">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-white">{title}</p>
                          <p className="text-xs text-rose-200/60 mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AI Mentorship Feed */}
          <div className="lg:col-span-5">
            <motion.div variants={itemVariants} className="h-full">
              <div className="h-full rounded-2xl overflow-hidden border border-border-subtle glass-elevated flex flex-col" style={{ minHeight: '500px' }}>
                {/* Header */}
                <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4.5 h-4.5 text-brand" />
                      <h3 className="text-sm font-bold text-white">AI Mentorship Feed</h3>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">Behavioral analysis & recommendations</p>
                </div>

                {/* Feed */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                        <Brain className="w-8 h-8 text-brand" />
                      </motion.div>
                      <p className="text-sm text-text-muted mt-4">Synthesizing behavioral data…</p>
                    </div>
                  ) : insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <Target className="w-7 h-7 text-brand" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-2">No Insights Yet</h4>
                      <p className="text-sm text-text-muted max-w-[220px] mb-5 leading-relaxed">Connect your GitHub to start generating AI-powered insights.</p>
                      <Link to="/app/profile">
                        <Button size="sm" className="bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/25">
                          Go to Profile <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    insights.map((insight, idx) => (
                      <FeedCard key={idx} type={insight.type} title={insight.title} content={insight.content} index={idx} />
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Archetype + Strategic Actions */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Archetype */}
              <div className="relative rounded-2xl p-5 overflow-hidden border border-border-subtle glass-elevated">
                <div className="absolute top-4 right-4 opacity-10">
                  <ArchetypeIcon className="w-20 h-20 text-brand" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-3">Your Archetype</p>
                <h3 className="text-2xl font-black text-white tracking-tight mb-3 gradient-text">{archetype}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{archetypeDesc}</p>
                <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-2">
                  <ArchetypeIcon className="w-4 h-4 text-brand" />
                  <span className="text-xs text-brand font-semibold">{archetype}</span>
                </div>
              </div>

              {/* Strategic Actions */}
              <div className="rounded-2xl p-5 border border-border-subtle glass-elevated flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-white">Strategic Actions</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {insights.filter(i => i.recommendation).length === 0 ? (
                    <p className="text-sm text-text-muted">No recommendations yet — generate insights first.</p>
                  ) : (
                    <ul className="space-y-3">
                      {insights.filter(i => i.recommendation).slice(0, 3).map((insight, idx) => (
                        <li key={idx} className="flex gap-3 text-sm group">
                          <div className="w-5 h-5 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-brand">{idx + 1}</span>
                          </div>
                          <span className="text-text-secondary leading-snug group-hover:text-white transition-colors">{insight.recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Work Intensity Chart */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-border-subtle glass-elevated p-5 flex flex-col" style={{ height: '340px' }}>
              <div className="flex items-start justify-between mb-5 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand" /> Work Intensity Map
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">24-hour commit distribution (14-day avg)</p>
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dynamicHourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(99,102,241,1)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="rgba(99,102,241,1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="hour" stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis stroke="#4b5568" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v === 0 ? '' : String(v)} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }}
                      contentStyle={{ backgroundColor: '#131626', borderColor: '#2d3055', borderRadius: '12px', padding: '10px 14px' }}
                      itemStyle={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="intensity"
                      stroke="rgba(99,102,241,1)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#chartGradient)"
                      activeDot={{ r: 5, fill: '#131626', stroke: '#6366f1', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FeedCard({ type, title, content, index }: { type: string; title: string; content: string; index: number }) {
  const isPositive = type === 'positive';
  const isWarning = type === 'warning';

  const config = isPositive
    ? { accent: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />, bar: '#10b981' }
    : isWarning
    ? { accent: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />, bar: '#f59e0b' }
    : { accent: '#6366f1', bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.15)', icon: <BookOpen className="w-3.5 h-3.5 text-brand" />, bar: '#6366f1' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ x: 2 }}
      className="relative rounded-xl overflow-hidden"
      style={{ background: config.bg, border: `1px solid ${config.border}` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l" style={{ background: config.bar }} />
      <div className="pl-4 pr-4 py-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg shrink-0 mt-0.5" style={{ background: `${config.border}` }}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white tracking-tight mb-1 truncate">{title}</h4>
            <p className="text-[13px] text-text-secondary leading-relaxed">{content}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

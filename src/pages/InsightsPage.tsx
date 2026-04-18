import React, { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain, Clock, Zap, Target, BookOpen, AlertCircle, HeartPulse, Coffee,
  ShieldAlert, Activity, Eye, ArrowRight, Moon, Sun, Sparkles, TrendingUp,
  TrendingDown, Dna, Flame, CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

// ── Heatmap helpers ───────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function FocusHeatmap({ rawActivities }: { rawActivities: any[] }) {
  // Build day×hour matrix — handles both "h14" (new) and "14" (legacy) keys
  const matrix = useMemo(() => {
    const mat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    rawActivities.forEach(act => {
      if (!act.date) return;
      try {
        const dow = new Date(act.date + 'T12:00:00').getDay(); // avoid UTC shift
        if (act.commitsByHour) {
          Object.entries(act.commitsByHour).forEach(([key, cnt]) => {
            // Support "h14" (new string key) and "14" (legacy numeric key)
            const h = parseInt(typeof key === 'string' ? key.replace('h', '') : String(key));
            if (!isNaN(h) && h >= 0 && h < 24) {
              mat[dow][h] += (cnt as number);
            }
          });
        }
      } catch {}
    });
    return mat;
  }, [rawActivities]);

  const maxVal = Math.max(...matrix.flat(), 1);

  const getColor = (val: number) => {
    if (val === 0) return 'rgba(255,255,255,0.04)';
    const intensity = val / maxVal;
    if (intensity > 0.75) return 'rgba(99,102,241,0.9)';
    if (intensity > 0.5) return 'rgba(99,102,241,0.6)';
    if (intensity > 0.25) return 'rgba(99,102,241,0.35)';
    return 'rgba(99,102,241,0.15)';
  };

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div style={{ minWidth: '480px' }}>
        {/* Hour labels */}
        <div className="flex mb-1" style={{ paddingLeft: '36px' }}>
          {HOURS.map(h => (
            <div
              key={h}
              className="text-center flex-1"
              style={{ fontSize: '9px', color: hourLabels.includes(h) ? '#64748b' : 'transparent' }}
            >
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-0.5 mb-0.5">
            <span className="text-[9px] text-text-muted w-8 shrink-0 text-right pr-1">{day}</span>
            {HOURS.map(h => (
              <motion.div
                key={h}
                whileHover={{ scale: 1.4, zIndex: 10 }}
                title={`${day} ${h}:00 — ${matrix[dayIdx][h]} commits`}
                className="flex-1 rounded-sm cursor-default"
                style={{
                  height: '14px',
                  background: getColor(matrix[dayIdx][h]),
                  border: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[9px] text-text-muted">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ background: getColor(v * maxVal) }} />
          ))}
          <span className="text-[9px] text-text-muted">More</span>
        </div>
      </div>
    </div>
  );
}

// ── Behavior Change helpers ───────────────────────────────────────────────────
function computeBehaviorChange(rawActivities: any[]) {
  const today = new Date();
  const sevenAgo = format(subDays(today, 7), 'yyyy-MM-dd');
  const fourteenAgo = format(subDays(today, 14), 'yyyy-MM-dd');

  const recent = rawActivities.filter(a => a.date >= sevenAgo);
  const prior = rawActivities.filter(a => a.date >= fourteenAgo && a.date < sevenAgo);

  if (recent.length === 0 || prior.length === 0) return null;

  const recentCommits = recent.reduce((s, a) => s + (a.commits || 0), 0);
  const priorCommits = prior.reduce((s, a) => s + (a.commits || 0), 0);

  if (priorCommits === 0) return null;

  const pctChange = Math.round(((recentCommits - priorCommits) / priorCommits) * 100);

  // Find the day with biggest drop
  const recentDates = recent.map(a => a.date).sort();
  const activeDays = recent.filter(a => (a.commits || 0) > 0).length;
  const inactiveDays = 7 - activeDays;

  return {
    pctChange,
    recentCommits,
    priorCommits,
    inactiveDays,
    isSignificant: Math.abs(pctChange) >= 20,
    isDrop: pctChange < -20,
    isGain: pctChange > 20,
  };
}

// ── DNA Profile helpers ───────────────────────────────────────────────────────
const DNA_PROFILES = {
  'Night Owl': {
    emoji: '🌙',
    color: '#8b5cf6',
    colorBg: 'rgba(139,92,246,0.12)',
    colorBorder: 'rgba(139,92,246,0.25)',
    strengths: ['Creative problem-solving late-night', 'Fewer interruptions = deeper focus', 'High commit quality in quiet hours'],
    weaknesses: ['Sleep cycle disruption over time', 'Misaligned with team standup hours', 'Risk of late-night cognitive errors'],
    style: 'You find your deepest focus well after dark. Your best work tends to emerge after 9 PM when the world quiets down.',
    tip: 'Guard your nights but protect your sleep — shift your hard-stop to 11 PM and sleep by midnight.',
  },
  'Early Bird': {
    emoji: '☀️',
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.12)',
    colorBorder: 'rgba(245,158,11,0.25)',
    strengths: ['Energized morning problem-solving', 'Team synergy during core hours', 'Consistent daily start ritual'],
    weaknesses: ['Energy crashes after 2 PM', 'Risk of saying yes to too many morning meetings', 'Late-day code reviews lower quality'],
    style: 'You tackle complex problems early in the day when your mind is sharpest. Mornings are your superpower.',
    tip: 'Block 8–10 AM as a no-meeting zone. Schedule all deep work there first.',
  },
  'Sprint Worker': {
    emoji: '⚡',
    color: '#10b981',
    colorBg: 'rgba(16,185,129,0.12)',
    colorBorder: 'rgba(16,185,129,0.25)',
    strengths: ['Extreme output in short bursts', 'High feature velocity', 'Very focused when "in the zone"'],
    weaknesses: ['Long recovery gaps after sprints', 'Inconsistency can confuse team', 'Risk of burnout after intense runs'],
    style: 'You work in intense bursts followed by recovery. This is highly effective if you protect your breaks.',
    tip: 'Schedule 2–3 day "sprint windows" and communicate your rhythm to your team.',
  },
  'Deep Focus Coder': {
    emoji: '🎯',
    color: '#06b6d4',
    colorBg: 'rgba(6,182,212,0.12)',
    colorBorder: 'rgba(6,182,212,0.25)',
    strengths: ['High code quality and depth', 'Excellent at complex systems', 'Low bug rate in output'],
    weaknesses: ['Lower commit frequency can look slow', 'Context-switching is costly', 'May miss faster iteration opportunities'],
    style: 'You invest long focused sessions into complex work. Your output is high-quality and deliberate.',
    tip: 'Use timeboxed Pomodoro blocks and make commits more granular to show daily progress.',
  },
  'The Marathoner': {
    emoji: '🏃',
    color: '#6366f1',
    colorBg: 'rgba(99,102,241,0.12)',
    colorBorder: 'rgba(99,102,241,0.25)',
    strengths: ['Exceptional long-term consistency', 'Team reliability and trust', 'Sustainable output over months'],
    weaknesses: ['May plateau without challenge spikes', 'Rarely pushes into peak-output territory', 'Can undervalue rest'],
    style: 'You work steadily throughout the day and across the week. Excellent for long-term consistency and team reliability.',
    tip: 'Introduce one "challenge sprint" per month to push beyond your comfort zone.',
  },
  'Inconsistent Explorer': {
    emoji: '🔄',
    color: '#f43f5e',
    colorBg: 'rgba(244,63,94,0.12)',
    colorBorder: 'rgba(244,63,94,0.25)',
    strengths: ['Highly creative and lateral thinking', 'Often discovers novel solutions', 'Wide knowledge breadth'],
    weaknesses: ['Hard to predict output week-to-week', 'Risk of stalled projects', 'Needs external structure to ship'],
    style: 'Your commit pattern is varied and exploratory. You tend to code in creative surges rather than routines.',
    tip: 'Set a "ship one thing per week" commitment. Consistency compounds over time.',
  },
  'Observing Mode': {
    emoji: '👁️',
    color: '#64748b',
    colorBg: 'rgba(100,116,139,0.1)',
    colorBorder: 'rgba(100,116,139,0.2)',
    strengths: ['—', '—', '—'],
    weaknesses: ['—', '—', '—'],
    style: 'We are gathering data to determine your core development archetype.',
    tip: 'Connect GitHub and sync to unlock your Developer DNA profile.',
  },
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

  const { dynamicHourlyData, archetype, dnaProfile } = useMemo(() => {
    // Build hourCounts — handles both "h14" (new) and "14" (legacy) keys
    let hourCounts = Array(24).fill(0);
    rawActivities.forEach(act => {
      if (act.commitsByHour) {
        Object.entries(act.commitsByHour).forEach(([key, count]) => {
          const h = parseInt(typeof key === 'string' ? key.replace('h', '') : String(key));
          if (!isNaN(h) && h >= 0 && h < 24) {
            hourCounts[h] += (count as number);
          }
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
    let arch = 'The Marathoner';

    if (totalCommits === 0) {
      arch = 'Observing Mode';
    } else {
      const nightSum = hourCounts[22] + hourCounts[23] + hourCounts[0] + hourCounts[1] + hourCounts[2] + hourCounts[3];
      const morningSum = hourCounts[5] + hourCounts[6] + hourCounts[7] + hourCounts[8];
      const afternoonSum = hourCounts[13] + hourCounts[14] + hourCounts[15] + hourCounts[16];
      const maxHour = hourCounts.reduce((a, b) => Math.max(a, b), 0);
      const spread = hourCounts.filter(c => c > maxHour * 0.3).length;

      if (nightSum / totalCommits > 0.4) arch = 'Night Owl';
      else if (morningSum / totalCommits > 0.4) arch = 'Early Bird';
      else if (spread < 4 && totalCommits > 10) arch = 'Sprint Worker';
      else if (afternoonSum / totalCommits > 0.5) arch = 'Deep Focus Coder';
      else if (rawActivities.length > 0) {
        // Check for inconsistency
        const activeDays = rawActivities.filter(a => (a.commits || 0) > 0).length;
        const inconsistencyRatio = activeDays / Math.max(rawActivities.length, 1);
        if (inconsistencyRatio < 0.4) arch = 'Inconsistent Explorer';
        else arch = 'The Marathoner';
      }
    }

    return {
      dynamicHourlyData: processed,
      archetype: arch,
      dnaProfile: DNA_PROFILES[arch as keyof typeof DNA_PROFILES] || DNA_PROFILES['Observing Mode'],
    };
  }, [rawActivities]);

  const behaviorChange = useMemo(() => computeBehaviorChange(rawActivities), [rawActivities]);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Brain className="w-5 h-5 text-brand" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Behavioral Intelligence</h1>
        </div>
        <p className="text-text-secondary text-sm ml-12 max-w-xl">
          Deep AI analysis of your working patterns — your DNA, behavior changes, focus heatmap, and actionable storytelling insights.
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

        {/* Behavior Change Detector */}
        {behaviorChange && behaviorChange.isSignificant && (
          <motion.div variants={itemVariants}>
            <div
              className="rounded-2xl p-5 border flex items-start gap-4"
              style={{
                background: behaviorChange.isDrop
                  ? 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(245,158,11,0.04))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.04))',
                borderColor: behaviorChange.isDrop ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)',
              }}
            >
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: behaviorChange.isDrop ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${behaviorChange.isDrop ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                {behaviorChange.isDrop ? (
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">⚡ Behavior Change Detected</h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: behaviorChange.isDrop ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)',
                      color: behaviorChange.isDrop ? '#fda4af' : '#6ee7b7',
                      border: `1px solid ${behaviorChange.isDrop ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    }}
                  >
                    {behaviorChange.isDrop ? 'Drop' : 'Spike'}
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {behaviorChange.isDrop
                    ? `Your activity dropped ${Math.abs(behaviorChange.pctChange)}% this week vs last week (${behaviorChange.recentCommits} vs ${behaviorChange.priorCommits} commits). ${behaviorChange.inactiveDays > 3 ? `You had ${behaviorChange.inactiveDays} inactive days — possible early burnout onset or external blocker.` : 'Consider a brief catch-up sprint to close the gap.'}`
                    : `Great momentum! Your commits surged ${behaviorChange.pctChange}% this week (${behaviorChange.recentCommits} vs ${behaviorChange.priorCommits} last week). Harness this energy while protecting your sustainable pace.`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── DEVELOPER DNA PROFILE (Signature Feature) ── */}
        <motion.div variants={itemVariants}>
          <div
            className="rounded-2xl overflow-hidden border relative"
            style={{ background: dnaProfile.colorBg, borderColor: dnaProfile.colorBorder }}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${dnaProfile.colorBg}`, border: `1px solid ${dnaProfile.colorBorder}` }}>
                  <Dna className="w-5 h-5" style={{ color: dnaProfile.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Developer DNA Profile</h2>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${dnaProfile.color}20`, border: `1px solid ${dnaProfile.color}40`, color: dnaProfile.color }}>
                      SIGNATURE FEATURE
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Your unique coding personality, strengths, and work style.</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Archetype Card */}
              <div className="md:col-span-1">
                <div className="text-center mb-4">
                  <div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-2xl text-4xl mb-3 shadow-xl"
                    style={{ background: dnaProfile.colorBg, border: `2px solid ${dnaProfile.colorBorder}`, boxShadow: `0 0 30px ${dnaProfile.color}30` }}
                  >
                    {dnaProfile.emoji}
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">{archetype}</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{dnaProfile.style}</p>
                </div>
                <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: `${dnaProfile.color}15`, border: `1px solid ${dnaProfile.color}25`, color: dnaProfile.color }}>
                  💡 <strong>Tip:</strong> {dnaProfile.tip}
                </div>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Strengths
                </h4>
                <ul className="space-y-2.5">
                  {dnaProfile.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Watch Out For
                </h4>
                <ul className="space-y-2.5">
                  {dnaProfile.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Focus Heatmap + AI Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AI Mentorship Feed */}
          <div className="lg:col-span-5">
            <motion.div variants={itemVariants} className="h-full">
              <div className="h-full rounded-2xl overflow-hidden border border-border-subtle glass-elevated flex flex-col" style={{ minHeight: '500px' }}>
                <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-brand" />
                      <h3 className="text-sm font-bold text-white">AI Storytelling Insights</h3>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">Behavioral analysis & actionable recommendations</p>
                </div>

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
                      <React.Fragment key={idx}>
                        <FeedCard type={insight.type} title={insight.title} content={insight.content} recommendation={insight.recommendation} index={idx} />
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Strategic Actions */}
            <motion.div variants={itemVariants}>
              <div className="rounded-2xl p-5 border border-border-subtle glass-elevated">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-white">Actionable Step Plan</h3>
                </div>
                {insights.filter(i => i.recommendation).length === 0 ? (
                  <p className="text-sm text-text-muted">No recommendations yet — generate insights first.</p>
                ) : (
                  <ul className="space-y-3">
                    {insights.filter(i => i.recommendation).slice(0, 4).map((insight, idx) => (
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
            </motion.div>

            {/* Focus Heatmap */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-border-subtle glass-elevated p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Flame className="w-4 h-4 text-brand" /> Focus Heatmap
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Commit intensity by day & hour — darker = more focused</p>
                </div>
              </div>
              <FocusHeatmap rawActivities={rawActivities} />
            </motion.div>

            {/* Work Intensity Chart */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-border-subtle glass-elevated p-5 flex flex-col" style={{ height: '280px' }}>
              <div className="flex items-start justify-between mb-4 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand" /> Work Intensity Map
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">24-hour commit distribution (all-time avg)</p>
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

function FeedCard({ type, title, content, recommendation, index }: { type: string; title: string; content: string; recommendation?: string; index: number }) {
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
            {recommendation && (
              <div className="mt-2 flex items-start gap-2">
                <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: config.accent }} />
                <p className="text-[12px] leading-relaxed font-medium" style={{ color: config.accent }}>{recommendation}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

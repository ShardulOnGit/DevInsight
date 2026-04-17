import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Clock, Zap, Target, BookOpen, AlertCircle, HeartPulse, Coffee, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
      setInsights(fetchedInsights);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching insights", error);
        setLoading(false);
    });

    const activitiesQuery = query(collection(db, 'dailyActivities'), where('uid', '==', user.uid));
    const unsubscribeActivities = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
      let lateNight = 0;
      let weekend = 0;
      let fetchedActivities: any[] = [];
      
      activitiesSnapshot.forEach(doc => {
        const data = doc.data();
        fetchedActivities.push(data);
        lateNight += data.lateNightCommits || 0;
        weekend += data.weekendCommits || 0;
      });

      setRawActivities(fetchedActivities);

      // Simple heuristic for demo burnout alert
      if (lateNight > 4 || weekend > 5) {
          setStats({ burnoutRisk: true });
      } else {
          setStats({ burnoutRisk: false });
      }
    }, (error) => {
        console.error("Error fetching activities", error);
    });

    return () => {
        unsubscribeInsights();
        unsubscribeActivities();
    };

  }, [user]);

  const { dynamicHourlyData, archetype, archetypeDesc } = useMemo(() => {
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

     // Determine archetype
     let arch = 'The Sprinter';
     let desc = 'You tend to work in intense bursts followed by longer breaks. This is effective, provided you honor the break periods.';
     
     if (totalCommits === 0) {
         arch = 'Observing Mode';
         desc = 'Not enough data to determine a pattern yet.';
     } else {
         const nightSum = hourCounts[22] + hourCounts[23] + hourCounts[0] + hourCounts[1] + hourCounts[2] + hourCounts[3];
         const morningSum = hourCounts[5] + hourCounts[6] + hourCounts[7] + hourCounts[8];
         
         if (nightSum / totalCommits > 0.4) {
             arch = 'Night Owl';
             desc = 'You find your deepest focus well after dark. Ensure you maintain a consistent physical rest schedule.';
         } else if (morningSum / totalCommits > 0.4) {
             arch = 'Early Bird';
             desc = 'You tackle complex problems early in the day. Guard your mornings against unnecessary meetings.';
         } else if (Math.max(...hourCounts) < totalCommits * 0.15 && totalCommits > 10) {
             arch = 'The Marathoner';
             desc = 'You work steadily throughout the day rather than in distinct spikes. Good for long-term consistency.';
         }
     }

     return { dynamicHourlyData: processed, archetype: arch, archetypeDesc: desc };
  }, [rawActivities]);

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-white tracking-tight">Behavioral Insights</h2>
        <p className="text-text-secondary mt-1">Deep analysis of your working patterns and AI recommendations.</p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mt-8"
      >
        {/* Top Burnout Alert Banner */}
        {stats.burnoutRisk && (
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardHeader className="pb-3 border-b border-border-subtle bg-bg-surface/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-rose-400">Burnout Risk Alert</CardTitle>
                  <CardDescription className="text-rose-400/80">
                    Your recent activity suggests an elevated risk. We've detected overworking patterns.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Why was this flagged?</h4>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li className="flex items-center"><Target className="w-4 h-4 mr-2 text-rose-400/70" /> Spikes in late-night or weekend code pushes</li>
                    <li className="flex items-center"><Target className="w-4 h-4 mr-2 text-rose-400/70" /> High deep work hours without adequate breaks</li>
                  </ul>
                </div>
                <div className="bg-bg-dark/50 border border-border-subtle p-4 rounded-xl">
                  <h4 className="flex items-center text-sm font-semibold text-white mb-2">
                    <HeartPulse className="w-4 h-4 mr-2 text-emerald-400" /> 
                    Recovery Protocol
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <Coffee className="w-4 h-4 mr-2 mt-0.5 text-text-secondary shrink-0" />
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <strong className="text-white">Mandatory Disconnect:</strong> Schedule a completely code-free weekend.
                      </p>
                    </div>
                    <div className="flex items-start">
                      <Clock className="w-4 h-4 mr-2 mt-0.5 text-text-secondary shrink-0" />
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <strong className="text-white">Hard Stop Rule:</strong> Commit to closing your IDE by 7:00 PM for the next 5 days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Left Column: AI Mentorship Stream */}
        <div className="lg:col-span-1 space-y-6 lg:space-y-8">
          <motion.div variants={itemVariants}>
          <Card className="border-brand/20 bg-brand/5 shadow-lg shadow-brand/5 flex flex-col h-full min-h-[350px]">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-brand" />
                <CardTitle className="text-xl">AI Observations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 flex-1">
              {loading ? (
                <p className="text-sm text-text-muted">Analyzing patterns...</p>
              ) : insights.length === 0 ? (
                <p className="text-sm text-text-muted">Connect your GitHub account to generate AI insights.</p>
              ) : (
                insights.map((insight, idx) => (
                  <InsightItem 
                    key={idx}
                    type={insight.type === 'positive' || insight.type === 'warning' || insight.type === 'neutral' ? insight.type : 'neutral'}
                    title={insight.title}
                    content={insight.content}
                    icon={insight.type === 'positive' ? <Zap className="w-4 h-4" /> : insight.type === 'warning' ? <AlertCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                  />
                ))
              )}
            </CardContent>
          </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
          <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md shadow-lg shadow-black/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Work Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-text-secondary">Archetype</span>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-400/20 px-3 py-1 font-medium">{archetype}</Badge>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  {archetypeDesc}
                </p>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </div>

        {/* Right Column: Data & Charts */}
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md shadow-lg shadow-black/10 flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Peak Productivity Hours</CardTitle>
                  <CardDescription className="mt-1">Focus intensity distributed by time of day.</CardDescription>
                </div>
                <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 shadow-inner shadow-white/5">
                   <Clock className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-6">
              <div className="h-full w-full min-h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicHourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                    <XAxis dataKey="hour" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--color-bg-elevated)', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-strong)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="intensity" radius={[4, 4, 0, 0]}>
                      {dynamicHourlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.intensity > 10 ? 'var(--color-brand)' : 'var(--color-border-strong)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
          <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-md shadow-lg shadow-black/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Actionable Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {insights.filter(i => i.recommendation).map((insight, idx) => (
                  <RecommendationCard 
                    key={`rec-${idx}`}
                    title={insight.title} 
                    desc={insight.recommendation}
                  />
                ))}
                {insights.filter(i => i.recommendation).length === 0 && (
                   <p className="text-sm text-text-muted col-span-2">No recommendations available yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function InsightItem({ type, title, content, icon }: { type: 'positive' | 'warning' | 'neutral', title: string, content: string, icon: React.ReactNode, key?: any }) {
  const colors = {
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-400/20',
    neutral: 'text-brand bg-brand/10 border-brand/20',
  };

  return (
    <div className="pb-5 border-b border-white/5 last:border-0 last:pb-0">
      <div className="flex items-center space-x-3 mb-2">
        <div className={`p-1.5 rounded-lg border shadow-sm ${colors[type]}`}>
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <p className="text-[15px] text-text-secondary leading-relaxed pl-[42px] max-w-sm">
        {content}
      </p>
    </div>
  );
}

function RecommendationCard({ title, desc }: { title: string, desc: string, key?: any }) {
  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }}
      className="p-5 rounded-2xl bg-bg-surface/50 backdrop-blur-md border border-white/5 shadow-lg shadow-black/20 hover:border-brand/40 transition-all group cursor-pointer"
    >
      <div className="flex items-start space-x-4">
        <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 flex shrink-0">
          <Target className="w-5 h-5 text-brand group-hover:text-brand-light transition-colors" />
        </div>
        <div>
          <h4 className="text-[15px] font-semibold text-white mb-2 group-hover:text-brand-light transition-colors leading-tight">{title}</h4>
          <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
        </div>
      </div>
    </motion.div>
  );
}

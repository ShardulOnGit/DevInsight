import React, { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Mail, ChevronDown, ChevronUp, BarChart2, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { generateWeeklyReport } from '@/services/reportService';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function ReportsPage() {
  const { user, userData } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'reports'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() }));
      fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setReports(fetched);
      setLoading(false);
    }, (err) => {
      console.error('Reports fetch error:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleGenerateReport = async () => {
    if (!user) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      // Fetch existing activities from Firestore
      const activitiesQuery = query(collection(db, 'dailyActivities'), where('uid', '==', user.uid));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activities: any[] = [];
      activitiesSnapshot.forEach(doc => activities.push(doc.data()));

      if (activities.length === 0) {
        setGenerateError('No activity data found. Please connect your GitHub and sync first from the Profile page.');
        return;
      }

      await generateWeeklyReport(user.uid, activities);
      // Reports will update via onSnapshot listener
    } catch (err: any) {
      console.error('Generate report error:', err);
      setGenerateError(err?.message || 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#f43f5e';
  };

  const hasGitHub = !!userData?.githubUsername;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-5"
      >
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <BarChart2 className="w-5 h-5 text-brand" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">AI Generated Reports</h1>
          </div>
          <p className="text-text-secondary text-sm ml-12">Weekly summaries and engineering performance history.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Generate Report Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerateReport}
            disabled={generating || !hasGitHub}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: generating ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              boxShadow: generating ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
            }}
            title={!hasGitHub ? 'Connect GitHub first to generate reports' : 'Generate a new weekly report'}
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating…' : 'Generate Report'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
          >
            <Mail className="w-4 h-4" />
            Subscribe
          </motion.button>
        </div>
      </motion.div>

      {/* GitHub not connected warning */}
      {!hasGitHub && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-200">GitHub Not Connected</p>
            <p className="text-xs text-amber-300/70 mt-0.5">
              Connect your GitHub account in{' '}
              <a href="/app/profile" className="underline hover:text-amber-200 transition-colors">Profile → GitHub Integration</a>
              {' '}and sync to enable report generation.
            </p>
          </div>
        </motion.div>
      )}

      {/* Generate Error */}
      <AnimatePresence>
        {generateError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}
          >
            <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-200">Report Generation Failed</p>
              <p className="text-xs text-rose-300/70 mt-0.5">{generateError}</p>
            </div>
            <button
              onClick={() => setGenerateError(null)}
              className="text-rose-400 hover:text-rose-300 transition-colors text-xs shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports List */}
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <motion.div key={i} variants={itemVariants} className="rounded-2xl border border-border-subtle glass-elevated p-5">
              <div className="flex items-center gap-4">
                <div className="skeleton w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2.5">
                  <div className="skeleton h-4 w-52 rounded-lg" />
                  <div className="skeleton h-3 w-36 rounded-lg" />
                </div>
                <div className="skeleton h-9 w-28 rounded-xl" />
              </div>
            </motion.div>
          ))
        ) : reports.length === 0 ? (
          <motion.div variants={itemVariants}>
            <EmptyState onGenerate={handleGenerateReport} generating={generating} hasGitHub={hasGitHub} />
          </motion.div>
        ) : (
          reports.map((report) => {
            const isExpanded = expandedId === report.id;
            const score = report.productivityScore;
            const color = score ? scoreColor(score) : '#94a3b8';
            // Calculate SVG ring circumference
            const radius = 20;
            const circumference = 2 * Math.PI * radius; // ~125.6
            const dashArray = score ? `${(score / 100) * circumference} ${circumference}` : `0 ${circumference}`;

            return (
              <motion.div key={report.id} variants={itemVariants}>
                <div
                  className="rounded-2xl border overflow-hidden glass-elevated transition-all duration-200"
                  style={{ borderColor: isExpanded ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)' }}
                >
                  {/* Report Header Row */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Circular progress ring */}
                      <div className="relative shrink-0 w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                          {score && (
                            <motion.circle
                              cx="24" cy="24" r={radius}
                              fill="none"
                              stroke={color}
                              strokeWidth="3"
                              strokeDasharray={dashArray}
                              strokeLinecap="round"
                              initial={{ strokeDasharray: `0 ${circumference}` }}
                              animate={{ strokeDasharray: dashArray }}
                              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                              style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
                            />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileText className="w-4 h-4" style={{ color }} />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[15px] font-bold text-white leading-tight">Weekly Engineering Summary</h4>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Calendar className="w-3 h-3" />
                            {report.weekEnding || 'Recent'}
                          </div>
                          {score && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
                              <BarChart2 className="w-3 h-3" />
                              Score: {score}/100
                            </div>
                          )}
                          {report.burnoutRiskStatus && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              report.burnoutRiskStatus === 'High'
                                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                : report.burnoutRiskStatus === 'Medium'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            }`}>
                              {report.burnoutRiskStatus} Risk
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); }}
                        title="Download report"
                      >
                        <Download className="w-4 h-4" />
                      </motion.button>
                      <div className="p-2 rounded-lg text-text-muted">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-5 pb-6 pt-5"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.12)' }}
                        >
                          <div className="max-w-3xl space-y-3">
                            {/* Render paragraphs preserving newlines */}
                            {(report.summaryText || '').split('\n\n').map((para: string, i: number) => (
                              <p key={i} className="text-[14px] text-text-secondary leading-relaxed">
                                {para.trim()}
                              </p>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}

function EmptyState({ onGenerate, generating, hasGitHub }: { onGenerate: () => void; generating: boolean; hasGitHub: boolean }) {
  return (
    <div className="rounded-2xl border border-border-subtle glass-elevated p-12 text-center">
      <div
        className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <FileText className="w-8 h-8 text-brand" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2 tracking-tight">No Reports Yet</h3>
      <p className="text-text-muted text-sm max-w-xs mx-auto leading-relaxed mb-7">
        {hasGitHub
          ? 'Your GitHub is connected. Generate your first AI-powered weekly report now.'
          : 'Connect your GitHub first, then generate your first performance report.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {hasGitHub ? (
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating Report…' : 'Generate My First Report'}
          </motion.button>
        ) : (
          <a href="/app/profile">
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
              }}
            >
              Connect GitHub First →
            </motion.button>
          </a>
        )}
      </div>
    </div>
  );
}

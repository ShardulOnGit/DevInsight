import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download, Calendar, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const q = query(collection(db, 'reports'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: any[] = [];
        snapshot.forEach(doc => {
            fetched.push({ id: doc.id, ...doc.data() });
        });
        
        // sort by timestamp locally to avoid needing index
        fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        setReports(fetched);
        setLoading(false);
    }, (error) => {
      console.error("Error fetching reports", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"
      >
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">AI Generated Reports</h2>
          <p className="text-text-secondary mt-1">Review your weekly summaries and performance history.</p>
        </div>
        <Button variant="secondary" className="sm:w-auto shadow-sm shadow-black/20 hover:border-brand/40 transition-all border border-transparent">
          <Mail className="w-4 h-4 mr-2 text-brand" /> Subscribe to Updates
        </Button>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
        <Card className="border-white/5 bg-gradient-to-b from-bg-surface/80 to-bg-surface backdrop-blur-xl shadow-lg shadow-black/10">
        <CardHeader className="pb-6">
          <CardTitle className="text-xl">Recent Reports</CardTitle>
          <CardDescription>Written in a professional, human-like tone summarizing your metric shifts.</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="space-y-5">
             {loading ? (
                <p className="text-sm text-text-muted">Loading reports...</p>
             ) : reports.length === 0 ? (
                <p className="text-sm text-text-muted">No reports generated yet. Connect GitHub to generate analytics.</p>
             ) : (
                reports.map((report) => (
                <motion.div variants={itemVariants} key={report.id} className="flex flex-col p-5 rounded-2xl bg-bg-surface/40 backdrop-blur-sm border border-white/5 hover:bg-bg-elevated/40 hover:border-brand/30 transition-all shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                   <div className="flex items-start space-x-5 mb-4 sm:mb-0">
                     <div className="w-12 h-12 rounded-xl bg-bg-dark border border-white/10 flex items-center justify-center shrink-0 text-brand mt-1 sm:mt-0 shadow-inner shadow-white/5">
                       <FileText className="w-6 h-6" />
                     </div>
                     <div>
                       <h4 className="text-[15px] font-semibold text-white hover:text-brand-light transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}>
                         Weekly Engineering Summary
                       </h4>
                       <div className="flex items-center mt-1.5 space-x-4 text-xs text-text-muted">
                         <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" />{report.weekEnding || 'Recent'}</span>
                         <span className="flex items-center">Score: <strong className="text-white ml-1">{report.productivityScore || 'N/A'}/100</strong></span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex gap-3 w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto bg-black/20 border-white/10 hover:bg-white/10" onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}>
                         {expandedId === report.id ? 'Hide Details' : 'View Details'}
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full sm:w-auto px-3 hover:bg-white/5"><Download className="w-4 h-4" /></Button>
                   </div>
                  </div>
                  
                  {expandedId === report.id && (
                     <motion.div 
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: 'auto', opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       className="mt-5 pt-5 border-t border-white/5 whitespace-pre-wrap text-[15px] max-w-4xl text-text-secondary leading-relaxed bg-black/10 -mx-5 -mb-5 p-5 rounded-b-2xl shadow-inner shadow-black/20"
                     >
                       {report.summaryText}
                     </motion.div>
                  )}
                </motion.div>
              )))}
          </div>
        </CardContent>
      </Card>
      </motion.div>
      </motion.div>
    </div>
  );
}

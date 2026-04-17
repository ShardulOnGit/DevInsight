import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Code2, Activity, Brain, Target, ArrowRight, Github, TrendingUp, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-dark text-text-primary selection:bg-brand selection:text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-screen" />
      </div>

      <nav className="relative z-10 border-b border-border-subtle bg-bg-dark/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Code2 className="w-6 h-6 text-brand mr-2" />
            <span className="text-xl font-bold tracking-tight text-white">DevInsight AI</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24 pb-16 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-light text-brand text-sm font-medium mb-6">
               <Activity className="w-4 h-4 mr-2" /> Introducing Developer Behavior Analytics
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
              Your AI Mentor for <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-indigo-400">Peak Engineering</span>
            </h1>
            <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed">
              Deeply analyze your coding patterns, predict productivity trends, and detect burnout before it happens. Connect your GitHub and let AI optimize your workflow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto font-medium text-base h-14 px-8 rounded-xl">
                  Connect GitHub <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/app">
                <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium text-base h-14 px-8 rounded-xl bg-bg-surface">
                  View Demo Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <FeatureCard 
            icon={<Target className="w-8 h-8 text-emerald-400" />}
            title="Activity Trends"
            desc="Track coding frequency, consistency, and identify your most productive hours automatically."
          />
          <FeatureCard 
            icon={<ShieldAlert className="w-8 h-8 text-rose-400" />}
            title="Burnout Detection"
            desc="Spot irregular work patterns and sudden drops in activity indicating potential risk."
          />
          <FeatureCard 
            icon={<Brain className="w-8 h-8 text-brand" />}
            title="AI Mentorship"
            desc="Receive human-like observations and personalized suggestions to improve your daily balance."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-border-subtle bg-bg-surface/50 hover:bg-bg-elevated/50 transition-colors">
      <div className="w-14 h-14 rounded-xl bg-bg-dark border border-border-subtle flex items-center justify-center mb-6 shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

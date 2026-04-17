import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Code2, Activity, Brain, Target, ArrowRight, Github, TrendingUp, ShieldAlert, Zap, BarChart3, Users, Sparkles, ChevronRight, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Animated counter hook
function useCounter(end: number, duration: number = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
}

const stats = [
  { label: 'Developers Tracked', value: 2400, suffix: '+', icon: Users },
  { label: 'Insights Generated', value: 14000, suffix: '+', icon: Brain },
  { label: 'Burnout Prevented', value: 89, suffix: '%', icon: ShieldAlert },
  { label: 'Avg Productivity Gain', value: 34, suffix: '%', icon: TrendingUp },
];

const features = [
  {
    icon: Target,
    title: 'Activity Trends',
    desc: 'Track coding frequency, consistency, and identify your most productive hours with deep GitHub analysis.',
    color: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  {
    icon: ShieldAlert,
    title: 'Burnout Detection',
    desc: 'Spot irregular work patterns and sudden drops in activity before they escalate into serious problems.',
    color: 'from-rose-500/20 to-pink-500/10',
    border: 'border-rose-500/20',
    iconColor: 'text-rose-400',
    glow: 'rgba(244, 63, 94, 0.15)',
  },
  {
    icon: Brain,
    title: 'AI Mentorship',
    desc: 'Receive human-like behavioral observations and personalized suggestions to optimize your daily balance.',
    color: 'from-violet-500/20 to-indigo-500/10',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    glow: 'rgba(139, 92, 246, 0.15)',
  },
  {
    icon: BarChart3,
    title: 'Team Benchmarks',
    desc: 'Compare anonymized performance across your engineering squad to surface hidden bottlenecks.',
    color: 'from-cyan-500/20 to-blue-500/10',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    glow: 'rgba(6, 182, 212, 0.15)',
  },
  {
    icon: Zap,
    title: 'Deep Work Hours',
    desc: 'AI estimates your real focus time by analyzing commit density, PR reviews, and session lengths.',
    color: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  {
    icon: TrendingUp,
    title: 'Weekly Reports',
    desc: 'Get beautifully formatted weekly summaries written in plain English with actionable next steps.',
    color: 'from-brand/20 to-indigo-500/10',
    border: 'border-brand/20',
    iconColor: 'text-brand',
    glow: 'rgba(99, 102, 241, 0.15)',
  },
];

const testimonials = [
  { name: 'Alex Chen', role: 'Senior Fullstack Engineer', text: 'DevInsight helped me realize I was burning out weeks before I noticed it myself. Now I have actual data to push back on unrealistic sprint goals.', stars: 5 },
  { name: 'Priya Rao', role: 'Engineering Manager', text: 'The team benchmarks alone are worth it. I can see at a glance who might need support without micromanaging anyone.', stars: 5 },
  { name: 'Marcus Webb', role: 'Indie Developer', text: 'I finally understand why some weeks feel so unproductive. My peak hours are 7-9am, not after lunch like I assumed. Game changer.', stars: 5 },
];

export default function LandingPage() {
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsStarted(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="hero-orb-1" />
        <div className="hero-orb-2" />
        <div className="hero-orb-3" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-30 border-b border-border-subtle/50 glass sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center shadow-lg glow-brand-sm">
              <Code2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">DevInsight <span className="text-brand">AI</span></span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <Link to="/auth">
              <Button variant="ghost" className="text-text-secondary hover:text-white transition-colors text-sm font-medium">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="h-9 px-5 text-sm font-semibold bg-gradient-to-r from-brand to-violet-600 hover:from-brand-hover hover:to-violet-700 text-white border-0 shadow-lg shadow-brand/25 transition-all hover:shadow-brand/40 hover:scale-[1.02] active:scale-[0.98] rounded-xl">
                Get Started <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Badge pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-brand/25 bg-brand/8 text-brand text-sm font-medium mb-8 backdrop-blur-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                <Sparkles className="w-3.5 h-3.5" />
                Introducing Developer Behavior Analytics
              </motion.div>

              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 leading-[0.95]">
                Your AI Mentor
                <br />
                for{' '}
                <span className="gradient-text animate-gradient" style={{ backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #06b6d4 80%, #6366f1 100%)' }}>
                  Peak Engineering
                </span>
              </h1>

              <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                Deeply analyze your coding patterns, predict productivity trends, and detect burnout before it happens. Connect your GitHub and let AI optimize your workflow.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative h-14 px-8 rounded-2xl font-semibold text-base text-white overflow-hidden shadow-2xl shadow-brand/30"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Github className="w-5 h-5" />
                      Connect GitHub
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                </Link>

              </div>

              {/* Social proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-center gap-3 mt-10 text-sm text-text-muted"
              >
                <div className="flex -space-x-2">
                  {['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'].map((color, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-bg-dark"
                      style={{ background: `linear-gradient(135deg, ${color}60, ${color}30)` }}
                    />
                  ))}
                </div>
                <span>Trusted by <strong className="text-text-secondary">2,400+</strong> engineers worldwide</span>
              </motion.div>
            </motion.div>
          </div>

          {/* Floating mockup / code preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
            className="mt-20 max-w-4xl mx-auto"
          >
            <div className="relative rounded-2xl overflow-hidden border border-border-subtle glass-elevated shadow-2xl shadow-black/50">
              {/* Faux window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle bg-bg-surface/80">
                <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <div className="flex-1 mx-4 h-6 rounded-md bg-bg-elevated/80 border border-border-subtle flex items-center px-3">
                  <span className="text-xs text-text-muted font-mono">devinsight.app/app/overview</span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Productivity', value: '78/100', color: '#6366f1', change: '+12%' },
                  { label: 'Burnout Risk', value: 'Low', color: '#10b981', change: 'Stable' },
                  { label: 'Deep Work', value: '24h', color: '#8b5cf6', change: 'This week' },
                  { label: 'Commits', value: '142', color: '#06b6d4', change: '14 repos' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="p-4 rounded-xl bg-bg-elevated/60 border border-border-subtle"
                  >
                    <p className="text-xs text-text-muted mb-2">{stat.label}</p>
                    <p className="text-2xl font-bold text-white tracking-tight" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-xs mt-1" style={{ color: `${stat.color}80` }}>{stat.change}</p>
                  </motion.div>
                ))}
              </div>
              {/* Gradient overlay on bottom */}
              <div className="h-16 bg-gradient-to-t from-bg-dark/80 to-transparent absolute bottom-0 left-0 right-0 pointer-events-none" />
            </div>
          </motion.div>
        </section>

        {/* Animated Stats Section */}
        <section ref={statsRef} className="py-16 px-6 border-y border-border-subtle/50">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <StatCounter key={i} {...stat} started={statsStarted} index={i} />
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-brand uppercase tracking-widest mb-4">Everything You Need</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Built for high-output engineers
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Stop flying blind. Get data-driven clarity on how you actually work and where your best improvements lie.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} index={i} />
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-6 bg-gradient-to-b from-transparent via-brand/3 to-transparent">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                Loved by developers
              </h2>
              <p className="text-text-secondary">Real feedback from engineers who use DevInsight daily.</p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <TestimonialCard key={i} {...t} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="relative p-12 rounded-3xl overflow-hidden border border-brand/20 glass-elevated">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-violet-500/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand to-violet-500 mb-6 shadow-xl glow-brand">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
                  Ready to understand yourself better?
                </h2>
                <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
                  Join thousands of developers who use DevInsight to stay sharp, prevent burnout, and ship better code.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/auth">
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="h-14 px-10 rounded-2xl font-semibold text-base text-white shadow-2xl shadow-brand/30"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                      Start for Free — Connect GitHub
                    </motion.button>
                  </Link>
                </div>
                <p className="mt-4 text-xs text-text-muted">Free plan available · No credit card required</p>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center">
              <Code2 className="w-3 h-3 text-white" />
            </div>
            <span>DevInsight AI © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-text-secondary transition-colors">Privacy</a>
            <a href="#" className="hover:text-text-secondary transition-colors">Terms</a>
            <a href="#" className="hover:text-text-secondary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCounter({ label, value, suffix, icon: Icon, started, index }: any) {
  const count = useCounter(value, 2000, started);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="text-center"
    >
      <div className="flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-brand mr-2" />
        <span className="text-3xl md:text-4xl font-black text-white stat-number">
          {started ? count.toLocaleString() : 0}{suffix}
        </span>
      </div>
      <p className="text-sm text-text-muted">{label}</p>
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, border, iconColor, glow, index }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={{ y: -6 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={`relative group p-7 rounded-2xl border bg-bg-surface/60 backdrop-blur-sm transition-all duration-300 card-lift ${border} hover:border-opacity-60`}
      style={{ boxShadow: hovered ? `0 0 30px ${glow}, 0 20px 40px rgba(0,0,0,0.3)` : '0 4px 20px rgba(0,0,0,0.2)' }}
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} border ${border} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none`} />
    </motion.div>
  );
}

function TestimonialCard({ name, role, text, stars, index }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="p-6 rounded-2xl glass-elevated border border-border-subtle hover:border-brand/20 transition-all card-lift"
    >
      <div className="flex gap-1 mb-4">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-text-secondary text-sm leading-relaxed mb-5">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/40 to-violet-500/30 border border-brand/20 flex items-center justify-center font-bold text-sm text-brand">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-text-muted">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

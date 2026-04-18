import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Code2, Check, Zap, Users, Brain, TrendingUp, ShieldAlert, Dna,
  Star, ArrowRight, ChevronRight, Sparkles, Crown, Lock
} from 'lucide-react';

const FREE_FEATURES = [
  { text: 'GitHub activity sync (public repos)', available: true },
  { text: 'Up to 3 AI behavioral insights/week', available: true },
  { text: 'Basic productivity score', available: true },
  { text: 'Burnout risk indicator', available: true },
  { text: 'Work intensity heatmap', available: true },
  { text: 'Developer archetype detection', available: true },
  { text: '1 weekly AI report/month', available: true },
  { text: 'Developer DNA Profile', available: false },
  { text: 'Predictive next-week forecast', available: false },
  { text: 'Behavior change detection', available: false },
  { text: 'Team benchmarks & comparison', available: false },
  { text: 'Private repo access', available: false },
];

const PRO_FEATURES = [
  { text: 'Everything in Free', available: true, bold: true },
  { text: 'Private repo deep analysis', available: true },
  { text: 'Unlimited AI insights + storytelling', available: true },
  { text: '🧬 Developer DNA Profile (signature feature)', available: true },
  { text: '🔮 Next-week productivity forecast', available: true },
  { text: '⚡ Behavior change detector', available: true },
  { text: 'Team benchmarks & B2B analytics', available: true },
  { text: 'Streak tracking + milestone badges', available: true },
  { text: 'Focus heatmap (hourly precision)', available: true },
  { text: 'Unlimited weekly reports', available: true },
  { text: 'Export to PDF / CSV', available: true },
  { text: 'Priority AI model (faster inference)', available: true },
];

const FAQS = [
  {
    q: 'Is the free plan truly free?',
    a: 'Yes. No credit card required. You get the core productivity insights, burnout detection, and archetype forever for free.',
  },
  {
    q: 'What is the "Developer DNA Profile"?',
    a: 'It\'s our signature feature that classifies your coding personality — Night Coder, Sprint Worker, Deep Focus Coder, or Marathoner — with tailored strengths, weaknesses, and recommendations.',
  },
  {
    q: 'How does the "Predict Next Week" feature work?',
    a: 'We project your commit trend and deep-work patterns using a rolling regression model to forecast your likely productivity score for the coming week — with confidence levels.',
  },
  {
    q: 'Can I upgrade or downgrade anytime?',
    a: 'Absolutely. Your data is always preserved. Downgrading simply limits new AI features while keeping your historical insights intact.',
  },
  {
    q: 'Does Team mode require everyone to sign up?',
    a: 'Managers see anonymized aggregate metrics from all team members who have connected their GitHub to DevInsight within the same workspace.',
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const proPrice = annual ? 7 : 9;

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary overflow-hidden">
      {/* Ambient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="hero-orb-1" />
        <div className="hero-orb-2" />
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
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center shadow-lg glow-brand-sm">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">DevInsight <span className="text-brand">AI</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-text-secondary hover:text-white transition-colors font-medium">Back to Home</Link>
            <Link to="/auth">
              <button className="h-9 px-5 text-sm font-semibold bg-gradient-to-r from-brand to-violet-600 text-white rounded-xl shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:scale-[1.02] transition-all active:scale-[0.98]">
                Get Started <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="pt-20 pb-10 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/25 bg-brand/8 text-brand text-sm font-medium mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Simple, transparent pricing
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-4 leading-tight">
              Invest in your{' '}
              <span className="gradient-text" style={{ backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #06b6d4 80%)' }}>
                peak performance
              </span>
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10">
              Start free. Unlock the full AI intelligence platform when you're ready to go deeper.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-sm font-semibold transition-colors ${!annual ? 'text-white' : 'text-text-muted'}`}>Monthly</span>
              <button
                id="billing-toggle"
                onClick={() => setAnnual(!annual)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand/30 ${annual ? 'bg-brand shadow-lg shadow-brand/25' : 'bg-border-strong'}`}
              >
                <motion.span
                  layout
                  className="inline-block h-5 w-5 rounded-full bg-white shadow"
                  style={{ translateX: annual ? 34 : 4 }}
                />
              </button>
              <span className={`text-sm font-semibold transition-colors ${annual ? 'text-white' : 'text-text-muted'}`}>
                Annual
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                  SAVE 22%
                </span>
              </span>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 px-0">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="rounded-3xl border border-border-subtle glass-elevated p-8 flex flex-col text-left hover:border-brand/20 transition-all card-lift"
            >
              <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-text-secondary" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Free</h2>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black text-white">$0</span>
                  <span className="text-text-muted text-sm font-medium">/month</span>
                </div>
                <p className="text-sm text-text-muted">No credit card required. Always free.</p>
              </div>

              <Link to="/auth" className="block mb-8">
                <button
                  id="free-plan-cta"
                  className="w-full h-11 rounded-2xl font-semibold text-sm border border-border-strong text-white hover:border-brand/40 hover:bg-white/5 transition-all"
                >
                  Get Started Free
                </button>
              </Link>

              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-4.5 h-4.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center ${f.available ? 'bg-emerald-500/15' : 'bg-white/5'}`}>
                      {f.available
                        ? <Check className="w-2.5 h-2.5 text-emerald-400" />
                        : <Lock className="w-2.5 h-2.5 text-text-muted" />}
                    </div>
                    <span className={`text-sm ${f.available ? 'text-text-secondary' : 'text-text-muted line-through decoration-white/20'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Pro Plan */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="relative rounded-3xl overflow-hidden flex flex-col text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
                border: '1px solid rgba(99,102,241,0.35)',
                boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              {/* Top glow */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/80 to-transparent" />
              <div className="absolute top-0 right-0 w-60 h-60 bg-brand/15 blur-[80px] rounded-full pointer-events-none" />

              <div className="relative z-10 p-8 flex flex-col flex-1">
                {/* Popular badge */}
                <div className="absolute top-6 right-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-brand to-violet-500 text-white shadow-lg shadow-brand/30">
                    <Crown className="w-3 h-3" /> Most Popular
                  </span>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand/30 to-violet-500/20 border border-brand/30 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-brand" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Pro</h2>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={proPrice}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="text-5xl font-black text-white"
                      >
                        ${proPrice}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-text-muted text-sm font-medium">/month</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-emerald-400 font-semibold">Billed annually — save $24/year</p>
                  )}
                  <p className="text-sm text-text-muted mt-1">Full AI intelligence platform.</p>
                </div>

                <Link to="/auth" className="block mb-8">
                  <motion.button
                    id="pro-plan-cta"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-11 rounded-2xl font-semibold text-sm text-white shadow-xl shadow-brand/30 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    <Star className="w-4 h-4" />
                    Start Pro Free — 14-day trial
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </Link>

                <ul className="space-y-3 flex-1">
                  {PRO_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-4.5 h-4.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center bg-brand/20 border border-brand/25">
                        <Check className="w-2.5 h-2.5 text-brand" />
                      </div>
                      <span className={`text-sm ${f.bold ? 'text-white font-semibold' : 'text-text-secondary'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Enterprise callout */}
        <section className="py-12 px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Users className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Building for a team of 10+?</h3>
                <p className="text-sm text-text-muted">Custom pricing with SSO, admin dashboards, compliance exports, and dedicated support.</p>
              </div>
            </div>
            <button
              id="enterprise-cta"
              className="shrink-0 h-10 px-6 rounded-xl text-sm font-semibold border border-brand/30 text-brand hover:bg-brand/10 transition-all whitespace-nowrap"
            >
              Talk to Sales →
            </button>
          </motion.div>
        </section>

        {/* Feature callout row */}
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Dna, color: '#8b5cf6', title: 'Developer DNA Profile', desc: 'Your one-of-a-kind coding personality — strengths, weaknesses, and work style, all in one card.' },
              { icon: TrendingUp, color: '#06b6d4', title: 'Next-Week Forecast', desc: "AI predicts your productivity trajectory before the week begins. Adjust before it's too late." },
              { icon: ShieldAlert, color: '#f43f5e', title: 'Behavior Change Detector', desc: 'Something shifted Tuesday? We notice micro-patterns and alert you — not after burnout, before it.' },
            ].map(({ icon: Icon, color, title, desc }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl p-6 border border-border-subtle glass-elevated hover:border-brand/20 transition-all card-lift"
              >
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h4 className="text-base font-bold text-white mb-2">{title}</h4>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-bold text-white text-center tracking-tight mb-10"
            >
              Frequently Asked Questions
            </motion.h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl overflow-hidden border border-border-subtle glass-elevated"
                >
                  <button
                    id={`faq-${i}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm font-semibold text-white">{faq.q}</span>
                    <motion.svg
                      animate={{ rotate: openFaq === i ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-4 h-4 text-text-muted shrink-0 ml-4"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </motion.svg>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-sm text-text-secondary leading-relaxed"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

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
              <Link to="/" className="hover:text-text-secondary transition-colors">Home</Link>
              <a href="#" className="hover:text-text-secondary transition-colors">Privacy</a>
              <a href="#" className="hover:text-text-secondary transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

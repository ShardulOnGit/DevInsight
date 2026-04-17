import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, ArrowLeft, Shield, Zap, Brain } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

const benefits = [
  { icon: Brain, text: 'AI-powered behavioral insights' },
  { icon: Zap, text: 'Real-time productivity scoring' },
  { icon: Shield, text: 'Burnout risk detection & prevention' },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingDot, setLoadingDot] = useState(0);

  React.useEffect(() => {
    if (user) navigate('/app');
  }, [user, navigate]);

  useEffect(() => {
    if (!isLoggingIn) return;
    const interval = setInterval(() => setLoadingDot(d => (d + 1) % 3), 400);
    return () => clearInterval(interval);
  }, [isLoggingIn]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/app');
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized. Add "localhost" to Firebase Console → Authentication → Authorized Domains.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups for localhost and try again.');
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed. Please try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        // ignore
      } else {
        setAuthError(`Sign-in failed: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/8 rounded-full blur-[150px]" />
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-cyan-500/6 rounded-full blur-[100px]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Back button */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to home
        </Link>
      </div>

      {/* Left panel — branding */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border-subtle relative"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center shadow-lg glow-brand-sm">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">DevInsight <span className="text-brand">AI</span></span>
        </div>

        {/* Centered content */}
        <div className="max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-4xl font-black text-white tracking-tight mb-4 leading-tight">
              Understand how you really{' '}
              <span className="gradient-text">code & create.</span>
            </h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              Connect your GitHub account and let our AI analyze your development patterns — no manual tracking required.
            </p>
            <div className="space-y-4">
              {benefits.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand" />
                  </div>
                  <span className="text-text-secondary">{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom quote */}
        <div className="p-5 rounded-2xl glass border border-border-subtle">
          <p className="text-sm text-text-secondary italic leading-relaxed">
            "DevInsight helped me identify that I was burning out weeks before I felt it. The data doesn't lie."
          </p>
          <div className="flex items-center gap-2.5 mt-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand/40 to-violet-500/30 border border-brand/20 flex items-center justify-center text-xs font-bold text-brand">A</div>
            <div>
              <p className="text-xs font-semibold text-white">Alex Chen</p>
              <p className="text-xs text-text-muted">Senior Engineer @ Vercel</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center shadow-lg">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">DevInsight <span className="text-brand">AI</span></span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Welcome back</h1>
            <p className="text-text-secondary">Sign in to access your developer dashboard.</p>
          </div>

          {/* Auth card */}
          <div className="relative p-8 rounded-2xl glass-elevated border border-border-strong overflow-hidden">
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand/8 rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Google OAuth button */}
              <motion.button
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full h-13 px-5 py-3.5 flex items-center justify-center gap-3 rounded-xl border border-border-strong bg-white/4 hover:bg-white/7 hover:border-brand/40 transition-all font-medium text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                    <span className="text-text-secondary">
                      Signing in<span className="inline-block w-6">{'...'.slice(0, loadingDot + 1)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </motion.button>

              {/* Error */}
              <AnimatePresence>
                {authError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="p-4 rounded-xl bg-rose-500/8 border border-rose-500/25 text-rose-300 text-sm leading-relaxed"
                  >
                    <strong className="block text-rose-200 mb-1">⚠ Sign-in error</strong>
                    {authError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-border-subtle" />
                <span className="text-xs text-text-muted">More options coming soon</span>
                <div className="flex-1 h-px bg-border-subtle" />
              </div>

              {/* Email placeholder */}
              <button
                disabled
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-white/2 text-text-muted text-sm opacity-50 cursor-not-allowed"
              >
                Continue with Email (coming soon)
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-6 leading-relaxed">
            By signing in, you agree to our{' '}
            <a href="#" className="text-text-secondary hover:text-white underline-offset-2 hover:underline transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-text-secondary hover:text-white underline-offset-2 hover:underline transition-colors">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

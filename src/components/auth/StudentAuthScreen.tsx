import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { soundEffects } from '../../utils/soundEffects';
import { UserCheck, LogIn, UserPlus, Sparkles, Eye, EyeOff } from 'lucide-react';
import type { AccessibilityPreference } from '../../../shared/types';

interface StudentAuthScreenProps {
  onAuthenticated?: () => void;
  /** Which tab to open on. `/register` deep-links the sign-up form. */
  initialMode?: 'login' | 'register';
}

export const StudentAuthScreen: React.FC<StudentAuthScreenProps> = ({
  onAuthenticated,
  initialMode = 'login',
}) => {
  const { students, loginStudent, registerStudent } = useAuthStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRoll, setRegRoll] = useState('');
  // Non-null: the form always has a preference selected, even though the
  // stored profile allows null for accounts that never set one.
  const [regPref, setRegPref] = useState<AccessibilityPreference>('Screen Reader');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your Roll Number or Email.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await loginStudent(loginIdentifier, loginPassword);
      if (!ok) {
        setLoginError('Invalid student credentials. Please check your email, roll number and password.');
      } else {
        onAuthenticated?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regName.trim() || !regEmail.trim() || !regRoll.trim() || !regPassword.trim()) {
      setRegError('Please fill in all registration fields.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await registerStudent(regName, regEmail, regRoll, regPref, regPassword);
      if (!ok) {
        setRegError('Registration failed. That Email or Roll Number may already be registered.');
      } else {
        onAuthenticated?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Student Portal Authentication"
      className="min-h-[82vh] flex flex-col justify-center items-center px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="w-full max-w-xl dx-glass border-2 border-theme-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Header Branding */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-theme-primary text-theme-primary-text font-black text-xl shadow-lg mb-2 hover:scale-105 transition-transform">
            DX
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight">
            DristiX Candidate Portal
          </h1>
          <p className="text-xs sm:text-sm font-medium text-theme-text/80 mt-1 max-w-md mx-auto">
            Accessible online examination &amp; practice platform designed for everyone.
          </p>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div
          role="tablist"
          aria-label="Student authentication options"
          className="flex p-1.5 rounded-2xl bg-theme-bg/80 border-2 border-theme-border mb-5 shadow-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'login'}
            onClick={() => {
              setAuthMode('login');
              soundEffects.playSelect();
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-theme-focus ${
              authMode === 'login'
                ? 'bg-theme-primary text-theme-primary-text shadow-md'
                : 'text-theme-text hover:bg-theme-surface/70'
            }`}
          >
            <LogIn className="w-4.5 h-4.5" aria-hidden="true" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'register'}
            onClick={() => {
              setAuthMode('register');
              soundEffects.playSelect();
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-theme-focus ${
              authMode === 'register'
                ? 'bg-theme-primary text-theme-primary-text shadow-md'
                : 'text-theme-text hover:bg-theme-surface/70'
            }`}
          >
            <UserPlus className="w-4.5 h-4.5" aria-hidden="true" />
            <span>Register New Student</span>
          </button>
        </div>

        {/* LOGIN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-bold"
              >
                ⚠️ {loginError}
              </div>
            )}

            <div>
              <label
                htmlFor="student-login-id"
                className="block text-xs sm:text-sm font-extrabold text-theme-text mb-1.5"
              >
                Roll Number or Email <span className="text-red-500">*</span>
              </label>
              <input
                id="student-login-id"
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Your registered roll number or email"
                required
                className="w-full px-4 py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition-all shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="student-login-pass"
                className="block text-xs sm:text-sm font-extrabold text-theme-text mb-1.5"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="student-login-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your candidate password"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-1 text-theme-text/60 hover:text-theme-text focus:ring-2 focus:ring-theme-focus rounded-lg transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password as plain text'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3.5 px-5 rounded-xl bg-theme-primary text-theme-primary-text font-black text-sm sm:text-base dx-glow-button hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md focus:ring-4 focus:ring-theme-focus disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in…' : 'Sign In to Candidate Dashboard'}
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {regError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-semibold"
              >
                ⚠️ {regError}
              </div>
            )}

            <div>
              <label htmlFor="reg-name" className="block text-xs sm:text-sm font-bold text-theme-text mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs sm:text-sm font-bold text-theme-text mb-1.5"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  required
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-roll"
                  className="block text-xs sm:text-sm font-bold text-theme-text mb-1.5"
                >
                  Roll Number / Candidate ID <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-roll"
                  type="text"
                  value={regRoll}
                  onChange={(e) => setRegRoll(e.target.value)}
                  placeholder="DX-104"
                  required
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-pref"
                  className="block text-xs sm:text-sm font-bold text-theme-text mb-1.5"
                >
                  Assistive Preference
                </label>
                <select
                  id="reg-pref"
                  value={regPref}
                  onChange={(e) =>
                    setRegPref(e.target.value as AccessibilityPreference)
                  }
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                >
                  <option value="Screen Reader">Screen Reader / Voice Output</option>
                  <option value="Low Vision">Low Vision / Large Print</option>
                  <option value="High Contrast">High Contrast (Yellow/Dark)</option>
                  <option value="Standard">Standard Keyboard Navigation</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="reg-pass"
                  className="block text-xs sm:text-sm font-bold text-theme-text mb-1.5"
                >
                  Create Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder:text-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-md transition focus:ring-4 focus:ring-theme-focus disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {isSubmitting ? 'Creating account…' : 'Complete Registration & Enter'}
            </button>
          </form>
        )}

        {/* Demo credentials footer */}
        <div className="mt-5 pt-4 border-t-2 border-theme-border">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-theme-primary" aria-hidden="true" />
              <h2 className="text-xs uppercase font-extrabold tracking-wider text-theme-text/70">
                Quick Demo Accounts
              </h2>
            </div>
            <span className="text-xs text-theme-text/60">
              Password: <code className="font-mono font-bold text-theme-primary">student123</code>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {students.slice(0, 3).map((std) => (
              <button
                key={std.id}
                type="button"
                onClick={() => {
                  setLoginIdentifier(std.rollNumber);
                  setLoginPassword('student123');
                  setLoginError('');
                  setAuthMode('login');
                }}
                className="p-2.5 text-left rounded-xl border-2 border-theme-border bg-theme-surface hover:border-theme-primary transition flex flex-col justify-between group focus:ring-4 focus:ring-theme-focus"
              >
                <div>
                  <span className="text-xs font-black text-theme-primary font-mono block">
                    {std.rollNumber}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-theme-text group-hover:text-theme-primary transition-colors block truncate">
                    {std.name}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-bold text-theme-primary flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Use account</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

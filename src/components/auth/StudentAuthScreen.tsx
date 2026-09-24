import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import type { StudentProfile } from '../../store/useAuthStore';
import { soundEffects } from '../../utils/soundEffects';
import { UserCheck, LogIn, UserPlus, Sparkles, Eye, EyeOff } from 'lucide-react';

interface StudentAuthScreenProps {
  onAuthenticated?: () => void;
}

export const StudentAuthScreen: React.FC<StudentAuthScreenProps> = ({ onAuthenticated }) => {
  const { students, loginStudent, quickLoginStudent, registerStudent } = useAuthStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRoll, setRegRoll] = useState('');
  const [regPref, setRegPref] = useState<StudentProfile['accessibilityPreference']>('Screen Reader');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your Roll Number or Email.');
      return;
    }
    const ok = loginStudent(loginIdentifier, loginPassword);
    if (!ok) {
      setLoginError('Invalid student credentials. Try one of the demo profiles below.');
    } else {
      onAuthenticated?.();
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regName.trim() || !regEmail.trim() || !regRoll.trim() || !regPassword.trim()) {
      setRegError('Please fill in all registration fields.');
      return;
    }
    const ok = registerStudent(regName, regEmail, regRoll, regPref, regPassword);
    if (!ok) {
      setRegError('Candidate with this Email or Roll Number already exists.');
    } else {
      onAuthenticated?.();
    }
  };

  return (
    <div
      role="region"
      aria-label="Student Portal Authentication"
      className="min-h-[80vh] flex flex-col justify-center items-center px-4 py-8 max-w-4xl mx-auto"
    >
      <div className="w-full max-w-xl bg-theme-surface border-2 border-theme-border rounded-3xl p-6 sm:p-10 shadow-lg">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-theme-primary text-white font-black text-2xl shadow-md mb-3">
            DX
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight">
            DristiX Candidate Portal
          </h1>
          <p className="text-sm text-theme-text/80 mt-1">
            Accessible online examination platform for visually impaired candidates.
          </p>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div
          role="tablist"
          aria-label="Student authentication options"
          className="flex p-1.5 rounded-xl bg-theme-bg border border-theme-border mb-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'login'}
            onClick={() => {
              setAuthMode('login');
              soundEffects.playSelect();
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-theme-focus ${
              authMode === 'login'
                ? 'bg-theme-primary text-white shadow-sm'
                : 'text-theme-text hover:bg-theme-surface'
            }`}
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
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
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-theme-focus ${
              authMode === 'register'
                ? 'bg-theme-primary text-white shadow-sm'
                : 'text-theme-text hover:bg-theme-surface'
            }`}
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Register New Student</span>
          </button>
        </div>

        {/* LOGIN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-semibold"
              >
                ⚠️ {loginError}
              </div>
            )}

            <div>
              <label
                htmlFor="student-login-id"
                className="block text-sm font-bold text-theme-text mb-1.5"
              >
                Roll Number or Email <span className="text-red-500">*</span>
              </label>
              <input
                id="student-login-id"
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. DX-101 or rohit@dristix.edu"
                required
                className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
              />
            </div>

            <div>
              <label
                htmlFor="student-login-pass"
                className="block text-sm font-bold text-theme-text mb-1.5"
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
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-1 text-theme-text/60 hover:text-theme-text focus:ring-2 focus:ring-theme-focus rounded"
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
              className="w-full py-3.5 px-4 rounded-xl bg-theme-primary text-white font-extrabold text-base shadow-md hover:brightness-110 active:scale-[0.99] transition focus:ring-4 focus:ring-theme-focus"
            >
              Sign In to Candidate Dashboard
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {regError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-semibold"
              >
                ⚠️ {regError}
              </div>
            )}

            <div>
              <label htmlFor="reg-name" className="block text-sm font-bold text-theme-text mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-bold text-theme-text mb-1.5"
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
                  className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-roll"
                  className="block text-sm font-bold text-theme-text mb-1.5"
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
                  className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-pref"
                className="block text-sm font-bold text-theme-text mb-1.5"
              >
                Accessibility Need / Assistive Preference
              </label>
              <select
                id="reg-pref"
                value={regPref}
                onChange={(e) =>
                  setRegPref(e.target.value as StudentProfile['accessibilityPreference'])
                }
                className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
              >
                <option value="Screen Reader">Screen Reader / Voice Output (Blind)</option>
                <option value="Low Vision">Low Vision / Large Print Scaling</option>
                <option value="High Contrast">High Contrast (Yellow-on-Black / Dark)</option>
                <option value="Standard">Standard Keyboard Navigation</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="reg-pass"
                className="block text-sm font-bold text-theme-text mb-1.5"
              >
                Create Password <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-pass"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Choose a secure password"
                required
                className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text placeholder-theme-text/40 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-md transition focus:ring-4 focus:ring-theme-focus"
            >
              Complete Registration & Enter
            </button>
          </form>
        )}

        {/* Instant 1-Click Demo Profiles */}
        <div className="mt-8 pt-6 border-t-2 border-theme-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-theme-primary" aria-hidden="true" />
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-theme-text/70">
              Instant 1-Click Demo Candidate Login:
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {students.slice(0, 3).map((std) => (
              <button
                key={std.id}
                type="button"
                onClick={() => {
                  quickLoginStudent(std.id);
                  onAuthenticated?.();
                }}
                className="p-3 text-left rounded-xl border-2 border-theme-border bg-theme-bg hover:border-theme-primary transition flex flex-col justify-between group focus:ring-4 focus:ring-theme-focus"
              >
                <div>
                  <span className="text-xs font-black text-theme-primary font-mono block">
                    {std.rollNumber}
                  </span>
                  <span className="text-sm font-bold text-theme-text group-hover:text-theme-primary transition-colors block truncate">
                    {std.name}
                  </span>
                  <span className="text-[11px] text-theme-text/60 block mt-0.5">
                    ♿ {std.accessibilityPreference}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-bold text-theme-primary flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Login as this student</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

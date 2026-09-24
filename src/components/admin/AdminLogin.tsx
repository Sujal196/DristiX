import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldCheck, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';

interface AdminLoginProps {
  onReturnToStudent: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onReturnToStudent }) => {
  const { loginAdmin } = useAuthStore();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const success = loginAdmin(username, password);
    if (!success) {
      setErrorMessage('Invalid administrator credentials. Please check your username and password.');
    }
  };

  return (
    <div
      role="region"
      aria-label="Administrator Authentication"
      className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 max-w-xl mx-auto"
    >
      <div className="w-full bg-theme-surface border-2 border-theme-border rounded-3xl p-6 sm:p-10 shadow-xl">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-md mb-3">
            <ShieldCheck className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight">
            DristiX Admin Studio
          </h1>
          <p className="text-sm text-theme-text/80 mt-1">
            Restricted access for examiners, test authors, and administrators.
          </p>
        </div>

        {/* Demo Credentials Alert Box */}
        <div
          role="note"
          aria-label="Demo administrator credentials"
          className="mb-6 p-4 rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/10 text-theme-text text-xs space-y-1.5"
        >
          <div className="flex items-center gap-2 font-bold text-indigo-500 text-sm">
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span>Default Administrator Credentials:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            <div>
              <span className="text-theme-text/60">Username: </span>
              <strong className="text-theme-text">admin</strong>
            </div>
            <div>
              <span className="text-theme-text/60">Password: </span>
              <strong className="text-theme-text">admin123</strong>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-semibold"
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="admin-username"
              className="block text-sm font-bold text-theme-text mb-1.5"
            >
              Admin Username <span className="text-red-500">*</span>
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30 outline-none font-medium text-sm transition"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-sm font-bold text-theme-text mb-1.5"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-12 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30 outline-none font-medium text-sm transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-1 text-theme-text/60 hover:text-theme-text focus:ring-2 focus:ring-indigo-500 rounded"
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
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base shadow-md transition focus:ring-4 focus:ring-indigo-500/50"
          >
            Authenticate & Enter Admin Studio
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 pt-4 border-t border-theme-border text-center">
          <button
            type="button"
            onClick={onReturnToStudent}
            className="inline-flex items-center gap-2 text-sm font-bold text-theme-text/80 hover:text-theme-primary transition"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Student Examination Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

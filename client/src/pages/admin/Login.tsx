import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('admin@tcs.com');
  const [password, setPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSession, setKeepSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await login({ email, password });
      if (user.role === 'admin') {
        navigate('/admin/exams');
      } else {
        setError('Unauthorized: Admin access required.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid administrator credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('admin@tcs.com');
    setPassword('Password@123');
  };

  return (
    <div className="bg-surface-canvas text-text-primary min-h-screen flex flex-col font-body-default antialiased">
      {/* Header */}
      <header className="h-16 bg-surface-card border-b border-border-rule flex items-center justify-between px-6 shrink-0">
        <div className="font-semibold text-base text-text-primary font-headline-md">TCS Assessment Admin</div>
        <Link to="/candidate/login" className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          Candidate Portal
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-surface-card border border-border-rule rounded p-8 shadow-sm">
          <div className="text-xs font-semibold tracking-wider text-text-muted uppercase mb-1">ADMINISTRATOR PORTAL</div>
          <h1 className="text-2xl font-semibold text-text-primary mb-5 font-headline-lg">Admin Sign In</h1>
          
          <div className="bg-surface-canvas border border-border-rule p-3.5 mb-6 text-xs text-slate-600 rounded">
            Notice: Access is strictly restricted to authorized TCS assessment evaluators and administrators. Self-registration is disabled; accounts are centrally provisioned.
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tcs.com"
                className="w-full bg-surface-card border border-border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-text-primary"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-text-primary">Password</label>
                <button
                  type="button"
                  onClick={handleDemoFill}
                  className="text-xs text-primary hover:underline"
                >
                  Quick Demo Fill
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-card border border-border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-text-primary font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-start pt-2">
              <input
                id="keep-session"
                type="checkbox"
                checked={keepSession}
                onChange={(e) => setKeepSession(e.target.checked)}
                className="mt-0.5 border-border-rule rounded text-primary-container focus:ring-primary-container bg-surface-card w-4 h-4 cursor-pointer"
              />
              <label htmlFor="keep-session" className="ml-2 text-xs text-text-muted cursor-pointer">
                Keep administrative session active for 8 hours
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-container hover:bg-[#172554] active:bg-[#0F172A] text-on-primary font-medium py-2.5 rounded transition-colors text-sm mt-6 disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Admin Portal'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border-rule text-center">
            <span className="text-xs text-text-muted">Candidate assessment taker? </span>
            <Link to="/candidate/login" className="text-xs text-primary-container hover:underline font-medium">
              Return to Candidate Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 bg-surface-card border-t border-border-rule flex items-center justify-center shrink-0">
        <span className="text-xs text-text-muted">TCS Assessment Platform</span>
      </footer>
    </div>
  );
};



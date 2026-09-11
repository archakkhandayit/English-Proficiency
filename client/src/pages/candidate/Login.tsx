import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const CandidateLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      if (user.role === 'candidate') {
        navigate('/candidate/dashboard');
      } else {
        navigate('/admin/exams');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-surface-canvas min-h-screen flex flex-col font-body-default text-text-primary antialiased">
      {/* Top AppBar (Navigation Suppressed as per Intent Fallback Rules for Login) */}
      <header className="bg-surface-card border-b border-border-rule flex justify-between items-center h-[64px] px-unit-6 w-full shrink-0">
        <div className="font-headline-md text-headline-md font-semibold text-primary">TCS Assessment Platform</div>
        <div className="font-label-prominent text-label-prominent text-text-muted">Candidate Portal</div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 py-12">
        {/* Login Card */}
        <div className="w-full max-w-[440px] bg-surface-card border border-border-rule p-8 rounded-lg shadow-sm">
          <div className="mb-4">
            <p className="font-label-default text-label-default uppercase text-text-muted mb-2 tracking-wide">CANDIDATE SIGN IN</p>
            <h1 className="font-headline-lg text-headline-lg text-text-primary mb-2">Welcome back</h1>
            {/* <p className="font-body-compact text-body-compact text-text-muted">Enter your credentials.</p> */}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label className="block font-label-prominent text-label-prominent text-text-primary mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2 bg-surface-card border border-border-rule rounded outline-none focus:border-primary focus:ring-1 focus:ring-primary text-text-primary font-body-compact"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block font-label-prominent text-label-prominent text-text-primary" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-surface-card border border-border-rule rounded outline-none focus:border-primary focus:ring-1 focus:ring-primary text-text-primary font-body-compact"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-text-primary focus:outline-none"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-border-rule rounded text-primary focus:ring-primary bg-surface-card cursor-pointer"
              />
              <label htmlFor="remember" className="ml-2 block font-body-compact text-body-compact text-text-primary cursor-pointer">
                Remember this device for 30 days
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-container text-on-primary py-2.5 rounded font-label-prominent text-label-prominent hover:bg-[#172554] active:bg-[#0F172A] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Card Footer */}
          <div className="mt-6 text-center font-body-compact text-body-compact text-text-muted pt-4 border-t border-border-rule">
            Don't have an account?{' '}
            <Link to="/candidate/register" className="text-primary hover:underline font-medium">
              Create an account
            </Link>
          </div>
        </div>

        {/* Below Card Links */}
        <div className="mt-6 text-center">
          <Link to="/admin/login" className="font-label-default text-label-default text-text-muted hover:text-text-primary transition-colors">
            Admin Portal →
          </Link>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="bg-surface-canvas border-t border-border-rule py-4 px-6 w-full shrink-0 text-center">
        <p className="font-label-default text-label-default text-text-muted">© 2024 TCS iON. All rights reserved.</p>
      </footer>
    </div>
  );
};



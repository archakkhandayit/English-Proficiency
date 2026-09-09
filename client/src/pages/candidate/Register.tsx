import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const CandidateRegister: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!termsAcknowledged) {
      setError('You must accept the Examination Terms & Integrity Guidelines.');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name,
        email,
        password,
        terms_acknowledged: termsAcknowledged,
      });
      navigate('/candidate/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details?.terms_acknowledged?.[0] ||
          'Failed to register candidate account.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface-canvas min-h-screen flex flex-col font-body-default text-text-primary antialiased">
      {/* TopAppBar (Suppressed navigation, transactional header) */}
      <header className="bg-white border-b border-border-rule flex justify-between items-center w-full px-unit-6 h-unit-16 shrink-0">
        <div className="text-text-primary font-semibold text-base font-headline-md tracking-tight">
          TCS Assessment Platform
        </div>
        <div className="text-text-muted text-xs font-label-default">
          Candidate Registration
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-grow flex items-center justify-center p-unit-6">
        {/* Registration Card */}
        <div className="w-full max-w-[480px] bg-surface-card border border-border-rule rounded-[4px] p-unit-8 shadow-sm">
          {/* Header Area */}
          <div className="mb-unit-6">
            <p className="text-text-muted text-xs font-semibold tracking-wider uppercase mb-1">CANDIDATE REGISTRATION</p>
            <h1 className="text-text-primary text-2xl font-semibold mb-1.5">Create Candidate Account</h1>
            <p className="text-text-muted text-sm leading-relaxed">Register with your legal name and email to access scheduled assessments and official evaluations.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Registration Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Full Legal Name */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary" htmlFor="fullName">
                Full Legal Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-unit-4 py-unit-3 bg-surface-card border border-border-rule rounded-[4px] text-text-primary focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors placeholder:text-text-muted text-sm"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-unit-4 py-unit-3 bg-surface-card border border-border-rule rounded-[4px] text-text-primary focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors placeholder:text-text-muted text-sm"
              />
            </div>

            {/* Create Password */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary" htmlFor="password">
                Create Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-unit-4 py-unit-3 bg-surface-card border border-border-rule rounded-[4px] text-text-primary focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors placeholder:text-text-muted text-sm"
              />
              <p className="text-xs text-text-muted mt-1">Minimum 6 characters with at least 1 number or special character</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-unit-4 py-unit-3 bg-surface-card border border-border-rule rounded-[4px] text-text-primary focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-colors placeholder:text-text-muted text-sm"
              />
            </div>

            {/* Integrity Pledge */}
            <div className="flex items-start gap-3 pt-2">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={termsAcknowledged}
                  onChange={(e) => setTermsAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded-[2px] border-border-rule text-primary-container focus:ring-secondary-container cursor-pointer"
                />
              </div>
              <div className="text-sm">
                <label className="font-medium text-text-primary cursor-pointer" htmlFor="terms">
                  I agree to the <span className="text-primary-container hover:underline font-medium">Examination Terms</span> & <span className="text-primary-container hover:underline font-medium">Integrity Guidelines</span>.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-unit-3 px-unit-4 border border-transparent rounded-[4px] shadow-sm text-sm font-medium text-white bg-primary-container hover:bg-[#172554] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-colors duration-100 disabled:opacity-50"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          {/* Switcher */}
          <div className="mt-unit-6 text-center">
            <p className="text-sm text-text-muted">
              Already have an account?{' '}
              <Link to="/candidate/login" className="font-medium text-primary-container hover:text-[#172554] hover:underline transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Pinned Footer */}
      <footer className="bg-white border-t border-border-rule py-unit-4 w-full shrink-0 flex justify-center items-center">
        <p className="text-text-muted text-xs font-body-compact text-center w-full">
          TCS Assessment Platform
        </p>
      </footer>
    </div>
  );
};


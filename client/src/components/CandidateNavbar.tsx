import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface CandidateNavbarProps {
  sectionTitle?: string;
  timerNode?: React.ReactNode;
  showLogout?: boolean;
}

export const CandidateNavbar: React.FC<CandidateNavbarProps> = ({
  sectionTitle,
  timerNode,
  showLogout = false,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAttemptsActive = location.pathname.startsWith('/candidate/attempts');
  const isExamsActive = location.pathname === '/candidate/dashboard' || (!isAttemptsActive && location.pathname.startsWith('/candidate/exams'));

  return (
    <header className="sticky top-0 left-0 right-0 w-full z-50 bg-surface-card border-b border-border-rule select-none">
      <div className="h-16 w-full max-w-candidate-max-width mx-auto px-unit-6 flex items-center justify-between">
        {/* Assessment title and optional nav links */}
        <div className="flex items-center space-x-unit-6 h-full min-w-0">
          <span className="font-headline-md text-headline-md font-semibold text-text-primary truncate">
            Aptivo — English Assessment
          </span>
          {sectionTitle && (
            <span className="hidden md:inline-block text-xs font-medium text-text-muted border-l border-border-rule pl-unit-3">
              {sectionTitle}
            </span>
          )}

          {/* Navigation Links for Candidate Portal (when outside active exam timer) */}
          {!timerNode && (
            <nav className="flex h-full space-x-unit-2 ml-unit-4">
              <Link
                to="/candidate/dashboard"
                className={`h-full flex items-center px-unit-4 font-label-prominent text-label-prominent transition-all ${
                  isExamsActive
                    ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Available Assessments
              </Link>
              <Link
                to="/candidate/attempts"
                className={`h-full flex items-center px-unit-4 font-label-prominent text-label-prominent transition-all ${
                  isAttemptsActive
                    ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                My Attempts
              </Link>
            </nav>
          )}
        </div>

        {/* Candidate Identifier & Timer / Actions */}
        <div className="flex items-center gap-unit-6">
          <div className="flex items-center gap-unit-4 font-label-mono text-label-mono text-text-primary tabular-nums">
            {timerNode}
          </div>

          {user && !timerNode && (
            <span className="font-label-prominent text-label-prominent text-text-primary hidden sm:inline">
              {user.name || user.email}
            </span>
          )}

          {showLogout && (
            <button
              onClick={() => logout()}
              className="font-label-prominent text-label-prominent text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
};



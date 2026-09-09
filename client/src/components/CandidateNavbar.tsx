import React from 'react';
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

  return (
    <header className="sticky top-0 left-0 right-0 w-full z-50 bg-surface-card border-b border-border-rule">
      <div className="h-16 w-full max-w-candidate-max-width mx-auto px-unit-6 flex items-center justify-between">
        {/* Assessment title and optional section */}
        <div className="flex items-center gap-unit-4 min-w-0">
          <span className="font-headline-md text-headline-md font-semibold text-text-primary truncate">
            TCS NQT — English Assessment
          </span>
          {sectionTitle && (
            <span className="hidden md:inline-block text-xs font-medium text-text-muted border-l border-border-rule pl-unit-3">
              {sectionTitle}
            </span>
          )}
        </div>

        {/* Candidate Identifier & Timer / Actions */}
        <div className="flex items-center gap-unit-6">
          <div className="flex items-center gap-unit-4 font-label-mono text-label-mono text-text-primary tabular-nums">
            <span className="text-text-muted hidden sm:inline">
              NQT-{(user?.id || '8849201').replace(/-/g, '').slice(0, 7).toUpperCase()}
            </span>
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



import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isExamsActive = location.pathname.startsWith('/admin/exams');
  const isAttemptsActive = location.pathname.startsWith('/admin/attempts');

  return (
    <header className="bg-surface-card h-16 w-full sticky top-0 border-b border-border-rule z-50 flex justify-between items-center transition-colors duration-100">
      <div className="max-w-candidate-max-width mx-auto w-full flex items-center justify-between h-full px-6">
        <div className="flex items-center space-x-unit-6 h-full">
          <span className="font-headline-md text-headline-md font-semibold text-text-primary">
            Aptivo Assessment Admin
          </span>
          <nav className="flex h-full space-x-unit-2 ml-unit-8">
            <Link
              to="/admin/exams"
              className={`h-full flex items-center px-unit-4 font-label-prominent text-label-prominent transition-all ${
                isExamsActive
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Exams
            </Link>
            <Link
              to="/admin/attempts"
              className={`h-full flex items-center px-unit-4 font-label-prominent text-label-prominent transition-all ${
                isAttemptsActive
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Candidate Attempts
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-unit-4">
          <span className="text-text-primary font-body-compact text-body-compact">
            {user?.email || 'admin@aptivo.com'}
          </span>
          <button
            onClick={() => logout()}
            className="text-text-primary font-label-prominent text-label-prominent hover:text-timer-critical transition-colors duration-100 flex items-center cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export const AdminFooter: React.FC = () => {
  return (
    <footer className="w-full bg-surface-card border-t border-border-rule py-6 px-6 mt-auto flex justify-center items-center">
      <span className="font-body-compact text-body-compact text-text-muted">
        Aptivo Assessment Platform
      </span>
    </footer>
  );
};

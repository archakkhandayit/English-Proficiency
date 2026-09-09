import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const CandidateRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas-base flex items-center justify-center">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-muted text-sm">Loading assessment portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/candidate/login" replace />;
  }

  if (user.role !== 'candidate') {
    return <Navigate to="/admin/exams" replace />;
  }

  return <Outlet />;
};

export const AdminRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas-base flex items-center justify-center">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-muted text-sm">Loading administrator console...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/candidate/dashboard" replace />;
  }

  return <Outlet />;
};

export const GuestRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/exams" replace />;
    }
    return <Navigate to="/candidate/dashboard" replace />;
  }

  return <Outlet />;
};

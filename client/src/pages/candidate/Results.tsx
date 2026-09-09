import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Scorecard } from '../../components/Scorecard';
import type { AttemptScorecard } from '@nqt/shared';

export const Results: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [scorecard, setScorecard] = useState<AttemptScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchScorecard = async () => {
      setLoading(true);
      setError(null);
      try {
        let scData: AttemptScorecard | null = null;
        // 1. Try fetching directly as attempt ID
        try {
          const res = await api.get<AttemptScorecard>(
            `/candidate/attempts/${examId}/scorecard`
          );
          scData = res.data;
        } catch {
          // 2. If not an attempt ID, fetch as exam ID
          const res = await api.get<AttemptScorecard>(
            `/candidate/exams/${examId}/scorecard`
          );
          scData = res.data;
        }

        if (isMounted) {
          setScorecard(scData);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch scorecard', err);
          setError(
            err.response?.data?.error ||
              'Scorecard is not ready yet. Please wait a moment while evaluation completes.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchScorecard();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  if (loading) {
    return (
      <div className="bg-canvas text-primaryText font-sans min-h-screen flex flex-col antialiased">
        <header className="bg-card border-b border-borderRule sticky top-0 z-40">
          <div className="max-w-[1040px] mx-auto px-6 h-16 flex justify-between items-center">
            <div className="font-semibold text-primaryText text-base">
              TCS NQT — English Assessment
            </div>
            <div className="text-sm font-medium text-primaryText">
              {user?.name || user?.email || 'Rahul Sharma'}
            </div>
          </div>
        </header>
        <main className="flex-grow flex items-center justify-center p-8">
          <div className="text-mutedText text-sm">Loading certified scorecard...</div>
        </main>
        <footer className="bg-card border-t border-borderRule py-6 text-center text-xs text-mutedText mt-auto">
          TCS Assessment Platform · Certified Automated AI Grading System
        </footer>
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="bg-canvas text-primaryText font-sans min-h-screen flex flex-col antialiased">
        <header className="bg-card border-b border-borderRule sticky top-0 z-40">
          <div className="max-w-[1040px] mx-auto px-6 h-16 flex justify-between items-center">
            <div className="font-semibold text-primaryText text-base">
              TCS NQT — English Assessment
            </div>
            <div className="text-sm font-medium text-primaryText">
              {user?.name || user?.email || 'Rahul Sharma'}
            </div>
          </div>
        </header>
        <main className="max-w-[1040px] mx-auto px-6 py-12 w-full flex-grow flex items-center justify-center">
          <div className="bg-card border border-borderRule rounded p-8 text-center max-w-md w-full space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-warning border border-amber-200 mx-auto">
              <span className="material-symbols-outlined text-[24px]">hourglass_top</span>
            </div>
            <h2 className="text-base font-semibold text-primaryText">Evaluation in Progress</h2>
            <p className="text-xs text-mutedText">{error}</p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => navigate(`/candidate/exams/${examId}/wait`)}
                className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded hover:bg-navy-hover transition-colors cursor-pointer"
              >
                Track Evaluation Status
              </button>
            </div>
          </div>
        </main>
        <footer className="bg-card border-t border-borderRule py-6 text-center text-xs text-mutedText mt-auto">
          TCS Assessment Platform · Certified Automated AI Grading System
        </footer>
      </div>
    );
  }

  const candidateDisplayName = user?.name || scorecard.candidate_name || 'Rahul Sharma';

  return (
    <div className="bg-canvas text-primaryText font-sans min-h-screen flex flex-col antialiased selection:bg-navy selection:text-white">
      {/* Candidate Navbar from candidate-scorecard.html */}
      <header className="bg-card border-b border-borderRule sticky top-0 z-40 print:hidden">
        <div className="max-w-[1040px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="font-semibold text-primaryText text-base">
            TCS NQT — English Assessment
          </div>
          <div className="text-sm font-medium text-primaryText">
            {candidateDisplayName}
          </div>
        </div>
      </header>

      {/* Main Scorecard Container */}
      <main className="flex-grow max-w-[1040px] mx-auto w-full px-6 py-8 space-y-6">
        {/* Context Back Link */}
        <div className="print:hidden">
          <Link
            to="/candidate/dashboard"
            className="text-sm font-medium text-mutedText hover:text-primaryText inline-flex items-center transition-colors"
          >
            ← Back to Assessments
          </Link>
        </div>

        {/* Scorecard Component */}
        <Scorecard
          scorecard={scorecard}
          candidateName={candidateDisplayName}
          examTitle={scorecard.exam_title}
          isAdminView={false}
        />

        {/* Bottom Action Button from candidate-scorecard.html */}
        <div className="pt-4 pb-8 flex justify-start print:hidden">
          <Link
            to="/candidate/dashboard"
            className="px-6 py-2.5 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded transition-colors inline-block cursor-pointer"
          >
            Return to Assessments
          </Link>
        </div>
      </main>

      {/* Clean Footer from candidate-scorecard.html */}
      <footer className="bg-card border-t border-borderRule py-6 text-center text-xs text-mutedText mt-auto print:hidden">
        TCS Assessment Platform · Certified Automated AI Grading System
      </footer>
    </div>
  );
};

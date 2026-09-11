import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { AttemptStatus } from '@nqt/shared';

interface CandidateAttemptItem {
  id: string;
  examId: string;
  examTitle: string;
  examDescription: string | null;
  examVersion: number;
  status: AttemptStatus;
  currentSection: number;
  startedAt: string;
  submittedAt: string | null;
  evaluatedAt: string | null;
  errorMessage: string | null;
  scorecard: {
    compositeScore: string;
    proficiencyBand: string;
    benchmarkMet: boolean;
  } | null;
}

export const CandidateAttempts: React.FC = () => {
  const [attempts, setAttempts] = useState<CandidateAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchAttempts = async () => {
    try {
      const res = await api.get<CandidateAttemptItem[]>('/candidate/attempts');
      setAttempts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load attempt history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleAction = (attempt: CandidateAttemptItem) => {
    const { status, currentSection, examId } = attempt;

    if (status === 'evaluated') {
      navigate(`/candidate/exams/${examId}/results`);
      return;
    }

    if (status === 'submitted' || status === 'evaluating') {
      navigate(`/candidate/exams/${examId}/wait`);
      return;
    }

    // In-progress: route to appropriate active section
    if (currentSection === 1) {
      navigate(`/candidate/exams/${examId}/section1`);
    } else if (currentSection === 2 || currentSection === 3) {
      navigate(`/candidate/exams/${examId}/section2`);
    } else if (currentSection === 4) {
      navigate(`/candidate/exams/${examId}/section3`);
    } else {
      navigate(`/candidate/exams/${examId}/section1`);
    }
  };

  return (
    <div className="bg-surface-canvas text-text-primary min-h-screen flex flex-col font-body-default text-body-default antialiased">
      <CandidateNavbar showLogout />

      {/* Main Workspace */}
      <main className="flex-grow w-full max-w-[800px] mx-auto py-unit-12 px-unit-6">
        {/* Page Header */}
        <div className="mb-unit-10">
          <h1 className="font-headline-lg text-headline-lg text-text-primary mb-unit-2">My Attempts</h1>
          <p className="font-body-reading text-body-reading text-text-muted">
            Review your previous assessment history, evaluation status, and AI scorecards.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-xs text-text-muted">Loading your attempt history...</p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="bg-surface-card border border-border-rule rounded p-8 text-center shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">No Attempts Found</h3>
            <p className="text-xs text-text-muted mt-1">You have not completed or started any assessments yet.</p>
            <div className="mt-4">
              <button
                onClick={() => navigate('/candidate/dashboard')}
                className="bg-primary-container text-white px-5 py-2.5 rounded font-label-prominent text-label-prominent hover:bg-[#172554] transition-colors cursor-pointer"
              >
                Browse Available Assessments
              </button>
            </div>
          </div>
        ) : (
          /* Recent Attempts Table â€” Taken directly from previous attempts UI */
          <div className="bg-surface-card border border-border-rule rounded overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-canvas border-b border-border-rule font-label-prominent text-label-prominent text-text-muted">
                  <th className="p-unit-4 font-normal">Assessment</th>
                  <th className="p-unit-4 font-normal">Date</th>
                  <th className="p-unit-4 font-normal">Status</th>
                  <th className="p-unit-4 font-normal text-right">AI Score</th>
                  <th className="p-unit-4 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-body-default text-body-default text-text-primary">
                {attempts.map((attempt) => {
                  const isEvaluated = attempt.status === 'evaluated';
                  const isEvaluating = attempt.status === 'submitted' || attempt.status === 'evaluating';
                  const isInProgress = attempt.status === 'in_progress';

                  return (
                    <tr key={attempt.id} className="border-b border-border-rule hover:bg-surface-canvas transition-colors">
                      <td className="p-unit-4 font-medium">
                        <div>{attempt.examTitle}</div>
                        {attempt.scorecard?.proficiencyBand && (
                          <div className="text-xs text-text-muted font-normal mt-0.5">
                            Band: <span className="text-text-primary font-medium">{attempt.scorecard.proficiencyBand}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-unit-4 font-label-mono text-label-mono text-text-muted">
                        {new Date(attempt.startedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-unit-4">
                        <span className="inline-flex items-center gap-unit-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isEvaluated
                                ? 'bg-state-success'
                                : isEvaluating
                                ? 'bg-timer-warning'
                                : 'bg-primary-container'
                            }`}
                          />
                          <span className="text-xs">
                            {isEvaluated
                              ? 'Evaluated'
                              : isEvaluating
                              ? 'In Evaluation'
                              : isInProgress
                              ? 'In Progress'
                              : attempt.status}
                          </span>
                        </span>
                      </td>
                      <td className="p-unit-4 font-label-mono text-label-mono text-right">
                        {attempt.scorecard
                          ? `${Number(attempt.scorecard.compositeScore).toFixed(1)}/100`
                          : '--/100'}
                      </td>
                      <td className="p-unit-4 text-right">
                        <button
                          onClick={() => handleAction(attempt)}
                          className="text-primary-container hover:text-[#172554] font-label-prominent text-label-prominent transition-colors cursor-pointer"
                        >
                          {isEvaluated
                            ? 'View Scorecard'
                            : isEvaluating
                            ? 'Check Status'
                            : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-surface-canvas border-t border-border-rule mt-auto">
        <div className="flex justify-between items-center py-unit-4 px-unit-6 w-full max-w-candidate-max-width mx-auto">
          <div className="font-label-default text-label-default text-text-muted">
            Â© 2024 TCS iON. All rights reserved.
          </div>
          <div className="font-label-default text-label-default text-text-muted text-center flex-grow">
            TCS Assessment Platform
          </div>
          <div className="flex gap-4 font-label-default text-label-default">
            <span className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">Help Desk</span>
            <span className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">Terms of Service</span>
            <span className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
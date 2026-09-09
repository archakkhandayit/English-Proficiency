import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { AttemptStatus } from '@nqt/shared';

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  attempt?: {
    id: string;
    status: AttemptStatus;
    currentSection: number;
    startedAt: string;
    submittedAt: string | null;
    evaluatedAt: string | null;
  } | null;
  scorecard?: {
    compositeScore: string;
    proficiencyBand: string;
    benchmarkMet: boolean;
  } | null;
}

export const CandidateDashboard: React.FC = () => {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchExams = async () => {
    try {
      const res = await api.get<ExamItem[]>('/candidate/exams');
      setExams(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleAction = (exam: ExamItem) => {
    if (!exam.attempt) {
      navigate(`/candidate/exams/${exam.id}/instructions`);
      return;
    }

    const { status, currentSection } = exam.attempt;

    if (status === 'evaluated') {
      navigate(`/candidate/exams/${exam.id}/results`);
      return;
    }

    if (status === 'submitted' || status === 'evaluating') {
      navigate(`/candidate/exams/${exam.id}/wait`);
      return;
    }

    // In-progress: route to appropriate active section
    if (currentSection === 1) {
      navigate(`/candidate/exams/${exam.id}/section1`);
    } else if (currentSection === 2) {
      navigate(`/candidate/exams/${exam.id}/section2/read?passage=1`);
    } else if (currentSection === 3) {
      navigate(`/candidate/exams/${exam.id}/section3`);
    } else {
      navigate(`/candidate/exams/${exam.id}/section1`);
    }
  };

  const completedAttempts = exams.filter((e) => e.attempt);

  return (
    <div className="bg-surface-canvas text-text-primary min-h-screen flex flex-col font-body-default text-body-default antialiased">
      <CandidateNavbar showLogout />

      {/* Main Workspace */}
      <main className="flex-grow w-full max-w-[800px] mx-auto py-unit-12 px-unit-6">
        {/* Page Header */}
        <div className="mb-unit-10">
          <h1 className="font-headline-lg text-headline-lg text-text-primary mb-unit-2">Available Assessments</h1>
          <p className="font-body-reading text-body-reading text-text-muted">Select an assessment below to review instructions and start.</p>
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
            <p className="text-xs text-text-muted">Loading your assigned assessments...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-surface-card border border-border-rule rounded p-8 text-center shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">No Active Assessments</h3>
            <p className="text-xs text-text-muted mt-1">There are currently no active NQT English assessments assigned to your account.</p>
          </div>
        ) : (
          /* Active Exams List */
          <div className="space-y-unit-4 mb-unit-12">
            {exams.map((exam) => {
              const attempt = exam.attempt;
              const isEvaluated = attempt?.status === 'evaluated';
              const isEvaluating = attempt?.status === 'submitted' || attempt?.status === 'evaluating';
              const isInProgress = attempt?.status === 'in_progress';

              return (
                <div
                  key={exam.id}
                  className="bg-surface-card border border-border-rule rounded p-unit-6 hover:bg-surface-canvas transition-colors duration-100 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-unit-4">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-text-primary mb-unit-2">{exam.title}</h2>
                      <p className="font-body-default text-body-default text-text-muted">
                        {exam.description || 'Comprehensive evaluation covering Sentence Completion, Passage Recall, and Professional Email Writing.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-unit-6 pt-unit-4 border-t border-border-rule">
                    <div className="flex gap-unit-6 text-text-muted font-label-default text-label-default">
                      <span className="flex items-center gap-unit-2">
                        <span className="material-symbols-outlined text-[16px]">segment</span>
                        3 Sections
                      </span>
                      <span className="flex items-center gap-unit-2">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        25 Minutes Total
                      </span>
                    </div>
                    <button
                      onClick={() => handleAction(exam)}
                      className="bg-primary-container text-on-primary border border-primary-container hover:bg-[#172554] active:bg-text-primary px-unit-5 py-[10px] rounded font-label-prominent text-label-prominent transition-colors cursor-pointer"
                    >
                      {isEvaluated
                        ? 'View Scorecard'
                        : isEvaluating
                        ? 'Evaluation Status'
                        : isInProgress
                        ? 'Resume Assessment'
                        : 'Start Assessment'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Attempts Table */}
        {completedAttempts.length > 0 && (
          <div>
            <h2 className="font-headline-md text-headline-md text-text-primary mb-unit-4">Previous Attempts</h2>
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
                  {completedAttempts.map((exam) => {
                    const attempt = exam.attempt!;
                    const isEvaluated = attempt.status === 'evaluated';
                    const isEvaluating = attempt.status === 'submitted' || attempt.status === 'evaluating';

                    return (
                      <tr key={attempt.id} className="border-b border-border-rule hover:bg-surface-canvas transition-colors">
                        <td className="p-unit-4 font-medium">{exam.title}</td>
                        <td className="p-unit-4 font-label-mono text-label-mono text-text-muted">
                          {new Date(attempt.startedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="p-unit-4">
                          <span className="inline-flex items-center gap-unit-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isEvaluated ? 'bg-state-success' : isEvaluating ? 'bg-timer-warning' : 'bg-secondary'
                              }`}
                            />
                            {isEvaluated ? 'Evaluated' : isEvaluating ? 'In Evaluation' : 'In Progress'}
                          </span>
                        </td>
                        <td className="p-unit-4 font-label-mono text-label-mono text-right">
                          {exam.scorecard ? `${Number(exam.scorecard.compositeScore).toFixed(1)}/100` : '--/100'}
                        </td>
                        <td className="p-unit-4 text-right">
                          <button
                            onClick={() => handleAction(exam)}
                            className="text-primary-container hover:text-text-primary font-label-prominent text-label-prominent transition-colors cursor-pointer"
                          >
                            {isEvaluated ? 'View Feedback' : 'Resume'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-surface-canvas border-t border-border-rule mt-auto">
        <div className="flex justify-between items-center py-unit-4 px-unit-6 w-full max-w-candidate-max-width mx-auto">
          <div className="font-label-default text-label-default text-text-muted">
            © 2024 TCS iON. All rights reserved.
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


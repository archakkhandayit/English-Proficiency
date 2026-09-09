import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/axios';
import { AdminNavbar, AdminFooter } from '../../components/AdminNavbar';
import type { AttemptStatus } from '@nqt/shared';

interface AdminAttemptItem {
  id: string;
  candidateId: string;
  examId: string;
  status: AttemptStatus;
  currentSection: number;
  startedAt: string;
  submittedAt: string | null;
  evaluatedAt: string | null;
  errorMessage: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  examTitle: string | null;
  scorecard?: {
    compositeScore: string;
    proficiencyBand: string;
    benchmarkMet: boolean;
  } | null;
}

export const AttemptsList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get('examId');

  const [attempts, setAttempts] = useState<AdminAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'evaluated' | 'submitted' | 'in_progress'>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const fetchAttempts = async () => {
    try {
      const res = await api.get<AdminAttemptItem[]>('/admin/attempts');
      setAttempts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load attempt logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleTriggerEvaluation = async (id: string) => {
    setEvaluatingId(id);
    try {
      await api.post(`/admin/attempts/${id}/evaluate`);
      await fetchAttempts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger evaluation.');
    } finally {
      setEvaluatingId(null);
    }
  };

  const uniqueExams = Array.from(
    new Set(attempts.map((a) => a.examTitle).filter(Boolean))
  ) as string[];

  const filteredAttempts = attempts.filter((att) => {
    if (examIdParam && att.examId !== examIdParam) {
      return false;
    }
    if (selectedExam !== 'all' && att.examTitle !== selectedExam) {
      return false;
    }
    if (statusFilter === 'evaluated' && att.status !== 'evaluated') {
      return false;
    }
    if (
      statusFilter === 'submitted' &&
      att.status !== 'submitted' &&
      att.status !== 'evaluating'
    ) {
      return false;
    }
    if (statusFilter === 'in_progress' && att.status !== 'in_progress') {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = (att.candidateName || '').toLowerCase().includes(q);
      const matchEmail = (att.candidateEmail || '').toLowerCase().includes(q);
      const matchExam = (att.examTitle || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchExam) return false;
    }
    return true;
  });

  return (
    <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
      <AdminNavbar />

      <main className="max-w-candidate-max-width mx-auto px-unit-8 py-unit-8 space-y-unit-6 flex-grow w-full">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="font-headline-lg text-headline-lg text-text-primary">Candidate Attempts</h1>
          <p className="font-body-default text-body-default text-text-muted">
            Track submitted assessments and review automated AI evaluations.
          </p>
        </header>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-surface-card border border-border-rule rounded p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by candidate name or email..."
                className="w-full pl-9 pr-3 py-2 bg-surface-card border border-border-rule rounded text-body-default focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none transition-colors"
              />
            </div>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full sm:w-auto bg-surface-card border border-border-rule rounded py-2 pl-3 pr-8 text-body-default focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
            >
              <option value="all">Exam: All</option>
              {uniqueExams.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-6 border-b border-border-rule overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`pb-2 font-label-prominent text-label-prominent transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'border-b-2 border-primary text-text-primary font-semibold'
                  : 'border-b-2 border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              All ({attempts.length})
            </button>
            <button
              onClick={() => setStatusFilter('evaluated')}
              className={`pb-2 font-label-prominent text-label-prominent transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'evaluated'
                  ? 'border-b-2 border-primary text-text-primary font-semibold'
                  : 'border-b-2 border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              Evaluated ({attempts.filter((a) => a.status === 'evaluated').length})
            </button>
            <button
              onClick={() => setStatusFilter('submitted')}
              className={`pb-2 font-label-prominent text-label-prominent transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'submitted'
                  ? 'border-b-2 border-primary text-text-primary font-semibold'
                  : 'border-b-2 border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              Submitted ({attempts.filter((a) => a.status === 'submitted' || a.status === 'evaluating').length})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`pb-2 font-label-prominent text-label-prominent transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'in_progress'
                  ? 'border-b-2 border-primary text-text-primary font-semibold'
                  : 'border-b-2 border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              In Progress ({attempts.filter((a) => a.status === 'in_progress').length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-card border border-border-rule rounded overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-muted font-body-default">
              Loading candidate attempt records...
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="p-12 text-center text-text-muted font-body-default">
              No matching candidate attempts found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-canvas border-b border-border-rule font-label-prominent text-label-prominent text-text-muted">
                <tr>
                  <th className="py-3 px-4 font-semibold">Candidate</th>
                  <th className="py-3 px-4 font-semibold">Exam Title</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Submitted At</th>
                  <th className="py-3 px-4 font-semibold text-right">AI Score</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-default text-body-default divide-y divide-border-rule">
                {filteredAttempts.map((att) => {
                  const scoreDisplay = att.scorecard
                    ? `${Number(att.scorecard.compositeScore).toFixed(0)} / 100`
                    : null;

                  return (
                    <tr
                      key={att.id}
                      className="hover:bg-surface-canvas transition-colors h-[44px]"
                    >
                      <td className="py-2 px-4">
                        <div className="font-medium text-text-primary">
                          {att.candidateName || 'Unnamed Candidate'}
                        </div>
                        <div className="text-text-muted text-[13px]">
                          {att.candidateEmail}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-text-primary font-medium">
                        {att.examTitle}
                      </td>
                      <td className="py-2 px-4">
                        {att.status === 'evaluated' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]">
                            Evaluated
                          </span>
                        ) : att.status === 'submitted' || att.status === 'evaluating' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FFFBEB] text-[#B45309] border border-[#D97706]">
                            {att.status === 'evaluating' ? 'Evaluating' : 'Submitted'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-canvas text-text-muted border border-border-rule">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-label-mono text-label-mono tabular-nums text-text-primary">
                        {att.submittedAt
                          ? new Date(att.submittedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-label-mono text-label-mono tabular-nums text-text-primary">
                        {scoreDisplay || (att.status === 'in_progress' ? '—' : 'Pending')}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        {att.status === 'evaluated' && (
                          <Link
                            to={`/admin/attempts/${att.id}`}
                            className="inline-block bg-surface-card border border-border-rule text-primary-container px-3 py-1.5 rounded hover:bg-surface-canvas hover:border-primary-container transition-colors text-sm font-medium cursor-pointer"
                          >
                            Review Evaluation
                          </Link>
                        )}
                        {(att.status === 'submitted' || att.status === 'evaluating') && (
                          <button
                            onClick={() => handleTriggerEvaluation(att.id)}
                            disabled={evaluatingId === att.id || att.status === 'evaluating'}
                            className="bg-primary-container text-on-primary px-3 py-1.5 rounded hover:bg-[#172554] transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
                          >
                            {evaluatingId === att.id ? 'Queuing...' : 'Trigger Evaluation'}
                          </button>
                        )}
                        {att.status === 'in_progress' && (
                          <Link
                            to={`/admin/attempts/${att.id}`}
                            className="text-primary-container hover:underline px-3 py-1.5 text-sm font-medium"
                          >
                            View Progress
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between py-2">
          <span className="font-body-compact text-body-compact text-text-muted">
            Showing 1 to {filteredAttempts.length} of {attempts.length} attempts
          </span>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1.5 bg-surface-card border border-border-rule rounded text-text-muted cursor-not-allowed font-label-prominent text-label-prominent"
              disabled
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 bg-surface-card border border-border-rule rounded text-text-muted cursor-not-allowed font-label-prominent text-label-prominent"
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </main>

      <AdminFooter />
    </div>
  );
};

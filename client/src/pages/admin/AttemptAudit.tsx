import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { AdminNavbar, AdminFooter } from '../../components/AdminNavbar';
import { Scorecard } from '../../components/Scorecard';
import type { AttemptScorecard, AttemptStatus } from '@nqt/shared';

interface ResponseWithEvaluation {
  response: {
    id: string;
    attemptId: string;
    section: number;
    itemType: string;
    itemId: string;
    answerText: string;
    timeSpentSec: number | null;
    createdAt: string;
  };
  evaluation?: {
    id: string;
    aiVerdict: string;
    score: string;
    maxScore: string;
    aiFeedback: string;
    details: any;
    modelVersion: string;
    evaluatedAt: string;
  } | null;
}

interface AttemptAuditData {
  attempt: {
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
  };
  scorecard: AttemptScorecard | null;
  responses: ResponseWithEvaluation[];
}

export const AttemptAudit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<AttemptAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditData = async () => {
    try {
      const res = await api.get<AttemptAuditData>(`/admin/attempts/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load attempt audit data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [id]);

  const handleRerunEvaluation = async () => {
    setEvaluating(true);
    try {
      await api.post(`/admin/attempts/${id}/evaluate`);
      setTimeout(async () => {
        await fetchAuditData();
        setEvaluating(false);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger re-evaluation.');
      setEvaluating(false);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!data) return;
    const candidateLabel = data.attempt.candidateName || data.attempt.candidateEmail || 'this candidate';
    const confirmMsg = `Are you sure you want to permanently delete the attempt for ${candidateLabel} on "${data.attempt.examTitle}"?\n\nThis will permanently erase all candidate responses, AI evaluations, and the scorecard.`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      await api.delete(`/admin/attempts/${id}`);
      navigate('/admin/attempts');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete attempt.');
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
        <AdminNavbar />
        <main className="flex-grow flex items-center justify-center p-8">
          <div className="text-text-muted font-body-default">Loading attempt audit details...</div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
      <AdminNavbar />

      <main className="flex-grow max-w-[1040px] mx-auto w-full px-6 py-8 space-y-6">
        {/* Context Back Link & Actions */}
        <div className="flex justify-between items-center">
          <Link
            to="/admin/attempts"
            className="text-sm font-medium text-text-muted hover:text-text-primary inline-flex items-center transition-colors"
          >
            ← Back to Candidate Attempts
          </Link>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRerunEvaluation}
              disabled={evaluating || deleting}
              className="bg-primary-container text-on-primary px-4 py-2 rounded text-xs font-semibold hover:bg-[#172554] transition-colors duration-100 disabled:opacity-50 cursor-pointer"
            >
              {evaluating ? 'Re-evaluating...' : 'Re-run AI Evaluation'}
            </button>
            <button
              onClick={handleDeleteAttempt}
              disabled={deleting || evaluating}
              className="border border-rose-300 text-timer-critical hover:bg-rose-50 px-4 py-2 rounded text-xs font-semibold transition-colors duration-100 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete Attempt'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Unified Scorecard Display if evaluated */}
        {data.scorecard ? (
          <Scorecard
            scorecard={data.scorecard}
            candidateName={data.attempt.candidateName || undefined}
            examTitle={data.attempt.examTitle || undefined}
            isAdminView={true}
          />
        ) : (
          <div className="bg-surface-card border border-border-rule rounded p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-canvas text-timer-warning border border-border-rule">
              <span className="material-symbols-outlined text-[24px]">hourglass_top</span>
            </div>
            <h2 className="text-headline-md font-headline-md text-text-primary">
              Attempt Not Yet Evaluated
            </h2>
            <p className="text-text-muted font-body-default max-w-md mx-auto">
              Candidate status is currently <span className="font-semibold text-text-primary uppercase font-mono text-xs">{data.attempt.status}</span>.
              Click "Re-run AI Evaluation" above to trigger automated grading.
            </p>

            {/* In Progress response details summary */}
            <div className="text-left mt-6 pt-6 border-t border-border-rule">
              <h3 className="font-headline-md text-sm font-semibold text-text-primary mb-3">
                Logged Responses ({data.responses.length})
              </h3>
              <div className="space-y-2">
                {data.responses.map((r, i) => (
                  <div key={r.response.id} className="p-3 bg-surface-canvas border border-border-rule rounded text-xs">
                    <span className="font-semibold text-text-primary">
                      Section {r.response.section} · Item #{i + 1}:
                    </span>{' '}
                    <span className="text-text-muted font-mono">{r.response.answerText || '(No answer entered)'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <AdminFooter />
    </div>
  );
};

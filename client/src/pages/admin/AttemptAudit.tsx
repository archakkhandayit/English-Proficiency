import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { AdminNavbar, AdminFooter } from '../../components/AdminNavbar';
import { Scorecard } from '../../components/Scorecard';
import { Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import type { AttemptScorecard, AttemptStatus } from '@aptivo/shared';

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

  // Conditional polling: polls every 2.5s only while evaluation is actively running
  useEffect(() => {
    if (data?.attempt?.status !== 'evaluating' && !evaluating) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get<AttemptAuditData>(`/admin/attempts/${id}`);
        setData(res.data);
        if (res.data.attempt.status === 'evaluated' || res.data.attempt.status === 'evaluation_failed') {
          setEvaluating(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll attempt status', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [id, data?.attempt?.status, evaluating]);

  const handleRerunEvaluation = async () => {
    setEvaluating(true);
    setError(null);
    try {
      await api.post(`/admin/attempts/${id}/evaluate`);
      await fetchAuditData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger evaluation.');
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
          <div className="text-text-muted font-body-default flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary-container" />
            Loading attempt audit details...
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  // Section response groupings for checkpoint inspection
  const s1Responses = data.responses.filter((r) => r.response.section === 1);
  const s2Responses = data.responses.filter((r) => r.response.section === 2);
  const s3Response = data.responses.find((r) => r.response.section === 3);

  const s1DoneCount = s1Responses.filter((r) => r.evaluation !== null && r.evaluation !== undefined).length;
  const s1TotalCount = s1Responses.length;
  const s1IsComplete = s1TotalCount > 0 && s1DoneCount === s1TotalCount;

  const s2DoneCount = s2Responses.filter((r) => r.evaluation !== null && r.evaluation !== undefined).length;
  const s2TotalCount = s2Responses.length;
  const s2IsComplete = s2TotalCount > 0 && s2DoneCount === s2TotalCount;

  const s3IsComplete = s3Response?.evaluation !== null && s3Response?.evaluation !== undefined;
  const isEvaluating = data.attempt.status === 'evaluating' || evaluating;
  const isFailed = data.attempt.status === 'evaluation_failed';

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
              disabled={isEvaluating || deleting}
              className={`px-4 py-2 rounded text-xs font-semibold transition-colors duration-100 disabled:opacity-50 cursor-pointer flex items-center gap-2 ${
                isFailed
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                  : 'bg-primary-container text-on-primary hover:bg-[#172554]'
              }`}
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Evaluating...
                </>
              ) : isFailed ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Evaluation
                </>
              ) : (
                'Re-run AI Evaluation'
              )}
            </button>
            <button
              onClick={handleDeleteAttempt}
              disabled={deleting || isEvaluating}
              className="border border-rose-300 text-timer-critical hover:bg-rose-50 px-4 py-2 rounded text-xs font-semibold transition-colors duration-100 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete Attempt'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2 cursor-pointer">✕</button>
          </div>
        )}

        {/* Unified Scorecard Display if evaluation is completely evaluated */}
        {data.scorecard ? (
          <Scorecard
            scorecard={data.scorecard}
            candidateName={data.attempt.candidateName || undefined}
            examTitle={data.attempt.examTitle || undefined}
            isAdminView={true}
          />
        ) : (
          /* Checkpoint Pipeline Inspector */
          <div className="bg-surface-card border border-border-rule rounded-lg p-6 space-y-6 shadow-sm">
            {/* Status Banner */}
            {isEvaluating ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">AI Evaluation in Progress</h3>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Grading sections sequentially. This page auto-refreshes in real-time as checkpoints finish.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-blue-200 text-blue-800">
                  Polling active (2.5s)
                </span>
              </div>
            ) : isFailed ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-rose-900">AI Evaluation Encountered an Error</h3>
                      <p className="text-xs text-rose-700 font-mono mt-1 break-all">
                        {data.attempt.errorMessage || 'AI model encountered a service timeout or high-demand spike.'}
                      </p>
                      <p className="text-xs text-rose-600 mt-2">
                        Successfully completed checkpoints are preserved in the database. Clicking Retry will only evaluate the missing sections.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRerunEvaluation}
                    disabled={isEvaluating || deleting}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Evaluation Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface-canvas border border-border-rule rounded-lg p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-text-muted shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Attempt Not Yet Evaluated</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Candidate status is currently <span className="font-semibold uppercase">{data.attempt.status}</span>. Click "Re-run AI Evaluation" to start grading.
                  </p>
                </div>
              </div>
            )}

            {/* Section Checkpoints Grid */}
            <div className="space-y-3">
              <h4 className="font-headline-md text-sm font-semibold text-text-primary">
                Evaluation Pipeline Checkpoints
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Section 1 Card */}
                <div className="p-4 bg-surface-canvas border border-border-rule rounded-md space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-text-primary">Section 1: Blanks</span>
                    {s1IsComplete ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" />
                        Graded
                      </span>
                    ) : isEvaluating ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-card text-text-muted border border-border-rule">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    {s1DoneCount} of {s1TotalCount} vocabulary items evaluated
                  </p>
                </div>

                {/* Section 2 Card */}
                <div className="p-4 bg-surface-canvas border border-border-rule rounded-md space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-text-primary">Section 2: Recall</span>
                    {s2IsComplete ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" />
                        Graded
                      </span>
                    ) : isEvaluating ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-card text-text-muted border border-border-rule">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    {s2DoneCount} of {s2TotalCount} passages evaluated
                  </p>
                </div>

                {/* Section 3 Card */}
                <div className="p-4 bg-surface-canvas border border-border-rule rounded-md space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-text-primary">Section 3: Email</span>
                    {s3IsComplete ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" />
                        Graded
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-300">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    ) : isEvaluating ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-card text-text-muted border border-border-rule">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    {s3IsComplete ? 'Rubric dimensions scored' : 'Corporate rubric grading'}
                  </p>
                </div>
              </div>
            </div>

            {/* Candidate Raw Response Table */}
            <div className="pt-4 border-t border-border-rule">
              <h4 className="font-headline-md text-sm font-semibold text-text-primary mb-3">
                Candidate Responses ({data.responses.length})
              </h4>
              <div className="space-y-2">
                {data.responses.map((r, i) => {
                  const ev = r.evaluation;
                  return (
                    <div
                      key={r.response.id}
                      className="p-3 bg-surface-canvas border border-border-rule rounded text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-text-primary">
                          Section {r.response.section} · Item #{i + 1}
                        </span>
                        {ev ? (
                          <span className="text-[11px] font-mono text-[#15803D] font-medium">
                            Score: {Number(ev.score).toFixed(1)} / {Number(ev.maxScore).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-muted font-mono italic">
                            {isEvaluating ? 'Evaluating...' : 'Un-evaluated'}
                          </span>
                        )}
                      </div>
                      <div className="text-text-muted font-mono bg-white p-2 rounded border border-border-rule">
                        {r.response.answerText || '(No answer provided)'}
                      </div>
                      {ev?.aiFeedback && (
                        <div className="text-[11px] text-text-muted">
                          Feedback: <span className="text-text-primary">{ev.aiFeedback}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <AdminFooter />
    </div>
  );
};

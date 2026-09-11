import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import type { Attempt } from '@nqt/shared';

export const EvaluationWait: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('Aptivo English — Practice Assessment 2026');
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // 1. Get current candidate attempt ID
  useEffect(() => {
    const getAttempt = async () => {
      try {
        const startRes = await api.post(`/candidate/exams/${examId}/start`);
        const currAttempt: Attempt = startRes.data.attempt;
        setAttemptId(currAttempt.id);

        if (startRes.data.exam?.title) {
          setExamTitle(startRes.data.exam.title);
        }

        if (currAttempt.status === 'evaluated') {
          navigate(`/candidate/exams/${examId}/results`);
        }
      } catch (err) {
        console.error('Failed to get attempt', err);
        setError('Failed to track evaluation status.');
      }
    };
    getAttempt();
  }, [examId, navigate]);

  // 2. Connect to SSE + Polling fallback
  useEffect(() => {
    if (!attemptId) return;

    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Connect to Server-Sent Events
      eventSource = new EventSource(`/api/events/attempts/${attemptId}`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'evaluating') {
            setCurrentStep(2);
          } else if (data.status === 'evaluated') {
            setCurrentStep(4);
            setTimeout(() => {
              navigate(`/candidate/exams/${examId}/results`);
            }, 800);
          } else if (data.status === 'evaluation_failed') {
            setError(data.error || 'Evaluation encountered an unexpected failure.');
          }
        } catch {
          // ignore heartbeat
        }
      };

      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
      };
    } catch {
      // Fallback
    }

    // Polling fallback every 2.5 seconds
    pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/candidate/attempts/${attemptId}/scorecard`);
        if (res.data) {
          setCurrentStep(4);
          if (pollInterval) clearInterval(pollInterval);
          setTimeout(() => {
            navigate(`/candidate/exams/${examId}/results`);
          }, 800);
        }
      } catch {
        // Still evaluating
      }
    }, 2500);

    // Dynamic visual step progression
    const stepTimer1 = setTimeout(() => setCurrentStep(2), 2000);
    const stepTimer2 = setTimeout(() => setCurrentStep(3), 4500);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
    };
  }, [attemptId, examId, navigate]);

  return (
    <div className="bg-surface-canvas min-h-screen flex flex-col font-body-default text-text-primary antialiased">
      <CandidateNavbar showLogout />

      {/* Main Workspace */}
      <main className="flex-grow flex items-center justify-center p-admin-gutter">
        <div className="w-full max-w-[640px]">
          {/* Submission Card */}
          <div className="bg-surface-card border border-border-rule rounded-lg p-unit-8 shadow-sm">
            {error ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-700 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary font-headline-md">Evaluation Notice</h2>
                <p className="text-xs text-text-muted">{error}</p>
                <button
                  onClick={() => navigate('/candidate/dashboard')}
                  className="px-5 py-2.5 bg-primary-container text-white text-xs font-semibold rounded cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-unit-4 mb-unit-6">
                  <div className="w-unit-12 h-unit-12 bg-[#DCFCE7] border border-[#16A34A] rounded flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#15803D]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check
                    </span>
                  </div>
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-text-primary mb-unit-1">
                      Assessment Submitted Successfully
                    </h1>
                    <p className="font-body-reading text-body-reading text-text-muted">
                      {examTitle}
                    </p>
                  </div>
                </div>

                <p className="font-body-reading text-body-reading text-text-primary mb-unit-8">
                  Your responses for Sentence Completion, Passage Recall, and Email Writing have been saved. AI evaluation is currently in progress.
                </p>

                {/* Details Box */}
                <div className="bg-surface-canvas border border-border-rule rounded p-unit-4 mb-unit-8 space-y-unit-3">
                  <div className="flex justify-between items-center">
                    <span className="font-label-default text-label-default text-text-muted">Candidate</span>
                    <span className="font-body-compact text-body-compact text-text-primary">{user?.name || user?.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-default text-label-default text-text-muted">Submitted At</span>
                    <span className="font-label-mono text-label-mono text-text-primary">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}{' '}
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-default text-label-default text-text-muted">Status</span>
                    <span className="inline-flex items-center px-2 py-1 rounded bg-[#FFFBEB] border border-[#D97706] text-[#B45309] font-label-default text-label-default">
                      Submitted — Evaluation Pending
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-default text-label-default text-text-muted">AI Pipeline</span>
                    <span className="font-label-mono text-label-mono text-text-primary flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-container" />
                      {currentStep === 1
                        ? 'Validating Sentence Completion'
                        : currentStep === 2
                        ? 'Scoring Passage Recall Fidelity'
                        : currentStep === 3
                        ? 'Grading Email Rubric Dimensions'
                        : 'Finalizing Scorecard'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-unit-4 justify-end">
                  <button
                    onClick={() => navigate('/candidate/dashboard')}
                    className="px-5 py-[10px] bg-surface-card border border-border-rule rounded text-text-muted font-label-prominent text-label-prominent hover:bg-surface-canvas hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-unit-4 px-admin-gutter border-t border-border-rule flex justify-center items-center mt-auto bg-surface-canvas text-text-muted font-body-compact text-body-compact">
        Aptivo Assessment Platform
      </footer>
    </div>
  );
};


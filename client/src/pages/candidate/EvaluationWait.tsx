import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, Clock, ArrowRight, Home } from 'lucide-react';
import type { Attempt } from '@aptivo/shared';

export const EvaluationWait: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [examTitle, setExamTitle] = useState('Aptivo English — Practice Assessment 2026');

  useEffect(() => {
    const fetchAttemptInfo = async () => {
      try {
        const startRes = await api.post(`/candidate/exams/${examId}/start`);
        const currAttempt: Attempt = startRes.data.attempt;
        setAttempt(currAttempt);

        if (startRes.data.exam?.title) {
          setExamTitle(startRes.data.exam.title);
        }

        // If this attempt is already evaluated, give candidate direct shortcut
        if (currAttempt.status === 'evaluated') {
          navigate(`/candidate/exams/${examId}/results`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load submission info', err);
      }
    };

    fetchAttemptInfo();
  }, [examId, navigate]);

  const submittedAtFormatted = attempt?.submitted_at
    ? new Date(attempt.submitted_at).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div className="bg-surface-canvas min-h-screen flex flex-col font-body-default text-text-primary antialiased">
      <CandidateNavbar showLogout />

      {/* Main Workspace */}
      <main className="flex-grow flex items-center justify-center p-unit-6 md:p-admin-gutter">
        <div className="w-full max-w-[620px]">
          {/* Submission Receipt Card */}
          <div className="bg-surface-card border border-border-rule rounded-lg p-unit-8 shadow-sm">
            {/* Header Icon + Title */}
            <div className="flex items-start gap-unit-4 mb-unit-6">
              <div className="w-12 h-12 bg-[#DCFCE7] border border-[#16A34A] rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
              </div>
              <div>
                <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">
                  Assessment Submitted Successfully
                </h1>
                <p className="font-body-reading text-body-reading text-text-muted">
                  {examTitle}
                </p>
              </div>
            </div>

            <p className="font-body-reading text-body-reading text-text-primary mb-unit-6 leading-relaxed">
              Thank you for completing your assessment. All responses for Sentence Completion, Passage Recall, and Professional Email Writing have been securely submitted and logged.
            </p>

            {/* Details Table */}
            <div className="bg-surface-canvas border border-border-rule rounded-md p-unit-4 mb-unit-6 space-y-unit-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted font-label-default">Candidate</span>
                <span className="font-medium text-text-primary">{user?.name || user?.email}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted font-label-default">Submitted At</span>
                <span className="font-label-mono text-text-primary">{submittedAtFormatted}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted font-label-default">Evaluation Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFFBEB] border border-[#D97706] text-[#B45309] font-label-default text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Submitted — In Evaluation Queue
                </span>
              </div>
            </div>

            {/* Next Steps Notice */}
            <div className="bg-[#F8FAFC] border border-blue-100 rounded-md p-unit-4 mb-unit-8 text-xs text-text-muted leading-normal">
              <strong className="text-text-primary block mb-1">What happens next?</strong>
              Automated AI evaluation is in progress. You do not need to keep this window open. You may safely return to your dashboard or close your browser. Your performance scorecard will be available in <strong>My Attempts</strong> once evaluation completes.
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-unit-3 justify-end">
              <button
                onClick={() => navigate('/candidate/dashboard')}
                className="px-5 py-2.5 bg-surface-card border border-border-rule rounded text-text-muted hover:text-text-primary hover:bg-surface-canvas font-label-prominent text-label-prominent transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
              <button
                onClick={() => navigate('/candidate/attempts')}
                className="px-5 py-2.5 bg-primary-container text-white rounded hover:bg-[#172554] font-label-prominent text-label-prominent transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                View My Attempts
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
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

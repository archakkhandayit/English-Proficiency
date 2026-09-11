import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { useExamSession } from '../../context/ExamSessionContext';
import { api } from '../../api/axios';

export const Transition: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { attempt, setAttempt, prefetchSection2, prefetchSection3 } = useExamSession();

  const toSection = searchParams.get('to') || 'section2';
  const isToSection2 = toSection === 'section2';

  const [secondsRemaining, setSecondsRemaining] = useState(15); // 15s standard inter-section countdown

  // 1. Proactively warm cache in the background during the rest screen
  useEffect(() => {
    const warmCache = async () => {
      try {
        let currentAttempt = attempt;
        if (!currentAttempt && examId) {
          const res = await api.post(`/candidate/exams/${examId}/start`);
          currentAttempt = res.data.attempt;
          if (currentAttempt) setAttempt(currentAttempt);
        }

        if (currentAttempt) {
          if (isToSection2) {
            await prefetchSection2(currentAttempt.id);
          } else {
            await prefetchSection3(currentAttempt.id);
          }
        }
      } catch (err) {
        console.error('[Transition] Background prefetch failed', err);
      }
    };

    warmCache();
  }, [examId, attempt, isToSection2, prefetchSection2, prefetchSection3, setAttempt]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      handleProceed();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleProceed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleProceed = () => {
    if (isToSection2) {
      navigate(`/candidate/exams/${examId}/section2`);
    } else {
      navigate(`/candidate/exams/${examId}/section3`);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // 3-second buffer to guarantee prefetch completion and enforce cognitive rest
  const canProceed = secondsRemaining <= 12;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-surface-canvas font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between exam-workspace select-none"
    >
      <CandidateNavbar />

      <main className="w-full flex-grow flex items-center justify-center py-unit-12 px-unit-6">
        <div className="w-full max-w-[600px] bg-surface-card border border-border-rule rounded p-unit-8 flex flex-col gap-unit-4 shadow-sm">
          <h1 className="text-[20px] font-medium text-text-primary font-headline-md">Section Completed</h1>
          <p className="text-text-muted font-body-default text-body-default">
            You have completed {isToSection2 ? 'Section 1' : 'Section 2'}. The next section will begin automatically, or you can proceed now.
          </p>
          <div className="font-label-mono font-feature-settings-tnum text-text-primary text-sm font-semibold">
            Starting in {formattedTime}
          </div>
          <div className="pt-unit-4 flex items-center gap-3">
            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className={`px-unit-6 py-unit-2 rounded font-medium transition-all ${
                canProceed
                  ? 'bg-primary-container text-white hover:bg-[#172554] cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
              type="button"
            >
              {canProceed ? 'Begin Next Section' : 'Preparing Next Section...'}
            </button>
            {!canProceed && (
              <span className="text-xs text-text-muted font-mono animate-pulse">
                Ready in {secondsRemaining - 12}s
              </span>
            )}
          </div>
        </div>
      </main>


      <footer className="w-full bg-surface-card border-t border-border-rule py-unit-4">
        <div className="max-w-candidate-max-width mx-auto px-unit-6 text-center text-text-muted font-body-default text-body-default">
          TCS Assessment Platform
        </div>
      </footer>
    </div>
  );
};


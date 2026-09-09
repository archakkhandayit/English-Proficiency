import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CandidateNavbar } from '../../components/CandidateNavbar';

export const Transition: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const toSection = searchParams.get('to') || 'section2';
  const isToSection2 = toSection === 'section2';

  const [secondsRemaining, setSecondsRemaining] = useState(15); // 15s standard inter-section countdown

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

  const handleProceed = () => {
    if (isToSection2) {
      navigate(`/candidate/exams/${examId}/section2/read?passage=1`);
    } else {
      navigate(`/candidate/exams/${examId}/section3`);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="bg-surface-canvas font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between">
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
          <div className="pt-unit-4">
            <button
              onClick={handleProceed}
              className="bg-primary-container text-white px-unit-6 py-unit-2 rounded font-medium transition-colors hover:bg-[#172554] cursor-pointer"
              type="button"
            >
              Begin Next Section
            </button>
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


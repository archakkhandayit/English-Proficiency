import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { ExamTimer } from '../../components/ExamTimer';
import { Loader2 } from 'lucide-react';
import type { Attempt } from '@nqt/shared';

interface PassageReadData {
  id: string;
  order_index?: number;
  passage_text?: string;
  orderIndex?: number;
  passageText?: string;
}

export const Section2Read: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const passageNum = parseInt(searchParams.get('passage') || '1', 10);

  const [passage, setPassage] = useState<PassageReadData | null>(null);
  const [totalPassages, setTotalPassages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassage = async () => {
      try {
        // Start or retrieve attempt
        const startRes = await api.post(`/candidate/exams/${examId}/start`);
        const attempt: Attempt = startRes.data.attempt;

        // Fetch meta
        const metaRes = await api.get(`/candidate/attempts/${attempt.id}/section2/passages-meta`);
        setTotalPassages(metaRes.data.total_passages || 1);

        // Fetch stimulus for current passage
        const readRes = await api.get(`/candidate/attempts/${attempt.id}/section2/read/${passageNum}`);
        setPassage(readRes.data);
      } catch (err) {
        console.error('Failed to load Section 2 stimulus', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPassage();
  }, [examId, passageNum]);

  const handleProceedToRecall = () => {
    // Immediate transition to Recall phase with ZERO delay
    navigate(`/candidate/exams/${examId}/section2/recall?passage=${passageNum}`);
  };

  if (loading || !passage) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  const passageText = passage.passage_text || passage.passageText;

  return (
    <div className="bg-surface-canvas font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between select-none">
      <CandidateNavbar
        timerNode={
          <ExamTimer
            initialSeconds={30} // 30 seconds reading phase
            onExpire={handleProceedToRecall}
            warningThresholdSeconds={10}
            criticalThresholdSeconds={5}
          />
        }
      />

      <main className="w-full flex-grow flex flex-col items-center py-unit-12 px-unit-4">
        <div className="w-full max-w-[680px] flex flex-col gap-unit-6">
          <div className="flex flex-col gap-unit-1">
            <span className="text-text-muted font-label-prominent text-label-prominent">
              Section 2: Passage Recall — Passage {passageNum} of {totalPassages} (Read Phase)
            </span>
            <p className="text-text-muted font-body-default text-body-default">
              Read the passage carefully. The passage will disappear when the timer reaches zero.
            </p>
          </div>

          <div className="bg-surface-card border border-border-rule rounded-lg p-unit-6 shadow-sm">
            <p className="font-body-reading text-[16px] leading-[28px] text-text-primary m-0 antialiased">
              {passageText}
            </p>
          </div>

          <div className="flex justify-end pt-unit-2">
            <button
              onClick={handleProceedToRecall}
              className="bg-primary-container text-white px-unit-6 py-2 rounded-[4px] font-label-prominent text-label-prominent hover:bg-[#172554] transition-colors cursor-pointer"
            >
              Start Recall
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full bg-surface-card border-t border-border-rule py-unit-4">
        <div className="max-w-[680px] mx-auto px-unit-4 flex justify-center">
          <span className="font-label-default text-text-muted">TCS Assessment Platform</span>
        </div>
      </footer>
    </div>
  );
};


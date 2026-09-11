import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { ExamTimer } from '../../components/ExamTimer';
import { useExamSession, type Section2BatchData } from '../../context/ExamSessionContext';
import { useExamNavigationGuard } from '../../hooks/useExamNavigationGuard';
import { handleTabInsert } from '../../utils/textUtils';
import { Loader2 } from 'lucide-react';
import type { Attempt } from '@nqt/shared';

export const Section2: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { attempt, setAttempt, section2Batch, getOrFetchSection2 } = useExamSession();

  const [batchData, setBatchData] = useState<Section2BatchData | null>(section2Batch);
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(attempt);
  const [loading, setLoading] = useState(!section2Batch);

  // In-memory Section 2 state machine (0ms phase transitions)
  const [passageIdx, setPassageIdx] = useState(0);
  const [phase, setPhase] = useState<'read' | 'recall'>('read');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recallInputRef = useRef<HTMLTextAreaElement>(null);

  // Lock browser back navigation and prevent accessing questions after submission
  useExamNavigationGuard({
    examId,
    attempt: currentAttempt,
    currentSectionNumber: 2,
  });

  // Ensure attempt and batched Section 2 data are loaded
  useEffect(() => {
    let isMounted = true;

    const loadSection2 = async () => {
      try {
        let activeAttempt = currentAttempt;
        if (!activeAttempt && examId) {
          const startRes = await api.post(`/candidate/exams/${examId}/start`);
          activeAttempt = startRes.data.attempt;
          if (isMounted && activeAttempt) {
            setCurrentAttempt(activeAttempt);
            setAttempt(activeAttempt);
          }
        }

        if (activeAttempt) {
          const data = await getOrFetchSection2(activeAttempt.id);
          if (isMounted && data) {
            setBatchData(data);
          }
        }
      } catch (err) {
        console.error('Failed to initialize Section 2', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (!batchData) {
      loadSection2();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [examId, currentAttempt, batchData, getOrFetchSection2, setAttempt]);

  // Focus textarea when transitioning into recall phase
  useEffect(() => {
    if (phase === 'recall') {
      recallInputRef.current?.focus();
    }
  }, [phase, passageIdx]);

  // Flush save immediately (used by timer expiry and next passage action)
  const flushSave = useCallback(
    async (passageId: string, text: string) => {
      if (!currentAttempt) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      try {
        await api.put(`/candidate/attempts/${currentAttempt.id}/responses`, {
          item_id: passageId,
          section: 2,
          item_type: 'section2_passage',
          answer_text: text,
          time_spent_sec: 90,
        });
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Failed to flush save Section 2 response', err);
      }
    },
    [currentAttempt]
  );

  // Debounced autosave (2 seconds)
  const triggerAutosave = useCallback(
    (passageId: string, text: string) => {
      if (!currentAttempt) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.put(`/candidate/attempts/${currentAttempt.id}/responses`, {
            item_id: passageId,
            section: 2,
            item_type: 'section2_passage',
            answer_text: text,
            time_spent_sec: 0,
          });
          setLastSavedTime(new Date().toLocaleTimeString());
        } catch (err) {
          console.error('Autosave error', err);
        } finally {
          setSaving(false);
        }
      }, 2000);
    },
    [currentAttempt]
  );

  const handleAnswerChange = (val: string) => {
    const currentPassage = batchData?.passages[passageIdx];
    if (!currentPassage) return;

    setAnswers((prev) => ({ ...prev, [currentPassage.id]: val }));
    triggerAutosave(currentPassage.id, val);
  };

  // Instant 0ms local swap from Read to Recall
  const handleStartRecall = () => {
    setPhase('recall');
  };

  // Completion of recall: proceed to next passage or transition to Section 3
  const handleNextPassageOrFinish = async () => {
    const currentPassage = batchData?.passages[passageIdx];
    if (currentPassage) {
      const currentText = answers[currentPassage.id] || '';
      await flushSave(currentPassage.id, currentText);
    }

    const total = batchData?.passages.length || 1;
    if (passageIdx < total - 1) {
      // 0ms instant transition to next passage reading phase
      setPassageIdx((prev) => prev + 1);
      setPhase('read');
    } else {
      // Complete Section 2: update attempt section and proceed to Section 3 rest
      try {
        if (currentAttempt) {
          await api.patch(`/candidate/attempts/${currentAttempt.id}/section`, { currentSection: 4 });
        }
      } catch {
        // Proceed even if patch fails
      }
      navigate(`/candidate/exams/${examId}/transition?to=section3`);
    }
  };

  if (loading || !batchData || batchData.passages.length === 0) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  const currentPassage = batchData.passages[passageIdx];
  const totalPassages = batchData.total_passages || batchData.passages.length;
  const currentAnswer = answers[currentPassage.id] || '';
  const wordCount = currentAnswer.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-surface-canvas font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between exam-workspace select-none"
    >
      <CandidateNavbar
        timerNode={
          phase === 'read' ? (
            <ExamTimer
              key={`read-${currentPassage.id}`}
              initialSeconds={30} // 30 seconds reading phase
              onExpire={handleStartRecall}
              warningThresholdSeconds={10}
              criticalThresholdSeconds={5}
            />
          ) : (
            <ExamTimer
              key={`recall-${currentPassage.id}`}
              initialSeconds={90} // 90 seconds recall phase
              onExpire={handleNextPassageOrFinish}
              warningThresholdSeconds={30}
              criticalThresholdSeconds={10}
            />
          )
        }
      />

      <main className="w-full flex-grow flex flex-col items-center py-unit-12 px-unit-4">
        <div className="w-full max-w-[680px] flex flex-col gap-unit-6">
          {/* Header Metadata */}
          <div className="flex flex-col gap-unit-1 select-none">
            <span className="text-text-muted font-label-prominent text-label-prominent">
              Section 2: Passage Recall — Passage {passageIdx + 1} of {totalPassages} (
              {phase === 'read' ? 'Read Phase' : 'Recall Phase'})
            </span>
            <p className="text-text-muted font-body-default text-body-default">
              {phase === 'read'
                ? 'Read the passage carefully. The passage will disappear when the timer reaches zero.'
                : 'Reconstruct the passage you just read as accurately as possible.'}
            </p>
          </div>

          {/* Phase 1: Reading Phase (Stimulus Display) */}
          {phase === 'read' && (
            <>
              <div className="bg-surface-card border border-border-rule rounded-lg p-unit-6 shadow-sm select-none">
                <p className="font-body-reading text-[16px] leading-[28px] text-text-primary m-0 antialiased select-none">
                  {currentPassage.passage_text}
                </p>
              </div>

              <div className="flex justify-end pt-unit-2">
                <button
                  type="button"
                  onClick={handleStartRecall}
                  className="bg-primary-container text-white px-unit-6 py-2 rounded-[4px] font-label-prominent text-label-prominent hover:bg-[#172554] transition-colors cursor-pointer select-none"
                >
                  Start Recall
                </button>
              </div>
            </>
          )}

          {/* Phase 2: Recall Phase (Textarea Input with ZERO Delay Transition) */}
          {phase === 'recall' && (
            <>
              <div className="flex flex-col gap-unit-2">
                <textarea
                  ref={recallInputRef}
                  id="recall-response"
                  rows={8}
                  placeholder="Begin typing your synthesis here..."
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  onKeyDown={(e) =>
                    handleTabInsert(e, (val) => {
                      handleAnswerChange(val);
                    })
                  }
                  autoFocus
                  className="exam-input w-full bg-surface-card border border-border-rule rounded-[4px] p-unit-4 font-body-reading text-body-reading text-text-primary focus:border-primary-container focus:outline-none transition-colors"
                />
                <div className="flex justify-between items-center text-label-default text-text-muted select-none">
                  <span>Word count: {wordCount}</span>
                  <span className="font-mono text-[11px]">
                    {saving ? 'Saving...' : lastSavedTime ? `Saved at ${lastSavedTime}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNextPassageOrFinish}
                  className="bg-primary-container text-white px-unit-6 py-2 rounded-[4px] font-semibold hover:bg-[#172554] transition-colors cursor-pointer select-none"
                >
                  {passageIdx < totalPassages - 1 ? 'Next Passage' : 'Complete Section 2'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="w-full bg-surface-card border-t border-border-rule py-unit-4 select-none">
        <div className="max-w-[680px] mx-auto px-unit-4 flex justify-center">
          <span className="font-label-default text-text-muted">Aptivo Assessment Platform</span>
        </div>
      </footer>
    </div>
  );
};

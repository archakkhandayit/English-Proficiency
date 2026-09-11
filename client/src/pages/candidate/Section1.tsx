import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { ExamTimer } from '../../components/ExamTimer';
import { useExamNavigationGuard } from '../../hooks/useExamNavigationGuard';
import { handleTabInsert } from '../../utils/textUtils';
import { Loader2 } from 'lucide-react';
import type { Section1Question, ExamResponse, Attempt } from '@nqt/shared';

export const Section1: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Section1Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock browser back navigation and prevent accessing questions after submission
  useExamNavigationGuard({
    examId,
    attempt,
    currentSectionNumber: 1,
  });

  // Fetch S1 questions and existing responses
  useEffect(() => {
    const fetchS1Data = async () => {
      try {
        // Start or get attempt
        const startRes = await api.post(`/candidate/exams/${examId}/start`);
        const currentAttempt: Attempt = startRes.data.attempt;
        setAttempt(currentAttempt);

        // Fetch S1 questions
        const s1Res = await api.get(`/candidate/attempts/${currentAttempt.id}/section1`);
        setQuestions(s1Res.data.questions);

        // Map existing answers
        const initialAnswers: Record<string, string> = {};
        (s1Res.data.responses || []).forEach((r: ExamResponse) => {
          initialAnswers[r.item_id] = r.answer_text;
        });
        setAnswers(initialAnswers);
      } catch (err) {
        console.error('Failed to load Section 1 data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchS1Data();
  }, [examId]);

  // Auto-focus input when navigating questions
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentIndex]);

  // Flush save immediately (used by question expiry and Next Question button)
  const flushSave = useCallback(
    async (itemId: string, text: string) => {
      if (!attempt) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      try {
        await api.put(`/candidate/attempts/${attempt.id}/responses`, {
          item_id: itemId,
          section: 1,
          item_type: 'section1_question',
          answer_text: text,
          time_spent_sec: 25,
        });
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Failed to autosave response', err);
      }
    },
    [attempt]
  );

  // Debounced autosave (2 seconds)
  const triggerAutosave = useCallback(
    (itemId: string, text: string) => {
      if (!attempt) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.put(`/candidate/attempts/${attempt.id}/responses`, {
            item_id: itemId,
            section: 1,
            item_type: 'section1_question',
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
    [attempt]
  );

  const handleAnswerChange = (text: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
    triggerAutosave(currentQ.id, text);
  };

  const handleSectionComplete = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      if (attempt) {
        await api.patch(`/candidate/attempts/${attempt.id}/section`, { currentSection: 2 });
      }
    } catch {
      // continue to transition even if patch fails
    }
    navigate(`/candidate/exams/${examId}/transition?to=section2`);
  }, [attempt, examId, navigate]);

  // 25s Question Timer Expiration Handler
  const handleQuestionTimerExpire = useCallback(async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !attempt) return;

    const currentText = answers[currentQ.id] || '';
    await flushSave(currentQ.id, currentText);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      await handleSectionComplete();
    }
  }, [currentIndex, questions, attempt, answers, flushSave, handleSectionComplete]);

  // Next Question Button Click Handler
  const handleNextQuestion = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !attempt) return;

    const currentText = answers[currentQ.id] || '';
    await flushSave(currentQ.id, currentText);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      await handleSectionComplete();
    }
  };

  if (loading || questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ.id] || '';

  // Format sentence display with prompt
  const displaySentence = currentQ.sentence_with_blank.replace(/(\[blank\]|___+)/gi, '________');

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-[#F8FAFC] font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between exam-workspace select-none"
    >
      <CandidateNavbar
        timerNode={
          <ExamTimer
            key={currentQ.id}
            initialSeconds={25}
            onExpire={handleQuestionTimerExpire}
            warningThresholdSeconds={8}
            criticalThresholdSeconds={4}
          />
        }
      />

      <main className="w-full flex-grow flex flex-col justify-between">
        {/* Focused Assessment Workspace */}
        <div className="w-full max-w-[680px] mx-auto px-unit-6 py-unit-10 flex flex-col justify-between flex-1">
          {/* Top Metadata */}
          <div>
            <div className="flex items-center justify-between pb-unit-6 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-unit-3 text-[#64748B] font-body-default text-body-default select-none">
                <span>
                  Section 1: Sentence Completion (Question {currentIndex + 1} of {questions.length})
                </span>
              </div>
              {/* Question Indicators - Strictly non-interactive (Cannot click backward or forward) */}
              <div className="flex items-center gap-1 pointer-events-none select-none" aria-hidden="true">
                {questions.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.id]?.trim());
                  const isCurrent = idx === currentIndex;
                  return (
                    <div
                      key={q.id}
                      className={`w-6 h-6 rounded-[2px] text-xs font-mono flex items-center justify-center transition-colors select-none ${
                        isCurrent
                          ? 'bg-primary-container text-white font-bold'
                          : isAnswered
                          ? 'bg-emerald-100 text-emerald-800 font-medium'
                          : 'bg-white border border-border-rule text-text-muted'
                      }`}
                      title={`Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question Core Area */}
            <div className="py-unit-8 flex flex-col">
              <h1 className="font-headline-md text-headline-md text-[#0F172A] font-medium leading-relaxed mb-unit-6 select-none">
                {displaySentence}
              </h1>

              <div className="flex flex-col gap-unit-2 w-full">
                <label className="font-body-default text-body-default text-[#0F172A] select-none" htmlFor="sentence-completion-input">
                  Enter your answer:
                </label>
                <div className="relative w-full">
                  <input
                    ref={inputRef}
                    id="sentence-completion-input"
                    type="text"
                    autoComplete="off"
                    spellCheck="false"
                    autoFocus
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    onKeyDown={(e) => handleTabInsert(e, (val) => handleAnswerChange(val))}
                    placeholder="Type your answer here..."
                    className="exam-input w-full h-11 px-unit-4 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[4px] font-body-reading text-body-reading text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] transition-colors"
                  />
                </div>
                <div className="flex justify-between items-center text-label-default select-none">
                  <p className="font-label-default text-[#64748B]">
                    Type the word that best completes the blank in the sentence above.
                  </p>
                  <span className="text-text-muted font-mono text-[11px]">
                    {saving ? 'Saving...' : lastSavedTime ? `Saved` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions: Strictly No Previous Button */}
          <div className="pt-unit-8 mt-unit-4 border-t border-[#E2E8F0] flex justify-end items-center">
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="h-10 px-unit-6 rounded-[4px] bg-[#1E3A8A] text-[#FFFFFF] font-body-default text-body-default hover:bg-[#172554] transition-colors focus:outline-none cursor-pointer select-none"
              >
                Next Question
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="h-10 px-unit-6 rounded-[4px] bg-emerald-700 text-[#FFFFFF] font-body-default text-body-default hover:bg-emerald-800 transition-colors focus:outline-none cursor-pointer select-none"
              >
                Complete Section 1
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full bg-[#FFFFFF] border-t border-[#E2E8F0] py-unit-4 select-none">
        <div className="max-w-candidate-max-width mx-auto px-unit-6 flex items-center justify-center font-body-default text-body-default text-[#64748B]">
          <span>TCS Assessment Platform</span>
        </div>
      </footer>
    </div>
  );
};



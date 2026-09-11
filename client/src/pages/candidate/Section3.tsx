import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { ExamTimer } from '../../components/ExamTimer';
import { useExamSession } from '../../context/ExamSessionContext';
import { useExamNavigationGuard } from '../../hooks/useExamNavigationGuard';
import { handleTabInsert } from '../../utils/textUtils';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { Attempt, Section3Prompt } from '@nqt/shared';

export const Section3: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { attempt: sessionAttempt, setAttempt: setSessionAttempt, section3Prompt, getOrFetchSection3 } = useExamSession();

  const [attempt, setAttempt] = useState<Attempt | null>(sessionAttempt);
  const [prompt, setPrompt] = useState<Section3Prompt | null>(section3Prompt);
  const [emailText, setEmailText] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(!section3Prompt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock browser back navigation and prevent accessing questions after submission
  useExamNavigationGuard({
    examId,
    attempt,
    currentSectionNumber: 4,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchS3Data = async () => {
      try {
        let currAttempt = attempt;
        if (!currAttempt && examId) {
          const startRes = await api.post(`/candidate/exams/${examId}/start`);
          currAttempt = startRes.data.attempt;
          if (isMounted && currAttempt) {
            setAttempt(currAttempt);
            setSessionAttempt(currAttempt);
          }
        }

        if (currAttempt) {
          const loadedPrompt = await getOrFetchSection3(currAttempt.id);
          if (isMounted && loadedPrompt) {
            setPrompt(loadedPrompt);
          }

          // Fetch any existing response in background
          const s3Res = await api.get(`/candidate/attempts/${currAttempt.id}/section3`);
          if (isMounted && s3Res.data.response?.answerText) {
            setEmailText(s3Res.data.response.answerText);
          }
        }
      } catch (err) {
        console.error('Failed to load Section 3 prompt', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchS3Data();

    return () => {
      isMounted = false;
    };
  }, [examId, attempt, getOrFetchSection3, setSessionAttempt]);


  // Debounced autosave (2 seconds)
  const triggerAutosave = useCallback(
    (text: string) => {
      if (!attempt || !prompt) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.put(`/candidate/attempts/${attempt.id}/responses`, {
            item_id: prompt.id,
            section: 3,
            item_type: 'section3_prompt',
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
    [attempt, prompt]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEmailText(val);
    triggerAutosave(val);
  };

  const wordCount = emailText.trim().split(/\s+/).filter(Boolean).length;

  const handleFinalSubmit = async () => {
    if (!attempt || !prompt) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSubmitting(true);

    try {
      // Ensure current text is saved
      await api.put(`/candidate/attempts/${attempt.id}/responses`, {
        item_id: prompt.id,
        section: 3,
        item_type: 'section3_prompt',
        answer_text: emailText,
        time_spent_sec: 0,
      });

      // Submit attempt
      await api.post(`/candidate/attempts/${attempt.id}/submit`);
      navigate(`/candidate/exams/${examId}/wait`);
    } catch (err) {
      console.error('Failed to submit attempt', err);
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  if (loading || !prompt) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  // Parse prompt text to extract scenario and requirements if formatted
  const promptLines = prompt.prompt_text.split('\n').filter(Boolean);
  const scenarioLine = promptLines[0] || prompt.prompt_text;
  const requirementLines = promptLines.slice(1);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-surface-canvas font-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between exam-workspace select-none"
    >
      <CandidateNavbar
        timerNode={
          <ExamTimer
            initialSeconds={540} // 9 minutes (540 seconds)
            onExpire={handleFinalSubmit}
            warningThresholdSeconds={120}
            criticalThresholdSeconds={30}
          />
        }
      />

      <main className="w-full pt-8 pb-24 bg-surface-canvas flex-grow flex flex-col justify-between">
        <div className="flex flex-col w-full">
          <div className="w-full max-w-[680px] mx-auto px-unit-4 py-unit-6 flex flex-col gap-unit-6">
            <div className="text-text-muted font-body-default text-body-default select-none">
              Section 3: Email Writing
            </div>

            <div className="rounded bg-surface-card p-unit-5 border border-border-rule flex flex-col gap-unit-4 shadow-sm select-none">
              <p className="font-body-reading text-body-reading text-text-primary leading-relaxed select-none">
                <strong className="font-semibold">Scenario: </strong>
                {scenarioLine.replace(/^Scenario:\s*/i, '')}
              </p>

              {requirementLines.length > 0 && (
                <div className="text-text-primary font-body-default text-body-default flex flex-col gap-unit-1 select-none">
                  <div className="font-medium mb-1">Requirements to include:</div>
                  <ul className="list-disc list-inside space-y-1 text-text-primary select-none">
                    {requirementLines.map((line, idx) => (
                      <li key={idx}>{line.replace(/^[-•*]\s*/, '')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-unit-4">
              <textarea
                id="email-body"
                rows={10}
                value={emailText}
                onChange={handleChange}
                onKeyDown={(e) =>
                  handleTabInsert(e, (val) => {
                    setEmailText(val);
                    triggerAutosave(val);
                  })
                }
                placeholder="Dear Mr. Henderson,&#10;&#10;I am writing to..."
                autoFocus
                className="exam-input w-full p-unit-4 rounded border border-border-rule bg-surface-card font-body-reading text-body-reading text-text-primary leading-relaxed resize-y focus:outline-none focus:border-text-muted transition-colors shadow-sm"
              />

              <div className="flex items-center justify-between select-none">
                <div className="text-text-muted font-body-default text-body-default select-none" id="word-badge">
                  Word count: {wordCount} (Recommended: 80–120 words)
                  {saving && <span className="ml-2 font-mono text-[11px] text-amber-600">• Saving...</span>}
                  {!saving && lastSavedTime && <span className="ml-2 font-mono text-[11px] text-text-muted">• Saved</span>}
                </div>

                <button
                  id="btn-submit"
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSubmitting}
                  className="px-unit-5 py-unit-2 rounded bg-primary-container text-white font-label-prominent text-label-prominent hover:bg-[#172554] transition-colors cursor-pointer disabled:opacity-50 select-none"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full bg-surface-card border-t border-border-rule py-unit-4 z-40 select-none">
        <div className="max-w-[680px] mx-auto px-unit-4 flex items-center justify-start font-label-default text-label-default text-text-muted">
          <div>Aptivo Assessment Platform</div>
        </div>
      </footer>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-surface-card border border-border-rule rounded max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-primary-container">
              <CheckCircle2 className="w-6 h-6 text-state-success" />
              <h3 className="font-semibold text-base text-text-primary">Confirm Final Submission</h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you wish to conclude your Aptivo English Assessment? Once submitted, your responses will be locked and routed directly to the AI grading engine.
            </p>
            <div className="bg-surface-canvas border border-border-rule p-3 rounded text-xs space-y-1">
              <div>• Section 1 (Sentence Completion): Completed</div>
              <div>• Section 2 (Passage Recall): Completed</div>
              <div>• Section 3 (Email Writing): {wordCount} words written</div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-border-rule rounded text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-canvas cursor-pointer"
              >
                Return to Editor
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="flex items-center space-x-1.5 px-5 py-2 bg-primary-container hover:bg-[#172554] text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Yes, Submit Exam</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



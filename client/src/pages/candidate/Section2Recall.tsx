import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { ExamTimer } from '../../components/ExamTimer';
import { useExamNavigationGuard } from '../../hooks/useExamNavigationGuard';
import { handleTabInsert } from '../../utils/textUtils';
import { Loader2 } from 'lucide-react';
import type { Attempt } from '@nqt/shared';

interface PassageMeta {
  id: string;
  order_index?: number;
  orderIndex?: number;
}

export const Section2Recall: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const passageNum = parseInt(searchParams.get('passage') || '1', 10);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [passageMeta, setPassageMeta] = useState<PassageMeta | null>(null);
  const [totalPassages, setTotalPassages] = useState(1);
  const [recalledText, setRecalledText] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock browser back navigation and prevent accessing questions after submission
  useExamNavigationGuard({
    examId,
    attempt,
    currentSectionNumber: 3,
  });

  useEffect(() => {
    const fetchRecallData = async () => {
      try {
        const startRes = await api.post(`/candidate/exams/${examId}/start`);
        const currAttempt: Attempt = startRes.data.attempt;
        setAttempt(currAttempt);

        const metaRes = await api.get(`/candidate/attempts/${currAttempt.id}/section2/passages-meta`);
        setTotalPassages(metaRes.data.total_passages || 1);

        // Fetch recall meta (STRICTLY OMITTING PASSAGE TEXT)
        const recallRes = await api.get(
          `/candidate/attempts/${currAttempt.id}/section2/recall/${passageNum}`
        );
        setPassageMeta(recallRes.data.passage);

        if (recallRes.data.response?.answerText) {
          setRecalledText(recallRes.data.response.answerText);
        }
      } catch (err) {
        console.error('Failed to load Section 2 recall meta', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecallData();
  }, [examId, passageNum]);

  // Flush save immediately
  const flushSave = useCallback(
    async (text: string) => {
      if (!attempt || !passageMeta) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      try {
        await api.put(`/candidate/attempts/${attempt.id}/responses`, {
          item_id: passageMeta.id,
          section: 2,
          item_type: 'section2_passage',
          answer_text: text,
          time_spent_sec: 90,
        });
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Failed to flush save recall', err);
      }
    },
    [attempt, passageMeta]
  );

  // Debounced autosave (2 seconds)
  const triggerAutosave = useCallback(
    (text: string) => {
      if (!attempt || !passageMeta) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.put(`/candidate/attempts/${attempt.id}/responses`, {
            item_id: passageMeta.id,
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
    [attempt, passageMeta]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRecalledText(val);
    triggerAutosave(val);
  };

  const handleNext = async () => {
    await flushSave(recalledText);

    if (passageNum < totalPassages) {
      // IMMEDIATE transition to next passage reading phase (ZERO REST!)
      navigate(`/candidate/exams/${examId}/section2/read?passage=${passageNum + 1}`);
    } else {
      try {
        if (attempt) {
          await api.patch(`/candidate/attempts/${attempt.id}/section`, { currentSection: 4 });
        }
      } catch {}
      // All passages in S2 completed: transition to Section 3 with scheduled rest break
      navigate(`/candidate/exams/${examId}/transition?to=section3`);
    }
  };

  if (loading || !passageMeta) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  const wordCount = recalledText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-surface-canvas font-body-default text-body-default text-text-primary antialiased min-h-screen flex flex-col justify-between exam-workspace select-none"
    >
      <CandidateNavbar
        timerNode={
          <ExamTimer
            initialSeconds={90} // 1:30 recall phase
            onExpire={handleNext}
            warningThresholdSeconds={30}
            criticalThresholdSeconds={10}
          />
        }
      />

      <main className="w-full flex-grow flex flex-col items-center py-unit-16 px-unit-4">
        <div className="w-full max-w-[680px] flex flex-col gap-unit-8">
          <div className="flex flex-col gap-unit-2 select-none">
            <span className="text-text-muted font-label-default text-label-default">
              Section 2: Passage Recall — Passage {passageNum} of {totalPassages} (Recall Phase)
            </span>
            <h1 className="font-medium text-text-primary text-[18px]">
              Reconstruct the passage you just read as accurately as possible.
            </h1>
          </div>

          <div className="flex flex-col gap-unit-2">
            <textarea
              id="recall-response"
              rows={8}
              placeholder="Begin typing your synthesis here..."
              value={recalledText}
              onChange={handleChange}
              onKeyDown={(e) =>
                handleTabInsert(e, (val) => {
                  setRecalledText(val);
                  triggerAutosave(val);
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
              onClick={handleNext}
              className="bg-primary-container text-white px-unit-6 py-2 rounded-[4px] font-semibold hover:bg-[#172554] transition-colors cursor-pointer select-none"
            >
              {passageNum < totalPassages ? 'Next Passage' : 'Complete Section 2'}
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full bg-surface-canvas py-unit-8 border-t border-border-rule select-none">
        <div className="max-w-[680px] mx-auto px-unit-4 flex justify-end">
          <span className="text-label-default text-text-muted">Aptivo Assessment Platform</span>
        </div>
      </footer>
    </div>
  );
};



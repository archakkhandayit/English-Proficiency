import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Attempt } from '@nqt/shared';

interface UseExamNavigationGuardOptions {
  examId?: string;
  attempt: Attempt | null;
  currentSectionNumber: number; // 1: S1, 2: S2 Read, 3: S2 Recall, 4: S3
}

export function useExamNavigationGuard({
  examId,
  attempt,
  currentSectionNumber,
}: UseExamNavigationGuardOptions) {
  const navigate = useNavigate();

  // 1. Lock browser back navigation and prevent DevTools shortcuts
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  // 2. Prevent candidate from accessing finished sections or accessing questions after exam submission
  useEffect(() => {
    if (!attempt || !examId) return;

    // After exam end: immediately redirect out of question sections to results
    if (
      attempt.status === 'submitted' ||
      attempt.status === 'evaluating' ||
      attempt.status === 'evaluated'
    ) {
      navigate(`/candidate/exams/${examId}/results`, { replace: true });
      return;
    }

    // Forward progression guard: candidate cannot go back to earlier sections
    const activeSection = attempt.current_section || (attempt as any).currentSection;
    if (activeSection && activeSection > currentSectionNumber) {
      if (activeSection === 2 || activeSection === 3) {
        navigate(`/candidate/exams/${examId}/section2`, { replace: true });
      } else if (activeSection === 4) {
        navigate(`/candidate/exams/${examId}/section3`, { replace: true });
      } else if (activeSection >= 5) {
        navigate(`/candidate/exams/${examId}/results`, { replace: true });
      }
    }
  }, [attempt, examId, currentSectionNumber, navigate]);
}


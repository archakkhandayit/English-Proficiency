import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { CandidateNavbar } from '../../components/CandidateNavbar';
import { Loader2 } from 'lucide-react';
import type { Exam } from '@nqt/shared';

export const ExamInstructions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await api.get<Exam>(`/candidate/exams/${id}`);
        setExam(res.data);
      } catch (err) {
        console.error('Failed to load exam metadata', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post(`/candidate/exams/${id}/start`);
      navigate(`/candidate/exams/${id}/section1`);
    } catch (err) {
      console.error('Failed to start exam', err);
      setStarting(false);
    }
  };

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bg-surface-canvas min-h-screen flex flex-col font-body-default text-body-default text-text-primary antialiased exam-workspace select-none"
    >
      <CandidateNavbar showLogout />


      {/* Main Workspace */}
      <main className="flex-grow flex flex-col items-center py-unit-12 px-unit-6 sm:px-unit-8 w-full max-w-[700px] mx-auto box-border">
        {/* Navigation & Heading */}
        <div className="w-full mb-unit-8">
          <Link
            to="/candidate/dashboard"
            className="inline-flex items-center text-text-muted hover:text-text-primary transition-colors duration-100 font-label-default text-label-default mb-unit-6 cursor-pointer"
          >
            ← Back to Assessments
          </Link>
          <h1 className="font-headline-lg text-[24px] font-medium leading-[32px] text-text-primary mb-unit-2">
            {exam.title}
          </h1>
          <p className="text-text-muted font-body-default text-body-default">
            Read the instructions below before beginning your timed assessment.
          </p>
        </div>

        {/* Exam Structure Card */}
        <div className="w-full bg-surface-card border border-border-rule rounded-lg p-unit-6 mb-unit-8 shadow-sm">
          <div className="space-y-unit-6">
            {/* Section 1 */}
            <div>
              <h2 className="font-label-prominent text-label-prominent font-medium text-text-primary mb-unit-1">
                Section 1: Sentence Completion
              </h2>
              <p className="text-text-muted font-body-default text-body-default">
                <span className="font-label-mono text-label-mono text-text-primary mr-1">
                  {exam.question_counts?.section1 || 15}
                </span>{' '}
                questions (25 seconds per question). Complete each sentence by typing the missing word in the blank. Responses auto-advance and save when the timer runs out.
              </p>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="font-label-prominent text-label-prominent font-medium text-text-primary mb-unit-1">
                Section 2: Passage Recall
              </h2>
              <p className="text-text-muted font-body-default text-body-default">
                <span className="font-label-mono text-label-mono text-text-primary mr-1">
                  {exam.question_counts?.section2 || 3}
                </span>{' '}
                passages. Phase 1: 30 seconds of silent reading. Phase 2: Reconstruct the passage from memory in the text box. Passages progress with zero inter-passage delay.
              </p>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="font-label-prominent text-label-prominent font-medium text-text-primary mb-unit-1">
                Section 3: Professional Email Writing
              </h2>
              <p className="text-text-muted font-body-default text-body-default">
                <span className="font-label-mono text-label-mono text-text-primary mr-1">1</span> prompt.{' '}
                <span className="font-label-mono text-label-mono text-text-primary mr-1">9</span> minutes. Compose a professional business email incorporating all required bullet points.
              </p>
            </div>
          </div>
        </div>

        {/* Important Guidelines */}
        <div className="w-full mb-unit-10">
          <h3 className="font-label-prominent text-label-prominent font-medium text-text-primary mb-unit-4">Important Guidelines</h3>
          <ul className="list-disc pl-5 space-y-unit-2 text-text-muted font-body-default text-body-default marker:text-text-muted">
            <li>Section 1 questions are timed at 25 seconds per question and advance automatically.</li>
            <li>Question progression is strictly sequential; you cannot revisit previous questions or sections.</li>
            <li>In Section 2, the stimulus text disappears during recall.</li>
            <li>Your responses are saved automatically as you type.</li>
            <li>Browser back navigation is locked throughout the exam until final evaluation.</li>
          </ul>
        </div>

        {/* Bottom Action Row */}
        <div className="w-full flex items-center gap-unit-4 pt-unit-4 border-t border-border-rule">
          <button
            onClick={handleStart}
            disabled={starting}
            className="bg-primary-container text-white hover:bg-[#172554] active:bg-[#0F172A] font-label-prominent text-label-prominent font-medium py-[10px] px-[20px] rounded transition-colors duration-100 cursor-pointer disabled:opacity-50"
          >
            {starting ? 'Starting Exam...' : 'Start Exam'}
          </button>
          <button
            onClick={() => navigate('/candidate/dashboard')}
            className="bg-transparent text-text-muted hover:text-text-primary font-label-prominent text-label-prominent font-medium py-[10px] px-[20px] rounded transition-colors duration-100 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </main>

      {/* Shared Component: Footer */}
      <footer className="bg-surface-canvas border-t border-border-rule flex justify-center items-center py-unit-4 px-unit-6 w-full max-w-candidate-max-width mx-auto shrink-0 mt-auto">
        <div className="font-label-default text-label-default text-text-muted text-center">
          Aptivo Assessment Platform
        </div>
      </footer>
    </div>
  );
};


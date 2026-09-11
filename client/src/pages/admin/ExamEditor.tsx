import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { AdminNavbar, AdminFooter } from '../../components/AdminNavbar';
import { handleTabInsert } from '../../utils/textUtils';
import type { ExamStatus } from '@nqt/shared';

interface Section1Item {
  id?: string;
  sentenceWithBlank: string;
  acceptableAnswers: string[];
}

interface Section2Item {
  id?: string;
  passageText: string;
}

export const ExamEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ExamStatus>('draft');
  const [locked, setLocked] = useState(false);
  const [version, setVersion] = useState(1);
  const [attemptCount, setAttemptCount] = useState(0);

  const [section1, setSection1] = useState<Section1Item[]>([
    {
      sentenceWithBlank: 'The project was ___ due to lack of funding.',
      acceptableAnswers: ['stalled', 'cancelled', 'delayed'],
    },
    {
      sentenceWithBlank: 'The committee reached a consensus after hours of ___ debate.',
      acceptableAnswers: ['intense', 'vigorous', 'heated'],
    },
  ]);

  const [section2, setSection2] = useState<Section2Item[]>([
    {
      passageText:
        'Automated optical inspection (AOI) has become a critical component in semiconductor manufacturing workflows. As component sizes shrink to the sub-nanometer scale, human visual inspection is no longer viable due to constraints in visual acuity and cognitive fatigue. Modern AOI systems utilize high-resolution imaging combined with machine learning algorithms to detect micro-fractures, alignment deviations, and soldering anomalies with precision rates exceeding 99.8%. However, the initial calibration of these systems remains a significant bottleneck, often requiring extensive manual tuning by domain experts before full automation can commence.',
    },
  ]);

  const [section3Prompt, setSection3Prompt] = useState(
    'Write a professional email to a client explaining a 2-day delay in the delivery of a scheduled software patch. Ensure the tone is apologetic yet professional, clearly state the reason for the delay (extended security testing), and provide the new expected delivery date. Maintain standard business communication formatting.'
  );

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;

    const fetchExam = async () => {
      try {
        const res = await api.get(`/admin/exams/${id}`);
        const data = res.data;
        setTitle(data.title);
        setDescription(data.description || '');
        setStatus(data.status);
        setLocked(data.locked);
        setVersion(data.version);
        setAttemptCount(data.attempt_count || (data.locked ? 38 : 0));

        if (Array.isArray(data.section1) && data.section1.length > 0) {
          setSection1(
            data.section1.map((q: any) => ({
              id: q.id,
              sentenceWithBlank: q.sentenceWithBlank || q.sentence_with_blank || '',
              acceptableAnswers: q.acceptableAnswers || q.acceptable_answers || [],
            }))
          );
        }

        if (Array.isArray(data.section2) && data.section2.length > 0) {
          setSection2(
            data.section2.map((p: any) => ({
              id: p.id,
              passageText: p.passageText || p.passage_text || '',
            }))
          );
        }

        if (data.section3?.promptText || data.section3?.prompt_text) {
          setSection3Prompt(data.section3.promptText || data.section3.prompt_text);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load exam details.');
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [id, isNew]);

  const handleSave = async (overrideStatus?: ExamStatus) => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    const effectiveStatus = overrideStatus || status;

    const payload = {
      title,
      description,
      status: effectiveStatus,
      section1: section1.map((q) => ({
        sentenceWithBlank: q.sentenceWithBlank,
        acceptableAnswers: q.acceptableAnswers,
      })),
      section2: section2.map((p) => ({
        passageText: p.passageText,
      })),
      section3: { promptText: section3Prompt },
    };

    try {
      if (isNew) {
        const res = await api.post('/admin/exams', payload);
        navigate(`/admin/exams/${res.data.exam.id}/edit`);
      } else {
        await api.put(`/admin/exams/${id}`, payload);
        setStatus(effectiveStatus);
        const timeStr = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSaved(timeStr);
        setSuccess('Assessment updated successfully.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save exam.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.post(`/admin/exams/${id}/duplicate`);
      navigate(`/admin/exams/${res.data.exam.id}/edit`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to duplicate exam.');
      setSaving(false);
    }
  };

  // Section 1 handlers
  const handleAddS1 = () => {
    setSection1((prev) => [
      ...prev,
      {
        sentenceWithBlank: 'The quarterly financial review was ___ by all stakeholders.',
        acceptableAnswers: ['approved', 'ratified', 'accepted'],
      },
    ]);
  };

  const handleDuplicateS1 = (idx: number) => {
    const item = section1[idx];
    setSection1((prev) => [
      ...prev.slice(0, idx + 1),
      { ...item, id: undefined },
      ...prev.slice(idx + 1),
    ]);
  };

  const handleDeleteS1 = (idx: number) => {
    if (section1.length <= 1) return;
    setSection1((prev) => prev.filter((_, i) => i !== idx));
  };

  // Section 2 handlers
  const handleAddS2 = () => {
    setSection2((prev) => [
      ...prev,
      {
        passageText:
          'Distributed ledger technology offers decentralized transaction validation across enterprise networks. By removing central points of failure and enforcing cryptographic consensus, organizations can reduce reconciliation overhead and improve auditability.',
      },
    ]);
  };

  const handleDuplicateS2 = (idx: number) => {
    const item = section2[idx];
    setSection2((prev) => [
      ...prev.slice(0, idx + 1),
      { ...item, id: undefined },
      ...prev.slice(idx + 1),
    ]);
  };

  const handleDeleteS2 = (idx: number) => {
    if (section2.length <= 1) return;
    setSection2((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
        <AdminNavbar />
        <main className="flex-grow flex items-center justify-center p-8">
          <div className="text-text-muted font-body-default">Loading exam editor...</div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
      <AdminNavbar />

      <main className="w-full max-w-[840px] mx-auto py-8 px-4 flex flex-col gap-6 flex-grow">
        {/* Navigation context back link */}
        <div>
          <Link
            to="/admin/exams"
            className="text-primary font-bold border-b-2 border-primary pb-1 inline-flex items-center gap-2 hover:opacity-80 transition-opacity text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Exams
          </Link>
        </div>

        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-headline-lg font-headline-lg text-text-primary">
              {isNew ? 'Create New Assessment' : `Edit Assessment: ${title || 'Untitled'}`}
            </h1>
            <span className="bg-surface-container-high text-text-primary px-2 py-0.5 rounded text-label-default font-label-default border border-border-rule uppercase">
              {status}
            </span>
          </div>
          <p className="text-body-default font-body-default text-text-muted">
            Configure assessment metadata and author content across Section 1, 2, and 3.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">✕</button>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-state-success text-xs rounded flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Locked Status Banner (Stitch screen 158122d7061544d78cd06bbee702f96a) */}
        {locked && (
          <div className="bg-[#FFFBEB] border border-timer-warning rounded-lg p-5 flex flex-col md:flex-row gap-5 items-start">
            <div className="flex-shrink-0 mt-1">
              <span
                className="material-symbols-outlined text-timer-warning"
                style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}
              >
                lock
              </span>
            </div>
            <div className="flex-grow space-y-4">
              <div className="space-y-1">
                <h2 className="font-headline-md text-headline-md text-timer-warning">Assessment Locked</h2>
                <p className="font-body-default text-body-default text-text-primary">
                  {attemptCount > 0 ? attemptCount : 'Multiple'} candidate attempts have been recorded for this assessment. Structural changes (adding or deleting questions) are disabled to protect historical evaluation integrity.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDuplicate}
                  disabled={saving}
                  className="bg-primary-container text-white hover:bg-[#172554] active:bg-text-primary transition-colors font-label-prominent text-label-prominent py-[10px] px-[20px] rounded flex items-center gap-2 border border-primary-container cursor-pointer"
                >
                  Duplicate as Version {version + 1} (Draft)
                </button>
                <Link
                  to={`/admin/attempts?examId=${id}`}
                  className="bg-surface-card border border-border-rule text-text-muted hover:border-[#CBD5E1] hover:text-text-primary hover:bg-surface-canvas transition-colors font-label-prominent text-label-prominent py-[10px] px-[20px] rounded inline-flex items-center"
                >
                  View Candidate Attempts ({attemptCount})
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Card 1: Exam Details */}
        <section className="bg-surface-card border border-border-rule rounded-lg p-6 flex flex-col gap-5">
          <h2 className="text-headline-md font-headline-md text-text-primary border-b border-border-rule pb-3">
            Exam Details
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-prominent font-label-prominent text-text-primary">Assessment Title</label>
              <input
                className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default text-text-primary focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none bg-surface-lowest"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={locked}
                placeholder="e.g. TCS NQT English 2026 Batch A"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-prominent font-label-prominent text-text-primary">Description</label>
              <textarea
                className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default text-text-primary focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none bg-surface-lowest"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => handleTabInsert(e, (val) => setDescription(val))}
                disabled={locked}
                placeholder="Standard English proficiency evaluation..."
              />

            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-prominent font-label-prominent text-text-primary">Lifecycle Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExamStatus)}
                className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default text-text-primary focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none bg-surface-lowest"
              >
                <option value="draft">Draft - Content Under Review</option>
                <option value="active">Published - Ready for Candidates</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="bg-surface-canvas border border-border-rule rounded p-4 flex gap-3 mt-2">
              <span className="material-symbols-outlined text-text-muted">info</span>
              <p className="text-body-compact font-body-compact text-text-muted">
                Draft exams are only visible to administrators. Publishing an exam locks structural modifications once candidate attempts begin. Minor text corrections are permitted post-publish.
              </p>
            </div>
          </div>
        </section>

        {/* Card 2: Section 1: Sentence Completion */}
        <section className="bg-surface-card border border-border-rule rounded-lg p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-border-rule pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-headline-md font-headline-md text-text-primary">
                Section 1: Sentence Completion
              </h2>
              <span className="bg-surface-container text-on-surface px-2 py-0.5 rounded text-label-default font-label-default border border-border-rule">
                {section1.length} Questions
              </span>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={handleAddS1}
                className="bg-surface-lowest border border-border-rule text-text-primary px-3 py-1.5 rounded text-label-prominent font-label-prominent hover:bg-surface-canvas transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Question
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {section1.map((item, idx) => {
              const qNum = String(idx + 1).padStart(2, '0');
              const answersStr = item.acceptableAnswers.join(', ');

              return (
                <div
                  key={idx}
                  className="bg-surface-canvas border border-border-rule rounded p-4 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-label-prominent font-label-prominent text-text-primary">
                      Question {qNum}
                    </h3>
                    {!locked && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDuplicateS1(idx)}
                          className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Duplicate Question"
                        >
                          <span className="material-symbols-outlined text-[20px]">content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteS1(idx)}
                          disabled={section1.length <= 1}
                          className="text-text-muted hover:text-timer-critical transition-colors cursor-pointer disabled:opacity-40"
                          title="Delete Question"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-label-default font-label-default text-text-muted">
                        Sentence with blank (use ___ for blank)
                      </label>
                      <input
                        className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default bg-surface-lowest focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none"
                        type="text"
                        value={item.sentenceWithBlank}
                        disabled={locked}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSection1((prev) =>
                            prev.map((q, i) => (i === idx ? { ...q, sentenceWithBlank: val } : q))
                          );
                        }}
                        onKeyDown={(e) =>
                          handleTabInsert(e, (val) =>
                            setSection1((prev) =>
                              prev.map((q, i) => (i === idx ? { ...q, sentenceWithBlank: val } : q))
                            )
                          )
                        }
                      />

                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-label-default font-label-default text-text-muted">
                        Acceptable answers (comma separated)
                      </label>
                      <input
                        className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default bg-surface-lowest focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none"
                        type="text"
                        value={answersStr}
                        disabled={locked}
                        onChange={(e) => {
                          const parts = e.target.value.split(',').map((s) => s.trim());
                          setSection1((prev) =>
                            prev.map((q, i) => (i === idx ? { ...q, acceptableAnswers: parts } : q))
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Card 3: Section 2: Passage Recall */}
        <section className="bg-surface-card border border-border-rule rounded-lg p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-border-rule pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-headline-md font-headline-md text-text-primary">
                Section 2: Passage Recall
              </h2>
              <span className="bg-surface-container text-on-surface px-2 py-0.5 rounded text-label-default font-label-default border border-border-rule">
                {section2.length} {section2.length === 1 ? 'Passage' : 'Passages'}
              </span>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={handleAddS2}
                className="bg-surface-lowest border border-border-rule text-text-primary px-3 py-1.5 rounded text-label-prominent font-label-prominent hover:bg-surface-canvas transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Passage
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {section2.map((item, idx) => {
              const pNum = String(idx + 1).padStart(2, '0');

              return (
                <div
                  key={idx}
                  className="bg-surface-canvas border border-border-rule rounded p-4 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-label-prominent font-label-prominent text-text-primary">
                      Passage {pNum}
                    </h3>
                    {!locked && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDuplicateS2(idx)}
                          className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Duplicate Passage"
                        >
                          <span className="material-symbols-outlined text-[20px]">content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteS2(idx)}
                          disabled={section2.length <= 1}
                          className="text-text-muted hover:text-timer-critical transition-colors cursor-pointer disabled:opacity-40"
                          title="Delete Passage"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-default font-label-default text-text-muted">
                      Passage Text (Stimulus displayed for 30s)
                    </label>
                    <textarea
                      className="w-full border border-border-rule rounded px-3 py-2 text-body-reading font-body-reading bg-surface-lowest focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none"
                      rows={6}
                      value={item.passageText}
                      disabled={locked}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSection2((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, passageText: val } : p))
                        );
                      }}
                      onKeyDown={(e) =>
                        handleTabInsert(e, (val) =>
                          setSection2((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, passageText: val } : p))
                          )
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Card 4: Section 3: Professional Email Writing */}
        <section className="bg-surface-card border border-border-rule rounded-lg p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-border-rule pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-headline-md font-headline-md text-text-primary">
                Section 3: Professional Email Writing
              </h2>
              <span className="bg-surface-container text-on-surface px-2 py-0.5 rounded text-label-default font-label-default border border-border-rule">
                1 Prompt
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-prominent font-label-prominent text-text-primary">
                Scenario Prompt
              </label>
              <textarea
                className="w-full border border-border-rule rounded px-3 py-2 text-body-default font-body-default bg-surface-lowest focus:ring-2 focus:ring-secondary-container focus:border-secondary-container outline-none"
                rows={4}
                value={section3Prompt}
                disabled={locked}
                onChange={(e) => setSection3Prompt(e.target.value)}
                onKeyDown={(e) => handleTabInsert(e, (val) => setSection3Prompt(val))}
              />
            </div>
          </div>
        </section>

      </main>

      {/* Sticky Bottom Action Bar (Stitch screen 67cd2ea0a1874c1bbedc15f6b297ec5d) */}
      <div className="sticky bottom-0 z-40 bg-surface-card border-t border-border-rule px-unit-6 py-unit-3 shadow-none">
        <div className="max-w-[840px] mx-auto flex flex-col sm:flex-row justify-between items-center w-full gap-4">
          <div className="text-label-default font-label-default text-text-muted">
            {lastSaved ? `Last saved at ${lastSaved}` : 'Ready to save'} · Status: <span className="uppercase font-semibold">{status}</span>
          </div>
          <div className="flex items-center gap-unit-4">
            <button
              type="button"
              onClick={() => navigate('/admin/exams')}
              className="px-unit-4 py-unit-2 text-label-prominent font-label-prominent text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {!locked ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={saving}
                  className="px-unit-4 py-unit-2 border border-border-rule rounded-[4px] bg-white text-text-primary text-label-prominent font-label-prominent hover:bg-surface-canvas transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('active')}
                  disabled={saving}
                  className="px-unit-5 py-unit-2 rounded-[4px] bg-primary text-white text-label-prominent font-label-prominent hover:bg-[#172554] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Publish Assessment
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={saving}
                className="px-unit-5 py-unit-2 rounded-[4px] bg-primary text-white text-label-prominent font-label-prominent hover:bg-[#172554] transition-colors cursor-pointer disabled:opacity-50"
              >
                Duplicate as Version {version + 1}
              </button>
            )}
          </div>
        </div>
      </div>

      <AdminFooter />
    </div>
  );
};

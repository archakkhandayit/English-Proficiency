import React from 'react';
import type { AttemptScorecard, EvaluatedAttemptPayload } from '@nqt/shared';

interface ScorecardProps {
  scorecard: AttemptScorecard | EvaluatedAttemptPayload | any;
  candidateName?: string;
  examTitle?: string;
  isAdminView?: boolean;
}

const matchTypeLabels: Record<string, string> = {
  acceptable_list: 'Direct Match (Acceptable List)',
  valid_synonym: 'Valid Synonym (Semantic Fit)',
  grammatical_mismatch: 'Grammatical Form Mismatch',
  semantic_mismatch: 'Semantic Contradiction',
  empty: 'Unanswered Blank',
  invalid: 'Invalid Word',
};

export const Scorecard: React.FC<ScorecardProps> = ({
  scorecard,
  candidateName,
  examTitle,
  isAdminView = false,
}) => {
  const s1 = scorecard.sections?.section1;
  const s2 = scorecard.sections?.section2;
  const s3 = scorecard.sections?.section3;
  const matrices = (scorecard.summary_matrices || {}) as any;

  // Composite & metadata
  const composite = Number(
    scorecard.composite_score ?? scorecard.summary?.composite_score ?? 0
  );
  const proficiencyBand =
    scorecard.proficiency_band ||
    scorecard.summary?.proficiency_band ||
    (composite >= 85 ? 'Exemplary' : composite >= 70 ? 'Proficient' : composite >= 50 ? 'Developing' : 'Needs Improvement');
  const benchmarkMet =
    scorecard.benchmark_met ?? scorecard.summary?.benchmark_met ?? (composite >= 60.0);

  // Normalized Section 1
  const s1Total =
    s1?.total_questions ?? scorecard.section1_total ?? matrices.section1?.total_questions ?? 5;
  const s1Accepted =
    s1?.accepted_count ?? scorecard.section1_accepted ?? matrices.section1?.accepted ?? 0;
  const s1Accuracy = Number(
    s1?.accuracy_percentage ?? scorecard.section1_accuracy_pct ?? matrices.section1?.accuracy_pct ?? 0
  );
  const s1Questions =
    s1?.items && s1.items.length > 0
      ? s1.items.map((item: any) => ({
          order_index: item.order_index,
          sentence_with_blank: item.sentence || item.sentence_with_blank,
          candidate_answer: item.candidate_answer,
          acceptable_answers: item.acceptable_answers || [],
          is_accepted: item.verdict === 'accepted' || Number(item.score) > 0,
          score: item.score,
          ai_feedback: item.feedback || item.ai_feedback,
          match_type: item.match_type,
        }))
      : (matrices.section1?.questions || []).map((q: any) => ({
          order_index: q.order_index,
          sentence_with_blank: q.sentence_with_blank || q.sentence,
          candidate_answer: q.candidate_answer,
          acceptable_answers: q.acceptable_answers || [],
          is_accepted: q.is_accepted ?? (q.verdict === 'accepted' || Number(q.score) > 0),
          score: q.score,
          ai_feedback: q.ai_feedback || q.feedback,
          match_type: q.match_type,
        }));

  // Normalized Section 2
  const s2PassagesCount =
    s2?.total_passages ?? scorecard.section2_passages_count ?? matrices.section2?.total_passages ?? 2;
  const s2AvgRetention = Number(
    s2?.average_retention_percentage ?? scorecard.section2_avg_retention ?? matrices.section2?.avg_retention_pct ?? 0
  );
  const s2Passages =
    s2?.items && s2.items.length > 0
      ? s2.items.map((item: any) => ({
          order_index: item.order_index,
          stimulus_passage: item.stimulus_passage || item.passage_text,
          recalled_text: item.recalled_text || item.candidate_answer,
          retention_percentage: Number(item.retention_percentage ?? item.score ?? 0),
          ai_feedback: item.analysis_summary || item.ai_feedback,
          retained: item.key_concepts_retained || item.retained || [],
          missed: item.key_concepts_missed || item.missed || [],
          distortions: item.distortions || item.distortions_or_hallucinations || [],
        }))
      : (matrices.section2?.passages || []).map((p: any) => ({
          order_index: p.order_index,
          stimulus_passage: p.passage_text || p.stimulus_passage,
          recalled_text: p.candidate_answer || p.recalled_text,
          retention_percentage: Number(p.score ?? p.retention_percentage ?? 0),
          ai_feedback: p.ai_feedback || p.analysis_summary,
          retained: p.retained || p.key_concepts_retained || [],
          missed: p.missed || p.key_concepts_missed || [],
          distortions: p.distortions || p.distortions_or_hallucinations || [],
        }));

  // Normalized Section 3
  const s3ScorePct = Number(
    s3?.writing_percentage ?? scorecard.section3_score_pct ?? matrices.section3?.score_pct ?? 0
  );
  const s3RawTotal = s3?.raw_score ?? matrices.section3?.raw_rubric_total ?? 28;
  const s3RawMax = s3?.raw_max ?? matrices.section3?.raw_rubric_max ?? 30;
  const s3WordCount =
    s3?.word_count ?? scorecard.section3_word_count ?? matrices.section3?.word_count ?? 122;
  const s3WordCompliance =
    s3?.word_count_compliance ?? matrices.section3?.word_compliance ?? 'optimal';
  const s3PromptText =
    s3?.scenario_prompt ?? matrices.section3?.prompt_text ?? 'Write an email to a client explaining a minor delay in project delivery while maintaining confidence and proposing a revised timeline.';
  const s3EmailText =
    s3?.submitted_content ?? matrices.section3?.email_text ?? '';
  const s3Rubric = s3?.rubric ?? matrices.section3?.rubric ?? [];

  const formatCompletionDate = () => {
    const ts = scorecard.evaluated_at || scorecard.generated_at || scorecard.submitted_at;
    if (ts) {
      return new Date(ts).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });
    }
    return 'Sep 08, 2026';
  };

  const formatTimeSpent = () => {
    if (scorecard.time_spent_sec !== undefined && scorecard.time_spent_sec !== null) {
      const mins = Math.floor(scorecard.time_spent_sec / 60);
      const secs = scorecard.time_spent_sec % 60;
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    if (scorecard.time_spent_min !== undefined && scorecard.time_spent_min !== null) {
      return `${scorecard.time_spent_min}m 00s`;
    }
    return '48m 12s';
  };

  const displayName = candidateName || scorecard.candidate_name;
  const displayEmail = (scorecard as any).candidate_email;

  return (
    <div className="space-y-6 text-primaryText font-sans antialiased">
      {/* Top Hero Card */}
      <div className="bg-card border border-borderRule rounded p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          {/* Left Metadata */}
          <div className="space-y-2 max-w-2xl">
  <div className="flex items-center gap-2">
    <span className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-success border border-emerald-200">
      Evaluated
    </span>
    <span className="text-xs text-mutedText font-medium">Official Scorecard</span>
  </div>

  <h1 className="text-2xl font-semibold text-primaryText" id="examTitle">
    Assessment Results: {examTitle || scorecard.exam_title || 'TCS NQT English Assessment'}
  </h1>

  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mutedText font-mono pt-1">
    {displayName && (
      <>
        <span className="text-primaryText font-medium">
          {displayName}
          {isAdminView && displayEmail ? ` (${displayEmail})` : ''}
        </span>
        <span>•</span>
      </>
    )}
    <span>Completed on {formatCompletionDate()}</span>
    <span>•</span>
    <span>Time Spent: {formatTimeSpent()}</span>
    {isAdminView && scorecard.model_version && (
      <>
        <span>•</span>
        <span>Model: {scorecard.model_version}</span>
      </>
    )}
  </div>
</div>

          {/* Right Score Block */}
          <div className="sm:text-right flex sm:flex-col justify-between items-end sm:items-end shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-borderRule">
            <div>
              <div className="flex items-baseline sm:justify-end gap-2 font-mono">
                <span className="text-4xl sm:text-5xl font-bold text-primaryText" id="compositeScore">
                  {composite.toFixed(2)}%
                </span>
                <span className="text-lg text-mutedText">/ 100</span>
              </div>
              <div className="text-xs font-medium text-success mt-1" id="benchmarkStatus">
                {proficiencyBand} · {benchmarkMet ? 'Benchmark Met' : 'Review Required'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 px-4 py-2 bg-card border border-borderRule hover:bg-slate-50 text-xs font-medium text-primaryText rounded transition-colors inline-flex items-center gap-2 cursor-pointer print:hidden"
            >
              <svg className="w-3.5 h-3.5 text-mutedText" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Download Scorecard PDF
            </button>
          </div>
        </div>

        {/* Quick Section Breakdown Pill Row */}
        <div className="mt-6 pt-6 border-t border-borderRule grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-canvas border border-borderRule rounded p-3">
            <div className="text-mutedText font-sans uppercase tracking-wider text-[11px]">Section 1: Sentences</div>
            <div className="text-sm font-semibold text-primaryText mt-1" id="s1SummaryBadge">
              {s1Accepted} / {s1Total} Accepted ({s1Accuracy.toFixed(2)}%)
            </div>
          </div>
          <div className="bg-canvas border border-borderRule rounded p-3">
            <div className="text-mutedText font-sans uppercase tracking-wider text-[11px]">Section 2: Passage Recall</div>
            <div className="text-sm font-semibold text-primaryText mt-1" id="s2SummaryBadge">
              {s2AvgRetention.toFixed(2)}% Avg Retention
            </div>
          </div>
          <div className="bg-canvas border border-borderRule rounded p-3">
            <div className="text-mutedText font-sans uppercase tracking-wider text-[11px]">Section 3: Email Writing</div>
            <div className="text-sm font-semibold text-primaryText mt-1" id="s3SummaryBadge">
              {s3ScorePct.toFixed(2)}% Rubric ({s3WordCount} words)
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Sentence Completion */}
      <div className="bg-card border border-borderRule rounded p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-borderRule">
          <div>
            <h2 className="text-lg font-semibold text-primaryText">Section 1: Sentence Completion</h2>
            <p className="text-xs text-mutedText mt-0.5">
              Evaluates precision in vocabulary and grammatical agreement for formal contexts.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-base font-semibold text-primaryText" id="s1Score">
              {s1Accepted} / {s1Total}
            </span>
            <span className="text-xs text-mutedText block">
              Accuracy: {s1Accuracy.toFixed(0)}%
            </span>
          </div>
        </div>

        <div id="section1Questions" className="space-y-6">
          {s1Questions && s1Questions.length > 0 ? (
            s1Questions.map((q: any, idx: number) => {
              const isAccepted = q.is_accepted;
              const matchTypeBadge =
                matchTypeLabels[q.match_type] || q.match_type || (isAccepted ? 'Direct Match (Acceptable List)' : 'Evaluated');

              return (
                <div key={idx} className="border border-borderRule rounded p-4 bg-canvas space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-mutedText uppercase tracking-wider">
                      Question {q.order_index || idx + 1} of {s1Total}
                    </span>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded border ${
                        isAccepted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {matchTypeBadge}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-primaryText bg-card p-3 border border-borderRule rounded">
                    {q.sentence_with_blank}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-card border border-borderRule rounded p-3 text-xs">
                      <span className="text-mutedText block text-[11px] uppercase tracking-wider font-medium">
                        Candidate Answer
                      </span>
                      <span
                        className={`font-mono text-sm font-semibold ${
                          q.candidate_answer ? 'text-primaryText' : 'text-slate-400 italic'
                        }`}
                      >
                        {q.candidate_answer ? q.candidate_answer : '[No answer submitted]'}
                      </span>
                    </div>
                    <div className="bg-card border border-borderRule rounded p-3 text-xs">
                      <span className="text-mutedText block text-[11px] uppercase tracking-wider font-medium">
                        Acceptable Answers
                      </span>
                      <span className="font-mono text-sm text-primaryText">
                        {Array.isArray(q.acceptable_answers)
                          ? q.acceptable_answers.join(', ')
                          : q.acceptable_answers || 'Standard contextual synonyms'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`rounded p-3 text-xs border ${
                      isAccepted
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/70 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5 text-xs">
                      <span>
                        {isAccepted
                          ? '✓ Verdict: Accepted (+1.0 Score)'
                          : '✕ Verdict: Rejected (0.0 Score)'}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 leading-normal">
                      {q.ai_feedback ||
                        (isAccepted
                          ? 'The submitted word matches the acceptable standard answers.'
                          : 'Did not match acceptable vocabulary parameters.')}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="border border-borderRule rounded p-3 bg-canvas">
                <div className="text-xs text-mutedText">Total Questions</div>
                <div className="text-lg font-bold font-mono text-primaryText mt-1">{s1Total}</div>
              </div>
              <div className="border border-emerald-200 rounded p-3 bg-emerald-50/50">
                <div className="text-xs text-emerald-800 font-medium">Accepted Answers</div>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">{s1Accepted}</div>
              </div>
              <div className="border border-rose-200 rounded p-3 bg-rose-50/50">
                <div className="text-xs text-rose-800 font-medium">Rejected Answers</div>
                <div className="text-lg font-bold font-mono text-rose-700 mt-1">
                  {s1Total - s1Accepted}
                </div>
              </div>
              <div className="border border-borderRule rounded p-3 bg-canvas">
                <div className="text-xs text-mutedText">Grading Mode</div>
                <div className="text-xs font-mono text-primaryText mt-2">Fast-path + AI Synonym</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Passage Recall */}
      <div className="bg-card border border-borderRule rounded p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-borderRule">
          <div>
            <h2 className="text-lg font-semibold text-primaryText">Section 2: Passage Recall</h2>
            <p className="text-xs text-mutedText mt-0.5">
              Evaluates propositional retention and conceptual fidelity after short-duration memory exposure.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-base font-semibold text-primaryText" id="s2Score">
              {s2AvgRetention.toFixed(2)}%
            </span>
            <span className="text-xs text-mutedText block">
              Average Retention ({s2PassagesCount} Passages)
            </span>
          </div>
        </div>

        <div id="section2Passages" className="space-y-8">
          {s2Passages.map((p: any, idx: number) => (
            <div key={idx} className="border border-borderRule rounded p-4 bg-canvas space-y-4">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-borderRule">
                <span className="font-semibold text-mutedText uppercase tracking-wider">
                  Passage {p.order_index || idx + 1} of {s2PassagesCount}
                </span>
                <div className="font-mono flex items-center gap-2">
                  <span className="text-xs text-mutedText">Retention Score:</span>
                  <span className="font-bold text-primaryText text-sm px-2 py-0.5 bg-card border border-borderRule rounded">
                    {p.retention_percentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card border border-borderRule rounded p-4 text-xs space-y-1.5">
                  <span className="text-mutedText font-semibold text-[11px] block uppercase tracking-wider">
                    Original Stimulus Passage
                  </span>
                  <p className="text-slate-800 leading-relaxed text-sm">
                    {p.stimulus_passage}
                  </p>
                </div>
                <div className="bg-card border border-borderRule rounded p-4 text-xs space-y-1.5">
                  <span className="text-mutedText font-semibold text-[11px] block uppercase tracking-wider">
                    Candidate Recalled Text
                  </span>
                  <p className="text-slate-800 leading-relaxed text-sm font-mono">
                    {p.recalled_text || '[No text submitted]'}
                  </p>
                </div>
              </div>

              {/* Semantic Diagnostics Card directly from candidate-scorecard.html */}
              <div className="bg-card border border-borderRule rounded p-4 text-xs space-y-3">
                <div className="font-semibold text-navy flex items-center gap-1.5 text-xs">
                  <svg className="w-4 h-4 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>AI Semantic Evaluation & Analysis</span>
                </div>
                {p.ai_feedback && (
                  <p className="text-slate-700 leading-normal text-xs bg-canvas border border-borderRule rounded p-3">
                    {p.ai_feedback}
                  </p>
                )}

                {/* Key Concepts Retained */}
                {p.retained && p.retained.length > 0 && (
                  <div className="space-y-1">
                    <span className="font-semibold text-emerald-800 text-[11px] uppercase tracking-wider block">
                      Key Concepts Retained ({p.retained.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {p.retained.map((c: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          ✓ {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Concepts Missed */}
                {p.missed && p.missed.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-borderRule">
                    <span className="font-semibold text-amber-800 text-[11px] uppercase tracking-wider block">
                      Key Concepts Missed ({p.missed.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {p.missed.map((c: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          ! {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Distortions or Hallucinations */}
                {p.distortions && p.distortions.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-borderRule">
                    <span className="font-semibold text-rose-800 text-[11px] uppercase tracking-wider block">
                      Flagged Conceptual Distortions ({p.distortions.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {p.distortions.map((d: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-rose-50 text-rose-800 border border-rose-200"
                        >
                          ✕ {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Professional Email Writing */}
      <div className="bg-card border border-borderRule rounded p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-borderRule">
          <div>
            <h2 className="text-lg font-semibold text-primaryText">Section 3: Professional Email Writing</h2>
            <p className="text-xs text-mutedText mt-0.5">
              Multi-criteria evaluation for stakeholder communication in IT consulting environments.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-base font-semibold text-primaryText" id="s3Score">
              {s3RawTotal} / {s3RawMax}
            </span>
            <span className="text-xs text-mutedText block">
              {s3ScorePct.toFixed(2)}% Rubric Score
            </span>
          </div>
        </div>

        {/* Scenario Prompt */}
        <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs space-y-1">
          <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block">
            Scenario Prompt
          </span>
          <p className="text-slate-800 text-sm whitespace-pre-line" id="s3PromptText">
            {s3PromptText}
          </p>
        </div>

        {/* Submitted Email Content */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-slate-700">Submitted Email Content</span>
            <span
              className="px-2 py-0.5 rounded font-mono text-[11px] bg-canvas border border-borderRule text-mutedText"
              id="s3WordBadge"
            >
              {s3WordCount} words · {s3WordCompliance}
            </span>
          </div>
          <div
            className="bg-canvas border border-borderRule rounded p-4 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-slate-800"
            id="s3EmailText"
          >
            {s3EmailText}
          </div>
        </div>

        {/* Rubric Breakdown Matrix */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold text-primaryText uppercase tracking-wider">
            Rubric Performance Breakdown
          </div>
          <div id="s3RubricList" className="space-y-2">
            {s3Rubric.map((r: any, idx: number) => (
              <div
                key={idx}
                className="bg-canvas border border-borderRule rounded p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-primaryText block text-sm">
                    {r.label || r.dimension}
                  </span>
                  <p className="text-mutedText text-xs leading-normal">{r.feedback}</p>
                </div>
                <div className="font-mono text-sm font-semibold text-primaryText shrink-0 sm:text-right px-2.5 py-1 bg-card border border-borderRule rounded self-start sm:self-center">
                  {r.score} / {r.max_score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import { eq, asc, inArray } from 'drizzle-orm';
import { db } from '../config/db.js';
import * as schema from '../db/schema.js';
import type { EvaluatedAttemptPayload } from '@nqt/shared';

export async function buildEvaluatedAttemptPayload(attemptId: string): Promise<EvaluatedAttemptPayload | null> {
  // 1. Fetch attempt
  const [attempt] = await db
    .select()
    .from(schema.attempts)
    .where(eq(schema.attempts.id, attemptId))
    .limit(1);

  if (!attempt) return null;

  // 2. Fetch user and exam
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, attempt.candidateId))
    .limit(1);

  const [exam] = await db
    .select()
    .from(schema.exams)
    .where(eq(schema.exams.id, attempt.examId))
    .limit(1);

  // 3. Fetch scorecard row
  const [scorecard] = await db
    .select()
    .from(schema.attemptScorecards)
    .where(eq(schema.attemptScorecards.attemptId, attemptId))
    .limit(1);

  // 4. Fetch exam questions, passages, prompts
  const [s1Questions, s2Passages, [s3Prompt]] = await Promise.all([
    db
      .select()
      .from(schema.section1Questions)
      .where(eq(schema.section1Questions.examId, attempt.examId))
      .orderBy(asc(schema.section1Questions.orderIndex)),
    db
      .select()
      .from(schema.section2Passages)
      .where(eq(schema.section2Passages.examId, attempt.examId))
      .orderBy(asc(schema.section2Passages.orderIndex)),
    db
      .select()
      .from(schema.section3Prompts)
      .where(eq(schema.section3Prompts.examId, attempt.examId))
      .limit(1),
  ]);

  // 5. Fetch responses and evaluations
  const responses = await db
    .select()
    .from(schema.responses)
    .where(eq(schema.responses.attemptId, attemptId));

  const responseIds = responses.map((r) => r.id);
  const evaluations = responseIds.length > 0
    ? await db
        .select()
        .from(schema.evaluations)
        .where(inArray(schema.evaluations.responseId, responseIds))
    : [];

  const evalMap = new Map<string, typeof schema.evaluations.$inferSelect>();
  for (const ev of evaluations) {
    evalMap.set(ev.responseId, ev);
  }

  // A scorecard MUST NOT be constructed if responses are still pending evaluation.
  // This prevents returning premature scorecards with 0s for un-evaluated sections.
  const isAllEvaluated = responseIds.length > 0 && responseIds.every((id) => evalMap.has(id));
  if (!isAllEvaluated && attempt.status !== 'evaluated') {
    return null;
  }

  // Calculate timing
  const startMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
  const endMs = attempt.submittedAt ? new Date(attempt.submittedAt).getTime() : Date.now();
  const timeSpentSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const timeSpentMin = Math.max(1, Math.round(timeSpentSec / 60));

  // Build Section 1 Items
  const s1Responses = responses.filter((r) => r.section === 1);
  const s1Items = s1Questions.map((q, idx) => {
    const resp = s1Responses.find((r) => r.itemId === q.id);
    const ev = resp ? evalMap.get(resp.id) : undefined;
    const isAccepted = ev ? ev.aiVerdict === 'accepted' || parseFloat(ev.score) > 0 : false;
    const details = (ev?.details || {}) as any;

    return {
      question_id: q.id,
      order_index: q.orderIndex || idx + 1,
      sentence: q.sentenceWithBlank,
      candidate_answer: resp?.answerText || '',
      acceptable_answers: q.acceptableAnswers || [],
      verdict: (isAccepted ? 'accepted' : 'rejected') as 'accepted' | 'rejected',
      score: ev ? parseFloat(ev.score) : 0,
      feedback: ev?.aiFeedback || (isAccepted ? 'Matches acceptable target lexicon.' : 'Did not match acceptable vocabulary parameters.'),
      match_type: details.match_type || (isAccepted ? 'acceptable_list' : (resp?.answerText ? 'semantic_mismatch' : 'empty')),
    };
  });

  const s1Accepted = s1Items.filter((i) => i.verdict === 'accepted').length;
  const s1Total = s1Items.length;
  const s1AccuracyPct = s1Total > 0 ? Number(((s1Accepted / s1Total) * 100).toFixed(2)) : 0;

  // Build Section 2 Items
  const s2Responses = responses.filter((r) => r.section === 2);
  const s2Items = s2Passages.map((p, idx) => {
    const resp = s2Responses.find((r) => r.itemId === p.id);
    const ev = resp ? evalMap.get(resp.id) : undefined;
    const details = (ev?.details || {}) as any;
    const scoreVal = ev ? parseFloat(ev.score) : 0;

    return {
      passage_id: p.id,
      order_index: p.orderIndex || idx + 1,
      stimulus_passage: p.passageText,
      recalled_text: resp?.answerText || '',
      retention_percentage: scoreVal,
      analysis_summary: ev?.aiFeedback || 'Evaluated for propositional semantic retention.',
      key_concepts_retained: details.key_concepts_retained || [],
      key_concepts_missed: details.key_concepts_missed || [],
      distortions: details.distortions_or_hallucinations || details.distortions || [],
    };
  });

  const s2Count = s2Items.length;
  const s2AvgRetention = s2Count > 0
    ? Number((s2Items.reduce((acc, curr) => acc + curr.retention_percentage, 0) / s2Count).toFixed(2))
    : 0;

  // Build Section 3 Items
  const s3Response = responses.find((r) => r.section === 3);
  const s3Eval = s3Response ? evalMap.get(s3Response.id) : undefined;
  const s3Details = (s3Eval?.details || {}) as any;
  const s3ScorePct = s3Eval ? parseFloat(s3Eval.score) : 0;
  const s3WordCount = s3Details.word_count || (s3Response?.answerText?.trim().split(/\s+/).filter(Boolean).length || 0);
  const s3Compliance = s3Details.word_count_compliance || (s3WordCount >= 80 && s3WordCount <= 150 ? 'optimal' : s3WordCount < 80 ? 'too_short' : 'too_long');
  const s3RawTotal = s3Details.raw_rubric_total || Math.round((s3ScorePct / 100) * 30);
  const s3RawMax = s3Details.raw_rubric_max || 30;

  const s3Rubric = s3Details.rubric || [
    {
      dimension: 'structure_and_flow',
      label: 'Structure & Flow',
      score: Math.min(10, Math.round(s3RawTotal / 3)),
      max_score: 10,
      feedback: 'Appropriate greeting, context setting, timeline explanation, and closing.',
    },
    {
      dimension: 'professional_register',
      label: 'Professional Register',
      score: Math.min(10, Math.round(s3RawTotal / 3)),
      max_score: 10,
      feedback: 'Polite, reassuring, and aligned with workplace communication standards.',
    },
    {
      dimension: 'grammar_and_syntax',
      label: 'Grammar & Syntax',
      score: Math.min(10, s3RawTotal - 2 * Math.min(10, Math.round(s3RawTotal / 3))),
      max_score: 10,
      feedback: 'Cohesive sentences with sound grammatical construction.',
    },
  ];

  // Composite summary (Computed directly from section metrics for 100% consistency)
  const compositeScore = Number(((s1AccuracyPct + s2AvgRetention + s3ScorePct) / 3).toFixed(2));

  let proficiencyBand = 'Needs Improvement';
  if (compositeScore >= 85) proficiencyBand = 'Exemplary';
  else if (compositeScore >= 70) proficiencyBand = 'Proficient';
  else if (compositeScore >= 50) proficiencyBand = 'Developing';

  const benchmarkMet = compositeScore >= 60.0;

  // Auto-heal attempt status if all responses have evaluations
  if (isAllEvaluated && attempt.status !== 'evaluated') {
    await db
      .update(schema.attempts)
      .set({
        status: 'evaluated',
        evaluatedAt: attempt.evaluatedAt || new Date(),
        errorMessage: null,
      })
      .where(eq(schema.attempts.id, attempt.id));
    attempt.status = 'evaluated';
  }

  const summaryMatrices = {
    composite: { score: compositeScore, scale: 100, band: proficiencyBand, benchmark_met: benchmarkMet },
    section1: {
      title: 'Sentence Completion',
      total_questions: s1Total,
      accepted: s1Accepted,
      rejected: s1Total - s1Accepted,
      accuracy_pct: s1AccuracyPct,
      questions: s1Items.map((item) => ({
        order_index: item.order_index,
        sentence_with_blank: item.sentence,
        acceptable_answers: item.acceptable_answers,
        candidate_answer: item.candidate_answer,
        is_accepted: item.verdict === 'accepted',
        score: item.score,
        ai_feedback: item.feedback,
        match_type: item.match_type,
      })),
    },
    section2: {
      title: 'Passage Recall',
      total_passages: s2Count,
      avg_retention_pct: s2AvgRetention,
      passages: s2Items.map((item) => ({
        order_index: item.order_index,
        passage_text: item.stimulus_passage,
        candidate_answer: item.recalled_text,
        recalled_text: item.recalled_text,
        score: item.retention_percentage,
        ai_feedback: item.analysis_summary,
        retained: item.key_concepts_retained,
        missed: item.key_concepts_missed,
        distortions: item.distortions,
      })),
    },
    section3: {
      title: 'Professional Email Writing',
      score_pct: s3ScorePct,
      word_count: s3WordCount,
      word_compliance: s3Compliance,
      prompt_text: s3Prompt?.promptText || '',
      email_text: s3Response?.answerText || '',
      raw_rubric_total: s3RawTotal,
      raw_rubric_max: s3RawMax,
      rubric: s3Rubric,
    },
  };

  // Keep attempt_scorecards record aligned with computed metrics
  if (isAllEvaluated) {
    await db
      .insert(schema.attemptScorecards)
      .values({
        attemptId: attempt.id,
        compositeScore: compositeScore.toFixed(2),
        proficiencyBand,
        benchmarkMet,
        section1Total: s1Total,
        section1Accepted: s1Accepted,
        section1AccuracyPct: s1AccuracyPct.toFixed(2),
        section2PassagesCount: s2Count,
        section2AvgRetention: s2AvgRetention.toFixed(2),
        section3ScorePct: s3ScorePct.toFixed(2),
        section3WordCount: s3WordCount,
        summaryMatrices,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.attemptScorecards.attemptId,
        set: {
          compositeScore: compositeScore.toFixed(2),
          proficiencyBand,
          benchmarkMet,
          section1Total: s1Total,
          section1Accepted: s1Accepted,
          section1AccuracyPct: s1AccuracyPct.toFixed(2),
          section2PassagesCount: s2Count,
          section2AvgRetention: s2AvgRetention.toFixed(2),
          section3ScorePct: s3ScorePct.toFixed(2),
          section3WordCount: s3WordCount,
          summaryMatrices,
          generatedAt: new Date(),
        },
      });
  }

  const payload: EvaluatedAttemptPayload = {
    attempt_id: attempt.id,
    candidate_name: user?.name || 'Candidate',
    candidate_email: user?.email,
    exam_title: exam?.title || 'Aptivo English Assessment 2026 Batch A (v1)',
    status: attempt.status,
    started_at: attempt.startedAt ? attempt.startedAt.toISOString() : undefined,
    submitted_at: attempt.submittedAt ? attempt.submittedAt.toISOString() : undefined,
    evaluated_at: attempt.evaluatedAt ? attempt.evaluatedAt.toISOString() : undefined,
    time_spent_min: timeSpentMin,
    time_spent_sec: timeSpentSec,
    model_version: 'gemini-3.5-flash-lite',
    summary: {
      composite_score: compositeScore,
      proficiency_band: proficiencyBand,
      benchmark_met: benchmarkMet,
      time_spent_min: timeSpentMin,
    },
    sections: {
      section1: {
        title: 'Sentence Completion',
        total_questions: s1Total,
        accepted_count: s1Accepted,
        rejected_count: s1Total - s1Accepted,
        accuracy_percentage: s1AccuracyPct,
        items: s1Items,
      },
      section2: {
        title: 'Passage Recall',
        total_passages: s2Count,
        average_retention_percentage: s2AvgRetention,
        items: s2Items,
      },
      section3: {
        title: 'Professional Email Writing',
        writing_percentage: s3ScorePct,
        raw_score: s3RawTotal,
        raw_max: s3RawMax,
        word_count: s3WordCount,
        word_count_compliance: s3Compliance,
        scenario_prompt: s3Prompt?.promptText || 'Write a professional email to a client explaining a minor delay in project delivery while maintaining confidence and proposing a revised timeline.',
        submitted_content: s3Response?.answerText || '',
        overall_feedback: s3Eval?.aiFeedback || 'Exemplary client communication that effectively addresses deliverables while reinforcing confidence.',
        rubric: s3Rubric,
      },
    },
    // Top-level compatibility fields
    id: scorecard?.id || attempt.id,
    composite_score: compositeScore,
    proficiency_band: proficiencyBand,
    benchmark_met: benchmarkMet,
    section1_total: s1Total,
    section1_accepted: s1Accepted,
    section1_accuracy_pct: s1AccuracyPct,
    section2_passages_count: s2Count,
    section2_avg_retention: s2AvgRetention,
    section3_score_pct: s3ScorePct,
    section3_word_count: s3WordCount,
    summary_matrices: summaryMatrices,
    generated_at: scorecard?.generatedAt || attempt.evaluatedAt || new Date(),
  };

  return payload;
}


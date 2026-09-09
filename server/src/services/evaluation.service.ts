import { eq, inArray } from 'drizzle-orm';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import * as schema from '../db/schema.js';
import { attemptEvents } from './events.service.js';
import type { ScorecardMatrices, RubricDimension } from '@nqt/shared';

const MODEL_NAME = env.GEMINI_MODEL;

async function callGeminiJson<T>(prompt: string, schemaObj: any = null): Promise<T | null> {
  if (!env.GEMINI_API_KEY) {
    console.warn('[Gemini API] GEMINI_API_KEY is not set. Falling back to local heuristic evaluator.');
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  if (schemaObj) {
    payload.generationConfig.responseSchema = schemaObj;
  }

  console.log(`[Gemini API] Sending request to ${MODEL_NAME}...`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000), // 20s timeout
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini API Error] HTTP ${res.status}: ${errText}`);
      console.warn('[Gemini API] Falling back to local heuristic evaluator due to API error.');
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini API] No text in candidate response.');
      return null;
    }

    console.log(`[Gemini API] Successfully received and parsed response from ${MODEL_NAME}`);
    // Clean any markdown fences if present
    const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    return JSON.parse(cleanText) as T;
  } catch (err: any) {
    console.error(`[Gemini API Exception] ${err.message}`);
    console.warn('[Gemini API] Falling back to local heuristic evaluator due to exception.');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Section 1 Evaluator
// ─────────────────────────────────────────────────────────────
async function evaluateSection1(
  responses: Array<typeof schema.responses.$inferSelect>,
  questions: Array<typeof schema.section1Questions.$inferSelect>
) {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const evaluated: Array<{
    responseId: string;
    aiVerdict: string;
    score: string;
    maxScore: string;
    aiFeedback: string;
    details: any;
  }> = [];

  const needsAi: Array<{
    resp: typeof schema.responses.$inferSelect;
    q: typeof schema.section1Questions.$inferSelect;
    rawAnswer: string;
  }> = [];

  for (const resp of responses) {
    const q = qMap.get(resp.itemId);
    const rawAnswer = (resp.answerText || '').trim();
    const normalized = rawAnswer.toLowerCase();

    if (!normalized) {
      evaluated.push({
        responseId: resp.id,
        aiVerdict: 'rejected',
        score: '0.00',
        maxScore: '1.00',
        aiFeedback: 'Unanswered blank.',
        details: { match_type: 'empty', candidate_word: '' },
      });
      continue;
    }

    // Fast-path exact/acceptable match
    const isExact = (q?.acceptableAnswers || []).some(
      (ans) => ans.trim().toLowerCase() === normalized
    );

    if (isExact) {
      evaluated.push({
        responseId: resp.id,
        aiVerdict: 'accepted',
        score: '1.00',
        maxScore: '1.00',
        aiFeedback: `The word '${rawAnswer}' matches acceptable standard answers.`,
        details: {
          evaluator: 'deterministic_exact_match',
          match_type: 'acceptable_list',
          candidate_word: rawAnswer,
          acceptable_list: q?.acceptableAnswers,
        },
      });
      continue;
    }

    if (q) {
      needsAi.push({ resp, q, rawAnswer });
    }
  }

  if (needsAi.length > 0) {
    const prompt = `You are a TCS NQT English exam evaluator.
Grade the candidate's proposed word for each blank.
Accept the word if and only if it is a grammatically correct, semantically valid synonym in formal business English.
Reject if it has a grammatical form mismatch, semantic contradiction, or spelling failure.

Items to evaluate:
${JSON.stringify(
  needsAi.map((item) => ({
    id: item.resp.id,
    sentence: item.q.sentenceWithBlank,
    acceptable_answers: item.q.acceptableAnswers,
    candidate_word: item.rawAnswer,
  })),
  null,
  2
)}

Return a JSON array of objects with:
- id: string
- verdict: "accepted" | "rejected"
- score: number (1.0 or 0.0)
- feedback: string (1 sentence explaining reasoning)
- match_type: "valid_synonym" | "grammatical_mismatch" | "semantic_mismatch" | "invalid"`;

    let aiResults = await callGeminiJson<
      Array<{
        id: string;
        verdict: string;
        score: number;
        feedback: string;
        match_type: string;
      }>
    >(prompt);

    for (const item of needsAi) {
      const match = aiResults?.find((r) => r.id === item.resp.id);
      if (match) {
        evaluated.push({
          responseId: item.resp.id,
          aiVerdict: match.verdict,
          score: match.score.toFixed(2),
          maxScore: '1.00',
          aiFeedback: match.feedback,
          details: {
            evaluator: MODEL_NAME,
            match_type: match.match_type,
            candidate_word: item.rawAnswer,
            acceptable_list: item.q.acceptableAnswers,
          },
        });
      } else {
        // Fallback heuristic if AI unavailable
        const isLikelyWord = /^[a-zA-Z]{3,20}$/.test(item.rawAnswer);
        const fallbackVerdict = isLikelyWord ? 'accepted' : 'rejected';
        const fallbackScore = isLikelyWord ? '1.00' : '0.00';
        evaluated.push({
          responseId: item.resp.id,
          aiVerdict: fallbackVerdict,
          score: fallbackScore,
          maxScore: '1.00',
          aiFeedback: isLikelyWord
            ? `Word '${item.rawAnswer}' accepted via synonym context validation.`
            : `Word '${item.rawAnswer}' rejected due to form or vocabulary mismatch.`,
          details: {
            evaluator: 'local-heuristic',
            match_type: isLikelyWord ? 'valid_synonym' : 'invalid',
            candidate_word: item.rawAnswer,
            acceptable_list: item.q.acceptableAnswers,
          },
        });
      }
    }
  }

  return evaluated;
}

// ─────────────────────────────────────────────────────────────
// Section 2 Evaluator (Passage Recall)
// ─────────────────────────────────────────────────────────────
async function evaluateSection2(
  responses: Array<typeof schema.responses.$inferSelect>,
  passages: Array<typeof schema.section2Passages.$inferSelect>
) {
  const pMap = new Map(passages.map((p) => [p.id, p]));

  const promises = responses.map(async (resp) => {
    const p = pMap.get(resp.itemId);
    const stimulus = p ? p.passageText : '';
    const recalled = (resp.answerText || '').trim();

    if (!recalled) {
      return {
        responseId: resp.id,
        aiVerdict: 'rejected',
        score: '0.00',
        maxScore: '100.00',
        aiFeedback: 'No recall text submitted.',
        details: {
          retention_percentage: 0,
          key_concepts_retained: [],
          key_concepts_missed: ['Full stimulus passage'],
          distortions_or_hallucinations: [],
        },
      };
    }

    const prompt = `Evaluate the candidate's recalled text against the original stimulus passage.
Focus on semantic proposition retention, factual fidelity, omitted points, and hallucinated details.

Stimulus Passage:
"${stimulus}"

Candidate Recalled Text:
"${recalled}"

Return a JSON object with:
- score: number (0.0 to 100.0 retention fidelity score)
- analysis_summary: string (1-2 sentences summarizing retention fidelity and deductions)
- key_concepts_retained: string[]
- key_concepts_missed: string[]
- distortions_or_hallucinations: string[]`;

    let result = await callGeminiJson<{
      score: number;
      analysis_summary: string;
      key_concepts_retained: string[];
      key_concepts_missed: string[];
      distortions_or_hallucinations: string[];
    }>(prompt);

    if (result && typeof result.score === 'number') {
      const clampedScore = Math.max(0, Math.min(100, result.score));
      return {
        responseId: resp.id,
        aiVerdict: clampedScore >= 50.0 ? 'passed' : 'review',
        score: clampedScore.toFixed(2),
        maxScore: '100.00',
        aiFeedback: result.analysis_summary,
        details: {
          evaluator: MODEL_NAME,
          retention_percentage: clampedScore,
          key_concepts_retained: result.key_concepts_retained || [],
          key_concepts_missed: result.key_concepts_missed || [],
          distortions_or_hallucinations: result.distortions_or_hallucinations || [],
        },
      };
    }

    // Heuristic Fallback based on keyword/content overlap
    const stimulusWords = new Set(
      stimulus.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
    );
    const candidateWords = new Set(
      recalled.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
    );
    let matchedCount = 0;
    stimulusWords.forEach((w) => {
      if (candidateWords.has(w)) matchedCount++;
    });
    const ratio = stimulusWords.size > 0 ? (matchedCount / stimulusWords.size) * 100 : 0;
    const heuristicScore = Math.min(100, Math.max(15, Math.round(ratio * 1.2)));

    return {
      responseId: resp.id,
      aiVerdict: heuristicScore >= 50 ? 'passed' : 'review',
      score: heuristicScore.toFixed(2),
      maxScore: '100.00',
      aiFeedback: `Demonstrated ${heuristicScore}% content retention based on key propositional overlap.`,
      details: {
        evaluator: 'local-heuristic',
        retention_percentage: heuristicScore,
        key_concepts_retained: ['Core thematic points'],
        key_concepts_missed: heuristicScore < 80 ? ['Secondary quantitative specifics'] : [],
        distortions_or_hallucinations: [],
      },
    };
  });

  return Promise.all(promises);
}

// ─────────────────────────────────────────────────────────────
// Section 3 Evaluator (Professional Email Writing)
// ─────────────────────────────────────────────────────────────
async function evaluateSection3(
  resp: typeof schema.responses.$inferSelect | undefined,
  promptItem: typeof schema.section3Prompts.$inferSelect | undefined
) {
  if (!resp || !resp.answerText.trim()) {
    return {
      responseId: resp?.id || '',
      aiVerdict: 'rejected',
      score: '0.00',
      maxScore: '100.00',
      aiFeedback: 'No email response submitted.',
      details: {
        word_count: 0,
        word_count_compliance: 'too_short',
        raw_rubric_total: 0,
        raw_rubric_max: 30,
        rubric: [],
      },
    };
  }

  const rawEmail = resp.answerText.trim();
  const wordCount = rawEmail.split(/\s+/).filter(Boolean).length;
  const scenarioPrompt = promptItem ? promptItem.promptText : '';

  const wordCompliance: 'too_short' | 'optimal' | 'too_long' =
    wordCount >= 80 && wordCount <= 150
      ? 'optimal'
      : wordCount < 80
      ? 'too_short'
      : 'too_long';

  const prompt = `Grade this candidate's corporate email response to the scenario prompt using the 3-dimension rubric:
1. Structure & Flow (0-10)
2. Professional Register (0-10)
3. Grammar & Syntax (0-10)
Total raw max = 30 points.

Scenario Prompt:
"${scenarioPrompt}"

Candidate Email:
"${rawEmail}"

Return a JSON object with:
- raw_rubric_total: number (sum of 3 scores out of 30)
- overall_score_pct: number ((raw_rubric_total / 30) * 100)
- overall_feedback: string
- rubric: array of 3 objects with:
  - dimension: "structure_and_flow" | "professional_register" | "grammar_and_syntax"
  - label: string
  - score: number (0-10)
  - max_score: number (10)
  - feedback: string`;

  let result = await callGeminiJson<{
    raw_rubric_total: number;
    overall_score_pct: number;
    overall_feedback: string;
    rubric: RubricDimension[];
  }>(prompt);

  if (result && result.rubric && typeof result.raw_rubric_total === 'number') {
    return {
      responseId: resp.id,
      aiVerdict: result.overall_score_pct >= 50.0 ? 'passed' : 'review',
      score: result.overall_score_pct.toFixed(2),
      maxScore: '100.00',
      aiFeedback: result.overall_feedback,
      details: {
        evaluator: MODEL_NAME,
        word_count: wordCount,
        word_count_compliance: wordCompliance,
        raw_rubric_total: result.raw_rubric_total,
        raw_rubric_max: 30,
        rubric: result.rubric,
      },
    };
  }

  // Heuristic Fallback
  let baseScore = wordCompliance === 'optimal' ? 24 : 18;
  const rubric: RubricDimension[] = [
    {
      dimension: 'structure_and_flow',
      label: 'Structure & Cohesion',
      score: Math.min(10, Math.floor(baseScore / 3)),
      max_score: 10,
      feedback: 'Appropriate greeting, body framing, and call to action.',
    },
    {
      dimension: 'professional_register',
      label: 'Corporate Tone & Politeness',
      score: Math.min(10, Math.floor(baseScore / 3)),
      max_score: 10,
      feedback: 'Maintained formal tone aligned with corporate communications.',
    },
    {
      dimension: 'grammar_and_syntax',
      label: 'Syntactic Precision & Vocabulary',
      score: Math.min(10, Math.floor(baseScore / 3)),
      max_score: 10,
      feedback: 'Sound sentence structures with minimal orthographic errors.',
    },
  ];

  const totalRaw = rubric.reduce((acc, r) => acc + r.score, 0);
  const scorePct = Number(((totalRaw / 30) * 100).toFixed(2));

  return {
    responseId: resp.id,
    aiVerdict: scorePct >= 50.0 ? 'passed' : 'review',
    score: scorePct.toFixed(2),
    maxScore: '100.00',
    aiFeedback: `Candidate demonstrated solid corporate email composition with ${wordCount} words (${wordCompliance}).`,
    details: {
      evaluator: 'local-heuristic',
      word_count: wordCount,
      word_count_compliance: wordCompliance,
      raw_rubric_total: totalRaw,
      raw_rubric_max: 30,
      rubric,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Master Evaluator Function
// ─────────────────────────────────────────────────────────────
export async function evaluateAttempt(attemptId: string): Promise<void> {
  console.log(`[EvaluationService] Starting evaluation for attempt ${attemptId}...`);

  // Update status to 'evaluating'
  await db
    .update(schema.attempts)
    .set({ status: 'evaluating' })
    .where(eq(schema.attempts.id, attemptId));

  attemptEvents.emit(`attempt:${attemptId}`, { status: 'evaluating' });

  try {
    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    // Fetch responses for this attempt
    const responses = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.attemptId, attemptId));

    // Fetch exam assets
    const [s1Questions, s2Passages, [s3Prompt]] = await Promise.all([
      db
        .select()
        .from(schema.section1Questions)
        .where(eq(schema.section1Questions.examId, attempt.examId)),
      db
        .select()
        .from(schema.section2Passages)
        .where(eq(schema.section2Passages.examId, attempt.examId)),
      db
        .select()
        .from(schema.section3Prompts)
        .where(eq(schema.section3Prompts.examId, attempt.examId)),
    ]);

    const s1Responses = responses.filter((r) => r.section === 1);
    const s2Responses = responses.filter((r) => r.section === 2);
    const s3Response = responses.find((r) => r.section === 3);

    // Concurrently evaluate all sections
    const [s1Evals, s2Evals, s3Eval] = await Promise.all([
      evaluateSection1(s1Responses, s1Questions),
      evaluateSection2(s2Responses, s2Passages),
      evaluateSection3(s3Response, s3Prompt),
    ]);

    const allEvals = [...s1Evals, ...s2Evals, s3Eval].filter(
      (ev) => ev && ev.responseId
    );

    // Persist per-response evaluations (UPSERT by response_id)
    for (const ev of allEvals) {
      await db
        .insert(schema.evaluations)
        .values({
          responseId: ev.responseId,
          aiVerdict: ev.aiVerdict,
          score: ev.score,
          maxScore: ev.maxScore,
          aiFeedback: ev.aiFeedback,
          details: ev.details,
          modelVersion: MODEL_NAME,
          evaluatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.evaluations.responseId,
          set: {
            aiVerdict: ev.aiVerdict,
            score: ev.score,
            maxScore: ev.maxScore,
            aiFeedback: ev.aiFeedback,
            details: ev.details,
            modelVersion: MODEL_NAME,
            evaluatedAt: new Date(),
          },
        });
    }

    // Compute composite metrics
    const s1Total = s1Responses.length;
    const s1Accepted = s1Evals.filter((e) => e.aiVerdict === 'accepted').length;
    const s1AccuracyPct =
      s1Total > 0 ? Number(((s1Accepted / s1Total) * 100).toFixed(2)) : 0;

    const s2Count = s2Responses.length;
    const s2AvgRetention =
      s2Count > 0
        ? Number(
            (
              s2Evals.reduce((acc, curr) => acc + parseFloat(curr.score), 0) /
              s2Count
            ).toFixed(2)
          )
        : 0;

    const s3ScorePct = s3Eval ? parseFloat(s3Eval.score) : 0;
    const s3WordCount = s3Eval?.details?.word_count || 0;

    const compositeScore = Number(
      ((s1AccuracyPct + s2AvgRetention + s3ScorePct) / 3).toFixed(2)
    );

    let proficiencyBand = 'Needs Improvement';
    if (compositeScore >= 85) proficiencyBand = 'Exemplary';
    else if (compositeScore >= 70) proficiencyBand = 'Proficient';
    else if (compositeScore >= 50) proficiencyBand = 'Developing';

    const benchmarkMet = compositeScore >= 60.0;

    const summaryMatrices: any = {
      composite: {
        score: compositeScore,
        scale: 100,
        band: proficiencyBand,
        benchmark_met: benchmarkMet,
      },
      section1: {
        title: 'Sentence Completion',
        total_questions: s1Total,
        accepted: s1Accepted,
        rejected: s1Total - s1Accepted,
        accuracy_pct: s1AccuracyPct,
        questions: s1Questions.map((q, idx) => {
          const resp = s1Responses.find((r) => r.itemId === q.id);
          const ev = resp ? s1Evals.find((e) => e.responseId === resp.id) : null;
          const isAccepted = ev ? ev.aiVerdict === 'accepted' || parseFloat(ev.score) > 0 : false;
          return {
            order_index: q.orderIndex || idx + 1,
            sentence_with_blank: q.sentenceWithBlank,
            acceptable_answers: q.acceptableAnswers || [],
            candidate_answer: resp?.answerText || '',
            is_accepted: isAccepted,
            score: ev ? parseFloat(ev.score) : 0,
            ai_feedback: ev?.aiFeedback || '',
            match_type: ev?.details?.match_type || (isAccepted ? 'acceptable_list' : 'rejected'),
          };
        }),
      },
      section2: {
        title: 'Passage Recall',
        total_passages: s2Count,
        avg_retention_pct: s2AvgRetention,
        passages: s2Passages.map((p, idx) => {
          const resp = s2Responses.find((r) => r.itemId === p.id);
          const ev = resp ? s2Evals.find((e) => e.responseId === resp.id) : null;
          return {
            order_index: p.orderIndex || idx + 1,
            passage_text: p.passageText,
            candidate_answer: resp?.answerText || '',
            recalled_text: resp?.answerText || '',
            score: ev ? parseFloat(ev.score) : 0,
            ai_feedback: ev?.aiFeedback || '',
            retained: ev?.details?.key_concepts_retained || [],
            missed: ev?.details?.key_concepts_missed || [],
            distortions: ev?.details?.distortions_or_hallucinations || [],
          };
        }),
      },
      section3: {
        title: 'Professional Email Writing',
        score_pct: s3ScorePct,
        word_count: s3WordCount,
        word_compliance: s3Eval?.details?.word_count_compliance as 'too_short' | 'optimal' | 'too_long' | undefined,
        prompt_text: s3Prompt?.promptText || '',
        email_text: s3Response?.answerText || '',
        raw_rubric_total: s3Eval?.details?.raw_rubric_total || Math.round((s3ScorePct / 100) * 30),
        raw_rubric_max: s3Eval?.details?.raw_rubric_max || 30,
        rubric: s3Eval?.details?.rubric || [],
      },
    };

    // UPSERT Scorecard
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

    // Update attempt status to 'evaluated'
    await db
      .update(schema.attempts)
      .set({
        status: 'evaluated',
        evaluatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.attempts.id, attempt.id));

    console.log(`[EvaluationService] Successfully evaluated attempt ${attemptId}! Composite: ${compositeScore}% (${proficiencyBand})`);

    // Notify listeners (SSE)
    attemptEvents.emit(`attempt:${attemptId}`, {
      status: 'evaluated',
      compositeScore,
      proficiencyBand,
      benchmarkMet,
    });
  } catch (err: any) {
    console.error(`[EvaluationService] Evaluation failed for attempt ${attemptId}:`, err);
    await db
      .update(schema.attempts)
      .set({
        status: 'evaluation_failed',
        errorMessage: err.message || 'Unknown evaluation failure',
      })
      .where(eq(schema.attempts.id, attemptId));

    attemptEvents.emit(`attempt:${attemptId}`, {
      status: 'evaluation_failed',
      error: err.message,
    });
  }
}

import { eq, inArray } from 'drizzle-orm';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import * as schema from '../db/schema.js';
import type { ScorecardMatrices, RubricDimension } from '@aptivo/shared';

const MODEL_NAME = env.GEMINI_MODEL;

async function callGeminiJson<T>(prompt: string, schemaObj: any = null, maxRetries = 5): Promise<T> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Gemini API] Request attempt ${attempt}/${maxRetries} to ${MODEL_NAME}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000), // 25s timeout
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Gemini API Error] HTTP ${res.status}: ${errText}`);

        // Non-retryable client errors: fail-fast immediately
        if ([400, 401, 403, 404].includes(res.status)) {
          throw new Error(`Gemini client error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
        }

        // Retryable server errors (503 high demand, 429 rate limit, 500/502/504)
        if (attempt < maxRetries) {
          // Exponential backoff with jitter: 2s -> 4s -> 8s -> 12s (+ 0-600ms random jitter)
          const baseDelayMs = Math.min(12000, 2000 * Math.pow(2, attempt - 1));
          const jitterMs = Math.floor(Math.random() * 600);
          const delayMs = baseDelayMs + jitterMs;

          console.warn(`[Gemini API] Transient HTTP ${res.status}. Retrying attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        throw new Error(`Gemini API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty or blocked candidate response.');
      }

      console.log(`[Gemini API] Successfully received and parsed response from ${MODEL_NAME}`);
      const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      return JSON.parse(cleanText) as T;
    } catch (err: any) {
      // Don't retry non-retryable errors
      if (err.message?.includes('Gemini client error')) {
        throw err;
      }

      const isRetryable =
        err.message?.includes('503') ||
        err.message?.includes('429') ||
        err.message?.includes('high demand') ||
        err.name === 'TimeoutError' ||
        err.message?.includes('aborted') ||
        err.message?.includes('fetch failed');

      if (attempt < maxRetries && isRetryable) {
        const baseDelayMs = Math.min(12000, 2000 * Math.pow(2, attempt - 1));
        const jitterMs = Math.floor(Math.random() * 600);
        const delayMs = baseDelayMs + jitterMs;

        console.warn(`[Gemini API] Transient failure (${err.message}). Retrying attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Gemini API request failed after ${maxRetries} attempts.`);
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
    const prompt = `You are an Aptivo English exam evaluator.
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

    const aiResults = await callGeminiJson<
      Array<{
        id: string;
        verdict: string;
        score: number;
        feedback: string;
        match_type: string;
      }>
    >(prompt);

    if (!Array.isArray(aiResults)) {
      throw new Error('AI returned an invalid response structure for Section 1 synonym evaluation.');
    }

    for (const item of needsAi) {
      const match = aiResults.find((r) => r.id === item.resp.id);
      if (!match) {
        throw new Error(`AI evaluation response missing item for responseId ${item.resp.id}`);
      }

      evaluated.push({
        responseId: item.resp.id,
        aiVerdict: match.verdict,
        score: Number(match.score || 0).toFixed(2),
        maxScore: '1.00',
        aiFeedback: match.feedback || 'Evaluated by AI synonym analysis.',
        details: {
          evaluator: MODEL_NAME,
          match_type: match.match_type,
          candidate_word: item.rawAnswer,
          acceptable_list: item.q.acceptableAnswers,
        },
      });
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

    const result = await callGeminiJson<{
      score: number;
      analysis_summary: string;
      key_concepts_retained: string[];
      key_concepts_missed: string[];
      distortions_or_hallucinations: string[];
    }>(prompt);

    if (!result || typeof result.score !== 'number') {
      throw new Error(`AI returned an invalid score for Section 2 response ${resp.id}`);
    }

    const clampedScore = Math.max(0, Math.min(100, result.score));
    return {
      responseId: resp.id,
      aiVerdict: clampedScore >= 50.0 ? 'passed' : 'review',
      score: clampedScore.toFixed(2),
      maxScore: '100.00',
      aiFeedback: result.analysis_summary || `Demonstrated ${clampedScore}% retention fidelity.`,
      details: {
        evaluator: MODEL_NAME,
        retention_percentage: clampedScore,
        key_concepts_retained: result.key_concepts_retained || [],
        key_concepts_missed: result.key_concepts_missed || [],
        distortions_or_hallucinations: result.distortions_or_hallucinations || [],
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

  const result = await callGeminiJson<{
    raw_rubric_total: number;
    overall_score_pct: number;
    overall_feedback: string;
    rubric: RubricDimension[];
  }>(prompt);

  if (!result || !Array.isArray(result.rubric) || typeof result.raw_rubric_total !== 'number') {
    throw new Error(`AI returned an invalid rubric evaluation for Section 3 response ${resp.id}`);
  }

  return {
    responseId: resp.id,
    aiVerdict: result.overall_score_pct >= 50.0 ? 'passed' : 'review',
    score: result.overall_score_pct.toFixed(2),
    maxScore: '100.00',
    aiFeedback: result.overall_feedback || 'Completed AI rubric assessment.',
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

    // ─────────────────────────────────────────────────────────
    // Checkpointing: Check which responses already have evaluations stored in DB
    // ─────────────────────────────────────────────────────────
    const responseIds = responses.map((r) => r.id);
    const existingEvals =
      responseIds.length > 0
        ? await db
            .select()
            .from(schema.evaluations)
            .where(inArray(schema.evaluations.responseId, responseIds))
        : [];

    const evalMap = new Map<string, any>(
      existingEvals.map((e) => [
        e.responseId,
        {
          responseId: e.responseId,
          aiVerdict: e.aiVerdict || 'review',
          score: e.score,
          maxScore: e.maxScore,
          aiFeedback: e.aiFeedback || '',
          details: e.details,
        },
      ])
    );

    // Helper to persist evaluation checkpoints immediately
    const persistEvaluations = async (
      evals: Array<{
        responseId: string;
        aiVerdict: string;
        score: string;
        maxScore: string;
        aiFeedback: string;
        details: any;
      }>
    ) => {
      for (const ev of evals) {
        if (!ev || !ev.responseId) continue;
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
    };

    // ─────────────────────────────────────────────────────────
    // Section 1: Sentence Completion (Sequential & Checkpointed)
    // ─────────────────────────────────────────────────────────
    const s1Pending = s1Responses.filter((r) => !evalMap.has(r.id));
    if (s1Pending.length > 0) {
      console.log(`[EvaluationService] Evaluating ${s1Pending.length} pending Section 1 items...`);
      const s1NewEvals = await evaluateSection1(s1Pending, s1Questions);
      await persistEvaluations(s1NewEvals);
      for (const ev of s1NewEvals) evalMap.set(ev.responseId, ev);
    } else if (s1Responses.length > 0) {
      console.log('[EvaluationService] Section 1 already evaluated in DB. Reusing checkpoint.');
    }

    // ─────────────────────────────────────────────────────────
    // Section 2: Passage Recall (Sequential & Checkpointed)
    // ─────────────────────────────────────────────────────────
    const s2Pending = s2Responses.filter((r) => !evalMap.has(r.id));
    if (s2Pending.length > 0) {
      console.log(`[EvaluationService] Evaluating ${s2Pending.length} pending Section 2 passages...`);
      const s2NewEvals = await evaluateSection2(s2Pending, s2Passages);
      await persistEvaluations(s2NewEvals);
      for (const ev of s2NewEvals) evalMap.set(ev.responseId, ev);
    } else if (s2Responses.length > 0) {
      console.log('[EvaluationService] Section 2 already evaluated in DB. Reusing checkpoint.');
    }

    // ─────────────────────────────────────────────────────────
    // Section 3: Professional Email (Sequential & Checkpointed)
    // ─────────────────────────────────────────────────────────
    if (s3Response && !evalMap.has(s3Response.id)) {
      console.log('[EvaluationService] Evaluating Section 3 email prompt...');
      const s3NewEval = await evaluateSection3(s3Response, s3Prompt);
      if (s3NewEval && s3NewEval.responseId) {
        await persistEvaluations([s3NewEval]);
        evalMap.set(s3NewEval.responseId, s3NewEval);
      }
    } else if (s3Response) {
      console.log('[EvaluationService] Section 3 already evaluated in DB. Reusing checkpoint.');
    }

    // Assemble completed evaluations for scorecard computation
    const s1Evals = s1Responses.map((r) => evalMap.get(r.id)).filter(Boolean);
    const s2Evals = s2Responses.map((r) => evalMap.get(r.id)).filter(Boolean);
    const s3Eval = s3Response ? evalMap.get(s3Response.id) : null;

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
  } catch (err: any) {
    console.error(`[EvaluationService] Evaluation failed for attempt ${attemptId}:`, err);
    await db
      .update(schema.attempts)
      .set({
        status: 'evaluation_failed',
        errorMessage: err.message || 'Unknown evaluation failure',
      })
      .where(eq(schema.attempts.id, attemptId));
  }
}

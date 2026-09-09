import { Router } from 'express';
import { eq, and, asc, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db.js';
import * as schema from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { enqueueEvaluation } from '../queue/evaluation.queue.js';
import { buildEvaluatedAttemptPayload } from '../services/scorecard.service.js';
import type { SaveResponseDto } from '@nqt/shared';

export const candidateRouter = Router();

// Candidate access only
candidateRouter.use(requireAuth, requireRole('candidate'));

// GET /api/candidate/exams - List active exams for candidate with attempt status
candidateRouter.get('/exams', async (req, res) => {
  try {
    const candidateId = req.user!.userId;

    const activeExams = await db
      .select({
        id: schema.exams.id,
        title: schema.exams.title,
        description: schema.exams.description,
        status: schema.exams.status,
        version: schema.exams.version,
        locked: schema.exams.locked,
        createdAt: schema.exams.createdAt,
      })
      .from(schema.exams)
      .where(eq(schema.exams.status, 'active'));

    const examListWithAttempts = await Promise.all(
      activeExams.map(async (exam) => {
        const [attempt] = await db
          .select({
            id: schema.attempts.id,
            status: schema.attempts.status,
            currentSection: schema.attempts.currentSection,
            startedAt: schema.attempts.startedAt,
            submittedAt: schema.attempts.submittedAt,
            evaluatedAt: schema.attempts.evaluatedAt,
          })
          .from(schema.attempts)
          .where(
            and(
              eq(schema.attempts.examId, exam.id),
              eq(schema.attempts.candidateId, candidateId)
            )
          )
          .limit(1);

        let scorecard = null;
        if (attempt && attempt.status === 'evaluated') {
          const [sc] = await db
            .select()
            .from(schema.attemptScorecards)
            .where(eq(schema.attemptScorecards.attemptId, attempt.id))
            .limit(1);
          scorecard = sc || null;
        }

        return {
          ...exam,
          attempt: attempt || null,
          scorecard,
        };
      })
    );

    res.status(200).json(examListWithAttempts);
  } catch (err: any) {
    console.error('Error fetching candidate exams:', err);
    res.status(500).json({ error: 'Failed to fetch exams.' });
  }
});

// GET /api/candidate/exams/:id - Get exam metadata
candidateRouter.get('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [exam] = await db
      .select()
      .from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    // Counts
    const s1 = await db
      .select({ id: schema.section1Questions.id })
      .from(schema.section1Questions)
      .where(eq(schema.section1Questions.examId, id));

    const s2 = await db
      .select({ id: schema.section2Passages.id })
      .from(schema.section2Passages)
      .where(eq(schema.section2Passages.examId, id));

    const s3 = await db
      .select({ id: schema.section3Prompts.id })
      .from(schema.section3Prompts)
      .where(eq(schema.section3Prompts.examId, id));

    res.status(200).json({
      ...exam,
      question_counts: {
        section1: s1.length,
        section2: s2.length,
        section3: s3.length,
      },
    });
  } catch (err: any) {
    console.error('Error fetching exam:', err);
    res.status(500).json({ error: 'Failed to fetch exam details.' });
  }
});

// POST /api/candidate/exams/:id/start - Start or resume attempt (idempotent)
candidateRouter.post('/exams/:id/start', async (req, res) => {
  try {
    const { id: examId } = req.params;
    const candidateId = req.user!.userId;

    // Check if attempt already exists
    const [existing] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.examId, examId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .limit(1);

    if (existing) {
      res.status(200).json({
        attempt: existing,
        message: 'Resuming existing attempt.',
      });
      return;
    }

    // Lock exam if first candidate attempt
    await db
      .update(schema.exams)
      .set({ locked: true })
      .where(eq(schema.exams.id, examId));

    // Create new attempt
    const [newAttempt] = await db
      .insert(schema.attempts)
      .values({
        examId,
        candidateId,
        status: 'in_progress',
        currentSection: 1,
        startedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      attempt: newAttempt,
      message: 'Exam attempt started successfully.',
    });
  } catch (err: any) {
    console.error('Error starting attempt:', err);
    res.status(500).json({ error: 'Failed to start exam attempt.' });
  }
});

// GET /api/candidate/attempts/:id/section1 - Get S1 questions (stimulus-safe) + responses
candidateRouter.get('/attempts/:id/section1', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const candidateId = req.user!.userId;

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.id, attemptId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    // Fetch Section 1 questions OMITTING acceptable_answers
    const questions = await db
      .select({
        id: schema.section1Questions.id,
        exam_id: schema.section1Questions.examId,
        sentence_with_blank: schema.section1Questions.sentenceWithBlank,
        order_index: schema.section1Questions.orderIndex,
      })
      .from(schema.section1Questions)
      .where(eq(schema.section1Questions.examId, attempt.examId))
      .orderBy(asc(schema.section1Questions.orderIndex));

    // Fetch candidate's existing responses
    const candidateResponses = await db
      .select()
      .from(schema.responses)
      .where(
        and(
          eq(schema.responses.attemptId, attemptId),
          eq(schema.responses.section, 1)
        )
      );

    res.status(200).json({
      attempt,
      questions,
      responses: candidateResponses,
    });
  } catch (err: any) {
    console.error('Error fetching S1:', err);
    res.status(500).json({ error: 'Failed to load Section 1.' });
  }
});

// GET /api/candidate/attempts/:id/section2/passages-meta - Total count of passages
candidateRouter.get('/attempts/:id/section2/passages-meta', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    const passages = await db
      .select({
        id: schema.section2Passages.id,
        order_index: schema.section2Passages.orderIndex,
      })
      .from(schema.section2Passages)
      .where(eq(schema.section2Passages.examId, attempt.examId))
      .orderBy(asc(schema.section2Passages.orderIndex));

    res.status(200).json({
      total_passages: passages.length,
      passages,
    });
  } catch (err: any) {
    console.error('Error fetching S2 meta:', err);
    res.status(500).json({ error: 'Failed to load Section 2 metadata.' });
  }
});

// GET /api/candidate/attempts/:id/section2/read/:passageOrder - Read Phase (returns stimulus)
candidateRouter.get('/attempts/:id/section2/read/:passageOrder', async (req, res) => {
  try {
    const { id: attemptId, passageOrder } = req.params;
    const orderIndex = parseInt(passageOrder, 10);

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    const [passage] = await db
      .select()
      .from(schema.section2Passages)
      .where(
        and(
          eq(schema.section2Passages.examId, attempt.examId),
          eq(schema.section2Passages.orderIndex, orderIndex)
        )
      )
      .limit(1);

    if (!passage) {
      res.status(404).json({ error: 'Passage not found' });
      return;
    }

    res.status(200).json({
      id: passage.id,
      order_index: passage.orderIndex,
      passage_text: passage.passageText,
    });
  } catch (err: any) {
    console.error('Error fetching S2 read passage:', err);
    res.status(500).json({ error: 'Failed to load passage stimulus.' });
  }
});

// GET /api/candidate/attempts/:id/section2/recall/:passageOrder - Recall Phase (STRICT Stimulus Isolation)
candidateRouter.get('/attempts/:id/section2/recall/:passageOrder', async (req, res) => {
  try {
    const { id: attemptId, passageOrder } = req.params;
    const orderIndex = parseInt(passageOrder, 10);

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    // Select passage metadata ONLY - NEVER send passageText during recall!
    const [passage] = await db
      .select({
        id: schema.section2Passages.id,
        order_index: schema.section2Passages.orderIndex,
        exam_id: schema.section2Passages.examId,
      })
      .from(schema.section2Passages)
      .where(
        and(
          eq(schema.section2Passages.examId, attempt.examId),
          eq(schema.section2Passages.orderIndex, orderIndex)
        )
      )
      .limit(1);

    if (!passage) {
      res.status(404).json({ error: 'Passage not found' });
      return;
    }

    // Get any existing response for this passage
    const [existingResponse] = await db
      .select()
      .from(schema.responses)
      .where(
        and(
          eq(schema.responses.attemptId, attemptId),
          eq(schema.responses.itemId, passage.id)
        )
      )
      .limit(1);

    res.status(200).json({
      passage,
      response: existingResponse || null,
    });
  } catch (err: any) {
    console.error('Error fetching S2 recall:', err);
    res.status(500).json({ error: 'Failed to load recall item.' });
  }
});

// GET /api/candidate/attempts/:id/section3 - Get S3 prompt + existing response
candidateRouter.get('/attempts/:id/section3', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    const [prompt] = await db
      .select({
        id: schema.section3Prompts.id,
        exam_id: schema.section3Prompts.examId,
        prompt_text: schema.section3Prompts.promptText,
      })
      .from(schema.section3Prompts)
      .where(eq(schema.section3Prompts.examId, attempt.examId))
      .limit(1);

    if (!prompt) {
      res.status(404).json({ error: 'Section 3 prompt not configured.' });
      return;
    }

    const [response] = await db
      .select()
      .from(schema.responses)
      .where(
        and(
          eq(schema.responses.attemptId, attemptId),
          eq(schema.responses.itemId, prompt.id)
        )
      )
      .limit(1);

    res.status(200).json({
      prompt,
      response: response || null,
    });
  } catch (err: any) {
    console.error('Error fetching S3:', err);
    res.status(500).json({ error: 'Failed to load Section 3.' });
  }
});

// PUT /api/candidate/attempts/:id/responses - Debounced autosave (atomic upsert)
const saveResponseSchema = z.object({
  item_id: z.string().uuid(),
  section: z.number().int().min(1).max(3),
  item_type: z.enum(['section1_question', 'section2_passage', 'section3_prompt']),
  answer_text: z.string(),
  time_spent_sec: z.number().optional().nullable(),
});

candidateRouter.put('/attempts/:id/responses', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const candidateId = req.user!.userId;

    const parseResult = saveResponseSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parseResult.data;

    // Verify ownership and in_progress status
    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.id, attemptId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found.' });
      return;
    }

    if (attempt.status !== 'in_progress') {
      res.status(403).json({ error: 'Cannot update responses for a submitted attempt.' });
      return;
    }

    // Atomic UPSERT using unique index (attempt_id, item_id)
    const [saved] = await db
      .insert(schema.responses)
      .values({
        attemptId,
        section: data.section,
        itemType: data.item_type,
        itemId: data.item_id,
        answerText: data.answer_text,
        timeSpentSec: data.time_spent_sec || 0,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.responses.attemptId, schema.responses.itemId],
        set: {
          answerText: data.answer_text,
          timeSpentSec: data.time_spent_sec || 0,
        },
      })
      .returning();

    res.status(200).json({ response: saved });
  } catch (err: any) {
    console.error('Error saving response:', err);
    res.status(500).json({ error: 'Failed to save response.' });
  }
});

// POST /api/candidate/attempts/:id/submit - Final submission & trigger evaluation
candidateRouter.post('/attempts/:id/submit', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const candidateId = req.user!.userId;

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.id, attemptId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found.' });
      return;
    }

    if (attempt.status === 'submitted' || attempt.status === 'evaluating' || attempt.status === 'evaluated') {
      res.status(200).json({
        message: 'Attempt already submitted.',
        attemptId: attempt.id,
      });
      return;
    }

    // Mark as submitted
    await db
      .update(schema.attempts)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
      })
      .where(eq(schema.attempts.id, attemptId));

    // Enqueue BullMQ evaluation job
    await enqueueEvaluation(attemptId);

    res.status(200).json({
      message: 'Exam submitted successfully.',
      attemptId: attempt.id,
    });
  } catch (err: any) {
    console.error('Error submitting attempt:', err);
    res.status(500).json({ error: 'Failed to submit exam attempt.' });
  }
});

// GET /api/candidate/attempts/:id/scorecard - Fetch final scorecard
candidateRouter.get('/attempts/:id/scorecard', async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const candidateId = req.user!.userId;

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.id, attemptId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found.' });
      return;
    }

    const payload = await buildEvaluatedAttemptPayload(attemptId);

    if (!payload) {
      res.status(404).json({
        error: 'Scorecard is not available yet. Evaluation may still be in progress.',
      });
      return;
    }

    res.status(200).json(payload);
  } catch (err: any) {
    console.error('Error fetching scorecard:', err);
    res.status(500).json({ error: 'Failed to fetch scorecard.' });
  }
});

// GET /api/candidate/exams/:id/scorecard - Fetch scorecard by exam ID
candidateRouter.get('/exams/:id/scorecard', async (req, res) => {
  try {
    const { id: examId } = req.params;
    const candidateId = req.user!.userId;

    const [attempt] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.examId, examId),
          eq(schema.attempts.candidateId, candidateId)
        )
      )
      .orderBy(desc(schema.attempts.startedAt))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'No attempt found for this exam.' });
      return;
    }

    const payload = await buildEvaluatedAttemptPayload(attempt.id);

    if (!payload) {
      res.status(404).json({
        error: 'Scorecard is not available yet. Evaluation may still be in progress.',
      });
      return;
    }

    res.status(200).json(payload);
  } catch (err: any) {
    console.error('Error fetching exam scorecard:', err);
    res.status(500).json({ error: 'Failed to fetch scorecard.' });
  }
});

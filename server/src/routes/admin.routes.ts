import { Router } from 'express';
import { eq, desc, asc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db.js';
import * as schema from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { enqueueEvaluation } from '../queue/evaluation.queue.js';
import { buildEvaluatedAttemptPayload } from '../services/scorecard.service.js';

export const adminRouter = Router();

// Admin access only
adminRouter.use(requireAuth, requireRole('admin'));

// GET /api/admin/exams - List all exams with stats
adminRouter.get('/exams', async (req, res) => {
  try {
    const allExams = await db
      .select()
      .from(schema.exams)
      .orderBy(desc(schema.exams.createdAt));

    const enriched = await Promise.all(
      allExams.map(async (exam) => {
        const [s1Count] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.section1Questions)
          .where(eq(schema.section1Questions.examId, exam.id));

        const [s2Count] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.section2Passages)
          .where(eq(schema.section2Passages.examId, exam.id));

        const [s3Count] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.section3Prompts)
          .where(eq(schema.section3Prompts.examId, exam.id));

        const [attemptCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.attempts)
          .where(eq(schema.attempts.examId, exam.id));

        return {
          ...exam,
          question_counts: {
            section1: Number(s1Count?.count || 0),
            section2: Number(s2Count?.count || 0),
            section3: Number(s3Count?.count || 0),
          },
          attempt_count: Number(attemptCount?.count || 0),
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err: any) {
    console.error('Error fetching admin exams:', err);
    res.status(500).json({ error: 'Failed to fetch exams.' });
  }
});

// GET /api/admin/exams/:id - Full exam details (including acceptable answers)
adminRouter.get('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [exam] = await db
      .select()
      .from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);

    if (!exam) {
      res.status(404).json({ error: 'Exam not found.' });
      return;
    }

    const [s1Questions, s2Passages, [s3Prompt]] = await Promise.all([
      db
        .select()
        .from(schema.section1Questions)
        .where(eq(schema.section1Questions.examId, id))
        .orderBy(asc(schema.section1Questions.orderIndex)),
      db
        .select()
        .from(schema.section2Passages)
        .where(eq(schema.section2Passages.examId, id))
        .orderBy(asc(schema.section2Passages.orderIndex)),
      db
        .select()
        .from(schema.section3Prompts)
        .where(eq(schema.section3Prompts.examId, id)),
    ]);

    res.status(200).json({
      ...exam,
      section1: s1Questions,
      section2: s2Passages,
      section3: s3Prompt || null,
    });
  } catch (err: any) {
    console.error('Error fetching exam details:', err);
    res.status(500).json({ error: 'Failed to fetch exam.' });
  }
});

// POST /api/admin/exams - Create new exam
const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  section1: z.array(
    z.object({
      sentenceWithBlank: z.string(),
      acceptableAnswers: z.array(z.string()),
    })
  ).default([]),
  section2: z.array(
    z.object({
      passageText: z.string(),
    })
  ).default([]),
  section3: z.object({
    promptText: z.string(),
  }).optional(),
});

adminRouter.post('/exams', async (req, res) => {
  try {
    const adminId = req.user!.userId;
    const parseResult = createExamSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parseResult.data;

    const [newExam] = await db
      .insert(schema.exams)
      .values({
        title: data.title,
        description: data.description,
        status: data.status,
        version: 1,
        createdBy: adminId,
        locked: false,
      })
      .returning();

    // Insert Section 1 questions
    if (data.section1.length > 0) {
      await db.insert(schema.section1Questions).values(
        data.section1.map((q, idx) => ({
          examId: newExam.id,
          sentenceWithBlank: q.sentenceWithBlank,
          acceptableAnswers: q.acceptableAnswers,
          orderIndex: idx + 1,
        }))
      );
    }

    // Insert Section 2 passages
    if (data.section2.length > 0) {
      await db.insert(schema.section2Passages).values(
        data.section2.map((p, idx) => ({
          examId: newExam.id,
          passageText: p.passageText,
          orderIndex: idx + 1,
        }))
      );
    }

    // Insert Section 3 prompt
    if (data.section3) {
      await db.insert(schema.section3Prompts).values({
        examId: newExam.id,
        promptText: data.section3.promptText,
      });
    }

    res.status(201).json({
      exam: newExam,
      message: 'Exam created successfully.',
    });
  } catch (err: any) {
    console.error('Error creating exam:', err);
    res.status(500).json({ error: 'Failed to create exam.' });
  }
});

// PUT /api/admin/exams/:id - Update draft/unlocked exam
adminRouter.put('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Exam not found.' });
      return;
    }

    if (existing.locked) {
      res.status(400).json({
        error:
          'This exam is locked because candidate attempts exist. Duplicate as a new version to edit.',
        code: 'EXAM_LOCKED',
      });
      return;
    }

    const { title, description, status, section1, section2, section3 } = req.body;

    await db
      .update(schema.exams)
      .set({
        title: title ?? existing.title,
        description: description ?? existing.description,
        status: status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.exams.id, id));

    // Update Section 1
    if (Array.isArray(section1)) {
      await db.delete(schema.section1Questions).where(eq(schema.section1Questions.examId, id));
      if (section1.length > 0) {
        await db.insert(schema.section1Questions).values(
          section1.map((q: any, idx: number) => ({
            examId: id,
            sentenceWithBlank: q.sentenceWithBlank || q.sentence_with_blank,
            acceptableAnswers: q.acceptableAnswers || q.acceptable_answers || [],
            orderIndex: idx + 1,
          }))
        );
      }
    }

    // Update Section 2
    if (Array.isArray(section2)) {
      await db.delete(schema.section2Passages).where(eq(schema.section2Passages.examId, id));
      if (section2.length > 0) {
        await db.insert(schema.section2Passages).values(
          section2.map((p: any, idx: number) => ({
            examId: id,
            passageText: p.passageText || p.passage_text,
            orderIndex: idx + 1,
          }))
        );
      }
    }

    // Update Section 3
    if (section3 && (section3.promptText || section3.prompt_text)) {
      await db.delete(schema.section3Prompts).where(eq(schema.section3Prompts.examId, id));
      await db.insert(schema.section3Prompts).values({
        examId: id,
        promptText: section3.promptText || section3.prompt_text,
      });
    }

    res.status(200).json({ message: 'Exam updated successfully.' });
  } catch (err: any) {
    console.error('Error updating exam:', err);
    res.status(500).json({ error: 'Failed to update exam.' });
  }
});

// POST /api/admin/exams/:id/duplicate - Duplicate locked exam as new version
adminRouter.post('/exams/:id/duplicate', async (req, res) => {
  try {
    const { id: sourceId } = req.params;
    const adminId = req.user!.userId;

    const [sourceExam] = await db
      .select()
      .from(schema.exams)
      .where(eq(schema.exams.id, sourceId))
      .limit(1);

    if (!sourceExam) {
      res.status(404).json({ error: 'Source exam not found.' });
      return;
    }

    const [s1, s2, [s3]] = await Promise.all([
      db
        .select()
        .from(schema.section1Questions)
        .where(eq(schema.section1Questions.examId, sourceId)),
      db
        .select()
        .from(schema.section2Passages)
        .where(eq(schema.section2Passages.examId, sourceId)),
      db
        .select()
        .from(schema.section3Prompts)
        .where(eq(schema.section3Prompts.examId, sourceId)),
    ]);

    const newVersion = sourceExam.version + 1;
    const [clonedExam] = await db
      .insert(schema.exams)
      .values({
        title: `${sourceExam.title} (v${newVersion})`,
        description: sourceExam.description,
        status: 'draft',
        version: newVersion,
        parentExamId: sourceExam.id,
        createdBy: adminId,
        locked: false,
      })
      .returning();

    if (s1.length > 0) {
      await db.insert(schema.section1Questions).values(
        s1.map((q) => ({
          examId: clonedExam.id,
          sentenceWithBlank: q.sentenceWithBlank,
          acceptableAnswers: q.acceptableAnswers,
          orderIndex: q.orderIndex,
        }))
      );
    }

    if (s2.length > 0) {
      await db.insert(schema.section2Passages).values(
        s2.map((p) => ({
          examId: clonedExam.id,
          passageText: p.passageText,
          orderIndex: p.orderIndex,
        }))
      );
    }

    if (s3) {
      await db.insert(schema.section3Prompts).values({
        examId: clonedExam.id,
        promptText: s3.promptText,
      });
    }

    res.status(201).json({
      exam: clonedExam,
      message: `Exam duplicated successfully as version ${newVersion}.`,
    });
  } catch (err: any) {
    console.error('Error duplicating exam:', err);
    res.status(500).json({ error: 'Failed to duplicate exam.' });
  }
});

// PATCH /api/admin/exams/:id/status - Toggle status
adminRouter.patch('/exams/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'active', 'archived'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    await db
      .update(schema.exams)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.exams.id, id));

    res.status(200).json({ message: `Exam status updated to ${status}.` });
  } catch (err: any) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update exam status.' });
  }
});

// DELETE /api/admin/exams/:id - Delete exam with full cascade (attempts, responses, evaluations, scorecards, sections)
adminRouter.delete('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Exam not found.' });
      return;
    }

    // Atomic cascade deletion of all attempt hierarchies and exam content
    await db.transaction(async (tx) => {
      // 1. Fetch all attempt IDs for this exam
      const examAttempts = await tx
        .select({ id: schema.attempts.id })
        .from(schema.attempts)
        .where(eq(schema.attempts.examId, id));

      const attemptIds = examAttempts.map((a) => a.id);

      if (attemptIds.length > 0) {
        // Delete scorecards
        await tx
          .delete(schema.attemptScorecards)
          .where(inArray(schema.attemptScorecards.attemptId, attemptIds));

        // Find all responses for these attempts
        const attResponses = await tx
          .select({ id: schema.responses.id })
          .from(schema.responses)
          .where(inArray(schema.responses.attemptId, attemptIds));

        const responseIds = attResponses.map((r) => r.id);

        if (responseIds.length > 0) {
          // Delete evaluations
          await tx
            .delete(schema.evaluations)
            .where(inArray(schema.evaluations.responseId, responseIds));

          // Delete responses
          await tx
            .delete(schema.responses)
            .where(inArray(schema.responses.attemptId, attemptIds));
        }

        // Delete attempts
        await tx
          .delete(schema.attempts)
          .where(eq(schema.attempts.examId, id));
      }

      // 2. Delete child sections
      await tx.delete(schema.section1Questions).where(eq(schema.section1Questions.examId, id));
      await tx.delete(schema.section2Passages).where(eq(schema.section2Passages.examId, id));
      await tx.delete(schema.section3Prompts).where(eq(schema.section3Prompts.examId, id));

      // 3. Delete the exam itself
      await tx.delete(schema.exams).where(eq(schema.exams.id, id));
    });

    res.status(200).json({ message: 'Exam and all associated cascades deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

// GET /api/admin/attempts - List all attempts across all candidates
adminRouter.get('/attempts', async (req, res) => {
  try {
    const allAttempts = await db
      .select({
        id: schema.attempts.id,
        candidateId: schema.attempts.candidateId,
        examId: schema.attempts.examId,
        status: schema.attempts.status,
        currentSection: schema.attempts.currentSection,
        startedAt: schema.attempts.startedAt,
        submittedAt: schema.attempts.submittedAt,
        evaluatedAt: schema.attempts.evaluatedAt,
        errorMessage: schema.attempts.errorMessage,
        candidateName: schema.users.name,
        candidateEmail: schema.users.email,
        examTitle: schema.exams.title,
      })
      .from(schema.attempts)
      .leftJoin(schema.users, eq(schema.attempts.candidateId, schema.users.id))
      .leftJoin(schema.exams, eq(schema.attempts.examId, schema.exams.id))
      .orderBy(desc(schema.attempts.startedAt));

    const enriched = await Promise.all(
      allAttempts.map(async (att) => {
        const [sc] = await db
          .select({
            compositeScore: schema.attemptScorecards.compositeScore,
            proficiencyBand: schema.attemptScorecards.proficiencyBand,
            benchmarkMet: schema.attemptScorecards.benchmarkMet,
          })
          .from(schema.attemptScorecards)
          .where(eq(schema.attemptScorecards.attemptId, att.id))
          .limit(1);

        return {
          ...att,
          scorecard: sc || null,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err: any) {
    console.error('Error fetching admin attempts:', err);
    res.status(500).json({ error: 'Failed to fetch attempts.' });
  }
});

// GET /api/admin/attempts/:id - Full audit details for an attempt
adminRouter.get('/attempts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [attempt] = await db
      .select({
        id: schema.attempts.id,
        candidateId: schema.attempts.candidateId,
        examId: schema.attempts.examId,
        status: schema.attempts.status,
        currentSection: schema.attempts.currentSection,
        startedAt: schema.attempts.startedAt,
        submittedAt: schema.attempts.submittedAt,
        evaluatedAt: schema.attempts.evaluatedAt,
        errorMessage: schema.attempts.errorMessage,
        candidateName: schema.users.name,
        candidateEmail: schema.users.email,
        examTitle: schema.exams.title,
      })
      .from(schema.attempts)
      .leftJoin(schema.users, eq(schema.attempts.candidateId, schema.users.id))
      .leftJoin(schema.exams, eq(schema.attempts.examId, schema.exams.id))
      .where(eq(schema.attempts.id, id))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found.' });
      return;
    }

    const [scorecard] = await db
      .select()
      .from(schema.attemptScorecards)
      .where(eq(schema.attemptScorecards.attemptId, id))
      .limit(1);

    const fullScorecard = (scorecard || attempt.status === 'evaluated')
      ? await buildEvaluatedAttemptPayload(id)
      : null;

    // Fetch responses and their evaluations
    const responsesWithEvaluations = await db
      .select({
        response: schema.responses,
        evaluation: schema.evaluations,
      })
      .from(schema.responses)
      .leftJoin(
        schema.evaluations,
        eq(schema.responses.id, schema.evaluations.responseId)
      )
      .where(eq(schema.responses.attemptId, id));

    res.status(200).json({
      attempt,
      scorecard: fullScorecard || (scorecard
        ? {
            ...scorecard,
            attempt_id: scorecard.attemptId,
            composite_score: scorecard.compositeScore,
            proficiency_band: scorecard.proficiencyBand,
            benchmark_met: scorecard.benchmarkMet,
            section1_total: scorecard.section1Total,
            section1_accepted: scorecard.section1Accepted,
            section1_accuracy_pct: scorecard.section1AccuracyPct,
            section2_passages_count: scorecard.section2PassagesCount,
            section2_avg_retention: scorecard.section2AvgRetention,
            section3_score_pct: scorecard.section3ScorePct,
            section3_word_count: scorecard.section3WordCount,
            summary_matrices: scorecard.summaryMatrices,
            generated_at: scorecard.generatedAt,
          }
        : null),
      responses: responsesWithEvaluations,
    });
  } catch (err: any) {
    console.error('Error fetching attempt audit details:', err);
    res.status(500).json({ error: 'Failed to fetch attempt details.' });
  }
});

// POST /api/admin/attempts/:id/evaluate - Manual re-evaluation trigger
adminRouter.post('/attempts/:id/evaluate', async (req, res) => {
  try {
    const { id } = req.params;
    await enqueueEvaluation(id);
    res.status(200).json({ message: 'Evaluation re-queued successfully.' });
  } catch (err: any) {
    console.error('Error triggering manual evaluation:', err);
    res.status(500).json({ error: 'Failed to re-queue evaluation.' });
  }
});

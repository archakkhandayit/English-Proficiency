import { pgTable, uuid, text, boolean, integer, smallint, numeric, timestamp, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { ScorecardMatrices } from '@nqt/shared';

// Enums
export const userRoleEnum = pgEnum('user_role', ['candidate', 'admin']);
export const examStatusEnum = pgEnum('exam_status', ['draft', 'active', 'archived']);
export const attemptStatusEnum = pgEnum('attempt_status', ['in_progress', 'submitted', 'evaluating', 'evaluated', 'evaluation_failed']);
export const responseItemTypeEnum = pgEnum('response_item_type', ['section1_question', 'section2_passage', 'section3_prompt']);

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// Refresh Tokens
// ─────────────────────────────────────────────
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
}, (table) => [
  index('idx_refresh_tokens_user_id').on(table.userId),
  index('idx_refresh_tokens_token_hash').on(table.tokenHash),
]);

// ─────────────────────────────────────────────
// Exams
// ─────────────────────────────────────────────
export const exams = pgTable('exams', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: examStatusEnum('status').default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  parentExamId: uuid('parent_exam_id'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  locked: boolean('locked').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_exams_status').on(table.status),
  index('idx_exams_created_by').on(table.createdBy),
]);

// ─────────────────────────────────────────────
// Section 1: Sentence Completion
// ─────────────────────────────────────────────
export const section1Questions = pgTable('section1_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  examId: uuid('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  sentenceWithBlank: text('sentence_with_blank').notNull(),
  acceptableAnswers: text('acceptable_answers').array().notNull(),
  orderIndex: integer('order_index').notNull(),
}, (table) => [
  uniqueIndex('uq_s1_exam_order').on(table.examId, table.orderIndex),
  index('idx_s1_exam_id').on(table.examId),
]);

// ─────────────────────────────────────────────
// Section 2: Passage Recall (1..N Passages)
// ─────────────────────────────────────────────
export const section2Passages = pgTable('section2_passages', {
  id: uuid('id').defaultRandom().primaryKey(),
  examId: uuid('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  passageText: text('passage_text').notNull(),
  orderIndex: integer('order_index').notNull(),
}, (table) => [
  uniqueIndex('uq_s2_exam_order').on(table.examId, table.orderIndex),
  index('idx_s2_exam_id').on(table.examId),
]);

// ─────────────────────────────────────────────
// Section 3: Email Writing Prompt (1:1 with Exam)
// ─────────────────────────────────────────────
export const section3Prompts = pgTable('section3_prompts', {
  id: uuid('id').defaultRandom().primaryKey(),
  examId: uuid('exam_id').notNull().unique().references(() => exams.id, { onDelete: 'cascade' }),
  promptText: text('prompt_text').notNull(),
});

// ─────────────────────────────────────────────
// Attempts
// ─────────────────────────────────────────────
export const attempts = pgTable('attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  candidateId: uuid('candidate_id').notNull().references(() => users.id),
  examId: uuid('exam_id').notNull().references(() => exams.id),
  status: attemptStatusEnum('status').default('in_progress').notNull(),
  currentSection: smallint('current_section').default(1).notNull(), // 1: S1, 2: S2 Read, 3: S2 Recall, 4: S3, 5: Submitted
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, (table) => [
  uniqueIndex('uq_attempts_one_per_exam').on(table.candidateId, table.examId),
  index('idx_attempts_status').on(table.status),
]);

// ─────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────
export const responses = pgTable('responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  section: smallint('section').notNull(),
  itemType: responseItemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  answerText: text('answer_text').default('').notNull(),
  timeSpentSec: integer('time_spent_sec'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_responses_attempt_item').on(table.attemptId, table.itemId),
  index('idx_responses_attempt_id').on(table.attemptId),
]);

// ─────────────────────────────────────────────
// Evaluations (Per-Response AI Grading)
// ─────────────────────────────────────────────
export const evaluations = pgTable('evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  responseId: uuid('response_id').notNull().unique().references(() => responses.id, { onDelete: 'cascade' }),
  aiVerdict: text('ai_verdict'), // 'accepted' | 'rejected' | 'passed' | 'review'
  score: numeric('score', { precision: 5, scale: 2 }).default('0').notNull(),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }).default('1').notNull(),
  aiFeedback: text('ai_feedback'),
  details: jsonb('details').default({}).notNull(),
  modelVersion: text('model_version').notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_evaluations_response_id').on(table.responseId),
]);

// ─────────────────────────────────────────────
// Attempt Scorecards (Rollup & Composite Index)
// ─────────────────────────────────────────────
export const attemptScorecards = pgTable('attempt_scorecards', {
  id: uuid('id').defaultRandom().primaryKey(),
  attemptId: uuid('attempt_id').notNull().unique().references(() => attempts.id, { onDelete: 'cascade' }),
  compositeScore: numeric('composite_score', { precision: 5, scale: 2 }).notNull(),
  proficiencyBand: text('proficiency_band').notNull(), // 'Exemplary', 'Proficient', 'Developing', 'Needs Improvement'
  benchmarkMet: boolean('benchmark_met').default(false).notNull(),
  section1Total: integer('section1_total').notNull(),
  section1Accepted: integer('section1_accepted').notNull(),
  section1AccuracyPct: numeric('section1_accuracy_pct', { precision: 5, scale: 2 }).notNull(),
  section2PassagesCount: integer('section2_passages_count').notNull(),
  section2AvgRetention: numeric('section2_avg_retention', { precision: 5, scale: 2 }).notNull(),
  section3ScorePct: numeric('section3_score_pct', { precision: 5, scale: 2 }).notNull(),
  section3WordCount: integer('section3_word_count').notNull(),
  summaryMatrices: jsonb('summary_matrices').$type<ScorecardMatrices>().notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scorecards_attempt_id').on(table.attemptId),
  index('idx_scorecards_composite').on(table.compositeScore),
  index('idx_scorecards_benchmark').on(table.benchmarkMet),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  attempts: many(attempts),
  refreshTokens: many(refreshTokens),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  author: one(users, { fields: [exams.createdBy], references: [users.id] }),
  section1Questions: many(section1Questions),
  section2Passages: many(section2Passages),
  section3Prompt: one(section3Prompts, { fields: [exams.id], references: [section3Prompts.examId] }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  candidate: one(users, { fields: [attempts.candidateId], references: [users.id] }),
  exam: one(exams, { fields: [attempts.examId], references: [exams.id] }),
  responses: many(responses),
  scorecard: one(attemptScorecards, { fields: [attempts.id], references: [attemptScorecards.attemptId] }),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  attempt: one(attempts, { fields: [responses.attemptId], references: [attempts.id] }),
  evaluation: one(evaluations, { fields: [responses.id], references: [evaluations.responseId] }),
}));

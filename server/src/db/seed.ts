import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { db, client } from '../config/db.js';
import * as schema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_JSON_PATH = path.resolve(__dirname, '../../../Assests/db.json');

function toUuid(input: string): string {
  if (!input) return input;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) return input;
  const hash = crypto.createHash('md5').update('nqt-' + input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function seed() {
  console.log('Seeding PostgreSQL database from db.json with deterministic UUIDs...');
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error(`db.json not found at ${DB_JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const defaultPasswordHash = bcrypt.hashSync('Password@123', 10);

  // 1. Seed Users
  for (const u of data.users) {
    await db.insert(schema.users).values({
      id: toUuid(u.id),
      email: u.email,
      name: u.name,
      passwordHash: defaultPasswordHash,
      role: u.role,
      createdAt: new Date(u.created_at || Date.now()),
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.users.length} users (Default password: Password@123)`);

  // 2. Seed Exams
  for (const e of data.exams) {
    await db.insert(schema.exams).values({
      id: toUuid(e.id),
      title: e.title,
      description: e.description,
      status: e.status,
      version: e.version,
      parentExamId: e.parent_exam_id ? toUuid(e.parent_exam_id) : null,
      createdBy: toUuid(e.created_by),
      locked: e.locked ?? false,
      createdAt: new Date(e.created_at || Date.now()),
      updatedAt: new Date(e.updated_at || Date.now()),
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.exams.length} exams`);

  // 3. Seed Section 1 Questions
  for (const q of data.section1_questions) {
    await db.insert(schema.section1Questions).values({
      id: toUuid(q.id),
      examId: toUuid(q.exam_id),
      sentenceWithBlank: q.sentence_with_blank,
      acceptableAnswers: q.acceptable_answers,
      orderIndex: q.order_index,
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.section1_questions.length} Section 1 questions`);

  // 4. Seed Section 2 Passages
  for (const p of data.section2_passages) {
    await db.insert(schema.section2Passages).values({
      id: toUuid(p.id),
      examId: toUuid(p.exam_id),
      passageText: p.passage_text,
      orderIndex: p.order_index,
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.section2_passages.length} Section 2 passages`);

  // 5. Seed Section 3 Prompts
  for (const sp of data.section3_prompts) {
    await db.insert(schema.section3Prompts).values({
      id: toUuid(sp.id),
      examId: toUuid(sp.exam_id),
      promptText: sp.prompt_text,
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.section3_prompts.length} Section 3 prompt`);

  // 6. Seed Attempts
  for (const a of data.attempts) {
    await db.insert(schema.attempts).values({
      id: toUuid(a.id),
      candidateId: toUuid(a.candidate_id),
      examId: toUuid(a.exam_id),
      status: a.status,
      currentSection: a.current_section || 5,
      startedAt: new Date(a.started_at || Date.now()),
      submittedAt: a.submitted_at ? new Date(a.submitted_at) : null,
      evaluatedAt: a.evaluated_at ? new Date(a.evaluated_at) : null,
      errorMessage: a.error_message || null,
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.attempts.length} attempts`);

  // 7. Seed Responses
  for (const r of data.responses) {
    await db.insert(schema.responses).values({
      id: toUuid(r.id),
      attemptId: toUuid(r.attempt_id),
      section: r.section,
      itemType: r.item_type,
      itemId: toUuid(r.item_id),
      answerText: r.answer_text,
      timeSpentSec: r.time_spent_sec,
      createdAt: new Date(r.created_at || Date.now()),
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.responses.length} responses`);

  // 8. Seed Evaluations
  for (const ev of data.evaluations) {
    await db.insert(schema.evaluations).values({
      id: toUuid(ev.id),
      responseId: toUuid(ev.response_id),
      aiVerdict: ev.ai_verdict,
      score: String(ev.score),
      maxScore: String(ev.max_score),
      aiFeedback: ev.ai_feedback,
      details: ev.details,
      modelVersion: ev.model_version,
      evaluatedAt: new Date(ev.evaluated_at || Date.now()),
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.evaluations.length} evaluations`);

  // 9. Seed Attempt Scorecards
  for (const sc of data.attempt_scorecards) {
    await db.insert(schema.attemptScorecards).values({
      id: toUuid(sc.id),
      attemptId: toUuid(sc.attempt_id),
      compositeScore: String(sc.composite_score),
      proficiencyBand: sc.proficiency_band,
      benchmarkMet: sc.benchmark_met,
      section1Total: sc.section1_total,
      section1Accepted: sc.section1_accepted,
      section1AccuracyPct: String(sc.section1_accuracy_pct),
      section2PassagesCount: sc.section2_passages_count,
      section2AvgRetention: String(sc.section2_avg_retention),
      section3ScorePct: String(sc.section3_score_pct),
      section3WordCount: sc.section3_word_count,
      summaryMatrices: sc.summary_matrices,
      generatedAt: new Date(sc.generated_at || Date.now()),
    }).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${data.attempt_scorecards.length} attempt scorecards`);

  console.log('✅ Database seeding complete!');
  await client.end();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});

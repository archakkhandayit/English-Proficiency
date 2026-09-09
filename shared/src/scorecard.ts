export interface RubricDimension {
  dimension: 'structure_and_flow' | 'professional_register' | 'grammar_and_syntax';
  label: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface PassageRecallDiagnostic {
  passage_order: number;
  score: number;
  retained: string[];
  missed: string[];
  distortions: string[];
}

export interface ScorecardMatrices {
  composite: {
    score: number;
    scale: number;
    band: string;
    benchmark_met: boolean;
  };
  section1: {
    title: string;
    total_questions: number;
    accepted: number;
    rejected: number;
    accuracy_pct: number;
    questions?: any[];
  };
  section2: {
    title: string;
    total_passages: number;
    avg_retention_pct: number;
    passages: {
      score: number;
      retained: string[];
      missed: string[];
      distortions: string[];
      passage_text?: string;
      recalled_text?: string;
      candidate_answer?: string;
      ai_feedback?: string;
      order_index?: number;
    }[];
  };
  section3: {
    title: string;
    score_pct: number;
    word_count: number;
    word_compliance?: 'too_short' | 'optimal' | 'too_long';
    prompt_text?: string;
    email_text?: string;
    raw_rubric_total?: number;
    raw_rubric_max?: number;
    rubric: RubricDimension[];
  };
}

export interface Section1ScorecardItem {
  question_id: string;
  order_index: number;
  sentence: string;
  candidate_answer: string;
  acceptable_answers: string[];
  verdict: 'accepted' | 'rejected';
  score: number;
  feedback: string;
  match_type?: string;
}

export interface Section2ScorecardItem {
  passage_id: string;
  order_index: number;
  stimulus_passage: string;
  recalled_text: string;
  retention_percentage: number;
  analysis_summary: string;
  key_concepts_retained: string[];
  key_concepts_missed: string[];
  distortions: string[];
}

export interface Section3ScorecardItem {
  title: string;
  writing_percentage: number;
  raw_score: number;
  raw_max: number;
  word_count: number;
  word_count_compliance: string;
  scenario_prompt: string;
  submitted_content: string;
  overall_feedback: string;
  rubric: RubricDimension[];
}

export interface EvaluatedAttemptPayload {
  attempt_id: string;
  candidate_name: string;
  candidate_email?: string;
  exam_title: string;
  status: string;
  started_at?: string | null;
  submitted_at?: string | null;
  evaluated_at?: string | null;
  time_spent_min?: number;
  time_spent_sec?: number;
  model_version: string;
  summary: {
    composite_score: number;
    proficiency_band: string;
    benchmark_met: boolean;
    time_spent_min?: number;
  };
  sections: {
    section1: {
      title: string;
      total_questions: number;
      accepted_count: number;
      rejected_count: number;
      accuracy_percentage: number;
      items: Section1ScorecardItem[];
    };
    section2: {
      title: string;
      total_passages: number;
      average_retention_percentage: number;
      items: Section2ScorecardItem[];
    };
    section3: Section3ScorecardItem;
  };
  // Compatibility fields
  id?: string;
  composite_score?: number | string;
  proficiency_band?: string;
  benchmark_met?: boolean;
  section1_total?: number;
  section1_accepted?: number;
  section1_accuracy_pct?: number | string;
  section2_passages_count?: number;
  section2_avg_retention?: number | string;
  section3_score_pct?: number | string;
  section3_word_count?: number;
  summary_matrices?: ScorecardMatrices | any;
  generated_at?: string | Date;
}

export interface AttemptScorecard extends Partial<EvaluatedAttemptPayload> {
  id: string;
  attempt_id: string;
  composite_score: number | string;
  proficiency_band: string;
  benchmark_met: boolean;
  section1_total: number;
  section1_accepted: number;
  section1_accuracy_pct: number | string;
  section2_passages_count: number;
  section2_avg_retention: number | string;
  section3_score_pct: number | string;
  section3_word_count: number;
  summary_matrices: ScorecardMatrices;
  generated_at: string;
  candidate_name?: string;
  exam_title?: string;
}

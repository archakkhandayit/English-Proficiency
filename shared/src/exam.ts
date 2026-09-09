export type ExamStatus = 'draft' | 'active' | 'archived';
export type AttemptStatus = 'in_progress' | 'submitted' | 'evaluating' | 'evaluated' | 'evaluation_failed';
export type ResponseItemType = 'section1_question' | 'section2_passage' | 'section3_prompt';

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: ExamStatus;
  version: number;
  parent_exam_id: string | null;
  created_by: string;
  locked: boolean;
  created_at: string;
  updated_at: string;
  question_counts?: {
    section1: number;
    section2: number;
    section3: number;
  };
}

export interface Section1Question {
  id: string;
  exam_id: string;
  sentence_with_blank: string;
  acceptable_answers: string[];
  order_index: number;
}

export interface Section2Passage {
  id: string;
  exam_id: string;
  passage_text: string;
  order_index: number;
}

export interface Section3Prompt {
  id: string;
  exam_id: string;
  prompt_text: string;
}

export interface Attempt {
  id: string;
  candidate_id: string;
  exam_id: string;
  status: AttemptStatus;
  current_section: number; // 1: S1, 2: S2 Read, 3: S2 Recall, 4: S3, 5: Submitted
  started_at: string;
  submitted_at: string | null;
  evaluated_at: string | null;
  error_message: string | null;
}

export interface ExamResponse {
  id: string;
  attempt_id: string;
  section: number;
  item_type: ResponseItemType;
  item_id: string;
  answer_text: string;
  time_spent_sec: number | null;
  created_at: string;
}

export interface SaveResponseDto {
  item_id: string;
  section: number;
  item_type: ResponseItemType;
  answer_text: string;
  time_spent_sec?: number;
}

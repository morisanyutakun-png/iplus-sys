export interface StudentMaterialInfo {
  material_key: string;
  material_name: string;
  pointer: number;
  total_nodes: number;
  percent: number;
  next_node_title?: string;
}

export interface Student {
  id: string;
  name: string;
  grade?: string;
  created_at: string;
  materials: StudentMaterialInfo[];
}

export interface MaterialNode {
  key: string;
  material_key: string;
  title: string;
  range_text: string;
  pdf_relpath: string;
  answer_pdf_relpath: string;
  recheck_pdf_relpath: string;
  recheck_answer_pdf_relpath: string;
  duplex: boolean;
  sort_order: number;
}

export interface Material {
  key: string;
  name: string;
  subject: string;
  start_on?: string;
  aliases: string[];
  sort_order: number;
  exam_material_id?: number | null;
  nodes: MaterialNode[];
}

export interface QueueItem {
  id: number;
  student_id: string;
  student_name?: string;
  student_grade?: string;
  material_key: string;
  material_name?: string;
  node_key?: string;
  node_name?: string;
  sort_order: number;
  status: string;
  pdf_type: string;
  generated_pdf?: string;
  scheduled_at?: string;
  created_at: string;
}

export interface PrintJobItem {
  id: number;
  sort_order: number;
  student_id?: string;
  student_name?: string;
  material_key?: string;
  material_name?: string;
  node_key?: string;
  node_name?: string;
  pdf_relpath?: string;
  missing_pdf: boolean;
  duplex: boolean;
  pdf_type: string;
}

export interface PrintJob {
  id: string;
  status: string;
  item_count: number;
  missing: number;
  created_at: string;
  executed_at?: string;
  items: PrintJobItem[];
}

export interface ProgressEntry {
  id: number;
  student_id: string;
  material_key: string;
  node_key?: string;
  action: string;
  old_pointer?: number;
  new_pointer?: number;
  created_at: string;
}

export interface NearlyCompleteItem {
  student_id: string;
  student_name: string;
  material_key: string;
  material_name: string;
  pointer: number;
  total_nodes: number;
  remaining: number;
  acknowledged: boolean;
}

export interface WeeklyTrendItem {
  week: string;
  actions: number;
}

export interface StudentMaterialProgress {
  material_key: string;
  material_name: string;
  pointer: number;
  total_nodes: number;
  percent: number;
}

export interface StudentProgressRow {
  student_id: string;
  student_name: string;
  materials: StudentMaterialProgress[];
  avg_percent: number;
}

export interface LowAccuracyItem {
  student_id: string;
  student_name: string;
  material_key: string;
  material_name: string;
  node_key: string;
  node_title: string;
  latest_rates: number[];
  streak: number;
  acknowledged: boolean;
}

export interface DashboardStats {
  total_students: number;
  total_materials: number;
  nearly_complete: NearlyCompleteItem[];
  low_accuracy: LowAccuracyItem[];
  weekly_actions: number;
  weekly_trend: WeeklyTrendItem[];
  student_progress: StudentProgressRow[];
  recent_activity: ProgressEntry[];
}

export interface MaterialZones {
  assigned: {
    key: string;
    name: string;
    total_nodes: number;
    pointer?: number;
    max_node?: number;
    percent?: number;
  }[];
  source: {
    key: string;
    name: string;
    total_nodes: number;
    word_book_id?: number;
    total_words?: number;
  }[];
}

export interface PrintLogEntry {
  id: number;
  type: string;
  job_id?: string;
  student_id?: string;
  student_name?: string;
  material_key?: string;
  material_name?: string;
  node_key?: string;
  node_name?: string;
  success?: boolean;
  message?: string;
  created_at: string;
}

// Lesson Records
export interface LessonRecord {
  id: number;
  student_id: string;
  material_key: string;
  node_key?: string;
  lesson_date: string;
  status: string;
  score?: number;
  max_score?: number;
  accuracy_rate?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LessonRecordUpsert {
  student_id: string;
  material_key: string;
  node_key?: string;
  lesson_date: string;
  status: string;
  score?: number;
  max_score?: number;
  notes?: string;
}

// Mastery Input
export interface MasteryInput {
  student_id: string;
  material_key: string;
  node_key: string;
  lesson_date: string;
  status: "completed" | "retry";
  score?: number;
  max_score?: number;
  notes?: string;
}

export interface MasteryResultItem {
  student_id: string;
  material_key: string;
  node_key: string;
  status: string;
  advanced: boolean;
  completed: boolean;
  new_pointer: number;
  queued_node_key?: string;
  queued_node_title?: string;
}

export interface MasteryBatchResponse {
  processed: number;
  advanced: number;
  retried: number;
  queued: number;
  completed: number;
  results: MasteryResultItem[];
}

// Auto Print
export interface NextPrintItem {
  student_id: string;
  student_name: string;
  student_grade?: string;
  material_key: string;
  material_name: string;
  node_key: string;
  node_title: string;
  pdf_relpath: string;
  answer_pdf_relpath: string;
  duplex: boolean;
  pointer: number;
}

// Analytics
export interface StudentAnalytics {
  progress_timeline: {
    date: string;
    material_key: string;
    action: string;
    old_pointer?: number;
    new_pointer?: number;
  }[];
  completion_rates: {
    material_key: string;
    material_name: string;
    pointer: number;
    total_nodes: number;
    percent: number;
  }[];
  pace: {
    nodes_per_week: number;
    trend: string;
    weekly_detail: Record<string, number>;
  };
}


// Word Test (単語ミックステスト)
export interface WordBook {
  id: number;
  name: string;
  description: string;
  total_words: number;
  material_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColumnMapping {
  number_col: number | null;
  word_col: number;
  translation_col: number;
  skip_header: boolean;
}

export interface DetectColumnsResponse {
  columns: { index: number; sample: string; suggested_role: string }[];
  suggested_mapping: ColumnMapping | null;
}

export interface Word {
  id: number;
  word_book_id: number;
  word_number: number;
  question: string;
  answer: string;
}

export interface CsvImportResponse {
  imported: number;
  updated: number;
  errors: string[];
}

// ── Exam Management (共通テスト・過去問) ──

export interface ExamSubject {
  id: number;
  exam_material_id: number;
  subject_name: string;
  max_score: number;
  sort_order: number;
  node_key?: string | null;
}

export interface ExamMaterial {
  id: number;
  name: string;
  exam_type: "common_test" | "university_past";
  year?: number;
  university?: string;
  faculty?: string;
  exam_period?: string;
  sort_order: number;
  subjects: ExamSubject[];
  created_at: string;
  updated_at: string;
}

export interface ExamAssignment {
  student_id: string;
  exam_material_id: number;
  assigned_at: string;
  exam_name?: string;
}

export interface ExamScore {
  id: number;
  student_id: string;
  exam_material_id: number;
  exam_subject_id: number;
  score: number | null;
  attempt_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ExamScoreUpsert {
  student_id: string;
  exam_material_id: number;
  exam_subject_id: number;
  score: number | null;
  attempt_date: string;
  notes?: string;
}

export interface ExamScoreTarget {
  id: number;
  student_id: string;
  exam_material_id: number;
  exam_subject_id: number;
  target_score: number;
}

export interface UniversityScoreWeight {
  id: number;
  name: string;
  university: string;
  faculty: string;
  weights: Record<string, { max: number; compressed_max: number }>;
  total_compressed_max: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectScoreDetail {
  subject_name: string;
  max_score: number;
  score: number | null;
  target_score?: number | null;
}

export interface ExamAttemptSummary {
  exam_material_id: number;
  exam_name: string;
  exam_type: string;
  attempt_date: string;
  subjects: SubjectScoreDetail[];
  total_score: number;
  total_max: number;
  percentage: number;
}

export interface StudentExamSummary {
  student_id: string;
  student_name: string;
  attempts: ExamAttemptSummary[];
}

export interface CompressedScoreSubject {
  subject_name: string;
  raw_score: number;
  original_max: number;
  compressed_max: number;
  compressed_score: number;
}

export interface CompressedScoreResult {
  weight_name: string;
  university: string;
  faculty: string;
  subjects: CompressedScoreSubject[];
  total_compressed: number;
  total_compressed_max: number;
  percentage: number;
}

export interface StudentExamRanking {
  student_id: string;
  student_name: string;
  grade?: string;
  total_score: number;
  total_max: number;
  percentage: number;
}

export interface SubjectAverageItem {
  subject_name: string;
  max_score: number;
  avg_score: number;
  avg_percentage: number;
  student_count: number;
}

export interface ExamOverview {
  exam_material_id: number;
  exam_name: string;
  rankings: StudentExamRanking[];
  subject_averages: SubjectAverageItem[];
  class_average_total: number;
  class_average_percentage: number;
}

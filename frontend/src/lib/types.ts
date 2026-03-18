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
  created_at: string;
  materials: StudentMaterialInfo[];
}

export interface MaterialNode {
  key: string;
  material_key: string;
  title: string;
  range_text: string;
  pdf_relpath: string;
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
  nodes: MaterialNode[];
}

export interface QueueItem {
  id: number;
  student_id: string;
  student_name?: string;
  material_key: string;
  material_name?: string;
  node_key?: string;
  node_name?: string;
  sort_order: number;
  status: string;
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

export interface DashboardStats {
  total_students: number;
  total_materials: number;
  nearly_complete: NearlyCompleteItem[];
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
    percent?: number;
  }[];
  source: {
    key: string;
    name: string;
    total_nodes: number;
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
  material_key: string;
  material_name: string;
  node_key: string;
  node_title: string;
  pdf_relpath: string;
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

export interface StudentRanking {
  student_id: string;
  name: string;
  avg_percent: number;
  total_nodes_completed: number;
}

export interface OverviewAnalytics {
  student_rankings: StudentRanking[];
  material_difficulty: {
    material_key: string;
    name: string;
    avg_pace: number;
    avg_score?: number;
  }[];
  weekly_activity: {
    week: string;
    records_count: number;
    prints_count: number;
    manual_set_count: number;
  }[];
  completion_heatmap: {
    student_id: string;
    student_name: string;
    material_key: string;
    material_name: string;
    percent: number;
  }[];
}

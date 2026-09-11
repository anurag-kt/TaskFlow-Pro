export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type ColumnType = 'Backlog' | 'In Progress' | 'Review' | 'Done';

export interface Task {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: ColumnType;
  start_date: string; // ISO YYYY-MM-DD
  estimated_days: number;
  order_index: number;
  created_at?: string;
  updated_at?: string;
  // Computed properties
  isBlocked?: boolean;
  blockedBy?: { id: string; title: string; status: ColumnType }[];
  isCritical?: boolean;
  calculatedEarlyStart?: number;
  calculatedEarlyFinish?: number;
  calculatedLateStart?: number;
  calculatedLateFinish?: number;
  slack?: number;
}

export interface Column {
  id: string;
  board_id: string;
  title: ColumnType;
  order_index: number;
  tasks: Task[];
}

export interface Board {
  id: string;
  title: string;
  created_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;       // The blocked task
  depends_on_id: string; // The prerequisite task
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  board_id: string;
  message: string;
  created_at: string;
}

export interface Edge {
  from: string; // depends_on_id (prerequisite)
  to: string;   // task_id (dependent)
}

export interface CycleCheckResult {
  hasCycle: boolean;
  path?: string[];
  message?: string;
}

export interface BoardPayload {
  board: Board;
  columns: Column[];
  dependencies: TaskDependency[];
  activities: ActivityLog[];
  criticalPath: {
    criticalTaskIds: string[];
    projectDurationDays: number;
  };
}

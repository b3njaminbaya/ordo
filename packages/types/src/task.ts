export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tasklist_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  due_date?: string;
  priority: TaskPriority;
  tasklist_id: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  due_date?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  tasklist_id?: number;
}

export interface AssignTaskRequest {
  user_ids: number[];
}

export interface TaskStats {
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
}

export interface UpcomingTask {
  id: number;
  title: string;
  dueDate: string | null;
}

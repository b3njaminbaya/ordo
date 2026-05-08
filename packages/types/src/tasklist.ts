import type { Task } from "./task";

export interface TaskList {
  id: number;
  name: string;
  user_id: number;
  tasks: Task[];
}

export interface CreateTaskListRequest {
  name: string;
}

export interface UpdateTaskListRequest {
  name: string;
}

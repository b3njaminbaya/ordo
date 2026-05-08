export interface Comment {
  id: number;
  content: string;
  user_id: number;
  username: string | null;
  task_id: number;
  created_at: string;
}

export interface CreateCommentRequest {
  content: string;
}

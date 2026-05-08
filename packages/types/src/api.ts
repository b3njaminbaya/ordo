/** Standard success response envelope */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

/** Standard error response envelope */
export interface ErrorResponse {
  error: string;
}

/** Paginated wrapper */
export interface Paginated<T> {
  items: T[];
  current_page: number;
  total_pages: number;
  total_count: number;
}

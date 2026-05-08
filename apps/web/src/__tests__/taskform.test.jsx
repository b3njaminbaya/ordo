import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockPost = vi.fn();
const mockGet = vi.fn(() => Promise.resolve({ data: { users: [] } }));

vi.mock("../api/axios", () => ({
  default: { get: mockGet, post: mockPost },
}));

import TaskForm from "../components/workspace/TaskForm";

describe("TaskForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ status: 201, data: { id: 42, title: "My Task" } });
  });

  const renderForm = (props = {}) =>
    render(<TaskForm tasklistId={1} {...props} />);

  it("renders all fields", async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when title is empty", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it("submits with valid values and calls onTaskAdded", async () => {
    const onTaskAdded = vi.fn();
    renderForm({ onTaskAdded });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/title/i), "My Task");
    await user.type(screen.getByLabelText(/due date/i), "2026-12-31");

    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/tasks/",
        expect.objectContaining({ title: "My Task" })
      );
      expect(onTaskAdded).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    });
  });

  it("disables submit button when no tasklistId provided", () => {
    render(<TaskForm tasklistId={null} />);
    expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled();
  });

  it("shows API error on failed submit", async () => {
    mockPost.mockRejectedValue({ response: { data: { error: "Server error" } } });
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/title/i), "Fail Task");
    await user.type(screen.getByLabelText(/due date/i), "2026-12-31");

    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
});

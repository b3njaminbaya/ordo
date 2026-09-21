import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: api }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", workspace_id: "ws-1" } }),
}));

import TaskForm from "../components/workspace/TaskForm";

const lists = [
  { id: 1, name: "My Tasks", user_id: 1, owner_name: "alice" },
  { id: 2, name: "Ops", user_id: 2, owner_name: "bob" },
];

describe("TaskForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { members: [{ id: 1, username: "alice", email: "a@x.co" }] } });
    api.post.mockResolvedValue({ status: 201, data: { id: 42, title: "My Task" } });
  });

  it("renders all fields", async () => {
    render(<TaskForm tasklists={lists} />);
    expect(await screen.findByLabelText(/^title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^list/i)).toBeInTheDocument();
  });

  it("requires a title but not a due date", async () => {
    render(<TaskForm tasklists={lists} />);
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/due date is required/i)).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("creates the task in the requested column, in one request", async () => {
    const onTaskAdded = vi.fn();
    render(<TaskForm tasklists={lists} status="in-progress" onTaskAdded={onTaskAdded} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^title/i), "  My Task ");
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => expect(onTaskAdded).toHaveBeenCalledWith(expect.objectContaining({ id: 42 })));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/tasks", expect.objectContaining({
      title: "My Task",              // trimmed
      status: "in-progress",         // persisted server-side, not just shown in the UI
      tasklist_id: 1,                // defaults to the user's own list
      due_date: null,
      assignee_ids: [],
    }));
  });

  it("lets the user pick another list", async () => {
    render(<TaskForm tasklists={lists} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^title/i), "Elsewhere");
    await user.selectOptions(screen.getByLabelText(/^list/i), "2");
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/tasks", expect.objectContaining({ tasklist_id: 2 })));
  });

  it("explains itself and disables submit when there are no lists", () => {
    render(<TaskForm tasklists={[]} />);
    expect(screen.getByText(/create a list first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled();
  });

  it("shows the server's error message and keeps what was typed", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "Server error" } } });
    render(<TaskForm tasklists={lists} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^title/i), "Fail Task");
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^title/i)).toHaveValue("Fail Task");
  });

  it("says so when the server can't be reached", async () => {
    api.post.mockRejectedValue(new Error("Network Error"));
    render(<TaskForm tasklists={lists} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^title/i), "Offline");
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
  });
});

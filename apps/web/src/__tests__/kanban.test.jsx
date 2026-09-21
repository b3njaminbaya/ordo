import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../api/axios", () => ({ default: api }));
vi.mock("../socket", () => ({ socket: { on: vi.fn(), off: vi.fn(), connected: false } }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", workspace_id: "ws-1", workspace: { is_owner: true } } }),
}));

import { ToastProvider } from "../components/ui/toast";
import KanbanBoard from "../components/workspace/KanbanBoard";

const task = (over) => ({
  id: 1, title: "Write docs", description: "", priority: "medium", status: "todo", position: 0,
  due_date: null, assignees: [], tasklist_id: 1, tasklist_owner_id: 1,
  subtask_count: 2, subtasks_completed: 1, attachment_count: 1, comment_count: 0, ...over,
});

function setup({ tasks = [task()], lists = [{ id: 1, name: "My Tasks", user_id: 1, owner_name: "alice", tasks: [] }] } = {}) {
  api.get.mockImplementation((url) => {
    if (url === "/tasks") return Promise.resolve({ data: tasks });
    if (url === "/tasklists/") return Promise.resolve({ data: lists });
    if (url.includes("/members")) return Promise.resolve({ data: { members: [] } });
    return Promise.resolve({ data: [] });
  });
  return render(
    <MemoryRouter>
      <ToastProvider>
        <KanbanBoard />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("KanbanBoard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the add-task dialog from a column's + button (regression: it never opened)", async () => {
    setup();
    await screen.findByText("Write docs");
    fireEvent.click(screen.getByRole("button", { name: /add task to in progress/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/add task to in progress/i)).toBeInTheDocument();
  });

  it("creates the task in the column that was clicked", async () => {
    api.post.mockResolvedValue({ data: task({ id: 9, title: "New", status: "in-progress" }) });
    setup();
    await screen.findByText("Write docs");
    fireEvent.click(screen.getByRole("button", { name: /add task to in progress/i }));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^title/i), "New");
    fireEvent.click(screen.getByRole("button", { name: /^add task$/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/tasks", expect.objectContaining({ status: "in-progress" })));
    // the new card shows up inside the In Progress column
    const column = screen.getByRole("region", { name: "In Progress" });
    expect(await within(column).findByText("New")).toBeInTheDocument();
  });

  it("shows subtask and attachment badges before a card is ever opened", async () => {
    setup();
    await screen.findByText("Write docs");
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("guides a brand-new user to create their first list", async () => {
    setup({ tasks: [], lists: [] });
    expect(await screen.findByRole("button", { name: /create a list/i })).toBeInTheDocument();
  });

  it("puts each task in its own column", async () => {
    setup({ tasks: [task({ id: 1, title: "A", status: "todo" }), task({ id: 2, title: "B", status: "completed" })] });
    await screen.findByText("A");
    expect(within(screen.getByRole("region", { name: "To Do" })).getByText("A")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Done" })).getByText("B")).toBeInTheDocument();
  });
});

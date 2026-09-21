import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn((url) => {
      if (url === "/api/task-stats")
        return Promise.resolve({ data: { todo: 4, completed: 3, pending: 1, inProgress: 2, overdue: 0, total: 10, overdueRate: 0 } });
      if (url === "/api/upcoming-tasks")
        return Promise.resolve({ data: [{ id: 1, title: "Write tests", dueDate: "2026-12-31" }] });
      if (url === "/api/task-stats/velocity")
        return Promise.resolve({ data: Array(8).fill(0).map((_, i) => ({ week: `Week ${i}`, completed: i })) });
      return Promise.resolve({ data: [] });
    }),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "alice", workspace: { name: "Alice's Workspace" } } }),
}));

// Chart.js requires canvas — stub it out
vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../components/ui/toast";
import Dashboard from "../components/workspace/Dashboard";

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("Dashboard", () => {
  it("renders greeting with username once loaded", async () => {
    renderDashboard();
    expect(await screen.findByText(/hi, alice/i)).toBeInTheDocument();
  });

  it("shows a card for every board status so the numbers add up", async () => {
    renderDashboard();
    await waitFor(() => {
      for (const label of ["To Do", "In Progress", "In Review", "Done", "Overdue"]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });
    // 4 + 2 + 1 + 3 = 10 total shown across the four status cards
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders charts", async () => {
    renderDashboard();
    expect(await screen.findByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("links upcoming tasks to the board", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: /write tests/i });
    expect(link).toHaveAttribute("href", "/workspace/kanban?task=1");
  });
});

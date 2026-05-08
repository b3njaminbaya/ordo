import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn((url) => {
      if (url === "/api/task-stats")
        return Promise.resolve({ data: { completed: 3, pending: 1, inProgress: 2, overdue: 0 } });
      if (url === "/api/upcoming-tasks")
        return Promise.resolve({ data: [{ id: 1, title: "Write tests", dueDate: "2026-12-31" }] });
      if (url === "/api/task-stats/velocity")
        return Promise.resolve({ data: Array(8).fill(0).map((_, i) => ({ week: `Week ${i}`, completed: i })) });
      return Promise.resolve({ data: [] });
    }),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "alice" } }),
}));

vi.mock("./Notifications", () => ({ default: () => null }), { virtual: true });
vi.mock("../components/workspace/Notifications", () => ({ default: () => null }));

// Chart.js requires canvas — stub it out
vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

import Dashboard from "../components/workspace/Dashboard";

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders greeting with username", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/hi, alice/i)).toBeInTheDocument();
  });

  it("renders stat cards", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("Ongoing")).toBeInTheDocument();
      expect(screen.getByText("Overdue")).toBeInTheDocument();
    });
  });

  it("renders charts", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  it("shows upcoming task title", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Write tests")).toBeInTheDocument();
    });
  });
});

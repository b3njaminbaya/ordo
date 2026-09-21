import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { motion } from "framer-motion";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Card, Spinner, useToast } from "../ui";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
);

// Every status on the board, so the cards always add up to the total.
const STAT_CONFIG = [
  { key: "todo",       label: "To Do",       cardClass: "bg-text-muted", chartColor: "#94A3B8" },
  { key: "inProgress", label: "In Progress", cardClass: "bg-primary",    chartColor: "#6366F1" },
  { key: "pending",    label: "In Review",   cardClass: "bg-warning",    chartColor: "#F59E0B" },
  { key: "completed",  label: "Done",        cardClass: "bg-success",    chartColor: "#10B981" },
  { key: "overdue",    label: "Overdue",     cardClass: "bg-danger",     chartColor: "#EF4444" },
];

function buildChartOptions(isDark, horizontal = false) {
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const tickColor = isDark ? "#94A3B8" : "#6B7280";
  return {
    responsive: true,
    indexAxis: horizontal ? "y" : "x",
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: tickColor }, grid: { color: gridColor } },
      y: { beginAtZero: true, ticks: { precision: 0, color: tickColor }, grid: { color: gridColor } },
    },
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const toast = useToast();
  const [loading,       setLoading]       = useState(true);
  const [taskStats,     setTaskStats]     = useState({ todo: 0, completed: 0, pending: 0, inProgress: 0, overdue: 0, total: 0, overdueRate: 0 });
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [velocity,      setVelocity]      = useState([]);
  const [workload,      setWorkload]      = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/api/task-stats"),
      api.get("/api/upcoming-tasks"),
      api.get("/api/task-stats/velocity"),
      api.get("/api/task-stats/workload"),
    ])
      .then(([stats, upcoming, vel, work]) => {
        if (cancelled) return;
        setTaskStats(stats.data);
        setUpcomingTasks(Array.isArray(upcoming.data) ? upcoming.data : []);
        setVelocity(Array.isArray(vel.data) ? vel.data : []);
        setWorkload(Array.isArray(work.data) ? work.data : []);
      })
      .catch((err) => { if (!cancelled) toast(errorMessage(err, "Couldn't load the dashboard."), "danger"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const isDark        = resolvedTheme === "dark";
  const chartOptions  = useMemo(() => buildChartOptions(isDark), [isDark]);
  const hasVelocity   = velocity.some((w) => w.completed > 0);

  const chartData = {
    labels: STAT_CONFIG.map((s) => s.label),
    datasets: [{
      label: "Tasks",
      data: STAT_CONFIG.map((s) => taskStats[s.key]),
      backgroundColor: STAT_CONFIG.map((s) => s.chartColor),
      borderRadius: 5,
    }],
  };

  const velocityData = {
    labels: velocity.map((w) => w.week),
    datasets: [{
      label: "Completed",
      data: velocity.map((w) => w.completed),
      borderColor: "#6366F1",
      backgroundColor: "rgba(99,102,241,0.12)",
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: "#6366F1",
    }],
  };

  const workloadData = {
    labels: workload.map((m) => m.username),
    datasets: [
      {
        label: "Open (on track)",
        data: workload.map((m) => Math.max(0, m.open - m.overdue)),
        backgroundColor: "rgba(99,102,241,0.75)",
        borderRadius: 4,
      },
      {
        label: "Overdue",
        data: workload.map((m) => m.overdue),
        backgroundColor: "rgba(239,68,68,0.75)",
        borderRadius: 4,
      },
    ],
  };

  const workloadStackedOptions = useMemo(() => {
    const base = buildChartOptions(isDark, true);
    return {
      ...base,
      plugins: { legend: { display: true, labels: { color: isDark ? "#94A3B8" : "#6B7280", boxWidth: 12 } } },
      scales: {
        ...base.scales,
        x: { ...base.scales.x, stacked: true },
        y: { ...base.scales.y, stacked: true },
      },
    };
  }, [isDark]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-primary" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Hi, {user?.username}!</h1>
        {taskStats.total > 0 && (
          <p className="text-sm text-text-muted mt-0.5">
            {taskStats.total} task{taskStats.total === 1 ? "" : "s"} in {user?.workspace?.name} · {taskStats.overdueRate}% overdue
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {STAT_CONFIG.map((stat, i) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className={`${stat.cardClass} text-white rounded-xl p-5 text-center`}>
              <p className="text-sm font-medium opacity-90">{stat.label}</p>
              <p className="text-4xl font-bold mt-1">{taskStats[stat.key] ?? 0}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-base font-semibold text-text mb-4">Task Distribution</h2>
          <Bar data={chartData} options={chartOptions} role="img" aria-label="Bar chart of tasks by status" />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-text mb-4">Weekly Velocity</h2>
          {hasVelocity ? (
            <Line data={velocityData} options={chartOptions} role="img" aria-label="Line chart of tasks completed per week" />
          ) : (
            <p className="text-sm text-text-muted pt-4">Nothing completed in the last 8 weeks yet.</p>
          )}
        </Card>
      </div>

      {/* Workload chart */}
      {workload.length > 0 && (
        <div className="mb-6">
          <Card>
            <h2 className="text-base font-semibold text-text mb-4">Open work per person</h2>
            <Bar data={workloadData} options={workloadStackedOptions} role="img" aria-label="Stacked bar chart of open and overdue tasks per person" />
          </Card>
        </div>
      )}

      {/* Upcoming tasks */}
      <div>
        <h2 className="text-base font-semibold text-text mb-3">Upcoming Tasks</h2>
        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-text-muted">No upcoming tasks</p>
        ) : (
          <ul className="space-y-2">
            {upcomingTasks.map((task) => (
              <motion.li
                key={task.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  to={`/workspace/kanban?task=${task.id}`}
                  className="block bg-surface rounded-lg px-4 py-3 shadow-card border border-border hover:border-primary/40 transition-colors"
                >
                  <p className="text-sm font-semibold text-text">{task.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">Due: {task.dueDate ?? "No deadline"}</p>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

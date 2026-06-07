import { useEffect, useState, useMemo } from "react";
import Notifications from "./Notifications";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/axios";
import { motion } from "framer-motion";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Card } from "../ui";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
);

const STAT_CONFIG = [
  { key: "completed",  label: "Completed",  cardClass: "bg-success",  chartColor: "#10B981" },
  { key: "pending",    label: "Pending",    cardClass: "bg-warning",  chartColor: "#F59E0B" },
  { key: "inProgress", label: "Ongoing",    cardClass: "bg-primary",  chartColor: "#6366F1" },
  { key: "overdue",    label: "Overdue",    cardClass: "bg-danger",   chartColor: "#EF4444" },
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
  const [taskStats,     setTaskStats]     = useState({ completed: 0, pending: 0, inProgress: 0, overdue: 0, total: 0, overdueRate: 0 });
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [velocity,      setVelocity]      = useState([]);
  const [workload,      setWorkload]      = useState([]);

  useEffect(() => {
    api.get("/api/task-stats").then((r) => setTaskStats(r.data)).catch(() => {});
    api.get("/api/upcoming-tasks").then((r) => setUpcomingTasks(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/api/task-stats/velocity").then((r) => setVelocity(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/api/task-stats/workload").then((r) => setWorkload(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const isDark          = resolvedTheme === "dark";
  const chartOptions    = useMemo(() => buildChartOptions(isDark),       [isDark]);
  const velocityOptions = useMemo(() => buildChartOptions(isDark),       [isDark]);
  const workloadOptions = useMemo(() => buildChartOptions(isDark, true), [isDark]);

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
        label: "Open",
        data: workload.map((m) => m.open),
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Hi, {user?.username}!</h1>
          {taskStats.total > 0 && (
            <p className="text-sm text-text-muted mt-0.5">
              {taskStats.overdueRate}% overdue rate · {taskStats.total} total tasks
            </p>
          )}
        </div>
        <Notifications />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STAT_CONFIG.map((stat, i) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className={`${stat.cardClass} text-white rounded-xl p-5 text-center`}>
              <p className="text-sm font-medium opacity-90">{stat.label}</p>
              <p className="text-4xl font-bold mt-1">{taskStats[stat.key]}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-base font-semibold text-text mb-4">Task Distribution</h2>
          <Bar data={chartData} options={chartOptions} />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-text mb-4">Weekly Velocity</h2>
          {velocity.length > 0 ? (
            <Line data={velocityData} options={velocityOptions} />
          ) : (
            <p className="text-sm text-text-muted pt-4">No completion data yet.</p>
          )}
        </Card>
      </div>

      {/* Workload chart */}
      {workload.length > 0 && (
        <div className="mb-6">
          <Card>
            <h2 className="text-base font-semibold text-text mb-4">Workload per Member</h2>
            <Bar data={workloadData} options={workloadStackedOptions} />
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
                className="bg-surface rounded-lg px-4 py-3 shadow-card border border-border"
              >
                <p className="text-sm font-semibold text-text">{task.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Due: {task.dueDate ?? "No deadline"}
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

import { useEffect, useState } from "react";
import Notifications from "./Notifications";
import { useAuth } from "../../context/AuthContext";
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

const chartOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const velocityOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [taskStats, setTaskStats] = useState({ completed: 0, pending: 0, inProgress: 0, overdue: 0 });
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [velocity, setVelocity] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/api/task-stats");
        setTaskStats(res.data);
      } catch {
        // non-fatal
      }
    };

    const fetchUpcomingTasks = async () => {
      try {
        const res = await api.get("/api/upcoming-tasks");
        setUpcomingTasks(Array.isArray(res.data) ? res.data : []);
      } catch {
        // non-fatal
      }
    };

    const fetchVelocity = async () => {
      try {
        const res = await api.get("/api/task-stats/velocity");
        setVelocity(Array.isArray(res.data) ? res.data : []);
      } catch {
        // non-fatal
      }
    };

    fetchStats();
    fetchUpcomingTasks();
    fetchVelocity();
  }, []);

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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Hi, {user?.username}!</h1>
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

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                className="bg-white rounded-lg px-4 py-3 shadow-card border border-border"
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

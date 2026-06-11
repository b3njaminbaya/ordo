import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";
import TaskList from "./TaskList.jsx";
import TaskBoard from "./TaskBoard.jsx";
import TaskForm from "./TaskForm.jsx";
import Notifications from "./Notifications.jsx";
import Sidebar from "./Sidebar.jsx";
import Shareboard from "./Shareboard.jsx";
import Profile from "./Profile.jsx";
import Settings from "./Settings.jsx";
import KanbanBoard from "./KanbanBoard.jsx";
import CalendarView from "./CalendarView.jsx";
import RecurringTasks from "./RecurringTasks.jsx";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket";
import { Menu, WifiOff } from "lucide-react";

const WorkspaceLayout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Start optimistic (true) so the banner never flashes on initial load;
  // only set false when a disconnect occurs after the connection was established.
  const [socketOnline, setSocketOnline] = useState(true);

  // ── Socket lifecycle: connect once for the whole workspace session ──────────
  useEffect(() => {
    if (!user?.workspace_id) return;

    const joinRooms = () => {
      socket.emit("join_workspace", { workspace_id: user.workspace_id });
      if (user.id) socket.emit("join_user", { user_id: user.id });
      setSocketOnline(true);
    };

    const onDisconnect = () => setSocketOnline(false);

    socket.on("connect", joinRooms);
    socket.on("disconnect", onDisconnect);

    socket.connect();
    if (socket.connected) joinRooms();

    return () => {
      socket.off("connect", joinRooms);
      socket.off("disconnect", onDisconnect);
      socket.emit("leave_workspace", { workspace_id: user.workspace_id });
      socket.disconnect();
    };
  }, [user?.workspace_id, user?.id]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center px-4 py-2 bg-surface border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <span className="ml-2 font-semibold text-text">Teevexa Ordo</span>
        </div>

        {/* Connection-lost banner */}
        {!socketOnline && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-warning/10 border-b border-warning/30 text-xs font-medium text-warning">
            <WifiOff size={13} />
            Real-time connection lost — reconnecting…
          </div>
        )}

        <main className="flex-1 overflow-auto bg-page">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks-list" element={<TaskList />} />
            <Route path="/task-board" element={<TaskBoard />} />
            <Route path="/create-task" element={<TaskForm />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/shareboard" element={<Shareboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/recurring" element={<RecurringTasks />} />
            <Route path="*" element={<Navigate to="/workspace/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default WorkspaceLayout;

import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Menu, WifiOff } from "lucide-react";
import Dashboard from "./Dashboard.jsx";
import TaskList from "./TaskList.jsx";
import Notifications from "./Notifications.jsx";
import Sidebar from "./Sidebar.jsx";
import Shareboard from "./Shareboard.jsx";
import Profile from "./Profile.jsx";
import Settings from "./Settings.jsx";
import KanbanBoard from "./KanbanBoard.jsx";
import CalendarView from "./CalendarView.jsx";
import RecurringTasks from "./RecurringTasks.jsx";
import TimeTracking from "./TimeTracking.jsx";
import { useAuth } from "../../context/AuthContext";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { TimerProvider } from "../../context/TimerContext";
import api from "../../api/axios";
import { socket } from "../../socket";

const WorkspaceLayout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Optimistic so the banner never flashes on load; only shown after a real disconnect.
  const [socketOnline, setSocketOnline] = useState(true);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // One authenticated socket for the whole workspace session. The server puts us in
  // the right rooms from our token; a new workspace or user means a fresh connection.
  useEffect(() => {
    if (!user?.id) return undefined;

    const onConnect = () => setSocketOnline(true);
    const onDisconnect = () => setSocketOnline(false);
    // Rejected (expired token?): make an API call so the axios interceptor refreshes it, then retry.
    let lastCheck = 0;
    const onConnectError = async () => {
      setSocketOnline(false);
      if (Date.now() - lastCheck < 15000) return;   // don't hammer the API while the socket keeps failing
      lastCheck = Date.now();
      try {
        await api.get("/session");
        if (!socket.connected) socket.connect();
      } catch {
        // signed out or offline — the interceptor / AuthContext handle it
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [user?.id, user?.workspace_id]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <NotificationsProvider>
      <TimerProvider>
        <div className="flex h-screen">
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="md:hidden flex items-center px-4 py-2 bg-surface border-b border-border">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu size={20} />
              </button>
              <span className="ml-2 font-semibold text-text">Ordo</span>
            </div>

            {!socketOnline && (
              <div role="status" className="flex items-center justify-center gap-2 px-4 py-1.5 bg-warning/10 border-b border-warning/30 text-xs font-medium text-warning">
                <WifiOff size={13} />
                Real-time connection lost — reconnecting…
              </div>
            )}

            <main className="flex-1 overflow-auto bg-page">
              <Routes>
                <Route path="/" element={<Navigate to="/workspace/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tasks-list" element={<TaskList />} />
                <Route path="/kanban" element={<KanbanBoard />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/shareboard" element={<Shareboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/recurring" element={<RecurringTasks />} />
                <Route path="/time" element={<TimeTracking />} />
                <Route path="*" element={<Navigate to="/workspace/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </TimerProvider>
    </NotificationsProvider>
  );
};

export default WorkspaceLayout;

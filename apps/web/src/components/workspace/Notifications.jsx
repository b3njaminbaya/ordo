import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import api from "../../api/axios";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?page=${page}`);
      setNotifications(res.data.notifications);
      setCurrentPage(res.data.current_page);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* non-fatal */ }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/read-all`);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* non-fatal */ }
  };

  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch { /* non-fatal */ }
  };

  const toggleNotifications = async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    try {
      const res = await api.patch(`/notifications/settings`, { enable_notifications: next });
      setNotificationsEnabled(res.data.enabled);
    } catch {
      setNotificationsEnabled((prev) => !prev);
    }
  };

  useEffect(() => {
    fetchNotifications(currentPage);
  }, [currentPage]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsPanelOpen((o) => !o)}
        className="relative p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
        )}
      </button>

      {/* Panel */}
      {isPanelOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsPanelOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-surface rounded-xl shadow-modal border border-border animate-slide-up">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Notifications</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
                <button
                  onClick={toggleNotifications}
                  className={[
                    "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                    notificationsEnabled
                      ? "bg-success text-white hover:bg-success/90"
                      : "bg-surface-muted text-text-muted hover:bg-border",
                  ].join(" ")}
                >
                  {notificationsEnabled ? "On" : "Off"}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {loading && (
                <p className="text-sm text-text-muted px-4 py-3">Loading…</p>
              )}
              {error && (
                <p className="text-sm text-danger px-4 py-3">{error}</p>
              )}
              {!loading && notifications.length === 0 && (
                <p className="text-sm text-text-muted px-4 py-3">No notifications</p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={[
                    "flex items-start gap-2 px-4 py-3 border-b border-border last:border-0",
                    n.is_read ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <p className={["flex-1 text-sm", n.is_read ? "text-text-muted" : "text-text font-medium"].join(" ")}>
                    {n.message}
                  </p>
                  <div className="flex-shrink-0 flex gap-1 items-center">
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="p-0.5 rounded text-text-muted hover:text-danger transition-colors"
                      aria-label="Delete notification"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="text-xs text-primary disabled:text-text-muted disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-xs text-text-muted">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="text-xs text-primary disabled:text-text-muted disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Notifications;

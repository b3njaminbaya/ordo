import { useEffect, useState, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket";

function formatRelTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [isPanelOpen, setIsPanelOpen]     = useState(false);
  const [currentPage, setCurrentPage]     = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [unreadCount, setUnreadCount]     = useState(0);

  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?page=${page}&per_page=10`);
      setNotifications(res.data.notifications);
      setCurrentPage(res.data.current_page);
      setTotalPages(res.data.total_pages);
      setUnreadCount(res.data.unread_count ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

  // Real-time: listen for pushed notifications (socket managed by WorkspaceLayout)
  useEffect(() => {
    if (!user?.id) return;

    const onNotification = (data) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };

    socket.on("notification", onNotification);

    return () => {
      socket.off("notification", onNotification);
    };
  }, [user?.id]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* non-fatal */ }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/read-all`);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* non-fatal */ }
  };

  const deleteNotification = async (id) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.delete(`/notifications/${id}`);
    } catch { /* non-fatal — already removed from UI */ }
  };

  const handlePageChange = (next) => {
    setCurrentPage(next);
    fetchNotifications(next);
  };

  const badgeCount = Math.min(unreadCount, 99);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsPanelOpen((o) => !o)}
        className="relative p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {badgeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isPanelOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsPanelOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 bg-surface rounded-xl shadow-modal border border-border animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium text-white bg-danger px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Check size={11} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {loading && (
                <p className="text-sm text-text-muted px-4 py-4">Loading…</p>
              )}
              {error && (
                <p className="text-sm text-danger px-4 py-4">{error}</p>
              )}
              {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <Bell size={28} className="text-text-muted opacity-40" />
                  <p className="text-sm text-text-muted">No notifications yet</p>
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={[
                    "flex items-start gap-3 px-4 py-3 transition-colors",
                    n.is_read ? "bg-transparent" : "bg-primary/5",
                  ].join(" ")}
                >
                  {!n.is_read && (
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  <div className={["flex-1 min-w-0", n.is_read ? "pl-4" : ""].join(" ")}>
                    <p className={["text-sm leading-snug break-words", n.is_read ? "text-text-muted" : "text-text font-medium"].join(" ")}>
                      {n.message}
                    </p>
                    {n.created_at && (
                      <p className="text-[11px] text-text-muted mt-0.5">{formatRelTime(n.created_at)}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-1 items-start pt-0.5">
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        title="Mark as read"
                        className="p-0.5 rounded text-text-muted hover:text-primary transition-colors"
                        aria-label="Mark as read"
                      >
                        <Check size={13} />
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
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="text-xs text-primary disabled:text-text-muted disabled:cursor-not-allowed hover:underline"
                >
                  Prev
                </button>
                <span className="text-xs text-text-muted">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="text-xs text-primary disabled:text-text-muted disabled:cursor-not-allowed hover:underline"
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

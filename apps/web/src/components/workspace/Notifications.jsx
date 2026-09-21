import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Alert, Button, Spinner } from "../ui";
import { useNotifications } from "../../context/NotificationsContext";
import { formatRelTime } from "../../utils/time";

/** Full notifications page. The unread badge lives in the sidebar. */
const Notifications = () => {
  const { items, page, totalPages, unreadCount, loading, error, fetchPage, markRead, markAllRead, remove } = useNotifications();

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Notifications</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</Button>
        )}
      </div>

      {error && (
        <div className="mb-4 space-y-2">
          <Alert variant="danger">{error}</Alert>
          <Button variant="outline" size="sm" onClick={() => fetchPage(page)}>Try again</Button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner className="text-primary" /></div>
      ) : items.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center bg-surface border border-border rounded-xl">
          <Bell size={32} className="text-text-muted opacity-40" />
          <p className="text-sm text-text-muted">No notifications yet</p>
          <p className="text-xs text-text-muted">You'll hear about assignments, comments and deadlines here.</p>
        </div>
      ) : (
        <ul className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">
          {items.map((n) => (
            <li key={n.id} className={["flex items-start gap-3 px-4 py-3", n.is_read ? "" : "bg-primary/5"].join(" ")}>
              <span
                className={["mt-2 flex-shrink-0 w-2 h-2 rounded-full", n.is_read ? "bg-transparent" : "bg-primary"].join(" ")}
                aria-label={n.is_read ? undefined : "Unread"}
              />
              <div className="flex-1 min-w-0">
                {n.task_id ? (
                  <Link
                    to={`/workspace/kanban?task=${n.task_id}`}
                    onClick={() => markRead(n.id)}
                    className={["block text-sm leading-snug break-words hover:underline", n.is_read ? "text-text-muted" : "text-text font-medium"].join(" ")}
                  >
                    {n.message}
                  </Link>
                ) : (
                  <p className={["text-sm leading-snug break-words", n.is_read ? "text-text-muted" : "text-text font-medium"].join(" ")}>{n.message}</p>
                )}
                <p className="text-xs text-text-muted mt-0.5">{formatRelTime(n.created_at)}</p>
              </div>
              <div className="flex-shrink-0 flex gap-1">
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors" aria-label="Mark as read">
                    <Check size={14} />
                  </button>
                )}
                <button onClick={() => remove(n.id)} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" aria-label="Delete notification">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>Previous</Button>
          <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};

export default Notifications;

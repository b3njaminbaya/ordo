import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { errorMessage } from "../api/errors";
import { socket } from "../socket";
import { useToast } from "../components/ui";

const NotificationsContext = createContext(null);
const PER_PAGE = 10;

export function NotificationsProvider({ children }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);

  const fetchPage = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/notifications?page=${p}&per_page=${PER_PAGE}`);
      setItems(res.data.notifications);
      setPage(res.data.current_page);
      pageRef.current = res.data.current_page;
      setTotalPages(Math.max(1, res.data.total_pages));
      setUnreadCount(res.data.unread_count ?? 0);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // Pushed by the server the moment something happens.
  useEffect(() => {
    const onNotification = (data) => {
      setUnreadCount((c) => c + 1);
      if (pageRef.current === 1) {
        setItems((prev) => (prev.some((n) => n.id === data.id) ? prev : [data, ...prev].slice(0, PER_PAGE)));
      }
      toast(data.message, "info");
    };
    socket.on("notification", onNotification);
    return () => socket.off("notification", onNotification);
  }, [toast]);

  const markRead = async (id) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.is_read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      toast(errorMessage(err, "Couldn't mark as read."), "danger");
      fetchPage(pageRef.current);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      toast(errorMessage(err, "Couldn't mark all as read."), "danger");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      fetchPage(pageRef.current);   // keeps pagination and the unread count honest
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete the notification."), "danger");
    }
  };

  return (
    <NotificationsContext.Provider
      value={{ items, page, totalPages, unreadCount, loading, error, fetchPage, markRead, markAllRead, remove }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { Button, PriorityBadge, Spinner, Alert } from "../ui";
import { parseDueDate } from "../../utils/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(today.getMonth() === month ? today.getDate() : null);

  const fetchTasks = useCallback(async (y, m) => {
    setLoading(true);
    setError(null);
    const start = `${y}-${pad(m + 1)}-01`;
    const end = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
    try {
      const res = await api.get(`/tasks/calendar?start=${start}&end=${end}`);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load calendar tasks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(year, month); }, [year, month, fetchTasks]);

  const goTo = (y, m, day = null) => { setYear(y); setMonth(m); setSelected(day); };
  const prevMonth = () => (month === 0 ? goTo(year - 1, 11) : goTo(year, month - 1));
  const nextMonth = () => (month === 11 ? goTo(year + 1, 0) : goTo(year, month + 1));
  const goToday = () => goTo(today.getFullYear(), today.getMonth(), today.getDate());

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const due = parseDueDate(t.due_date);
      if (!due) return;
      (map[due.getDate()] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const days = buildCalendarDays(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;
  const selectedTasks = selected ? tasksByDay[selected] || [] : [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-muted hover:text-text" aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-text min-w-[150px] text-center" aria-live="polite">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-muted hover:text-text" aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 space-y-2">
          <Alert variant="danger">{error}</Alert>
          <Button variant="outline" size="sm" onClick={() => fetchTasks(year, month)}>Try again</Button>
        </div>
      )}

      <div className="bg-surface rounded-xl shadow-card border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wide">{day}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="text-primary" /></div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} className="min-h-[80px] border-b border-r border-border bg-surface-muted/50" />;
              const dayTasks = tasksByDay[day] || [];
              const isSelected = day === selected;
              const label = `${new Date(year, month, day).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}, ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"} due`;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={label}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={[
                    "min-h-[80px] p-1.5 sm:p-2 border-b border-r border-border text-left align-top transition-colors hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    isSelected ? "bg-primary/10" : "",
                  ].join(" ")}
                >
                  <span className={["inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold mb-1", day === todayDay ? "bg-primary text-white" : "text-text-muted"].join(" ")}>
                    {day}
                  </span>
                  <span className="block space-y-0.5">
                    {dayTasks.slice(0, 2).map((t) => (
                      <span key={t.id} className="block text-xs truncate px-1 py-0.5 rounded bg-primary/10 text-primary font-medium" title={t.title}>
                        {t.title}
                      </span>
                    ))}
                    {dayTasks.length > 2 && <span className="block text-xs text-text-muted px-1">+{dayTasks.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && !loading && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-text mb-3">
            Tasks due {new Date(year, month, selected).toLocaleDateString("default", { month: "long", day: "numeric" })}
          </h2>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-text-muted">No tasks due on this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/workspace/kanban?task=${t.id}`}
                    className="flex items-center justify-between gap-3 bg-surface rounded-lg px-4 py-3 shadow-card border border-border hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{t.title}</p>
                      {t.description && <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{t.description}</p>}
                    </div>
                    <PriorityBadge priority={t.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

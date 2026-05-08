import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../api/axios";
import { PriorityBadge, Spinner, Alert } from "../ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [selected, setSelected] = useState(null);

  const fetchTasks = useCallback(async (y, m) => {
    setLoading(true);
    setError(null);
    const pad = (n) => String(n).padStart(2, "0");
    const start = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    try {
      const res = await api.get(`/tasks/calendar?start=${start}&end=${end}`);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load calendar tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks(year, month);
    setSelected(null);
  }, [year, month, fetchTasks]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const tasksByDay = {};
  tasks.forEach((t) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date).getDate();
    if (!tasksByDay[d]) tasksByDay[d] = [];
    tasksByDay[d].push(t);
  });

  const days = buildCalendarDays(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  const selectedTasks = selected ? (tasksByDay[selected] || []) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-muted hover:text-text">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-text min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-muted hover:text-text">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Grid */}
      <div className="bg-surface rounded-xl shadow-card border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const dayTasks = day ? (tasksByDay[day] || []) : [];
              const isToday = day === todayDay;
              const isSelected = day === selected;
              return (
                <div
                  key={idx}
                  onClick={() => day && setSelected(isSelected ? null : day)}
                  className={[
                    "min-h-[80px] p-2 border-b border-r border-border last:border-r-0 transition-colors",
                    day ? "cursor-pointer hover:bg-primary/5" : "bg-surface-muted/50",
                    isSelected ? "bg-primary/10" : "",
                  ].join(" ")}
                >
                  {day && (
                    <>
                      <span
                        className={[
                          "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold mb-1",
                          isToday ? "bg-primary text-white" : "text-text-muted",
                        ].join(" ")}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className="text-xs truncate px-1 py-0.5 rounded bg-primary/10 text-primary font-medium"
                            title={t.title}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-xs text-text-muted px-1">+{dayTasks.length - 2} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected day task list */}
      {selected && selectedTasks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-text mb-3">
            Tasks due {new Date(year, month, selected).toLocaleDateString("default", { month: "long", day: "numeric" })}
          </h2>
          <ul className="space-y-2">
            {selectedTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between bg-surface rounded-lg px-4 py-3 shadow-card border border-border"
              >
                <div>
                  <p className="text-sm font-semibold text-text">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                </div>
                <PriorityBadge priority={t.priority} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {selected && selectedTasks.length === 0 && (
        <p className="mt-4 text-sm text-text-muted">No tasks due on this day.</p>
      )}
    </div>
  );
}

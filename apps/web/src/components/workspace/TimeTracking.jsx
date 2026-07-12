import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Square, Plus, Download, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../api/axios";
import { socket } from "../../socket";

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function fmtElapsed(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function previewDuration(startTime, endTime, date) {
  if (!startTime || !endTime || !date) return null;
  const started = new Date(`${date}T${startTime}:00`);
  const ended = new Date(`${date}T${endTime}:00`);
  const secs = Math.floor((ended - started) / 1000);
  if (secs <= 0) return null;
  return fmtDuration(secs);
}

const CATEGORIES = ["focus", "meeting", "review", "other"];
const CATEGORY_COLORS = {
  focus:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  review:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  other:   "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-text">{value}</span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  );
}

function CategoryPill({ category }) {
  if (!category) return null;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}>
      {category}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TimeTracking() {
  const [tasklists, setTasklists] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Start-timer form
  const [startForm, setStartForm] = useState({ tasklist_id: "", task_id: "", category: "", note: "" });
  const [startError, setStartError] = useState(null);

  // Log past entry form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), start_time: "", end_time: "", tasklist_id: "", task_id: "", category: "", note: "" });
  const [logError, setLogError] = useState(null);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState(null);

  const intervalRef = useRef(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [tlRes, activeRes, entriesRes, summaryRes] = await Promise.all([
        api.get("/tasklists/"),
        api.get("/time-entries/active"),
        api.get("/time-entries"),
        api.get("/time-entries/summary"),
      ]);
      setTasklists(tlRes.data);
      setActiveTimer(activeRes.data);
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
    } catch {
      setError("Failed to load time tracking data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Elapsed ticker ──────────────────────────────────────────────────────────

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!activeTimer) { setElapsed(0); return; }
    const compute = () => {
      const secs = Math.floor((Date.now() - new Date(activeTimer.started_at + "Z").getTime()) / 1000);
      setElapsed(Math.max(0, secs));
    };
    compute();
    intervalRef.current = setInterval(compute, 1000);
    return () => clearInterval(intervalRef.current);
  }, [activeTimer]);

  // ── Socket.IO — sync across tabs ────────────────────────────────────────────

  useEffect(() => {
    const onStarted = (data) => {
      setActiveTimer(data);
      setStartForm({ tasklist_id: "", task_id: "", category: "", note: "" });
      setStartError(null);
    };
    const onStopped = (data) => {
      setActiveTimer(null);
      setEntries((prev) => [data, ...prev.filter((e) => e.id !== data.id)]);
      fetchAll(); // refresh summary
    };
    socket.on("timer_started", onStarted);
    socket.on("timer_stopped", onStopped);
    return () => {
      socket.off("timer_started", onStarted);
      socket.off("timer_stopped", onStopped);
    };
  }, [fetchAll]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleStart(e) {
    e.preventDefault();
    setStartError(null);
    if (!startForm.tasklist_id) { setStartError("Select a list."); return; }
    try {
      await api.post("/time-entries/start", {
        tasklist_id: startForm.tasklist_id || undefined,
        task_id: startForm.task_id || undefined,
        category: startForm.category || undefined,
        note: startForm.note || undefined,
      });
      // state update handled by socket event
    } catch (err) {
      const msg = err.response?.data?.error ?? "Could not start timer.";
      setStartError(msg);
      if (err.response?.status === 409) {
        setActiveTimer(err.response.data.active_timer);
      }
    }
  }

  async function handleStop() {
    if (!activeTimer) return;
    try {
      await api.patch(`/time-entries/${activeTimer.id}/stop`);
      // state update handled by socket event
    } catch {
      setError("Failed to stop timer.");
    }
  }

  async function handleLog(e) {
    e.preventDefault();
    setLogError(null);
    if (!logForm.date || !logForm.start_time || !logForm.end_time) {
      setLogError("Date, start time, and end time are required."); return;
    }
    if (!logForm.tasklist_id) { setLogError("Select a list."); return; }
    try {
      const res = await api.post("/time-entries", {
        started_at: `${logForm.date}T${logForm.start_time}:00`,
        ended_at:   `${logForm.date}T${logForm.end_time}:00`,
        tasklist_id: logForm.tasklist_id || undefined,
        task_id:     logForm.task_id || undefined,
        category:    logForm.category || undefined,
        note:        logForm.note || undefined,
      });
      setEntries((prev) => [res.data, ...prev]);
      setLogForm({ date: new Date().toISOString().slice(0, 10), start_time: "", end_time: "", tasklist_id: "", task_id: "", category: "", note: "" });
      setShowLogForm(false);
      fetchAll();
    } catch (err) {
      setLogError(err.response?.data?.error ?? "Failed to log entry.");
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditError(null);
    const started = entry.started_at ? new Date(entry.started_at + "Z") : null;
    const ended   = entry.ended_at   ? new Date(entry.ended_at + "Z")   : null;
    setEditForm({
      date:       started ? started.toISOString().slice(0, 10) : "",
      start_time: started ? started.toTimeString().slice(0, 5) : "",
      end_time:   ended   ? ended.toTimeString().slice(0, 5)   : "",
      tasklist_id: entry.tasklist_id ?? "",
      category:   entry.category ?? "",
      note:       entry.note ?? "",
    });
  }

  async function handleEditSave(entry) {
    setEditError(null);
    const isRunning = !entry.ended_at;
    const payload = {
      category: editForm.category || undefined,
      note:     editForm.note || undefined,
      tasklist_id: editForm.tasklist_id || undefined,
    };
    if (!isRunning && editForm.date && editForm.start_time && editForm.end_time) {
      payload.started_at = `${editForm.date}T${editForm.start_time}:00`;
      payload.ended_at   = `${editForm.date}T${editForm.end_time}:00`;
    }
    try {
      const res = await api.patch(`/time-entries/${entry.id}`, payload);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data : e)));
      if (activeTimer?.id === entry.id) setActiveTimer(res.data);
      setEditingId(null);
      fetchAll();
    } catch (err) {
      setEditError(err.response?.data?.error ?? "Failed to save.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this time entry?")) return;
    try {
      await api.delete(`/time-entries/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      fetchAll();
    } catch {
      setError("Failed to delete entry.");
    }
  }

  async function handleExport() {
    try {
      const res = await api.get("/time-entries/export.csv", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "time-entries.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    }
  }

  // ── Tasks for selected list ──────────────────────────────────────────────────

  function tasksForList(listId) {
    const tl = tasklists.find((t) => String(t.id) === String(listId));
    return tl?.tasks ?? [];
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const logDurationPreview = previewDuration(logForm.start_time, logForm.end_time, logForm.date);
  const maxDaySecs = Math.max(...(summary?.by_day?.map((d) => d.seconds) ?? []), 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Active timer / start form ──────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {activeTimer ? (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">
                  Timer running
                </span>
              </div>
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <Square size={13} strokeWidth={2.5} />
                Stop
              </button>
            </div>

            <div className="text-center my-2">
              <div className="font-mono text-5xl font-bold text-text tabular-nums tracking-tight">
                {fmtElapsed(elapsed)}
              </div>
              <div className="mt-2 text-sm text-text-muted">
                {activeTimer.tasklist_name && (
                  <span className="font-medium text-text">{activeTimer.tasklist_name}</span>
                )}
                {activeTimer.task_title && (
                  <span className="text-text-muted"> · {activeTimer.task_title}</span>
                )}
              </div>
              {activeTimer.category && (
                <div className="mt-2 flex justify-center">
                  <CategoryPill category={activeTimer.category} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleStart} className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Timer size={16} className="text-primary" />
              <h2 className="font-semibold text-text">Start Timer</h2>
            </div>

            {startError && (
              <p className="text-sm text-red-600 dark:text-red-400">{startError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">List *</label>
                <select
                  value={startForm.tasklist_id}
                  onChange={(e) => setStartForm({ ...startForm, tasklist_id: e.target.value, task_id: "" })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select list…</option>
                  {tasklists.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Task (optional)</label>
                <select
                  value={startForm.task_id}
                  onChange={(e) => setStartForm({ ...startForm, task_id: e.target.value })}
                  disabled={!startForm.tasklist_id}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                >
                  <option value="">No specific task</option>
                  {tasksForList(startForm.tasklist_id).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Category</label>
                <select
                  value={startForm.category}
                  onChange={(e) => setStartForm({ ...startForm, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Note</label>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Optional…"
                  value={startForm.note}
                  onChange={(e) => setStartForm({ ...startForm, note: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Timer size={14} />
              Start Timer
            </button>
          </form>
        )}
      </div>

      {/* ── Log past time ──────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowLogForm((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-surface-muted transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus size={15} />
            Log past time
          </div>
          {showLogForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showLogForm && (
          <form onSubmit={handleLog} className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            {logError && <p className="text-sm text-red-600 dark:text-red-400">{logError}</p>}

            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Date *</label>
                <input
                  type="date"
                  value={logForm.date}
                  onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Start time *</label>
                <input
                  type="time"
                  value={logForm.start_time}
                  onChange={(e) => setLogForm({ ...logForm, start_time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">End time *</label>
                <input
                  type="time"
                  value={logForm.end_time}
                  onChange={(e) => setLogForm({ ...logForm, end_time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {logDurationPreview && (
              <p className="text-sm font-semibold text-primary">
                Duration: {logDurationPreview}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">List *</label>
                <select
                  value={logForm.tasklist_id}
                  onChange={(e) => setLogForm({ ...logForm, tasklist_id: e.target.value, task_id: "" })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select list…</option>
                  {tasklists.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Task (optional)</label>
                <select
                  value={logForm.task_id}
                  onChange={(e) => setLogForm({ ...logForm, task_id: e.target.value })}
                  disabled={!logForm.tasklist_id}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                >
                  <option value="">No specific task</option>
                  {tasksForList(logForm.tasklist_id).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Category</label>
                <select
                  value={logForm.category}
                  onChange={(e) => setLogForm({ ...logForm, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Note</label>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="What were you working on?"
                  value={logForm.note}
                  onChange={(e) => setLogForm({ ...logForm, note: e.target.value })}
                  className="w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Log Time
              </button>
              <button
                type="button"
                onClick={() => { setShowLogForm(false); setLogError(null); }}
                className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm hover:bg-surface-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Summary ────────────────────────────────────────────────────────── */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Today"
              value={fmtDuration(summary.today_seconds)}
              sub={summary.today_seconds > 0 ? `${Math.round(summary.today_seconds / 60)} min` : "No entries yet"}
            />
            <StatTile
              label="This week"
              value={fmtDuration(summary.week_seconds)}
              sub={summary.by_list[0]?.name ? `Most: ${summary.by_list[0].name}` : undefined}
            />
          </div>

          {/* Per-day bar chart */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">Last 7 days</h3>
            <div className="space-y-2.5">
              {summary.by_day.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-8 shrink-0">{day.label}</span>
                  <div className="flex-1 bg-border rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(day.seconds / maxDaySecs) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-12 text-right tabular-nums">
                    {day.seconds > 0 ? fmtDuration(day.seconds) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-list breakdown */}
          {summary.by_list.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">By list this week</h3>
              <div className="space-y-2">
                {summary.by_list.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-text truncate">{item.name}</span>
                    <span className="text-sm font-medium text-text-muted tabular-nums">{fmtDuration(item.seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Entries list ───────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Recent entries</h3>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded-lg px-3 py-1.5 hover:bg-surface-muted transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-10">No time entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="px-5 py-4">
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}

                    {!entry.ended_at && (
                      <p className="text-xs text-text-muted italic">Timer is running — only note, category, and list can be edited.</p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {!entry.ended_at ? null : (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs text-text-muted">Date</label>
                            <input type="date" value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 col-span-1">
                            <div className="space-y-1">
                              <label className="text-xs text-text-muted">Start</label>
                              <input type="time" value={editForm.start_time}
                                onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                                className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-text-muted">End</label>
                              <input type="time" value={editForm.end_time}
                                onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                                className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-text-muted">List</label>
                        <select value={editForm.tasklist_id}
                          onChange={(e) => setEditForm({ ...editForm, tasklist_id: e.target.value })}
                          className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="">No list</option>
                          {tasklists.map((tl) => <option key={tl.id} value={tl.id}>{tl.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-text-muted">Category</label>
                        <select value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="">None</option>
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-text-muted">Note</label>
                      <input type="text" maxLength={300} value={editForm.note}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        className="w-full rounded-lg border border-border bg-page text-text text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleEditSave(entry)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors">
                        Save
                      </button>
                      <button onClick={() => { setEditingId(null); setEditError(null); }}
                        className="px-3 py-1.5 rounded-lg border border-border text-text-muted text-xs hover:bg-surface-muted transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs text-text-muted">{fmtDate(entry.started_at)}</span>
                        <span className="text-xs text-text-muted">
                          {fmtTime(entry.started_at)}
                          {entry.ended_at && ` → ${fmtTime(entry.ended_at)}`}
                        </span>
                        {entry.ended_at ? (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">
                            {fmtDuration(entry.duration_seconds)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            Running
                          </span>
                        )}
                        {entry.category && <CategoryPill category={entry.category} />}
                      </div>
                      <div className="text-sm text-text truncate">
                        {entry.tasklist_name && <span className="font-medium">{entry.tasklist_name}</span>}
                        {entry.task_title && <span className="text-text-muted"> · {entry.task_title}</span>}
                      </div>
                      {entry.note && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">{entry.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(entry)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
                        aria-label="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useId } from "react";
import { Timer, Square, Plus, Download, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { socket } from "../../socket";
import { useTimer } from "../../context/TimerContext";
import { Alert, Spinner, useToast } from "../ui";
import {
  fmtDuration, fmtElapsed, localToIso, toLocalDateInput, toLocalTimeInput, tzOffsetMinutes,
} from "../../utils/time";

// All times arrive from the API as UTC ISO strings ending in "Z", so `new Date(iso)`
// is always correct for display; anything typed by the user is converted with localToIso().
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "");

function previewDuration(startTime, endTime, date) {
  if (!startTime || !endTime || !date) return null;
  const secs = Math.floor((new Date(`${date}T${endTime}:00`) - new Date(`${date}T${startTime}:00`)) / 1000);
  return secs > 0 ? fmtDuration(secs) : null;
}

const CATEGORIES = ["focus", "meeting", "review", "other"];
const CATEGORY_COLORS = {
  focus:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  review:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  other:   "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const controlCls =
  "w-full rounded-lg border border-border bg-page text-text text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-40";

function Field({ label, children }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-text-muted">{label}</label>
      {children(id)}
    </div>
  );
}

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

const emptyLog = () => ({
  date: toLocalDateInput(new Date()), start_time: "", end_time: "", tasklist_id: "", task_id: "", category: "", note: "",
});

function ListAndTaskFields({ form, setForm, tasklists, showTask = true }) {
  const tasks = tasklists.find((t) => String(t.id) === String(form.tasklist_id))?.tasks ?? [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="List *">
        {(id) => (
          <select id={id} value={form.tasklist_id} className={controlCls}
            onChange={(e) => setForm({ ...form, tasklist_id: e.target.value, task_id: "" })}>
            <option value="">Select list…</option>
            {tasklists.map((tl) => <option key={tl.id} value={tl.id}>{tl.name}</option>)}
          </select>
        )}
      </Field>
      {showTask && (
        <Field label="Task (optional)">
          {(id) => (
            <select id={id} value={form.task_id} disabled={!form.tasklist_id} className={controlCls}
              onChange={(e) => setForm({ ...form, task_id: e.target.value })}>
              <option value="">No specific task</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
        </Field>
      )}
    </div>
  );
}

function CategoryAndNote({ form, setForm, placeholder }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Category">
        {(id) => (
          <select id={id} value={form.category} className={controlCls} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">None</option>
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        )}
      </Field>
      <Field label="Note">
        {(id) => (
          <input id={id} type="text" maxLength={300} placeholder={placeholder} value={form.note} className={controlCls}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        )}
      </Field>
    </div>
  );
}

export default function TimeTracking() {
  const toast = useToast();
  const { activeTimer, setActiveTimer, elapsed } = useTimer();
  const [tasklists, setTasklists] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [startForm, setStartForm] = useState({ tasklist_id: "", task_id: "", category: "", note: "" });
  const [startError, setStartError] = useState(null);

  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState(emptyLog);
  const [logError, setLogError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const tz = tzOffsetMinutes();
      const [tlRes, entriesRes, summaryRes] = await Promise.all([
        api.get("/tasklists/"),
        api.get("/time-entries"),
        api.get(`/time-entries/summary?tz_offset=${tz}`),
      ]);
      setTasklists(tlRes.data);
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load time tracking data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // A timer stopped in another tab: refresh the list and totals here too.
  useEffect(() => {
    socket.on("timer_stopped", fetchAll);
    return () => socket.off("timer_stopped", fetchAll);
  }, [fetchAll]);

  async function handleStart(e) {
    e.preventDefault();
    setStartError(null);
    if (!startForm.tasklist_id) { setStartError("Select a list."); return; }
    setBusy(true);
    try {
      const res = await api.post("/time-entries/start", {
        tasklist_id: Number(startForm.tasklist_id),
        task_id: startForm.task_id ? Number(startForm.task_id) : undefined,
        category: startForm.category || undefined,
        note: startForm.note || undefined,
      });
      setActiveTimer(res.data);   // don't wait for the socket echo
      setStartForm({ tasklist_id: "", task_id: "", category: "", note: "" });
    } catch (err) {
      setStartError(errorMessage(err, "Could not start the timer."));
      if (err.response?.status === 409 && err.response.data?.active_timer) setActiveTimer(err.response.data.active_timer);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!activeTimer) return;
    setBusy(true);
    try {
      await api.patch(`/time-entries/${activeTimer.id}/stop`);
      setActiveTimer(null);
      await fetchAll();
    } catch (err) {
      toast(errorMessage(err, "Failed to stop the timer."), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function handleLog(e) {
    e.preventDefault();
    setLogError(null);
    if (!logForm.date || !logForm.start_time || !logForm.end_time) { setLogError("Date, start time, and end time are required."); return; }
    if (!logForm.tasklist_id) { setLogError("Select a list."); return; }
    if (!previewDuration(logForm.start_time, logForm.end_time, logForm.date)) { setLogError("The end time must be after the start time."); return; }
    setBusy(true);
    try {
      await api.post("/time-entries", {
        started_at: localToIso(logForm.date, logForm.start_time),
        ended_at: localToIso(logForm.date, logForm.end_time),
        tasklist_id: Number(logForm.tasklist_id),
        task_id: logForm.task_id ? Number(logForm.task_id) : undefined,
        category: logForm.category || undefined,
        note: logForm.note || undefined,
      });
      setLogForm(emptyLog());
      setShowLogForm(false);
      await fetchAll();
      toast("Time logged.", "success");
    } catch (err) {
      setLogError(errorMessage(err, "Failed to log the entry."));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditError(null);
    const started = new Date(entry.started_at);
    const ended = entry.ended_at ? new Date(entry.ended_at) : null;
    setEditForm({
      date: toLocalDateInput(started),
      start_time: toLocalTimeInput(started),
      end_time: ended ? toLocalTimeInput(ended) : "",
      tasklist_id: entry.tasklist_id ?? "",
      category: entry.category ?? "",
      note: entry.note ?? "",
    });
  }

  async function handleEditSave(entry) {
    setEditError(null);
    const isRunning = !entry.ended_at;
    const payload = { category: editForm.category || null, note: editForm.note || null };
    if (editForm.tasklist_id && Number(editForm.tasklist_id) !== entry.tasklist_id) {
      payload.tasklist_id = Number(editForm.tasklist_id);
    }
    if (!isRunning) {
      if (!editForm.date || !editForm.start_time || !editForm.end_time) { setEditError("Date, start and end are required."); return; }
      if (!previewDuration(editForm.start_time, editForm.end_time, editForm.date)) { setEditError("The end time must be after the start time."); return; }
      payload.started_at = localToIso(editForm.date, editForm.start_time);
      payload.ended_at = localToIso(editForm.date, editForm.end_time);
    }
    try {
      const res = await api.patch(`/time-entries/${entry.id}`, payload);
      if (activeTimer?.id === entry.id) setActiveTimer(res.data);
      setEditingId(null);
      await fetchAll();
    } catch (err) {
      setEditError(errorMessage(err, "Failed to save."));
    }
  }

  async function handleDelete(entry) {
    if (!window.confirm(entry.ended_at ? "Delete this time entry?" : "Delete the running timer? Its time will be lost.")) return;
    try {
      await api.delete(`/time-entries/${entry.id}`);
      if (activeTimer?.id === entry.id) setActiveTimer(null);
      await fetchAll();
    } catch (err) {
      toast(errorMessage(err, "Failed to delete the entry."), "danger");
    }
  }

  async function handleExport() {
    try {
      const res = await api.get(`/time-entries/export.csv?tz_offset=${tzOffsetMinutes()}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "time-entries.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(errorMessage(err, "Export failed."), "danger");
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner className="text-primary" /></div>;

  const logDurationPreview = previewDuration(logForm.start_time, logForm.end_time, logForm.date);
  const maxDaySecs = Math.max(...(summary?.by_day?.map((d) => d.seconds) ?? []), 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text">Time</h1>

      {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {tasklists.length === 0 && !error && (
        <Alert variant="info">Create a list first — time is tracked against the lists and tasks in your workspace.</Alert>
      )}

      {/* Active timer / start form */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {activeTimer ? (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">Timer running</span>
              </div>
              <button
                onClick={handleStop}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                <Square size={13} strokeWidth={2.5} /> Stop
              </button>
            </div>
            <div className="text-center my-2">
              <div className="font-mono text-4xl sm:text-5xl font-bold text-text tabular-nums tracking-tight" role="timer" aria-live="off">
                {fmtElapsed(elapsed)}
              </div>
              <div className="mt-2 text-sm text-text-muted">
                {activeTimer.tasklist_name && <span className="font-medium text-text">{activeTimer.tasklist_name}</span>}
                {activeTimer.task_title && <span> · {activeTimer.task_title}</span>}
              </div>
              {activeTimer.note && <p className="mt-1 text-xs text-text-muted">{activeTimer.note}</p>}
              {activeTimer.category && <div className="mt-2 flex justify-center"><CategoryPill category={activeTimer.category} /></div>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleStart} className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Timer size={16} className="text-primary" />
              <h2 className="font-semibold text-text">Start Timer</h2>
            </div>
            {startError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{startError}</p>}
            <ListAndTaskFields form={startForm} setForm={setStartForm} tasklists={tasklists} />
            <CategoryAndNote form={startForm} setForm={setStartForm} placeholder="Optional…" />
            <button
              type="submit"
              disabled={busy || tasklists.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Timer size={14} /> Start Timer
            </button>
          </form>
        )}
      </div>

      {/* Log past time */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowLogForm((v) => !v)}
          aria-expanded={showLogForm}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-surface-muted transition-colors"
        >
          <span className="flex items-center gap-2"><Plus size={15} /> Log past time</span>
          {showLogForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showLogForm && (
          <form onSubmit={handleLog} className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            {logError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{logError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Field label="Date *">
                {(id) => <input id={id} type="date" max={toLocalDateInput(new Date())} value={logForm.date} className={controlCls}
                  onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />}
              </Field>
              <Field label="Start time *">
                {(id) => <input id={id} type="time" value={logForm.start_time} className={controlCls}
                  onChange={(e) => setLogForm({ ...logForm, start_time: e.target.value })} />}
              </Field>
              <Field label="End time *">
                {(id) => <input id={id} type="time" value={logForm.end_time} className={controlCls}
                  onChange={(e) => setLogForm({ ...logForm, end_time: e.target.value })} />}
              </Field>
            </div>
            {logDurationPreview && <p className="text-sm font-semibold text-primary">Duration: {logDurationPreview}</p>}
            <ListAndTaskFields form={logForm} setForm={setLogForm} tasklists={tasklists} />
            <CategoryAndNote form={logForm} setForm={setLogForm} placeholder="What were you working on?" />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                Log Time
              </button>
              <button type="button" onClick={() => { setShowLogForm(false); setLogError(null); }} className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm hover:bg-surface-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Today" value={fmtDuration(summary.today_seconds)} sub={summary.today_seconds > 0 ? `${Math.round(summary.today_seconds / 60)} min` : "No entries yet"} />
            <StatTile label="This week" value={fmtDuration(summary.week_seconds)} sub={summary.by_list[0]?.name ? `Most: ${summary.by_list[0].name}` : undefined} />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">Last 7 days</h3>
            <div className="space-y-2.5">
              {summary.by_day.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-8 shrink-0">{day.label}</span>
                  <div className="flex-1 bg-border rounded-full h-2" role="img" aria-label={`${day.label}: ${fmtDuration(day.seconds)}`}>
                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${(day.seconds / maxDaySecs) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-muted w-14 text-right tabular-nums">{day.seconds > 0 ? fmtDuration(day.seconds) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {summary.by_list.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">By list this week</h3>
              <div className="space-y-2">
                {summary.by_list.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text truncate">{item.name}</span>
                    <span className="text-sm font-medium text-text-muted tabular-nums">{fmtDuration(item.seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entries */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Recent entries</h3>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded-lg px-3 py-1.5 hover:bg-surface-muted transition-colors">
            <Download size={13} /> Export CSV
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
                    {editError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                    {!entry.ended_at ? (
                      <p className="text-xs text-text-muted italic">Timer is running — only note, category and list can be edited.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Field label="Date">{(id) => <input id={id} type="date" value={editForm.date} className={controlCls} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />}</Field>
                        <Field label="Start">{(id) => <input id={id} type="time" value={editForm.start_time} className={controlCls} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} />}</Field>
                        <Field label="End">{(id) => <input id={id} type="time" value={editForm.end_time} className={controlCls} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} />}</Field>
                      </div>
                    )}
                    <ListAndTaskFields form={editForm} setForm={setEditForm} tasklists={tasklists} showTask={false} />
                    <CategoryAndNote form={editForm} setForm={setEditForm} placeholder="" />
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSave(entry)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">Save</button>
                      <button onClick={() => { setEditingId(null); setEditError(null); }} className="px-3 py-1.5 rounded-lg border border-border text-text-muted text-xs hover:bg-surface-muted transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs text-text-muted">{fmtDate(entry.started_at)}</span>
                        <span className="text-xs text-text-muted">{fmtTime(entry.started_at)}{entry.ended_at && ` → ${fmtTime(entry.ended_at)}`}</span>
                        {entry.ended_at ? (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">{fmtDuration(entry.duration_seconds)}</span>
                        ) : (
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Running</span>
                        )}
                        {entry.category && <CategoryPill category={entry.category} />}
                      </div>
                      <div className="text-sm text-text truncate">
                        {entry.tasklist_name && <span className="font-medium">{entry.tasklist_name}</span>}
                        {entry.task_title && <span className="text-text-muted"> · {entry.task_title}</span>}
                      </div>
                      {entry.note && <p className="text-xs text-text-muted mt-0.5 truncate">{entry.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(entry)} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors" aria-label="Edit entry"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(entry)} className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" aria-label="Delete entry"><Trash2 size={13} /></button>
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

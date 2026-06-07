import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Pencil, Trash2, Pause, Play, X, AlertCircle } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { Button, Spinner, Alert, Modal, PriorityBadge } from "../ui";

const RULES = [
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom",  label: "Custom interval" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const EMPTY_FORM = {
  title: "",
  description: "",
  priority: "medium",
  recurrence_rule: "daily",
  recurrence_interval: 1,
  tasklist_id: "",
};

function formatNextRun(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = d - Date.now();
  const h = Math.round(diff / 3600000);
  if (h < 24) return `in ~${h}h`;
  const days = Math.round(diff / 86400000);
  return `in ${days}d (${d.toLocaleDateString()})`;
}

function RecurringForm({ initial, tasklists, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        recurrence_rule: form.recurrence_rule,
        recurrence_interval: parseInt(form.recurrence_interval, 10) || 1,
        tasklist_id: form.tasklist_id || undefined,
      };
      if (initial?.id) {
        const res = await api.patch(`/recurring-tasks/${initial.id}`, payload);
        onSave(res.data, "update");
      } else {
        const res = await api.post("/recurring-tasks", payload);
        onSave(res.data, "create");
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-page text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
  const labelCls = "block text-xs font-medium text-text-muted mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div>
        <label className={labelCls}>Title *</label>
        <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Weekly report" />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details…" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Priority</label>
          <select className={inputCls} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Task List</label>
          <select className={inputCls} value={form.tasklist_id} onChange={(e) => set("tasklist_id", e.target.value)}>
            <option value="">Default list</option>
            {tasklists.map((tl) => <option key={tl.id} value={tl.id}>{tl.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Repeats</label>
          <select className={inputCls} value={form.recurrence_rule} onChange={(e) => set("recurrence_rule", e.target.value)}>
            {RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {form.recurrence_rule === "custom" && (
          <div>
            <label className={labelCls}>Every N days</label>
            <input
              type="number" min={1} max={365}
              className={inputCls}
              value={form.recurrence_interval}
              onChange={(e) => set("recurrence_interval", e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-text-muted hover:bg-surface-muted transition-colors">Cancel</button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="xs" /> : (initial?.id ? "Save changes" : "Create template")}
        </Button>
      </div>
    </form>
  );
}

export default function RecurringTasks() {
  const { user } = useAuth();
  const [items, setItems]         = useState([]);
  const [tasklists, setTasklists] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [rtRes, tlRes] = await Promise.all([
        api.get("/recurring-tasks"),
        api.get("/tasklists"),
      ]);
      setItems(Array.isArray(rtRes.data) ? rtRes.data : []);
      setTasklists(Array.isArray(tlRes.data) ? tlRes.data : []);
    } catch {
      setError("Failed to load recurring tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = (saved, mode) => {
    setItems((prev) =>
      mode === "create"
        ? [saved, ...prev]
        : prev.map((r) => (r.id === saved.id ? saved : r))
    );
  };

  const handleToggleActive = async (item) => {
    setTogglingId(item.id);
    try {
      const res = await api.patch(`/recurring-tasks/${item.id}`, { active: !item.active });
      setItems((prev) => prev.map((r) => (r.id === item.id ? res.data : r)));
    } catch {
      // non-fatal
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this recurring task template? Existing tasks are unaffected.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/recurring-tasks/${id}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit   = (item) => { setEditing(item); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditing(null); };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <RefreshCw size={22} className="text-primary" />
            Recurring Tasks
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Templates that automatically create tasks on a schedule.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-1.5">
          <Plus size={15} /> New Template
        </Button>
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Create/Edit modal */}
      {showForm && (
        <Modal open onClose={closeForm} title={editing ? "Edit Recurring Template" : "New Recurring Template"}>
          <RecurringForm
            initial={editing}
            tasklists={tasklists}
            onSave={handleSave}
            onClose={closeForm}
          />
        </Modal>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl border border-border">
          <RefreshCw size={36} className="mx-auto text-text-muted mb-3 opacity-40" />
          <p className="text-sm font-medium text-text">No recurring templates yet</p>
          <p className="text-xs text-text-muted mt-1">Create one to start auto-generating tasks on a schedule.</p>
          <Button onClick={openCreate} className="mt-4">Create your first template</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const ruleLabel = RULES.find((r) => r.value === item.recurrence_rule)?.label ?? item.recurrence_rule;
            const freqLabel = item.recurrence_rule === "custom"
              ? `Every ${item.recurrence_interval} days`
              : ruleLabel;

            return (
              <li
                key={item.id}
                className={`bg-surface border border-border rounded-xl px-5 py-4 flex items-start gap-4 transition-opacity ${!item.active ? "opacity-50" : ""}`}
              >
                {/* Icon */}
                <div className={`mt-0.5 flex-shrink-0 p-2 rounded-lg ${item.active ? "bg-primary/10" : "bg-surface-muted"}`}>
                  <RefreshCw size={16} className={item.active ? "text-primary" : "text-text-muted"} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text">{item.title}</p>
                    <PriorityBadge priority={item.priority} />
                    {!item.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-muted text-text-muted font-medium">Paused</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                  <p className="text-xs text-text-muted mt-1">
                    <span className="font-medium text-text">{freqLabel}</span>
                    {" · "}Next run: <span className="font-medium">{formatNextRun(item.next_run_at)}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingId === item.id}
                    title={item.active ? "Pause" : "Resume"}
                    className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    {togglingId === item.id ? <Spinner size="xs" /> : item.active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    title="Edit"
                    className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="Delete"
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    {deletingId === item.id ? <Spinner size="xs" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

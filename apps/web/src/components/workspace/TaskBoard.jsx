import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import api from "../../api/axios";
import { Button, Spinner, Textarea, Input, PriorityBadge } from "../ui";

const TaskBoard = ({ task, onEditTask }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ ...task });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/tasks/${task.id}/comments`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      // non-fatal
    } finally {
      setLoadingComments(false);
    }
  }, [task.id]);

  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${task.id}/subtasks`);
      setSubtasks(Array.isArray(res.data) ? res.data : []);
    } catch {
      // non-fatal
    }
  }, [task.id]);

  useEffect(() => {
    if (isExpanded) {
      fetchComments();
      fetchSubtasks();
    }
  }, [isExpanded, fetchComments, fetchSubtasks]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") { setIsExpanded(false); setIsEditing(false); }
    };
    if (isExpanded) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isExpanded]);

  const handleAddComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    setSavingComment(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content });
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch {
      // non-fatal
    } finally {
      setSavingComment(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const res = await api.patch(`/tasks/${task.id}`, {
        title: editedTask.title,
        description: editedTask.description,
        priority: editedTask.priority,
        due_date: editedTask.due_date,
      });
      if (onEditTask) onEditTask(res.data);
    } catch {
      // non-fatal
    }
    setIsEditing(false);
  };

  const handleAddSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    setAddingSubtask(true);
    try {
      const res = await api.post(`/tasks/${task.id}/subtasks`, { title });
      setSubtasks((prev) => [...prev, res.data]);
      setNewSubtask("");
    } catch {
      // non-fatal
    } finally {
      setAddingSubtask(false);
    }
  };

  const toggleSubtask = async (subtask) => {
    const newStatus = subtask.status === "completed" ? "todo" : "completed";
    try {
      await api.patch(`/subtasks/${subtask.id}`, { status: newStatus });
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, status: newStatus } : s))
      );
    } catch {
      // non-fatal
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await api.delete(`/subtasks/${subtaskId}`);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch {
      // non-fatal
    }
  };

  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;

  if (!task) return null;

  return (
    <>
      {/* Kanban card */}
      <div
        onClick={() => setIsExpanded(true)}
        className="cursor-pointer p-3 bg-white rounded-lg shadow-card border border-border hover:border-primary/40 transition-colors"
      >
        <p className="text-sm font-semibold text-text leading-snug">{task.title}</p>
        {task.priority && (
          <div className="mt-1.5">
            <PriorityBadge priority={task.priority} />
          </div>
        )}
        {subtasks.length > 0 && (
          <p className="mt-1.5 text-xs text-text-muted">
            {completedSubtasks}/{subtasks.length} subtasks
          </p>
        )}
      </div>

      {/* Expanded detail dialog */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) { setIsExpanded(false); setIsEditing(false); } }}
        >
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3">
              {isEditing ? (
                <input
                  className="flex-1 text-base font-semibold text-text bg-transparent border-b border-primary focus:outline-none"
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                />
              ) : (
                <h2 className="text-base font-semibold text-text">{task.title}</h2>
              )}
              <button
                onClick={() => { setIsExpanded(false); setIsEditing(false); }}
                className="p-1 flex-shrink-0 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Task details */}
              {isEditing ? (
                <>
                  <Textarea
                    label="Description"
                    rows={3}
                    value={editedTask.description || ""}
                    onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  />
                  <div>
                    <label className="text-sm font-medium text-text block mb-1">Priority</label>
                    <select
                      className="w-full px-3 py-2 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      value={editedTask.priority || "medium"}
                      onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <Input
                    label="Due Date"
                    type="date"
                    value={editedTask.due_date?.split("T")[0] || ""}
                    onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-text">{task.description || "No description."}</p>
                  <div className="flex gap-4 text-sm text-text-muted">
                    <span>Priority: <span className="font-medium text-text capitalize">{task.priority}</span></span>
                    <span>Due: <span className="font-medium text-text">{task.due_date ? new Date(task.due_date).toLocaleDateString() : "No deadline"}</span></span>
                  </div>
                </>
              )}

              {/* Subtasks */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-2">
                  Subtasks{subtasks.length > 0 && (
                    <span className="ml-1 text-text-muted font-normal">({completedSubtasks}/{subtasks.length})</span>
                  )}
                </h3>
                {subtasks.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 group">
                        <button
                          onClick={() => toggleSubtask(s)}
                          className="flex-shrink-0 text-text-muted hover:text-success transition-colors"
                        >
                          {s.status === "completed"
                            ? <CheckCircle2 size={16} className="text-success" />
                            : <Circle size={16} />
                          }
                        </button>
                        <span className={`flex-1 text-sm ${s.status === "completed" ? "line-through text-text-muted" : "text-text"}`}>
                          {s.title}
                        </span>
                        <button
                          onClick={() => deleteSubtask(s.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                          aria-label="Delete subtask"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted"
                    placeholder="Add subtask…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                    disabled={addingSubtask}
                  />
                  <Button size="sm" variant="outline" onClick={handleAddSubtask} disabled={addingSubtask || !newSubtask.trim()}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-2">Comments</h3>
                {loadingComments ? (
                  <Spinner size="sm" className="text-primary" />
                ) : (
                  <ul className="space-y-2 mb-3">
                    {comments.length === 0 && (
                      <li className="text-sm text-text-muted">No comments yet.</li>
                    )}
                    {comments.map((c) => (
                      <li key={c.id} className="px-3 py-2 bg-surface-muted rounded text-sm border border-border">
                        <p className="text-text">{c.content}</p>
                        {c.username && <p className="text-xs text-text-muted mt-0.5">{c.username}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted"
                    placeholder="Add a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    disabled={savingComment}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={savingComment || !newComment.trim()}
                    loading={savingComment}
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface-muted rounded-b-xl">
              <Button variant="ghost" onClick={() => { setIsExpanded(false); setIsEditing(false); }}>
                Close
              </Button>
              {isEditing ? (
                <Button onClick={handleSaveChanges}>Save</Button>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskBoard;

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, CheckCircle2, Circle, Pencil, MessageSquare, Paperclip } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { Button, Spinner, Textarea, Input, PriorityBadge } from "../ui";
import TaskAttachments from "./TaskAttachments";
import { socket } from "../../socket";

function formatRelTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TaskBoard = ({ task, onEditTask }) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ ...task });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [subtasks, setSubtasks]         = useState([]);
  const [newSubtask, setNewSubtask]     = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);

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

  // Live comments via Socket.IO when the task detail is open
  useEffect(() => {
    if (!isExpanded) return;

    const onCommentAdded = (data) => {
      if (data.task_id !== task.id) return;
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev; // dedup own post
        return [...prev, data];
      });
    };
    const onCommentUpdated = (data) => {
      if (data.task_id !== task.id) return;
      setComments((prev) => prev.map((c) => (c.id === data.id ? { ...c, content: data.content } : c)));
    };
    const onCommentDeleted = ({ task_id, comment_id }) => {
      if (task_id !== task.id) return;
      setComments((prev) => prev.filter((c) => c.id !== comment_id));
    };

    socket.on("comment_added",   onCommentAdded);
    socket.on("comment_updated", onCommentUpdated);
    socket.on("comment_deleted", onCommentDeleted);

    return () => {
      socket.off("comment_added",   onCommentAdded);
      socket.off("comment_updated", onCommentUpdated);
      socket.off("comment_deleted", onCommentDeleted);
    };
  }, [isExpanded, task.id]);

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

  const handleStartEditComment = (c) => {
    setEditingCommentId(c.id);
    setEditCommentContent(c.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentContent("");
  };

  const handleSaveEditComment = async (commentId) => {
    const content = editCommentContent.trim();
    if (!content) return;
    setSavingEdit(true);
    try {
      const res = await api.patch(`/comments/${commentId}`, { content });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: res.data.content } : c)));
      setEditingCommentId(null);
      setEditCommentContent("");
    } catch {
      // non-fatal
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    setDeletingCommentId(commentId);
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // non-fatal
    } finally {
      setDeletingCommentId(null);
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
        className="cursor-pointer p-3 bg-surface rounded-lg shadow-card border border-border hover:border-primary/40 transition-colors"
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
        {attachmentCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-text-muted">
            <Paperclip size={11} />
            {attachmentCount}
          </div>
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

              {/* Attachments */}
              <TaskAttachments
                taskId={task.id}
                taskOwnerId={task.tasklist?.user_id}
                onCountChange={setAttachmentCount}
              />

              {/* Comments */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} className="text-text-muted" />
                  <h3 className="text-sm font-semibold text-text">
                    Comments
                    {comments.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-text-muted">({comments.length})</span>
                    )}
                  </h3>
                </div>

                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" className="text-primary" />
                  </div>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {comments.length === 0 && (
                      <li className="text-sm text-text-muted py-2 text-center">
                        No comments yet. Be the first to comment.
                      </li>
                    )}
                    {comments.map((c) => {
                      const isOwn = user?.id === c.user_id;
                      const isDeleting = deletingCommentId === c.id;
                      const isEditingThis = editingCommentId === c.id;

                      return (
                        <li key={c.id} className="group">
                          {isEditingThis ? (
                            <div className="space-y-2 px-3 py-2.5 bg-surface-muted rounded-lg border border-primary/40">
                              <textarea
                                className="w-full px-0 py-0 text-sm text-text bg-transparent border-none focus:outline-none resize-none"
                                rows={2}
                                value={editCommentContent}
                                onChange={(e) => setEditCommentContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEditComment(c.id); }
                                  if (e.key === "Escape") handleCancelEditComment();
                                }}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={handleCancelEditComment} disabled={savingEdit}>
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEditComment(c.id)}
                                  loading={savingEdit}
                                  disabled={!editCommentContent.trim()}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`px-3 py-2.5 bg-surface-muted rounded-lg border border-border transition-opacity ${isDeleting ? "opacity-40" : ""}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex-shrink-0">
                                    {(c.username || "?").charAt(0).toUpperCase()}
                                  </span>
                                  <span className="text-xs font-semibold text-text truncate">{c.username || "Unknown"}</span>
                                  {c.created_at && (
                                    <span className="text-xs text-text-muted flex-shrink-0">{formatRelTime(c.created_at)}</span>
                                  )}
                                </div>
                                {isOwn && !isDeleting && (
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                      onClick={() => handleStartEditComment(c)}
                                      className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                      aria-label="Edit comment"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                      aria-label="Delete comment"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-text mt-1.5 ml-8 leading-relaxed">{c.content}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* New comment input */}
                <div className="flex gap-2 items-start">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex-shrink-0 mt-1">
                    {(user?.username || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 flex gap-2">
                    <textarea
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-text-muted resize-none transition-colors"
                      placeholder="Write a comment…"
                      rows={1}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
                      }}
                      disabled={savingComment}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={savingComment || !newComment.trim()}
                      loading={savingComment}
                      className="self-end"
                    >
                      Post
                    </Button>
                  </div>
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

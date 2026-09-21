import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Pencil, MessageSquare, Paperclip, ListChecks } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { useAuth } from "../../context/AuthContext";
import { Button, Spinner, Textarea, Input, PriorityBadge, Modal, useToast } from "../ui";
import TaskAttachments from "./TaskAttachments";
import { socket } from "../../socket";
import { dateOnly, formatRelTime, parseDueDate } from "../../utils/time";

/**
 * One task card plus its detail dialog.
 *  - onTaskChange(task): called with the fresh task after any change
 *  - onTaskDelete(id): called after the task was deleted
 *  - autoOpen: open the dialog on mount (used when arriving from a notification)
 */
const TaskBoard = ({ task, onTaskChange, onTaskDelete, autoOpen = false }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [isExpanded, setIsExpanded] = useState(autoOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedTask, setEditedTask] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [members, setMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  const currentAssigneeId = task.assignees?.[0]?.id?.toString() || "";
  const canDelete = task.tasklist_owner_id === user?.id || user?.workspace?.is_owner;

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/tasks/${task.id}/comments`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast(errorMessage(err, "Couldn't load comments."), "danger");
    } finally {
      setLoadingComments(false);
    }
  }, [task.id, toast]);

  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${task.id}/subtasks`);
      setSubtasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast(errorMessage(err, "Couldn't load subtasks."), "danger");
    }
  }, [task.id, toast]);

  useEffect(() => {
    if (!isExpanded) return;
    fetchComments();
    fetchSubtasks();
    if (user?.workspace_id) {
      api.get(`/workspace/${user.workspace_id}/members`)
        .then((res) => setMembers(res.data.members || []))
        .catch(() => {});
    }
  }, [isExpanded, fetchComments, fetchSubtasks, user?.workspace_id]);

  // Live comments while the dialog is open.
  useEffect(() => {
    if (!isExpanded) return undefined;
    const onCommentAdded = (data) => {
      if (data.task_id !== task.id || data.user_id === user?.id) return;
      setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    };
    const onCommentUpdated = (data) => {
      if (data.task_id !== task.id) return;
      setComments((prev) => prev.map((c) => (c.id === data.id ? { ...c, content: data.content } : c)));
    };
    const onCommentDeleted = ({ task_id, comment_id }) => {
      if (task_id !== task.id) return;
      setComments((prev) => prev.filter((c) => c.id !== comment_id));
    };
    socket.on("comment_added", onCommentAdded);
    socket.on("comment_updated", onCommentUpdated);
    socket.on("comment_deleted", onCommentDeleted);
    return () => {
      socket.off("comment_added", onCommentAdded);
      socket.off("comment_updated", onCommentUpdated);
      socket.off("comment_deleted", onCommentDeleted);
    };
  }, [isExpanded, task.id, user?.id]);

  const startEditing = () => {
    setEditedTask({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      due_date: dateOnly(task.due_date),
    });
    setSelectedAssignee(currentAssigneeId);
    setIsEditing(true);
  };

  const isDirty = () =>
    isEditing && editedTask && (
      editedTask.title !== task.title ||
      editedTask.description !== (task.description || "") ||
      editedTask.priority !== (task.priority || "medium") ||
      editedTask.due_date !== dateOnly(task.due_date) ||
      selectedAssignee !== currentAssigneeId
    );

  const requestClose = () => {
    if (isDirty() && !window.confirm("Discard your unsaved changes?")) return;
    setIsExpanded(false);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!editedTask.title.trim()) {
      toast("A task needs a title.", "warning");
      return;
    }
    setSaving(true);
    try {
      let updated = (await api.patch(`/tasks/${task.id}`, {
        title: editedTask.title,
        description: editedTask.description,
        priority: editedTask.priority,
        due_date: editedTask.due_date || null,
      })).data;

      if (selectedAssignee !== currentAssigneeId) {
        const res = await api.put(`/tasks/${task.id}/assignees`, {
          user_ids: selectedAssignee ? [Number(selectedAssignee)] : [],
        });
        updated = res.data.task;
      }
      onTaskChange?.(updated);
      setIsEditing(false);
    } catch (err) {
      // Stay in edit mode so nothing typed is lost.
      toast(errorMessage(err, "Couldn't save your changes."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(`Delete “${task.title}”? Its subtasks, comments and attachments will be deleted too.`)) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      setIsExpanded(false);
      onTaskDelete?.(task.id);
      toast("Task deleted.", "success");
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete the task."), "danger");
    }
  };

  const handleAddComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    setSavingComment(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content });
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (err) {
      toast(errorMessage(err, "Couldn't post your comment."), "danger");
    } finally {
      setSavingComment(false);
    }
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
    } catch (err) {
      toast(errorMessage(err, "Couldn't save the comment."), "danger");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    setDeletingCommentId(commentId);
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete the comment."), "danger");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleAddSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    setAddingSubtask(true);
    try {
      const res = await api.post(`/tasks/${task.id}/subtasks`, { title });
      setSubtasks((prev) => [...prev, res.data]);
      setNewSubtask("");
    } catch (err) {
      toast(errorMessage(err, "Couldn't add the subtask."), "danger");
    } finally {
      setAddingSubtask(false);
    }
  };

  const toggleSubtask = async (subtask) => {
    const status = subtask.status === "completed" ? "todo" : "completed";
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, status } : s)));
    try {
      await api.patch(`/subtasks/${subtask.id}`, { status });
    } catch (err) {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, status: subtask.status } : s)));
      toast(errorMessage(err, "Couldn't update the subtask."), "danger");
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await api.delete(`/subtasks/${subtaskId}`);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete the subtask."), "danger");
    }
  };

  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
  // Badges come from the server so they're right before the dialog is ever opened.
  const subtaskTotal = isExpanded ? subtasks.length : task.subtask_count || 0;
  const subtaskDone = isExpanded ? completedSubtasks : task.subtasks_completed || 0;
  const due = parseDueDate(task.due_date);
  const overdue = due && task.status !== "completed" && due < new Date(new Date().setHours(0, 0, 0, 0));

  const footer = (
    <>
      {canDelete && !isEditing && (
        <Button variant="ghost" onClick={handleDeleteTask} className="mr-auto text-danger hover:text-danger">
          <Trash2 size={14} /> Delete
        </Button>
      )}
      <Button variant="ghost" onClick={requestClose}>{isEditing ? "Cancel" : "Close"}</Button>
      {isEditing ? (
        <Button onClick={handleSaveChanges} loading={saving}>Save</Button>
      ) : (
        <Button variant="outline" onClick={startEditing}><Pencil size={14} /> Edit</Button>
      )}
    </>
  );

  return (
    <>
      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(true)}
        onKeyDown={(e) => { if (e.key === "Enter") setIsExpanded(true); }}
        className="cursor-pointer p-3 bg-surface rounded-lg shadow-card border border-border hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
      >
        <p className="text-sm font-semibold text-text leading-snug break-words">{task.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {task.priority && <PriorityBadge priority={task.priority} />}
          {due && (
            <span className={`text-xs ${overdue ? "text-danger font-medium" : "text-text-muted"}`}>
              {overdue ? "Overdue · " : "Due "}{due.toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted empty:hidden">
          {subtaskTotal > 0 && (
            <span className="inline-flex items-center gap-1"><ListChecks size={11} />{subtaskDone}/{subtaskTotal}</span>
          )}
          {(task.attachment_count || 0) > 0 && (
            <span className="inline-flex items-center gap-1"><Paperclip size={11} />{task.attachment_count}</span>
          )}
          {(task.comment_count || 0) > 0 && (
            <span className="inline-flex items-center gap-1"><MessageSquare size={11} />{task.comment_count}</span>
          )}
          {task.assignees?.length > 0 && (
            <span className="ml-auto truncate max-w-[8rem]" title={task.assignees.map((a) => a.username).join(", ")}>
              {task.assignees.map((a) => a.username).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Modal
        open={isExpanded}
        onClose={requestClose}
        title={isEditing ? "Edit task" : task.title}
        size="lg"
        footer={footer}
      >
        <div className="space-y-5">
          {isEditing && editedTask ? (
            <>
              <Input
                label="Title" value={editedTask.title} maxLength={100}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              />
              <Textarea
                label="Description" rows={3} value={editedTask.description}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`prio-${task.id}`} className="text-sm font-medium text-text block mb-1">Priority</label>
                  <select
                    id={`prio-${task.id}`}
                    className="w-full px-3 py-2 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editedTask.priority}
                    onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <Input
                    label="Due date" type="date" value={editedTask.due_date}
                    onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                  />
                  {editedTask.due_date && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary hover:underline"
                      onClick={() => setEditedTask({ ...editedTask, due_date: "" })}
                    >
                      Clear due date
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor={`assignee-${task.id}`} className="text-sm font-medium text-text block mb-1">Assignee</label>
                <select
                  id={`assignee-${task.id}`}
                  className="w-full px-3 py-2 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id.toString()}>{m.username} ({m.email})</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text whitespace-pre-wrap break-words">{task.description || "No description."}</p>
              <div className="flex flex-wrap gap-4 text-sm text-text-muted">
                <span>Priority: <span className="font-medium text-text capitalize">{task.priority}</span></span>
                <span>Due: <span className="font-medium text-text">{due ? due.toLocaleDateString() : "No deadline"}</span></span>
                {task.tasklist_name && <span>List: <span className="font-medium text-text">{task.tasklist_name}</span></span>}
              </div>
              <div className="text-sm text-text-muted">
                Assigned to:{" "}
                <span className="font-medium text-text">
                  {task.assignees?.length ? task.assignees.map((a) => a.username).join(", ") : "Nobody"}
                </span>
              </div>
            </>
          )}

          {/* Subtasks */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">
              Subtasks
              {subtasks.length > 0 && (
                <span className="ml-1 text-text-muted font-normal">({completedSubtasks}/{subtasks.length})</span>
              )}
            </h3>
            {subtasks.length > 0 && (
              <ul className="space-y-1 mb-2">
                {subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(s)}
                      className="flex-shrink-0 text-text-muted hover:text-success transition-colors"
                      aria-label={s.status === "completed" ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}
                    >
                      {s.status === "completed"
                        ? <CheckCircle2 size={16} className="text-success" />
                        : <Circle size={16} />}
                    </button>
                    <span className={`flex-1 text-sm break-words ${s.status === "completed" ? "line-through text-text-muted" : "text-text"}`}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-text-muted hover:text-danger transition-all"
                      aria-label={`Delete subtask “${s.title}”`}
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
                maxLength={100}
                aria-label="New subtask"
                className="flex-1 px-3 py-1.5 rounded border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted"
                placeholder="Add subtask…"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                disabled={addingSubtask}
              />
              <Button size="sm" variant="outline" onClick={handleAddSubtask} disabled={addingSubtask || !newSubtask.trim()} aria-label="Add subtask">
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <TaskAttachments
            taskId={task.id}
            taskOwnerId={task.tasklist_owner_id}
            onCountChange={(count) => {
              if (count !== (task.attachment_count || 0)) onTaskChange?.({ ...task, attachment_count: count });
            }}
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
              <div className="flex justify-center py-4"><Spinner size="sm" className="text-primary" /></div>
            ) : (
              <ul className="space-y-2 mb-3">
                {comments.length === 0 && (
                  <li className="text-sm text-text-muted py-2 text-center">No comments yet. Be the first to comment.</li>
                )}
                {comments.map((c) => {
                  const isOwn = user?.id === c.user_id;
                  const isDeleting = deletingCommentId === c.id;
                  return (
                    <li key={c.id} className="group">
                      {editingCommentId === c.id ? (
                        <div className="space-y-2 px-3 py-2.5 bg-surface-muted rounded-lg border border-primary/40">
                          <textarea
                            aria-label="Edit comment"
                            className="w-full px-0 py-0 text-sm text-text bg-transparent border-none focus:outline-none resize-none"
                            rows={2}
                            maxLength={5000}
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEditComment(c.id); }
                              if (e.key === "Escape") { e.stopPropagation(); setEditingCommentId(null); }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)} disabled={savingEdit}>Cancel</Button>
                            <Button size="sm" onClick={() => handleSaveEditComment(c.id)} loading={savingEdit} disabled={!editCommentContent.trim()}>Save</Button>
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
                              {c.created_at && <span className="text-xs text-text-muted flex-shrink-0">{formatRelTime(c.created_at)}</span>}
                            </div>
                            {isOwn && !isDeleting && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }}
                                  className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                  aria-label="Edit comment"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  aria-label="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-text mt-1.5 ml-8 leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex gap-2 items-start">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex-shrink-0 mt-1">
                {(user?.username || "?").charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 flex gap-2">
                <textarea
                  aria-label="Write a comment"
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-text-muted resize-none transition-colors"
                  placeholder="Write a comment…  (Enter to post, Shift+Enter for a new line)"
                  rows={1}
                  maxLength={5000}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  disabled={savingComment}
                />
                <Button size="sm" onClick={handleAddComment} disabled={savingComment || !newComment.trim()} loading={savingComment} className="self-end">
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TaskBoard;

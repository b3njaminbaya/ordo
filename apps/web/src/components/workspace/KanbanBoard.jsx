import { useEffect, useState, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Search, X, SlidersHorizontal } from "lucide-react";
import api from "../../api/axios";
import { Button, Modal, PriorityBadge, Spinner, Alert } from "../ui";
import TaskForm from "./TaskForm";
import TaskBoard from "./TaskBoard";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket";

const COLUMNS = [
  { id: "todo",        label: "To Do",       headerClass: "border-border",       dotClass: "bg-text-muted" },
  { id: "in-progress", label: "In Progress", headerClass: "border-primary/40",   dotClass: "bg-primary" },
  { id: "pending",     label: "In Review",   headerClass: "border-warning/40",   dotClass: "bg-warning" },
  { id: "completed",   label: "Done",        headerClass: "border-success/40",   dotClass: "bg-success" },
];

const PRIORITY_OPTIONS = [
  { value: "",       label: "All Priorities" },
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const DUE_OPTIONS = [
  { value: "",       label: "Any Due Date" },
  { value: "overdue", label: "Overdue" },
  { value: "today",  label: "Due Today" },
  { value: "week",   label: "Due This Week" },
  { value: "none",   label: "No Due Date" },
];

function matchesDue(task, filterDue) {
  if (!filterDue) return true;
  if (filterDue === "none") return !task.due_date;
  if (!task.due_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (filterDue === "overdue") return due < today;
  if (filterDue === "today")   return due.getTime() === today.getTime();
  if (filterDue === "week")    return due >= today && due <= weekEnd;
  return true;
}

const selectCls =
  "px-3 py-2 rounded-lg border border-border text-sm text-text bg-page focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

export default function KanbanBoard() {
  const { user } = useAuth();
  const [tasks, setTasks]       = useState([]);
  const [tasklists, setTasklists] = useState([]);
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [addingTo, setAddingTo] = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState("");
  const [filterPriority,  setFilterPriority]  = useState("");
  const [filterDue,       setFilterDue]       = useState("");
  const [filterAssignee,  setFilterAssignee]  = useState("");

  const hasActiveFilters = search || filterPriority || filterDue || filterAssignee;

  const clearFilters = () => {
    setSearch("");
    setFilterPriority("");
    setFilterDue("");
    setFilterAssignee("");
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, listsRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/tasklists"),
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setTasklists(Array.isArray(listsRes.data) ? listsRes.data : []);
    } catch {
      setError("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user?.workspace_id) return;
    api.get(`/workspace/${user.workspace_id}/members`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => {});
  }, [user?.workspace_id]);

  // ── Socket.IO real-time sync (connection managed by WorkspaceLayout) ────────
  useEffect(() => {
    const onCreated = (task) => setTasks((prev) => {
      if (prev.some((t) => t.id === task.id)) return prev;
      return [...prev, task];
    });
    const onUpdated = (task) =>
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    const onDeleted = ({ id }) =>
      setTasks((prev) => prev.filter((t) => t.id !== id));

    socket.on("task_created", onCreated);
    socket.on("task_updated", onUpdated);
    socket.on("task_deleted", onDeleted);

    return () => {
      socket.off("task_created", onCreated);
      socket.off("task_updated", onUpdated);
      socket.off("task_deleted", onDeleted);
    };
  }, []);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
    }

    if (filterPriority) {
      result = result.filter((t) => t.priority === filterPriority);
    }

    if (filterDue) {
      result = result.filter((t) => matchesDue(t, filterDue));
    }

    if (filterAssignee) {
      result = result.filter((t) =>
        (t.assignees || []).some((a) => String(a.id) === filterAssignee)
      );
    }

    return result;
  }, [tasks, search, filterPriority, filterDue, filterAssignee]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;

    const isSameColumn = destination.droppableId === source.droppableId;
    const isSamePosition = destination.index === source.index;
    if (isSameColumn && isSamePosition) return;

    const taskId = parseInt(draggableId, 10);

    if (isSameColumn) {
      // Reordering within a column — disabled when filters are active (ambiguous partial view)
      if (hasActiveFilters) return;

      const colId = source.droppableId;
      // Get the full ordered list for this column (already sorted by position from API)
      const colTasks = tasks
        .filter((t) => t.status === colId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      const reordered = [...colTasks];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      // Build position map and optimistically update
      const posMap = {};
      reordered.forEach((t, i) => { posMap[t.id] = i; });
      setTasks((prev) =>
        prev.map((t) => posMap[t.id] !== undefined ? { ...t, position: posMap[t.id] } : t)
      );

      try {
        await api.patch("/tasks/reorder", {
          status: colId,
          order: reordered.map((t) => t.id),
        });
      } catch {
        fetchAll(); // rollback on failure
      }
    } else {
      // Moving to a different column — update status, task appends to end
      const newStatus = destination.droppableId;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      try {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      } catch {
        fetchAll();
      }
    }
  };

  const defaultTasklistId = tasklists[0]?.id ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error)   return <div className="p-6"><Alert variant="danger">{error}</Alert></div>;

  const totalVisible = filteredTasks.length;

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-text">Kanban Board</h1>
          {hasActiveFilters && (
            <p className="text-sm text-text-muted mt-0.5">
              {totalVisible} task{totalVisible !== 1 ? "s" : ""} match your filters
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={15} className="text-text-muted" />
          <span className="text-sm text-text-muted hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
              {[search, filterPriority, filterDue, filterAssignee].filter(Boolean).length}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5 p-3 bg-surface border border-border rounded-xl items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-border text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Priority */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className={selectCls}
          aria-label="Filter by priority"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Due date */}
        <select
          value={filterDue}
          onChange={(e) => setFilterDue(e.target.value)}
          className={selectCls}
          aria-label="Filter by due date"
        >
          {DUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Assignee */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className={selectCls}
          aria-label="Filter by assignee"
        >
          <option value="">All Assignees</option>
          {members.map((m) => (
            <option key={m.id} value={String(m.id)}>{m.username}</option>
          ))}
        </select>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 border border-danger/30 transition-colors"
          >
            <X size={13} /> Clear all
          </button>
        )}
      </div>

      {/* Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks
              .filter((t) => t.status === col.id)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            return (
              <div
                key={col.id}
                className={`flex flex-col bg-surface-muted rounded-xl border-t-4 ${col.headerClass} shadow-card`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                    <span className="text-sm font-semibold text-text">{col.label}</span>
                    <span className="ml-1 text-xs font-medium text-text-muted bg-surface px-1.5 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setAddingTo(col.id)}
                    className="p-1 rounded hover:bg-surface transition-colors text-text-muted hover:text-primary"
                    aria-label={`Add task to ${col.label}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Cards */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 space-y-2 min-h-[120px] transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5" : ""
                      }`}
                    >
                      {colTasks.length === 0 && hasActiveFilters && (
                        <p className="text-xs text-text-muted text-center pt-6 pb-2">
                          No tasks match your filters
                        </p>
                      )}
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(drag, dragSnap) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              style={drag.draggableProps.style}
                              className={dragSnap.isDragging ? "opacity-80" : ""}
                            >
                              <TaskBoard
                                task={task}
                                onEditTask={(updated) =>
                                  setTasks((prev) =>
                                    prev.map((t) => (t.id === updated.id ? updated : t))
                                  )
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add-task modal */}
      {addingTo && (
        <Modal
          isOpen
          onClose={() => setAddingTo(null)}
          title={`Add Task to ${COLUMNS.find((c) => c.id === addingTo)?.label}`}
        >
          <TaskForm
            tasklistId={defaultTasklistId}
            onTaskAdded={(task) => {
              setTasks((prev) => [...prev, { ...task, status: addingTo }]);
              setAddingTo(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Search, X, SlidersHorizontal } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { Button, Modal, Spinner, Alert, useToast } from "../ui";
import TaskForm from "./TaskForm";
import TaskBoard from "./TaskBoard";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket";
import { parseDueDate } from "../../utils/time";

const COLUMNS = [
  { id: "todo",        label: "To Do",       headerClass: "border-border",     dotClass: "bg-text-muted" },
  { id: "in-progress", label: "In Progress", headerClass: "border-primary/40", dotClass: "bg-primary" },
  { id: "pending",     label: "In Review",   headerClass: "border-warning/40", dotClass: "bg-warning" },
  { id: "completed",   label: "Done",        headerClass: "border-success/40", dotClass: "bg-success" },
];

const PRIORITY_OPTIONS = [
  { value: "",       label: "All Priorities" },
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const DUE_OPTIONS = [
  { value: "",        label: "Any Due Date" },
  { value: "overdue", label: "Overdue" },
  { value: "today",   label: "Due Today" },
  { value: "week",    label: "Due This Week" },
  { value: "none",    label: "No Due Date" },
];

function matchesDue(task, filterDue) {
  if (!filterDue) return true;
  if (filterDue === "none") return !task.due_date;
  const due = parseDueDate(task.due_date);
  if (!due) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (filterDue === "overdue") return due < today && task.status !== "completed";
  if (filterDue === "today")   return due.getTime() === today.getTime();
  if (filterDue === "week")    return due >= today && due <= weekEnd;
  return true;
}

const selectCls =
  "px-3 py-2 rounded-lg border border-border text-sm text-text bg-page focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id;

export default function KanbanBoard() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openTaskId] = useState(() => Number(searchParams.get("task")) || null);

  const [tasks, setTasks] = useState([]);
  const [tasklists, setTasklists] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [creatingList, setCreatingList] = useState(false);

  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDue, setFilterDue] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const hasActiveFilters = Boolean(search || filterPriority || filterDue || filterAssignee);

  const clearFilters = () => {
    setSearch(""); setFilterPriority(""); setFilterDue(""); setFilterAssignee("");
  };

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, listsRes] = await Promise.all([api.get("/tasks"), api.get("/tasklists/")]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setTasklists(Array.isArray(listsRes.data) ? listsRes.data : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load tasks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // The notification that brought us here has done its job; keep the URL clean.
  useEffect(() => {
    if (openTaskId && !loading) setSearchParams({}, { replace: true });
  }, [openTaskId, loading, setSearchParams]);

  useEffect(() => {
    if (!user?.workspace_id) return;
    api.get(`/workspace/${user.workspace_id}/members`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => {});
  }, [user?.workspace_id]);

  // Real-time sync (the connection itself is managed by WorkspaceLayout).
  useEffect(() => {
    const upsert = (task) => {
      if (task.parent_task_id) return;
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]));
    };
    const onDeleted = ({ id }) => setTasks((prev) => prev.filter((t) => t.id !== id));
    const onListsChanged = () => fetchAll();

    socket.on("task_created", upsert);
    socket.on("task_updated", upsert);
    socket.on("task_deleted", onDeleted);
    socket.on("tasklist_changed", onListsChanged);
    socket.on("connect", fetchAll);   // catch up on anything missed while disconnected
    return () => {
      socket.off("task_created", upsert);
      socket.off("task_updated", upsert);
      socket.off("task_deleted", onDeleted);
      socket.off("tasklist_changed", onListsChanged);
      socket.off("connect", fetchAll);
    };
  }, [fetchAll]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
    }
    if (filterPriority) result = result.filter((t) => t.priority === filterPriority);
    if (filterDue) result = result.filter((t) => matchesDue(t, filterDue));
    if (filterAssignee) result = result.filter((t) => (t.assignees || []).some((a) => String(a.id) === filterAssignee));
    return result;
  }, [tasks, search, filterPriority, filterDue, filterAssignee]);

  const replaceTask = (updated) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    const sameColumn = destination.droppableId === source.droppableId;
    if (sameColumn && destination.index === source.index) return;

    const taskId = parseInt(draggableId, 10);
    const moved = tasks.find((t) => t.id === taskId);
    if (!moved) return;

    if (hasActiveFilters && sameColumn) {
      toast("Clear the filters to reorder cards — the order of hidden cards is unknown.", "info");
      return;
    }

    const destId = destination.droppableId;
    const column = (id) => tasks.filter((t) => t.status === id && t.id !== taskId).sort(byPosition);

    // With filters on, the drop index refers to a subset, so append instead of guessing.
    const index = hasActiveFilters ? column(destId).length : destination.index;
    const ordered = column(destId);
    ordered.splice(index, 0, { ...moved, status: destId });
    const positions = new Map(ordered.map((t, i) => [t.id, i]));

    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => {
      if (t.id === taskId) return { ...t, status: destId, position: positions.get(t.id) };
      return positions.has(t.id) && t.status === destId ? { ...t, position: positions.get(t.id) } : t;
    }));

    try {
      if (sameColumn) {
        await api.patch("/tasks/reorder", { status: destId, order: ordered.map((t) => t.id) });
      } else {
        const res = await api.patch(`/tasks/${taskId}`, { status: destId, index });
        replaceTask(res.data);
      }
    } catch (err) {
      setTasks(snapshot);
      toast(errorMessage(err, "Couldn't move that task."), "danger");
      fetchAll();
    }
  };

  const createFirstList = async () => {
    setCreatingList(true);
    try {
      await api.post("/tasklists/", { name: "My Tasks" });
      await fetchAll();
    } catch (err) {
      toast(errorMessage(err, "Couldn't create a list."), "danger");
    } finally {
      setCreatingList(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-primary" /></div>;
  if (error) {
    return (
      <div className="p-6 space-y-3">
        <Alert variant="danger">{error}</Alert>
        <Button variant="outline" onClick={() => { setLoading(true); fetchAll(); }}>Try again</Button>
      </div>
    );
  }

  if (tasklists.length === 0) {
    return (
      <div className="p-6 max-w-md mx-auto text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold text-text">Kanban Board</h1>
        <p className="text-sm text-text-muted">Tasks live inside lists. Create your first list to start adding tasks.</p>
        <Button onClick={createFirstList} loading={creatingList}><Plus size={15} /> Create a list</Button>
      </div>
    );
  }

  const totalVisible = filteredTasks.length;

  return (
    <div className="p-4 sm:p-6">
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

      <div className="flex flex-wrap gap-2 mb-5 p-3 bg-surface border border-border rounded-xl items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text" placeholder="Search tasks…" aria-label="Search tasks" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-lg border border-border text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={selectCls} aria-label="Filter by priority">
          {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterDue} onChange={(e) => setFilterDue(e.target.value)} className={selectCls} aria-label="Filter by due date">
          {DUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={selectCls} aria-label="Filter by assignee">
          <option value="">All Assignees</option>
          {members.map((m) => <option key={m.id} value={String(m.id)}>{m.username}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 border border-danger/30 transition-colors"
          >
            <X size={13} /> Clear all
          </button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id).sort(byPosition);
            return (
              <section key={col.id} aria-label={col.label} className={`flex flex-col bg-surface-muted rounded-xl border-t-4 ${col.headerClass} shadow-card`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                    <h2 className="text-sm font-semibold text-text">{col.label}</h2>
                    <span className="ml-1 text-xs font-medium text-text-muted bg-surface px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => setAddingTo(col.id)}
                    className="p-1 rounded hover:bg-surface transition-colors text-text-muted hover:text-primary"
                    aria-label={`Add task to ${col.label}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 space-y-2 min-h-[120px] transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                    >
                      {colTasks.length === 0 && (
                        <p className="text-xs text-text-muted text-center pt-6 pb-2">
                          {hasActiveFilters ? "No tasks match your filters" : "Nothing here yet"}
                        </p>
                      )}
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(drag, dragSnap) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              className={dragSnap.isDragging ? "opacity-80" : ""}
                            >
                              <TaskBoard
                                task={task}
                                autoOpen={task.id === openTaskId}
                                onTaskChange={replaceTask}
                                onTaskDelete={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </div>
      </DragDropContext>

      <Modal
        open={Boolean(addingTo)}
        onClose={() => setAddingTo(null)}
        title={`Add task to ${COLUMNS.find((c) => c.id === addingTo)?.label ?? ""}`}
      >
        <TaskForm
          tasklists={tasklists}
          status={addingTo || "todo"}
          onTaskAdded={(task) => {
            setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
            setAddingTo(null);
            toast("Task added.", "success");
          }}
        />
      </Modal>
    </div>
  );
}

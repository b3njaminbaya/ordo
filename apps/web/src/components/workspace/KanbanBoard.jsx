import { useEffect, useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, X } from "lucide-react";
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

export default function KanbanBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [tasklists, setTasklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user?.workspace_id) return;
    socket.connect();
    socket.emit("join_workspace", { workspace_id: user.workspace_id });

    const onCreated = (task) => setTasks((prev) => [...prev, task]);
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
      socket.emit("leave_workspace", { workspace_id: user.workspace_id });
      socket.disconnect();
    };
  }, [user?.workspace_id]);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const taskId = parseInt(draggableId, 10);
    const newStatus = destination.droppableId;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      fetchAll();
    }
  };

  const defaultTasklistId = tasklists[0]?.id ?? null;

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error) return <div className="p-6"><Alert variant="danger">{error}</Alert></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text mb-6">Kanban Board</h1>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
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

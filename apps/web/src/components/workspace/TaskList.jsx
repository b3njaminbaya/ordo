import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskBoard from "./TaskBoard";
import TaskForm from "./TaskForm";
import { Trash2, Plus } from "lucide-react";
import api from "../../api/axios";
import { Button, Modal } from "../ui";

const TaskList = () => {
  const [taskLists, setTaskLists] = useState({});
  const [openTaskForm, setOpenTaskForm] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [newListTitle, setNewListTitle] = useState("");

  useEffect(() => {
    fetchTaskLists();
  }, []);

  const fetchTaskLists = async () => {
    try {
      const res = await api.get("/tasklists/");
      const mapped = res.data.reduce((acc, tl) => {
        acc[tl.id] = { name: tl.name, tasks: tl.tasks || [] };
        return acc;
      }, {});
      setTaskLists(mapped);
    } catch {
      // non-fatal
    }
  };

  const addTaskList = async () => {
    const name = `New List ${Date.now()}`;
    try {
      const res = await api.post("/tasklists/", { name });
      setTaskLists((prev) => ({ ...prev, [res.data.id]: { name, tasks: [] } }));
    } catch {
      // non-fatal
    }
  };

  const commitListRename = async (tasklist_id) => {
    const trimmed = newListTitle.trim();
    if (trimmed && trimmed !== taskLists[tasklist_id].name) {
      try {
        await api.put(`/tasklists/${tasklist_id}`, { name: trimmed });
        setTaskLists((prev) => ({
          ...prev,
          [tasklist_id]: { ...prev[tasklist_id], name: trimmed },
        }));
      } catch {
        // non-fatal
      }
    }
    setEditingListId(null);
  };

  const deleteTaskList = async (tasklist_id) => {
    if (!window.confirm("Delete this list and all its tasks?")) return;
    try {
      await api.delete(`/tasklists/${tasklist_id}`);
      setTaskLists((prev) => {
        const next = { ...prev };
        delete next[tasklist_id];
        return next;
      });
    } catch {
      // non-fatal
    }
  };

  const handleDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    const sourceList = [...taskLists[source.droppableId].tasks];
    const destList = [...taskLists[destination.droppableId].tasks];
    const [moved] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, moved);

    setTaskLists((prev) => ({
      ...prev,
      [source.droppableId]: { ...prev[source.droppableId], tasks: sourceList },
      [destination.droppableId]: { ...prev[destination.droppableId], tasks: destList },
    }));

    try {
      await api.patch(`/tasks/${moved.id}`, { tasklist_id: Number(destination.droppableId) });
    } catch {
      // non-fatal — optimistic update already applied
    }
  };

  const addTask = (tasklist_id, newTask) => {
    setTaskLists((prev) => ({
      ...prev,
      [tasklist_id]: { ...prev[tasklist_id], tasks: [...prev[tasklist_id].tasks, newTask] },
    }));
    setOpenTaskForm(null);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {Object.keys(taskLists).map((tasklist_id) => (
          <Droppable key={tasklist_id} droppableId={String(tasklist_id)}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-col w-72 min-w-[18rem] max-h-[calc(100vh-7rem)] bg-white rounded-xl shadow-card border border-border"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  {editingListId === tasklist_id ? (
                    <input
                      className="flex-1 text-sm font-semibold text-text bg-transparent border-b border-primary focus:outline-none mr-2"
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onBlur={() => commitListRename(tasklist_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitListRename(tasklist_id);
                        if (e.key === "Escape") setEditingListId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-sm font-semibold text-text hover:text-primary transition-colors truncate mr-2"
                      onClick={() => {
                        setEditingListId(tasklist_id);
                        setNewListTitle(taskLists[tasklist_id].name);
                      }}
                    >
                      {taskLists[tasklist_id].name}
                    </button>
                  )}
                  <button
                    onClick={() => deleteTaskList(tasklist_id)}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                    aria-label="Delete list"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Task cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {(taskLists[tasklist_id]?.tasks || []).map((task, index) => (
                    <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TaskBoard task={task} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>

                {/* Add task button */}
                <div className="px-3 py-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => setOpenTaskForm(tasklist_id)}
                    className="justify-start gap-2"
                  >
                    <Plus size={15} />
                    Add task
                  </Button>
                </div>
              </div>
            )}
          </Droppable>
        ))}

        {/* Add new list */}
        <div className="flex-shrink-0 pt-1">
          <Button variant="outline" onClick={addTaskList} className="gap-2 whitespace-nowrap">
            <Plus size={15} />
            Add List
          </Button>
        </div>
      </div>

      {/* Add task modal */}
      {openTaskForm && (
        <Modal
          open
          onClose={() => setOpenTaskForm(null)}
          title={`Add task to "${taskLists[openTaskForm]?.name}"`}
          size="md"
        >
          <TaskForm
            onTaskAdded={(task) => addTask(openTaskForm, task)}
            tasklistId={openTaskForm}
          />
        </Modal>
      )}
    </DragDropContext>
  );
};

export default TaskList;

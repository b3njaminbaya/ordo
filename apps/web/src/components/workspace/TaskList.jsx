import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Trash2, Plus, Check, X } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket";
import { Alert, Button, Modal, Spinner, useToast } from "../ui";
import TaskBoard from "./TaskBoard";
import TaskForm from "./TaskForm";

const TaskList = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openTaskId] = useState(() => Number(searchParams.get("task")) || null);

  const [lists, setLists] = useState([]);          // [{id, name, user_id, owner_name, tasks}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToList, setAddingToList] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [savingList, setSavingList] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      const res = await api.get("/tasklists/");
      setLists(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load your lists."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  useEffect(() => {
    if (openTaskId && !loading) setSearchParams({}, { replace: true });
  }, [openTaskId, loading, setSearchParams]);

  // Anything that changes a task or a list somewhere else: pull fresh data.
  useEffect(() => {
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(fetchLists, 250); };
    const events = ["task_created", "task_updated", "task_deleted", "tasklist_changed", "connect"];
    events.forEach((e) => socket.on(e, refresh));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => socket.off(e, refresh));
    };
  }, [fetchLists]);

  const updateTaskInLists = (updated) =>
    setLists((prev) => prev.map((l) => ({ ...l, tasks: l.tasks.map((t) => (t.id === updated.id ? updated : t)) })));

  const removeTaskFromLists = (id) =>
    setLists((prev) => prev.map((l) => ({ ...l, tasks: l.tasks.filter((t) => t.id !== id) })));

  const createList = async (e) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setSavingList(true);
    try {
      const res = await api.post("/tasklists/", { name });
      setLists((prev) => [...prev, { ...res.data, tasks: res.data.tasks || [] }]);
      setNewListName("");
      setCreating(false);
    } catch (err) {
      toast(errorMessage(err, "Couldn't create the list."), "danger");
    } finally {
      setSavingList(false);
    }
  };

  const commitRename = async (list) => {
    const name = editingName.trim();
    setEditingListId(null);
    if (!name || name === list.name) return;
    try {
      await api.put(`/tasklists/${list.id}`, { name });
      setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, name } : l)));
    } catch (err) {
      toast(errorMessage(err, "Couldn't rename the list."), "danger");
    }
  };

  const deleteList = async (list) => {
    const n = list.tasks.length;
    const detail = n ? `${n} task${n === 1 ? "" : "s"} (with their subtasks, comments and attachments)` : "it";
    if (!window.confirm(`Delete “${list.name}” and ${detail}? This can't be undone.`)) return;
    try {
      await api.delete(`/tasklists/${list.id}`);
      setLists((prev) => prev.filter((l) => l.id !== list.id));
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete the list."), "danger");
    }
  };

  const handleDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceId = Number(source.droppableId);
    const destId = Number(destination.droppableId);
    const snapshot = lists;

    const next = lists.map((l) => ({ ...l, tasks: [...l.tasks] }));
    const from = next.find((l) => l.id === sourceId);
    const to = next.find((l) => l.id === destId);
    const [moved] = from.tasks.splice(source.index, 1);
    to.tasks.splice(destination.index, 0, { ...moved, tasklist_id: destId });
    setLists(next);

    try {
      if (sourceId === destId) {
        await api.patch(`/tasklists/${destId}/reorder`, { order: to.tasks.map((t) => t.id) });
      } else {
        await api.patch(`/tasks/${Number(draggableId)}`, { tasklist_id: destId, list_index: destination.index });
      }
    } catch (err) {
      setLists(snapshot);
      toast(errorMessage(err, "Couldn't move that task."), "danger");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-primary" /></div>;
  if (error) {
    return (
      <div className="p-6 space-y-3">
        <Alert variant="danger">{error}</Alert>
        <Button variant="outline" onClick={() => { setLoading(true); fetchLists(); }}>Try again</Button>
      </div>
    );
  }

  const addTarget = lists.find((l) => l.id === addingToList);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-4 sm:p-6 overflow-x-auto h-full items-start">
        {lists.length === 0 && !creating && (
          <div className="max-w-sm py-10 space-y-3">
            <h1 className="text-xl font-bold text-text">No lists yet</h1>
            <p className="text-sm text-text-muted">Create a list to start organising tasks.</p>
          </div>
        )}

        {lists.map((list) => {
          const isOwner = list.user_id === user?.id;
          return (
            <Droppable key={list.id} droppableId={String(list.id)}>
              {(provided) => (
                <section
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  aria-label={list.name}
                  className="flex flex-col w-72 min-w-[18rem] max-h-[calc(100vh-7rem)] bg-surface rounded-xl shadow-card border border-border"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
                    {editingListId === list.id ? (
                      <input
                        aria-label="List name"
                        className="flex-1 min-w-0 text-sm font-semibold text-text bg-transparent border-b border-primary focus:outline-none"
                        value={editingName}
                        maxLength={120}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => commitRename(list)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") { setEditingName(list.name); setEditingListId(null); }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        {isOwner ? (
                          <button
                            className="block w-full text-left text-sm font-semibold text-text hover:text-primary transition-colors truncate"
                            title="Click to rename"
                            onClick={() => { setEditingListId(list.id); setEditingName(list.name); }}
                          >
                            {list.name}
                          </button>
                        ) : (
                          <h2 className="text-sm font-semibold text-text truncate">{list.name}</h2>
                        )}
                        {!isOwner && list.owner_name && (
                          <p className="text-[11px] text-text-muted truncate">by {list.owner_name}</p>
                        )}
                      </div>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => deleteList(list)}
                        className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                        aria-label={`Delete list ${list.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[3rem]">
                    {list.tasks.length === 0 && (
                      <p className="text-xs text-text-muted text-center py-3">No tasks yet</p>
                    )}
                    {list.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                            <TaskBoard
                              task={task}
                              autoOpen={task.id === openTaskId}
                              onTaskChange={updateTaskInLists}
                              onTaskDelete={removeTaskFromLists}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>

                  <div className="px-3 py-3 border-t border-border">
                    <Button variant="ghost" size="sm" fullWidth onClick={() => setAddingToList(list.id)} className="justify-start gap-2">
                      <Plus size={15} /> Add task
                    </Button>
                  </div>
                </section>
              )}
            </Droppable>
          );
        })}

        <div className="flex-shrink-0 pt-1">
          {creating ? (
            <form onSubmit={createList} className="w-72 bg-surface border border-border rounded-xl p-3 space-y-2">
              <input
                aria-label="New list name"
                className="w-full px-3 py-2 rounded border border-border text-sm text-text bg-page focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="List name"
                maxLength={120}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setCreating(false); setNewListName(""); } }}
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={savingList} disabled={!newListName.trim()}><Check size={14} /> Add list</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setNewListName(""); }}>
                  <X size={14} /> Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setCreating(true)} className="gap-2 whitespace-nowrap">
              <Plus size={15} /> Add List
            </Button>
          )}
        </div>
      </div>

      <Modal open={Boolean(addTarget)} onClose={() => setAddingToList(null)} title={`Add task to “${addTarget?.name ?? ""}”`}>
        <TaskForm
          tasklists={addTarget ? [addTarget] : []}
          tasklistId={addTarget?.id}
          onTaskAdded={(task) => {
            setLists((prev) => prev.map((l) => (l.id === task.tasklist_id ? { ...l, tasks: [...l.tasks, task] } : l)));
            setAddingToList(null);
            toast("Task added.", "success");
          }}
        />
      </Modal>
    </DragDropContext>
  );
};

export default TaskList;

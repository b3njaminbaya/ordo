import { useEffect, useState } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { useAuth } from "../../context/AuthContext";
import { Input, Textarea, Select, Button, Alert } from "../ui";

const validationSchema = Yup.object({
  title: Yup.string().trim().max(100, "100 characters or fewer").required("Title is required"),
  description: Yup.string(),
  dueDate: Yup.string(),
  priority: Yup.string().oneOf(["low", "medium", "high", "urgent"], "Invalid priority").required("Priority is required"),
  assignee: Yup.string(),
  tasklistId: Yup.string().required("Choose a list"),
});

/**
 * Create a task.
 *  - tasklists: lists the person may add to (a picker is shown when there is more than one)
 *  - tasklistId: preselected list
 *  - status: the column the task should be created in
 */
const TaskForm = ({ onTaskAdded, tasklists = [], tasklistId, status = "todo" }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState(null);

  useEffect(() => {
    if (!user?.workspace_id) return;
    api.get(`/workspace/${user.workspace_id}/members`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => setMembersError("Could not load workspace members."));
  }, [user?.workspace_id]);

  const handleSubmit = async (values, { setSubmitting, setStatus, resetForm }) => {
    setStatus({ error: "" });
    try {
      const res = await api.post("/tasks", {
        title: values.title.trim(),
        description: values.description,
        due_date: values.dueDate || null,
        priority: values.priority,
        status,
        tasklist_id: Number(values.tasklistId),
        assignee_ids: values.assignee ? [Number(values.assignee)] : [],
      });
      resetForm();
      onTaskAdded?.(res.data);
    } catch (err) {
      setStatus({ error: errorMessage(err, "Failed to add task.") });
    } finally {
      setSubmitting(false);
    }
  };

  const defaultList = tasklistId ?? tasklists.find((l) => l.user_id === user?.id)?.id ?? tasklists[0]?.id ?? "";

  return (
    <Formik
      initialValues={{
        title: "", description: "", dueDate: "", priority: "medium", assignee: "",
        tasklistId: defaultList ? String(defaultList) : "",
      }}
      enableReinitialize
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ values, handleChange, handleBlur, isSubmitting, errors, touched, status: formStatus }) => (
        <Form className="space-y-4" noValidate>
          {formStatus?.error && <Alert variant="danger">{formStatus.error}</Alert>}
          {membersError && <Alert variant="warning">{membersError}</Alert>}

          <Input
            label="Title" name="title" value={values.title}
            onChange={handleChange} onBlur={handleBlur} maxLength={100} autoFocus
            error={touched.title && errors.title}
          />

          <Textarea
            label="Description" name="description" rows={3} value={values.description}
            onChange={handleChange} onBlur={handleBlur}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Due date (optional)" name="dueDate" type="date" value={values.dueDate}
              onChange={handleChange} onBlur={handleBlur}
            />
            <Select
              label="Priority" name="priority" value={values.priority}
              onChange={handleChange} onBlur={handleBlur} error={touched.priority && errors.priority}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          {tasklists.length > 1 && (
            <Select
              label="List" name="tasklistId" value={values.tasklistId}
              onChange={handleChange} onBlur={handleBlur} error={touched.tasklistId && errors.tasklistId}
            >
              {tasklists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.user_id !== user?.id && l.owner_name ? ` (${l.owner_name})` : ""}
                </option>
              ))}
            </Select>
          )}

          <Select label="Assignee (optional)" name="assignee" value={values.assignee} onChange={handleChange} onBlur={handleBlur}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.username} ({m.email})</option>
            ))}
          </Select>

          {!values.tasklistId && (
            <Alert variant="info">Create a list first — tasks live inside lists.</Alert>
          )}

          <Button type="submit" fullWidth loading={isSubmitting} disabled={!values.tasklistId}>
            Add Task
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default TaskForm;

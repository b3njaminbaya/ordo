import { useState, useEffect } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import api from "../../api/axios";
import { Input, Textarea, Select, Button, Alert } from "../ui";

const validationSchema = Yup.object({
  title: Yup.string().required("Title is required"),
  description: Yup.string(),
  dueDate: Yup.date().required("Due date is required"),
  priority: Yup.string().oneOf(["low", "medium", "high", "urgent"], "Invalid priority").required("Priority is required"),
  assignee: Yup.string().nullable(),
});

const TaskForm = ({ onTaskAdded, task, tasklistId }) => {
  const [users, setUsers] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    api.get("/users/")
      .then((res) => setUsers(res.data.users || []))
      .catch(() => setFetchError("Could not load workspace members."));
  }, []);

  const handleSubmit = async (values, { setSubmitting, setStatus, resetForm }) => {
    setStatus({ error: "" });
    try {
      const res = await api.post("/tasks/", {
        title: values.title,
        description: values.description,
        due_date: values.dueDate,
        priority: values.priority,
        tasklist_id: tasklistId,
      });

      if (res.status === 201) {
        if (values.assignee) {
          await api.post(`/tasks/${res.data.id}/assign/`, { user_ids: [values.assignee] });
        }
        if (onTaskAdded) onTaskAdded(res.data);
        resetForm();
      }
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Failed to add task." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{
        title: task?.title || "",
        description: task?.description || "",
        dueDate: task?.dueDate || "",
        priority: task?.priority || "low",
        assignee: task?.assignee || "",
      }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ values, handleChange, handleBlur, isSubmitting, errors, touched, status }) => (
        <Form className="space-y-4">
          {status?.error && <Alert variant="danger">{status.error}</Alert>}
          {fetchError && <Alert variant="warning">{fetchError}</Alert>}

          <Input
            label="Title"
            name="title"
            value={values.title}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.title && errors.title}
          />

          <Textarea
            label="Description"
            name="description"
            rows={3}
            value={values.description}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.description && errors.description}
          />

          <Input
            label="Due Date"
            name="dueDate"
            type="date"
            value={values.dueDate}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dueDate && errors.dueDate}
          />

          <Select
            label="Priority"
            name="priority"
            value={values.priority}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.priority && errors.priority}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>

          <Select
            label="Assignee (optional)"
            name="assignee"
            value={values.assignee}
            onChange={handleChange}
            onBlur={handleBlur}
          >
            <option value="">None</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.email})
              </option>
            ))}
          </Select>

          <Button type="submit" fullWidth loading={isSubmitting} disabled={!tasklistId}>
            {task ? "Update Task" : "Add Task"}
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default TaskForm;

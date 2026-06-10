import { useState, useEffect } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui";
import { Input, Button, Alert, Card, CardHeader, CardTitle, Spinner } from "../ui";
import { Copy, Link, Users, Clock } from "lucide-react";

const inviteSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
});

const Shareboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const workspace_id = user?.workspace_id;

  const [boardMembers, setBoardMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!workspace_id) return;
    setLoading(true);
    api.get(`/workspace/${workspace_id}/members`)
      .then((res) => {
        setBoardMembers(res.data.members || []);
        setPendingInvites(res.data.pending_invites || []);
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to fetch members"))
      .finally(() => setLoading(false));
  }, [workspace_id]);

  const handleInvite = async (values, { resetForm, setSubmitting }) => {
    if (pendingInvites.some((inv) => inv.email === values.email)) {
      setError("Invite already sent to this email");
      setSubmitting(false);
      return;
    }
    setError(null);
    try {
      const res = await api.post("/invite/", { email: values.email, workspace_id });
      setPendingInvites((prev) => [...prev, { email: values.email, status: "pending", invited_by: "You" }]);
      if (res.data.email_sent === false) {
        const detail = res.data.email_error ? ` (${res.data.email_error})` : "";
        toast(`Invite saved, but email failed${detail}. Share the invite link manually.`, "warning");
      } else {
        toast("Invite sent successfully!", "success");
      }
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  };

  const generateInviteLink = async () => {
    setGeneratingLink(true);
    setError(null);
    try {
      const res = await api.post("/invite/generate-link/", { workspace_id });
      setInviteLink(res.data.link);
    } catch (err) {
      setError(err.response?.data?.error || "Error generating link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    toast("Invite link copied!", "success");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-text">Share Board</h1>

      {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Email invite */}
      <Card>
        <CardHeader><CardTitle>Invite by Email</CardTitle></CardHeader>
        <Formik
          initialValues={{ email: "" }}
          validationSchema={inviteSchema}
          onSubmit={handleInvite}
        >
          {({ values, handleChange, handleBlur, isSubmitting, errors, touched }) => (
            <Form>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Email address"
                    name="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.email && errors.email}
                  />
                </div>
                <Button type="submit" loading={isSubmitting} disabled={loading}>
                  Invite
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Card>

      {/* Link invite */}
      <Card className="space-y-3">
        <CardHeader><CardTitle>Invite Link</CardTitle></CardHeader>
        <Button
          variant="secondary"
          onClick={generateInviteLink}
          loading={generatingLink}
          className="gap-2"
        >
          <Link size={15} />
          Generate Link
        </Button>
        {inviteLink && (
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 rounded border border-border text-sm text-text bg-surface-muted focus:outline-none"
            />
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
              <Copy size={14} />
              Copy
            </Button>
          </div>
        )}
      </Card>

      {/* Members + pending */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Board Members
            </CardTitle>
          </CardHeader>
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : boardMembers.length === 0 ? (
            <p className="text-sm text-text-muted">No members yet</p>
          ) : (
            <ul className="divide-y divide-border -mt-1">
              {boardMembers.map((m) => (
                <li key={m.id} className="py-2.5">
                  <p className="text-sm font-medium text-text">{m.username}</p>
                  <p className="text-xs text-text-muted">{m.email}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} className="text-warning" />
              Pending Invites
            </CardTitle>
          </CardHeader>
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : pendingInvites.length === 0 ? (
            <p className="text-sm text-text-muted">No pending invites</p>
          ) : (
            <ul className="divide-y divide-border -mt-1">
              {pendingInvites.map((inv, i) => (
                <li key={i} className="py-2.5">
                  <p className="text-sm font-medium text-text">{inv.email}</p>
                  <p className="text-xs text-text-muted">
                    {inv.status} · invited by {inv.invited_by}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Shareboard;

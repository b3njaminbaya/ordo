import { useState, useEffect, useCallback } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { useAuth } from "../../context/AuthContext";
import { Input, Button, Alert, Card, CardHeader, CardTitle, Spinner, useToast } from "../ui";
import { Copy, Link as LinkIcon, Users, Clock, X, Crown, LogOut, UserMinus } from "lucide-react";

const inviteSchema = Yup.object({
  email: Yup.string().trim().email("Invalid email").required("Email is required"),
});

const Shareboard = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const workspaceId = user?.workspace_id;
  const isOwner = Boolean(user?.workspace?.is_owner);

  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [busyLink, setBusyLink] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    try {
      const res = await api.get(`/workspace/${workspaceId}/members`);
      setMembers(res.data.members || []);
      setPendingInvites(res.data.pending_invites || []);
      setHasActiveLink(Boolean(res.data.has_active_link));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch members"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (values, { resetForm, setSubmitting }) => {
    const email = values.email.trim();
    setError(null);
    try {
      const res = await api.post("/invite", { email, workspace_id: workspaceId });
      if (res.data.email_sent === false) {
        toast("Invite created, but the email couldn't be sent. Share the invite link with them instead.", "warning");
        setInviteLink(res.data.invite_url);
      } else {
        toast("Invite sent successfully!", "success");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to send invite"));
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (invite) => {
    try {
      await api.delete(`/invite/${invite.id}`);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      toast(errorMessage(err, "Couldn't revoke the invite."), "danger");
    }
  };

  const generateInviteLink = async () => {
    setBusyLink(true);
    setError(null);
    try {
      const res = await api.post("/invite/generate-link", { workspace_id: workspaceId });
      setInviteLink(res.data.link);
      setHasActiveLink(true);
    } catch (err) {
      setError(errorMessage(err, "Error generating link"));
    } finally {
      setBusyLink(false);
    }
  };

  const revokeLink = async () => {
    if (!window.confirm("Turn off the invite link? Anyone who hasn't used it yet will no longer be able to join with it.")) return;
    setBusyLink(true);
    try {
      await api.delete("/invite/link");
      setInviteLink("");
      setHasActiveLink(false);
      toast("Invite link turned off.", "success");
    } catch (err) {
      toast(errorMessage(err, "Couldn't turn the link off."), "danger");
    } finally {
      setBusyLink(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast("Invite link copied!", "success");
    } catch {
      toast("Couldn't copy automatically — select the link and copy it manually.", "warning");
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.username} from the workspace? They keep their account; the lists they created stay here.`)) return;
    try {
      await api.delete(`/workspace/${workspaceId}/members/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast(`${member.username} was removed.`, "success");
    } catch (err) {
      toast(errorMessage(err, "Couldn't remove that member."), "danger");
    }
  };

  const leaveWorkspace = async () => {
    if (!window.confirm("Leave this workspace? You'll get a new personal workspace. The lists you created stay with the team.")) return;
    try {
      await api.post(`/workspace/${workspaceId}/leave`);
      await refreshUser();
      toast("You left the workspace.", "success");
    } catch (err) {
      toast(errorMessage(err, "Couldn't leave the workspace."), "danger");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Share Board</h1>
        <p className="text-sm text-text-muted mt-1">Invite teammates to <span className="font-medium text-text">{user?.workspace?.name}</span>.</p>
      </div>

      {error && <Alert variant="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardHeader><CardTitle>Invite by Email</CardTitle></CardHeader>
        <Formik initialValues={{ email: "" }} validationSchema={inviteSchema} onSubmit={handleInvite}>
          {({ values, handleChange, handleBlur, isSubmitting, errors, touched }) => (
            <Form noValidate>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                <div className="flex-1">
                  <Input
                    label="Email address" name="email" type="email" placeholder="colleague@example.com"
                    value={values.email} onChange={handleChange} onBlur={handleBlur}
                    error={touched.email && errors.email}
                  />
                </div>
                <Button type="submit" loading={isSubmitting} className="sm:mt-6">Send invite</Button>
              </div>
              <p className="text-xs text-text-muted mt-2">Invites are valid for 7 days. Anyone who accepts is asked to confirm before joining.</p>
            </Form>
          )}
        </Formik>
      </Card>

      <Card className="space-y-3">
        <CardHeader><CardTitle>Invite Link</CardTitle></CardHeader>
        <p className="text-sm text-text-muted">A shareable link that works for 14 days. Turn it off any time.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={generateInviteLink} loading={busyLink} className="gap-2">
            <LinkIcon size={15} /> {hasActiveLink ? "Show link" : "Generate link"}
          </Button>
          {hasActiveLink && (
            <Button variant="ghost" onClick={revokeLink} disabled={busyLink} className="text-danger hover:text-danger">Turn link off</Button>
          )}
        </div>
        {inviteLink && (
          <div className="flex gap-2 items-center">
            <input
              readOnly aria-label="Invite link" value={inviteLink} onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 px-3 py-2 rounded border border-border text-sm text-text bg-surface-muted focus:outline-none"
            />
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5"><Copy size={14} /> Copy</Button>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={16} className="text-primary" /> Members ({members.length})
            </CardTitle>
          </CardHeader>
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : (
            <ul className="divide-y divide-border -mt-1">
              {members.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text flex items-center gap-1.5">
                      <span className="truncate">{m.username}</span>
                      {m.id === user.id && <span className="text-xs font-normal text-text-muted">(you)</span>}
                      {m.is_owner && <Crown size={12} className="text-warning flex-shrink-0" aria-label="Workspace owner" />}
                    </p>
                    <p className="text-xs text-text-muted truncate">{m.email}</p>
                  </div>
                  {isOwner && m.id !== user.id && (
                    <button
                      onClick={() => removeMember(m)}
                      className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      aria-label={`Remove ${m.username}`}
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!loading && members.length > 1 && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button variant="ghost" size="sm" onClick={leaveWorkspace} className="text-danger hover:text-danger gap-1.5">
                <LogOut size={14} /> Leave workspace
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} className="text-warning" /> Pending Invites
            </CardTitle>
          </CardHeader>
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : pendingInvites.length === 0 ? (
            <p className="text-sm text-text-muted">No pending invites</p>
          ) : (
            <ul className="divide-y divide-border -mt-1">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{inv.email}</p>
                    <p className="text-xs text-text-muted">
                      invited by {inv.invited_by} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeInvite(inv)}
                    className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label={`Revoke invite for ${inv.email}`}
                  >
                    <X size={15} />
                  </button>
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

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserPlus, LogIn, CheckCircle, AlertTriangle } from "lucide-react";
import api from "../../api/axios";
import { errorMessage } from "../../api/errors";
import { useAuth } from "../../context/AuthContext";
import { Button, Spinner, Alert } from "../ui";

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | accepting | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get(`/invite/preview/${token}`)
      .then((res) => { if (!cancelled) setPreview(res.data); })
      .catch((err) => { if (!cancelled) setPreviewError(errorMessage(err, "This invite link is invalid or has expired.")); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setStatus("accepting");
    setErrorMsg("");
    try {
      const res = await api.post(`/invite/accept/${token}`);
      setUser(res.data.user);
      setStatus("success");
      setTimeout(() => navigate("/workspace/dashboard"), 1500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(errorMessage(err, "Failed to accept the invite. The link may have expired."));
    }
  };

  const remember = (path) => {
    sessionStorage.setItem("pendingInviteToken", token);
    navigate(path);
  };

  const switching = user && preview && user.workspace_id && user.workspace?.name !== preview.workspace_name;

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-card border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            {status === "success" ? <CheckCircle size={28} className="text-success" />
              : previewError ? <AlertTriangle size={28} className="text-warning" />
              : <UserPlus size={28} className="text-primary" />}
          </div>

          {previewError ? (
            <>
              <h1 className="text-xl font-bold text-text mb-2">Invite unavailable</h1>
              <p className="text-sm text-text-muted mb-6">{previewError}</p>
              <Button onClick={() => navigate(user ? "/workspace/dashboard" : "/")} fullWidth>
                {user ? "Go to your workspace" : "Go home"}
              </Button>
            </>
          ) : !preview ? (
            <Spinner className="mx-auto text-primary" />
          ) : status === "success" ? (
            <>
              <h1 className="text-xl font-bold text-text mb-2">You&apos;re in!</h1>
              <p className="text-sm text-text-muted">Welcome to {preview.workspace_name}. Taking you there…</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-text mb-2">Join {preview.workspace_name}?</h1>
              <p className="text-sm text-text-muted mb-6">
                {preview.invited_by ? `${preview.invited_by} invited you to collaborate` : "You've been invited to collaborate"}
                {" "}({preview.member_count} member{preview.member_count === 1 ? "" : "s"}).
              </p>

              {status === "error" && <Alert variant="danger" className="mb-4 text-left">{errorMsg}</Alert>}

              {user ? (
                <div className="space-y-3">
                  {switching && (
                    <Alert variant="warning" className="text-left">
                      You&apos;re currently in <strong>{user.workspace?.name}</strong>. If teammates share it, the lists you
                      created there stay with them; if you&apos;re its only member, your lists come with you.
                    </Alert>
                  )}
                  <Button fullWidth onClick={accept} loading={status === "accepting"}>Join workspace</Button>
                  <Button fullWidth variant="ghost" onClick={() => navigate("/workspace/dashboard")}>No thanks</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button fullWidth onClick={() => remember("/signup")} className="gap-2"><UserPlus size={15} /> Create an account to join</Button>
                  <Button fullWidth variant="outline" onClick={() => remember("/?login=1")} className="gap-2"><LogIn size={15} /> I already have an account</Button>
                  <p className="text-xs text-text-muted">You&apos;ll be asked to confirm after signing in.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

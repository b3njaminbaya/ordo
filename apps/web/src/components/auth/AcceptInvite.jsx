import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserPlus, LogIn, CheckCircle } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { Button, Spinner, Alert } from "../ui";

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | accepting | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const accept = async () => {
    setStatus("accepting");
    try {
      await api.post(`/invite/accept/${token}`);
      // Refresh session so user context reflects the new workspace_id
      const session = await api.get("/session/");
      setUser(session.data.user);
      setStatus("success");
      setTimeout(() => navigate("/workspace/dashboard"), 1800);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.response?.data?.error || "Failed to accept invite. The link may have expired.");
    }
  };

  // Logged-in users: auto-accept immediately
  useEffect(() => {
    if (user && status === "idle") {
      accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const goLogin = () => {
    sessionStorage.setItem("pendingInviteToken", token);
    navigate("/");          // opens login modal from landing page
  };

  const goSignup = () => {
    sessionStorage.setItem("pendingInviteToken", token);
    navigate("/signup");
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-card border border-border p-8 text-center">

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            {status === "success"
              ? <CheckCircle size={28} className="text-success" />
              : <UserPlus size={28} className="text-primary" />
            }
          </div>

          {/* Content by state */}
          {status === "accepting" && (
            <>
              <h1 className="text-xl font-bold text-text mb-2">Joining workspace…</h1>
              <Spinner className="mx-auto mt-4" />
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-xl font-bold text-text mb-2">You&apos;re in!</h1>
              <p className="text-sm text-text-muted">Redirecting you to the workspace…</p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-xl font-bold text-text mb-4">Invite link invalid</h1>
              <Alert variant="danger">{errorMsg}</Alert>
              <Button variant="outline" onClick={() => navigate("/")} className="mt-5">
                Back to home
              </Button>
            </>
          )}

          {status === "idle" && !user && (
            <>
              <h1 className="text-xl font-bold text-text mb-2">You&apos;ve been invited!</h1>
              <p className="text-sm text-text-muted mb-7">
                Log in or create an account to join the workspace.
              </p>
              <div className="flex flex-col gap-3">
                <Button fullWidth onClick={goLogin} className="flex items-center justify-center gap-2">
                  <LogIn size={15} /> Log in to accept
                </Button>
                <Button fullWidth variant="outline" onClick={goSignup} className="flex items-center justify-center gap-2">
                  <UserPlus size={15} /> Sign up to accept
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

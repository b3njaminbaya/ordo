import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { errorMessage } from "../api/errors";
import { Button, Spinner } from "../components/ui";

const AuthContext = createContext(null);

function storeTokens(data) {
  if (data.access_token) localStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const navigate = useNavigate();

  const checkSession = useCallback(async () => {
    setUnreachable(false);
    setLoading(true);
    if (!localStorage.getItem("access_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get("/session");
      setUser(response.data.user);
    } catch (err) {
      if (err.response) {
        // The server answered and said we're not signed in.
        clearTokens();
        setUser(null);
      } else {
        // Server asleep / offline: keep the tokens and let the person retry.
        setUnreachable(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  /** Re-read the signed-in user (after changing workspace, for example). */
  const refreshUser = useCallback(async () => {
    const response = await api.get("/session");
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const completeSignIn = (data) => {
    storeTokens(data);
    setUser(data.user);
    // An invite link opened before signing in is confirmed on its own page — we never
    // move someone into another workspace without asking.
    const pending = sessionStorage.getItem("pendingInviteToken");
    if (pending) {
      sessionStorage.removeItem("pendingInviteToken");
      navigate(`/invite/${pending}`);
    } else {
      navigate("/workspace/dashboard");
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post("/register", userData);
      completeSignIn(response.data);
      return { success: true };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Registration failed") };
    }
  };

  const login = async (credentials) => {
    try {
      const response = await api.post("/login", credentials);
      completeSignIn(response.data);
      return { success: true };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Login failed") };
    }
  };

  const logout = async () => {
    try {
      await api.delete("/logout", { data: { refresh_token: localStorage.getItem("refresh_token") } });
    } catch {
      // Token may already be expired — still clear local state
    } finally {
      clearTokens();
      setUser(null);
      navigate("/");
    }
  };

  /** Called after a password change, which signs out every other session. */
  const replaceTokens = (data) => storeTokens(data);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-primary" aria-busy="true">
        <Spinner size="lg" />
      </div>
    );
  }

  if (unreachable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold text-text">Can&apos;t reach the server</h1>
          <p className="text-sm text-text-muted">
            It may be starting up or your connection dropped. You&apos;re still signed in — try again in a moment.
          </p>
          <Button onClick={checkSession}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser, register, login, logout, replaceTokens, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

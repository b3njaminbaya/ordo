import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) throw new Error("No token");

        const response = await api.get("/session/");
        setUser(response.data.user);
      } catch {
        localStorage.removeItem("access_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const _acceptPendingInvite = async () => {
    const token = sessionStorage.getItem("pendingInviteToken");
    if (!token) return;
    sessionStorage.removeItem("pendingInviteToken");
    try {
      await api.post(`/invite/accept/${token}`);
    } catch {
      // Non-fatal — user still lands in workspace; invite may have already been used
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post("/register/", userData);
      localStorage.setItem("access_token", response.data.access_token);
      if (response.data.refresh_token) {
        localStorage.setItem("refresh_token", response.data.refresh_token);
      }
      setUser(response.data.user);
      await _acceptPendingInvite();
      navigate(`/workspace/${response.data.user.workspace_id}`);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.error || "Registration failed" };
    }
  };

  const login = async (credentials) => {
    try {
      const response = await api.post("/login/", credentials);
      localStorage.setItem("access_token", response.data.access_token);
      if (response.data.refresh_token) {
        localStorage.setItem("refresh_token", response.data.refresh_token);
      }
      setUser(response.data.user);
      await _acceptPendingInvite();
      navigate(`/workspace/${response.data.user.workspace_id}`);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.error || "Login failed" };
    }
  };

  const logout = async () => {
    try {
      await api.delete("/logout/");
    } catch {
      // Token may already be expired — still clear local state
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      navigate("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, register, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

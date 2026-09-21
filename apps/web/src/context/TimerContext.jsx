import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { socket } from "../socket";

const TimerContext = createContext(null);

/** The running timer, shared so the sidebar can show it on every page. */
export function TimerProvider({ children }) {
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get("/time-entries/active")
      .then((res) => { if (!cancelled) setActiveTimer(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Other tabs / devices of the same user.
  useEffect(() => {
    const onStarted = (entry) => setActiveTimer(entry);
    const onStopped = () => setActiveTimer(null);
    socket.on("timer_started", onStarted);
    socket.on("timer_stopped", onStopped);
    return () => {
      socket.off("timer_started", onStarted);
      socket.off("timer_stopped", onStopped);
    };
  }, []);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return undefined; }
    const started = new Date(activeTimer.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  return (
    <TimerContext.Provider value={{ activeTimer, setActiveTimer, elapsed }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}

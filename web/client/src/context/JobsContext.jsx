import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { ACTIVE, STATUS } from "../lib/constants.js";
import { useToast } from "./ToastContext.jsx";

const JobsContext = createContext(null);

/**
 * Polls the job list (newest 200, without results) and shares it app-wide.
 * Fast polling only while something is queued/running. Announces jobs that
 * finish while the app is open.
 */
export function JobsProvider({ children }) {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Jobs that finished while the app was open, newest first; shown by the bell.
  const [notices, setNotices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("notices") ?? "[]");
    } catch {
      return [];
    }
  });
  const known = useRef(new Map()); // id -> last seen status
  const timer = useRef();

  const refresh = useCallback(async () => {
    clearTimeout(timer.current);
    let list = null;
    try {
      ({ jobs: list } = await api("/jobs?limit=200"));
      const first = known.current.size === 0;
      for (const j of list) {
        const prev = known.current.get(j.id);
        if (!first && prev && ACTIVE.has(prev) && !ACTIVE.has(j.status)) {
          toast(`${STATUS[j.status]}: ${j.title}`, { kind: j.status === "failed" ? "error" : "info", to: `/jobs/${j.id}` });
          setNotices((n) => [{ id: j.id, type: j.type, title: j.title, status: j.status, at: new Date().toISOString(), read: false }, ...n.filter((x) => x.id !== j.id)].slice(0, 20));
        }
        known.current.set(j.id, j.status);
      }
      setJobs(list);
      setLoaded(true);
    } catch {
      /* transient; retry on the next tick */
    }
    const active = list?.some((j) => ACTIVE.has(j.status));
    timer.current = setTimeout(refresh, active ? 2500 : 15000);
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem("notices", JSON.stringify(notices));
    } catch {
      /* private mode: notices just won't survive a reload */
    }
  }, [notices]);

  const markRead = useCallback(() => setNotices((n) => n.map((x) => ({ ...x, read: true }))), []);
  const clearNotices = useCallback(() => setNotices([]), []);

  useEffect(() => {
    refresh();
    return () => clearTimeout(timer.current);
  }, [refresh]);

  /** Register a job the user just created so its completion is announced, then poll now. */
  const track = useCallback(
    (job) => {
      known.current.set(job.id, job.status);
      refresh();
    },
    [refresh],
  );

  return <JobsContext.Provider value={{ jobs, loaded, refresh, track, notices, markRead, clearNotices }}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  return useContext(JobsContext);
}

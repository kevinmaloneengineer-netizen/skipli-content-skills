import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { ACTIVE, STATUS } from "../lib/constants.js";
import { useToast } from "./ToastContext.jsx";
import { useAuth } from "../components/AuthGate.jsx";

const JobsContext = createContext(null);

/** System notification when a job ends while the tab is in the background (permission asked on the first run). */
function notifyBrowser(job) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const n = new Notification(job.status === "done" ? "Kết quả đã xong ✅" : `${STATUS[job.status]}`, { body: job.title, icon: "/assistant/happy.png", tag: job.id });
    n.onclick = () => {
      window.focus();
      window.location.assign(`/jobs/${job.id}`);
      n.close();
    };
  } catch {
    // some mobile browsers only allow notifications from a service worker
  }
}

/** Ask once, right after the user starts a job (browsers require a user action). */
export function askNotifyPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}

/**
 * Polls the job list (newest 200, without results) and shares it app-wide.
 * Fast polling only while something is queued/running. Announces jobs that
 * finish while the app is open.
 */
export function JobsProvider({ children }) {
  const toast = useToast();
  const { user } = useAuth();
  const noticeKey = user ? `notices:${user.id}` : "notices"; // one bell per account on a shared browser
  const [jobs, setJobs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Jobs that finished while the app was open, newest first; shown by the bell.
  const [notices, setNotices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(noticeKey) ?? "[]");
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
          notifyBrowser(j);
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
      localStorage.setItem(noticeKey, JSON.stringify(notices));
    } catch {
      /* private mode: notices just won't survive a reload */
    }
  }, [notices, noticeKey]);

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

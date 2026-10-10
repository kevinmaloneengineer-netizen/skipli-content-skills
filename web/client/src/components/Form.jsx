import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { askNotifyPermission, useJobs } from "../context/JobsContext.jsx";
import { api } from "../lib/api.js";

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Pill-style radio group. */
export function Segmented({ name, options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {Object.entries(options).map(([v, text]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}

/** Submit button row with the expected duration next to it. */
export function SubmitRow({ busy, label, eta }) {
  return (
    <div className="submit-row">
      <button className="btn primary big" type="submit" disabled={busy}>
        {busy ? "Đang gửi…" : label}
        <span aria-hidden="true">→</span>
      </button>
      {eta && <span className="submit-eta">Mất khoảng {eta}</span>}
    </div>
  );
}

/** Submit a job, then open its detail page. Returns [submit, busy, error]. */
export function useSubmitJob(type) {
  const navigate = useNavigate();
  const { track } = useJobs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(input) {
    setBusy(true);
    setError("");
    try {
      askNotifyPermission(); // inside the click: browsers block the prompt otherwise
      const { job } = await api("/jobs", { method: "POST", body: { type, input } });
      track(job);
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return [submit, busy, error];
}

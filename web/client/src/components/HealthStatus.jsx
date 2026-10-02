import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const TEXT = {
  checking: "Đang kiểm tra…",
  ok: "Đã kết nối",
  mock: "Chế độ demo",
  down: "GoClaw mất kết nối",
  offline: "Mất kết nối máy chủ",
};

const TITLE = {
  ok: "GoClaw đang chạy, kết quả là thật.",
  mock: "Chế độ demo (GOCLAW_MOCK=1): kết quả là dữ liệu mẫu, không gọi AI.",
};

export default function HealthStatus() {
  const [state, setState] = useState("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const { goclaw } = await api("/health");
        if (!alive) return;
        setState(goclaw.mock ? "mock" : goclaw.ok ? "ok" : "down");
        setDetail(goclaw.ok ? "" : goclaw.error ?? `HTTP ${goclaw.status}`);
      } catch {
        if (alive) setState("offline");
      }
    }
    check();
    const t = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span className="status" data-state={state} role="status" title={TITLE[state] ?? detail}>
      <span className="dot" />
      {TEXT[state]}
    </span>
  );
}

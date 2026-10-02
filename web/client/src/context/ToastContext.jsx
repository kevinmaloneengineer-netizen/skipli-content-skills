import { createContext, useCallback, useContext, useState } from "react";
import { Link } from "react-router-dom";
import { copyText } from "../lib/text.js";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, { kind = "info", to } = {}) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, message, kind, to }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-kind={t.kind}>
            {t.message}
            {t.to && <>{" "}<Link to={t.to}>Xem →</Link></>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Copy to clipboard and report the outcome as a toast. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text) => {
      const ok = await copyText(text);
      toast(ok ? "Đã sao chép" : "Trình duyệt chặn sao chép. Hãy bôi đen rồi bấm Ctrl+C.", { kind: ok ? "info" : "error" });
    },
    [toast],
  );
}

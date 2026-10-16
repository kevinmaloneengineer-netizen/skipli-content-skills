import { useEffect, useRef } from "react";

/** A small modal question in the app's own style, in place of window.confirm. Mount it only while it is asked. */
export default function ConfirmDialog({ title, body, okLabel, onOk, onClose, cancelLabel = "Giữ lại", okClass = "danger" }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="confirm-body">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="confirm-actions">
          <button type="button" className="btn small ghost" onClick={() => ref.current.close()}>{cancelLabel}</button>
          <button type="button" className={`btn small ${okClass}`} onClick={() => { ref.current.close(); onOk(); }}>{okLabel}</button>
        </div>
      </div>
    </dialog>
  );
}

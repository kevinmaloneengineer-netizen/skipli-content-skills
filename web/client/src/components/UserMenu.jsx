import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { logout, useAuth } from "./AuthGate.jsx";

/** Signed-in customer (ACCOUNTS=1): initials button with account links. */
export default function UserMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!user) return null;
  const label = user.name || user.email;
  const initials = label.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-chip" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} title={user.email}>
        <span className="user-avatar" aria-hidden="true">{initials}</span>
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-head">
            <b>{label}</b>
            <small>{user.email}{user.role === "admin" ? " · Quản trị" : ""}</small>
          </div>
          {user.role === "admin" && <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>Quản lý tài khoản</Link>}
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)}>Đổi mật khẩu</Link>
          <button type="button" role="menuitem" onClick={logout}>Đăng xuất</button>
        </div>
      )}
    </div>
  );
}

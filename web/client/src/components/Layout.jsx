import { Link, NavLink, Outlet } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { ACTIVE } from "../lib/constants.js";
import { useParallax } from "../lib/motion.js";
import Backdrop from "./Backdrop.jsx";
import HealthStatus from "./HealthStatus.jsx";

export default function Layout() {
  const { jobs } = useJobs();
  const running = jobs.filter((j) => ACTIVE.has(j.status)).length;
  useParallax();

  return (
    <div className="app">
      <Backdrop />
      <header className="topbar">
        <Link className="brand" to="/">
          <img className="brand-logo" src="/logo.jpg" alt="" width="32" height="32" />
          <span>
            Skipli <em>Content</em>
          </span>
        </Link>
        <nav className="topnav" aria-label="Điều hướng">
          {running > 0 && (
            <Link className="running-pill" to="/history">
              <span className="pulse" aria-hidden="true" />
              {running} đang chạy
            </Link>
          )}
          <NavLink to="/history">Lịch sử</NavLink>
          <NavLink to="/library">Thư viện</NavLink>
          <HealthStatus />
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

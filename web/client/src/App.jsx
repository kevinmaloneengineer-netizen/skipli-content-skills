import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { JobsProvider } from "./context/JobsContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import FbScanPage from "./pages/FbScanPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import JobPage from "./pages/JobPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ThreadsPage from "./pages/ThreadsPage.jsx";
import WritePage from "./pages/WritePage.jsx";

/** Remount the writer when its query (?ref, ?template) changes so the form re-prefills. */
function WriteRoute() {
  const { search } = useLocation();
  return <WritePage key={search} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <JobsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="fb" element={<FbScanPage />} />
              <Route path="threads" element={<ThreadsPage />} />
              <Route path="write" element={<WriteRoute />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="jobs/:id" element={<JobPage />} />
              <Route path="skills/:id" element={<ComingSoonPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </JobsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

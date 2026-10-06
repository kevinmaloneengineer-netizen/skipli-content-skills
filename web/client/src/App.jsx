import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { JobsProvider } from "./context/JobsContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ClonePage from "./pages/ClonePage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import FanpagePage from "./pages/FanpagePage.jsx";
import FbScanPage from "./pages/FbScanPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ImagePage from "./pages/ImagePage.jsx";
import JobPage from "./pages/JobPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import LivestreamPage from "./pages/LivestreamPage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import ThreadsPage from "./pages/ThreadsPage.jsx";
import VideoPage from "./pages/VideoPage.jsx";
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
              <Route path="clone" element={<ClonePage />} />
              <Route path="video" element={<VideoPage />} />
              <Route path="fanpage" element={<FanpagePage />} />
              <Route path="livestream" element={<LivestreamPage />} />
              <Route path="image" element={<ImagePage />} />
              <Route path="schedule" element={<SchedulePage />} />
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

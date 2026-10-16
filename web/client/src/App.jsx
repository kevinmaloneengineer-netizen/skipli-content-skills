import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AuthGate, { LoginPage, RequireAuth } from "./components/AuthGate.jsx";
import SamplePage from "./pages/SamplePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import BillingPage from "./pages/BillingPage.jsx";
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
import HashtagPage from "./pages/HashtagPage.jsx";
import CutReelsPage from "./pages/CutReelsPage.jsx";
import LiveRecapPage from "./pages/LiveRecapPage.jsx";
import DubPage from "./pages/DubPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import TextSkillPage from "./pages/TextSkillPage.jsx";
import { TEXT_SKILLS } from "./lib/textSkills.js";
import InboxPage from "./pages/InboxPage.jsx";
import MapsPage from "./pages/MapsPage.jsx";
import YelpPage from "./pages/YelpPage.jsx";
import InstagramPage from "./pages/InstagramPage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import TiktokPage from "./pages/TiktokPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";
import CampaignPage from "./pages/CampaignPage.jsx";

/** Remount the writer when its query (?ref, ?template) changes so the form re-prefills. */
function WriteRoute() {
  const { search } = useLocation();
  return <WritePage key={search} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <ToastProvider>
        <JobsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="samples/:type" element={<SamplePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route element={<RequireAuth />}>
                <Route path="fb" element={<FbScanPage />} />
                <Route path="threads" element={<ThreadsPage />} />
                <Route path="write" element={<WriteRoute />} />
                <Route path="clone" element={<ClonePage />} />
                <Route path="video" element={<VideoPage />} />
                <Route path="fanpage" element={<FanpagePage />} />
                <Route path="livestream" element={<LivestreamPage />} />
                <Route path="image" element={<ImagePage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="tiktok" element={<TiktokPage />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="campaign" element={<CampaignPage />} />
                <Route path="maps" element={<MapsPage />} />
                <Route path="yelp" element={<YelpPage />} />
                <Route path="instagram" element={<InstagramPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="hashtag" element={<HashtagPage />} />
                <Route path="cut-reels" element={<CutReelsPage />} />
                <Route path="live-recap" element={<LiveRecapPage />} />
                <Route path="dub" element={<DubPage />} />
                <Route path="post-score" element={<TextSkillPage config={TEXT_SKILLS["post-score"]} />} />
                <Route path="dish-riddle" element={<TextSkillPage config={TEXT_SKILLS["dish-riddle"]} />} />
                <Route path="story-behind" element={<TextSkillPage config={TEXT_SKILLS["story-behind"]} />} />
                <Route path="weather-post" element={<TextSkillPage config={TEXT_SKILLS["weather-post"]} />} />
                <Route path="skills/tiktok" element={<Navigate to="/tiktok" replace />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="jobs/:id" element={<JobPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="skills/:id" element={<ComingSoonPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </JobsProvider>
      </ToastProvider>
      </AuthGate>
    </BrowserRouter>
  );
}

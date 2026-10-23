import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AuthGate, { LoginPage, RequireAuth } from "./components/AuthGate.jsx";
import { JobsProvider } from "./context/JobsContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import HomePage from "./pages/HomePage.jsx";
import { TEXT_SKILLS } from "./lib/textSkills.js";

// Every page but the home page loads on first visit (smaller first download); Layout shows a placeholder meanwhile.
const SamplePage = lazy(() => import("./pages/SamplePage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const AccountPage = lazy(() => import("./pages/AccountPage.jsx"));
const BillingPage = lazy(() => import("./pages/BillingPage.jsx"));
const ClonePage = lazy(() => import("./pages/ClonePage.jsx"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage.jsx"));
const FanpagePage = lazy(() => import("./pages/FanpagePage.jsx"));
const FbScanPage = lazy(() => import("./pages/FbScanPage.jsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.jsx"));
const ImagePage = lazy(() => import("./pages/ImagePage.jsx"));
const JobPage = lazy(() => import("./pages/JobPage.jsx"));
const LibraryPage = lazy(() => import("./pages/LibraryPage.jsx"));
const LivestreamPage = lazy(() => import("./pages/LivestreamPage.jsx"));
const SchedulePage = lazy(() => import("./pages/SchedulePage.jsx"));
const ThreadsPage = lazy(() => import("./pages/ThreadsPage.jsx"));
const VideoPage = lazy(() => import("./pages/VideoPage.jsx"));
const WritePage = lazy(() => import("./pages/WritePage.jsx"));
const HashtagPage = lazy(() => import("./pages/HashtagPage.jsx"));
const CutReelsPage = lazy(() => import("./pages/CutReelsPage.jsx"));
const LiveRecapPage = lazy(() => import("./pages/LiveRecapPage.jsx"));
const DubPage = lazy(() => import("./pages/DubPage.jsx"));
const CombosPage = lazy(() => import("./pages/CombosPage.jsx"));
const QrPage = lazy(() => import("./pages/QrPage.jsx"));
const MenuBoardPage = lazy(() => import("./pages/MenuBoardPage.jsx"));
const BannerPage = lazy(() => import("./pages/BannerPage.jsx"));
const SalesPage = lazy(() => import("./pages/SalesPage.jsx"));
const PublicMenuPage = lazy(() => import("./pages/PublicMenuPage.jsx"));
const PhotoFixPage = lazy(() => import("./pages/PhotoFixPage.jsx"));
const LegalPage = lazy(() => import("./pages/LegalPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TextSkillPage = lazy(() => import("./pages/TextSkillPage.jsx"));
const InboxPage = lazy(() => import("./pages/InboxPage.jsx"));
const MapsPage = lazy(() => import("./pages/MapsPage.jsx"));
const YelpPage = lazy(() => import("./pages/YelpPage.jsx"));
const InstagramPage = lazy(() => import("./pages/InstagramPage.jsx"));
const MenuPage = lazy(() => import("./pages/MenuPage.jsx"));
const ReviewPage = lazy(() => import("./pages/ReviewPage.jsx"));
const TiktokPage = lazy(() => import("./pages/TiktokPage.jsx"));
const ComparePage = lazy(() => import("./pages/ComparePage.jsx"));
const CampaignPage = lazy(() => import("./pages/CampaignPage.jsx"));

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
            {/* The online menu guests open from a table QR: no navbar, no login. */}
            <Route path="m/:id" element={<Suspense fallback={null}><PublicMenuPage /></Suspense>} />
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="samples/:type" element={<SamplePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="terms" element={<LegalPage kind="terms" />} />
              <Route path="privacy" element={<LegalPage kind="privacy" />} />
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
                <Route path="gbp-post" element={<TextSkillPage config={TEXT_SKILLS["gbp-post"]} />} />
                <Route path="zalo-message" element={<TextSkillPage config={TEXT_SKILLS["zalo-message"]} />} />
                <Route path="sales-insight" element={<SalesPage />} />
                <Route path="delivery-menu" element={<TextSkillPage config={TEXT_SKILLS["delivery-menu"]} />} />
                <Route path="us-occasions" element={<TextSkillPage config={TEXT_SKILLS["us-occasions"]} />} />
                <Route path="nextdoor-post" element={<TextSkillPage config={TEXT_SKILLS["nextdoor-post"]} />} />
                <Route path="nearby" element={<TextSkillPage config={TEXT_SKILLS.nearby} />} />
                <Route path="review-compare" element={<TextSkillPage config={TEXT_SKILLS["review-compare"]} />} />
                <Route path="trends" element={<TextSkillPage config={TEXT_SKILLS.trends} />} />
                <Route path="promo-plan" element={<TextSkillPage config={TEXT_SKILLS["promo-plan"]} />} />
                <Route path="photo-fix" element={<PhotoFixPage />} />
                <Route path="qr" element={<QrPage />} />
                <Route path="menu-board" element={<MenuBoardPage />} />
                <Route path="banner" element={<BannerPage />} />
                <Route path="combos" element={<CombosPage />} />
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

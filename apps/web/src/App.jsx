import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import WorkspaceLayout from "./components/workspace/WorkspaceLayout.jsx";
import Navbar from "./components/common/Navbar.jsx";
import Footer from "./components/common/Footer.jsx";
import ScrollToTop from "./components/common/ScrollToTop.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import Signup from "./components/auth/Signup.jsx";
import LoginModal from "./components/auth/LoginModal.jsx";
import ForgotPassword from "./components/auth/ForgotPassword.jsx";
import ResetPassword from "./components/auth/ResetPassword.jsx";
import AcceptInvite from "./components/auth/AcceptInvite.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import TermsAndConditions from "./pages/TermsAndConditions.jsx";
import CookiesPolicy from "./pages/CookiesPolicy.jsx";
import Accessibility from "./pages/Accessibility.jsx";

const PAGE_TITLES = {
  "/":                       "Home",
  "/signup":                 "Try Free",
  "/forgot-password":        "Forgot Password",
  "/terms-and-conditions":   "Terms & Conditions",
  "/privacy-policy":         "Privacy Policy",
  "/cookies-policy":         "Cookies Policy",
  "/accessibility":          "Accessibility",
  "/workspace/dashboard":    "Dashboard",
  "/workspace/tasks-list":   "Task Lists",
  "/workspace/kanban":       "Kanban",
  "/workspace/calendar":     "Calendar",
  "/workspace/recurring":    "Recurring Tasks",
  "/workspace/time":         "Time Tracking",
  "/workspace/notifications":"Notifications",
  "/workspace/shareboard":   "Share Board",
  "/workspace/profile":      "Profile",
  "/workspace/settings":     "Settings",
};

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname];
    document.title = title ? `${title} | Ordo` : "Ordo";
  }, [location.pathname]);

  // "?login=1" (used by the invite page) opens the sign-in dialog.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("login") === "1") setIsLoginModalOpen(true);
  }, [location.search]);

  return (
    <MainLayout
      isLoginModalOpen={isLoginModalOpen}
      setIsLoginModalOpen={setIsLoginModalOpen}
    />
  );
}

function MainLayout({ isLoginModalOpen, setIsLoginModalOpen }) {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith("/workspace");

  return (
    <div className="flex flex-col min-h-screen bg-page">
      <ScrollToTop />
      {!isWorkspace && <Navbar onLogin={() => setIsLoginModalOpen(true)} />}

      <main className="flex-1">
        <Routes>
          <Route path="/"                       element={<LandingPage />} />
          <Route path="/signup"                 element={<Signup />} />
          <Route path="/forgot-password"        element={<ForgotPassword />} />
          <Route path="/reset-password/:token"  element={<ResetPassword />} />
          <Route path="/invite/:token"          element={<AcceptInvite />} />
          <Route path="/terms-and-conditions"   element={<TermsAndConditions />} />
          <Route path="/privacy-policy"         element={<PrivacyPolicy />} />
          <Route path="/cookies-policy"         element={<CookiesPolicy />} />
          <Route path="/accessibility"          element={<Accessibility />} />
          <Route path="/workspace/*"            element={<WorkspaceLayout />} />
          <Route path="*"                       element={<NotFound />} />
        </Routes>
      </main>

      {!isWorkspace && <Footer />}

      {isLoginModalOpen && (
        <LoginModal onClose={() => setIsLoginModalOpen(false)} />
      )}
    </div>
  );
}

export default App;

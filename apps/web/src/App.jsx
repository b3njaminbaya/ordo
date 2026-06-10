import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import WorkspaceLayout from "./components/workspace/WorkspaceLayout.jsx";
import Navbar from "./components/common/Navbar.jsx";
import Footer from "./components/common/Footer.jsx";
import ScrollToTop from "./components/common/ScrollToTop.jsx";
import CookieBanner from "./components/common/CookieBanner.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import Signup from "./components/auth/Signup.jsx";
import LoginModal from "./components/auth/LoginModal.jsx";
import ForgotPassword from "./components/auth/ForgotPassword.jsx";
import ResetPassword from "./components/auth/ResetPassword.jsx";
import VerifyEmail from "./components/auth/VerifyEmail.jsx";
import AcceptInvite from "./components/auth/AcceptInvite.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import TermsAndConditions from "./pages/TermsAndConditions.jsx";
import Accessibility from "./pages/Accessibility.jsx";
import CookiesPolicy from "./pages/CookiesPolicy.jsx";

const PAGE_TITLES = {
  "/": "Home",
  "/signup": "Sign Up",
  "/forgot-password": "Forgot Password",
  "/privacy-policy": "Privacy Policy",
  "/terms-and-conditions": "Terms & Conditions",
  "/accessibility": "Accessibility",
  "/cookies-policy": "Cookies Policy",
};

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] ?? "Taskly";
    document.title = `Taskly | ${title}`;
  }, [location.pathname]);

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
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />
          <Route path="/workspace/*" element={<WorkspaceLayout />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isWorkspace && <Footer />}
      {!isWorkspace && <CookieBanner />}

      {isLoginModalOpen && (
        <LoginModal onClose={() => setIsLoginModalOpen(false)} />
      )}
    </div>
  );
}

export default App;

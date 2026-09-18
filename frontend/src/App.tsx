import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ClipFlowHome from './pages/ClipFlowHome';
import ClipFlowEditor from './pages/ClipFlowEditor';
import ClipFlowStudio from './pages/ClipFlowStudio';
import LoginPage from './pages/LoginPage';
import LogoutPage from './pages/LogoutPage';
import CloudStoragePage from './pages/CloudStoragePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <main className="min-h-screen bg-black text-[#f8fafc]">
          <Routes>
            {/* Main Hub: Landing page */}
            <Route path="/" element={<ClipFlowHome />} />
            <Route path="/dashboard" element={<ClipFlowHome />} />

            {/* Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signin" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />
            <Route path="/auth" element={<LoginPage />} />
            <Route path="/forgot-password" element={<LoginPage />} />
            <Route path="/forgot" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* Dedicated Cloud Storage Tab */}
            <Route path="/storage" element={<CloudStoragePage />} />
            <Route path="/editor/storage" element={<CloudStoragePage />} />
            <Route path="/cloud-storage" element={<CloudStoragePage />} />

            {/* Dedicated Settings Tab */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/editor/settings" element={<SettingsPage />} />

            {/* Dedicated Editor & Studio Tabs */}
            <Route path="/editor" element={<ClipFlowEditor />} />
            <Route path="/editor/studio" element={<ClipFlowEditor />} />
            <Route path="/video/*" element={<ClipFlowEditor />} />
            <Route path="/clip" element={<ClipFlowEditor />} />

            {/* Studio Suite */}
            <Route path="/studio" element={<ClipFlowStudio />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

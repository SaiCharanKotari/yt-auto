import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VideoPage from './pages/VideoPage';
import DashboardPage from './pages/DashboardPage';
import Overview from './pages/dashboard/Overview';
import Accounts from './pages/dashboard/Accounts';
import ClipFlow from './pages/dashboard/ClipFlow';

function App() {
  return (
    <BrowserRouter>
      <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/dashboard" element={<DashboardPage />}>
            <Route index element={<Overview />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="clip-flow" element={<ClipFlow />} />
            {/* Fallback for Settings for now */}
            <Route path="settings" element={<div className="text-white p-8">Settings Page Coming Soon</div>} />
          </Route>
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;

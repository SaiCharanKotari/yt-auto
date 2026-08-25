import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClipFlowHome from './pages/ClipFlowHome';
import ClipFlowEditor from './pages/ClipFlowEditor';

function App() {
  return (
    <BrowserRouter>
      <main className="min-h-screen bg-[#090d16] text-[#f8fafc]">
        <Routes>
          {/* Main Hub: Landing page where entering links opens editor in a new tab */}
          <Route path="/" element={<ClipFlowHome />} />
          <Route path="/dashboard" element={<ClipFlowHome />} />
          
          {/* Dedicated Editor Tab */}
          <Route path="/editor" element={<ClipFlowEditor />} />
          <Route path="/video/*" element={<ClipFlowEditor />} />
          <Route path="/clip" element={<ClipFlowEditor />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;

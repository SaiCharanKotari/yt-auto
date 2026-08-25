import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClipFlowStudio from './pages/ClipFlowStudio';

function App() {
  return (
    <BrowserRouter>
      <main className="min-h-screen bg-[#090d16] text-[#f8fafc]">
        <Routes>
          <Route path="/" element={<ClipFlowStudio />} />
          <Route path="/dashboard" element={<ClipFlowStudio />} />
          <Route path="/dashboard/*" element={<ClipFlowStudio />} />
          <Route path="/video/*" element={<ClipFlowStudio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import StudentDashboard from './pages/StudentDashboard'
import LecturerDashboard from './pages/LecturerDashboard'
import ProjectView from './pages/ProjectView'
import ChatPage from './pages/ChatPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/lecturer" element={<LecturerDashboard />} />
        <Route path="/project/:id" element={<ProjectView />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

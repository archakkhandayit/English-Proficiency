import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CandidateRoute, AdminRoute, GuestRoute } from './components/ProtectedRoute';

// Candidate Pages
import { CandidateLogin } from './pages/candidate/Login';
import { CandidateRegister } from './pages/candidate/Register';
import { CandidateDashboard } from './pages/candidate/Dashboard';
import { ExamInstructions } from './pages/candidate/ExamInstructions';
import { Section1 } from './pages/candidate/Section1';
import { Transition } from './pages/candidate/Transition';
import { Section2Read } from './pages/candidate/Section2Read';
import { Section2Recall } from './pages/candidate/Section2Recall';
import { Section3 } from './pages/candidate/Section3';
import { EvaluationWait } from './pages/candidate/EvaluationWait';
import { Results } from './pages/candidate/Results';

// Admin Pages
import { AdminLogin } from './pages/admin/Login';
import { ExamsList } from './pages/admin/ExamsList';
import { ExamEditor } from './pages/admin/ExamEditor';
import { AttemptsList } from './pages/admin/AttemptsList';
import { AttemptAudit } from './pages/admin/AttemptAudit';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Index Redirect */}
          <Route path="/" element={<Navigate to="/candidate/dashboard" replace />} />

          {/* Guest Routes (Login / Register) */}
          <Route element={<GuestRoute />}>
            <Route path="/candidate/login" element={<CandidateLogin />} />
            <Route path="/candidate/register" element={<CandidateRegister />} />
            <Route path="/admin/login" element={<AdminLogin />} />
          </Route>

          {/* Candidate Protected Routes */}
          <Route element={<CandidateRoute />}>
            <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
            <Route path="/candidate/exams/:id/instructions" element={<ExamInstructions />} />
            <Route path="/candidate/exams/:id/section1" element={<Section1 />} />
            <Route path="/candidate/exams/:id/transition" element={<Transition />} />
            <Route path="/candidate/exams/:id/section2/read" element={<Section2Read />} />
            <Route path="/candidate/exams/:id/section2/recall" element={<Section2Recall />} />
            <Route path="/candidate/exams/:id/section3" element={<Section3 />} />
            <Route path="/candidate/exams/:id/wait" element={<EvaluationWait />} />
            <Route path="/candidate/exams/:id/results" element={<Results />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Navigate to="/admin/exams" replace />} />
            <Route path="/admin/exams" element={<ExamsList />} />
            <Route path="/admin/exams/new" element={<ExamEditor />} />
            <Route path="/admin/exams/:id/edit" element={<ExamEditor />} />
            <Route path="/admin/attempts" element={<AttemptsList />} />
            <Route path="/admin/attempts/:id" element={<AttemptAudit />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/candidate/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

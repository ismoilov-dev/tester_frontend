import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import RequireAdmin from "./components/RequireAdmin";
import HomePage from "./pages/HomePage";
import ExamLayout from "./pages/admin/ExamLayout";
import ExamsPage from "./pages/admin/ExamsPage";
import LivePage from "./pages/admin/LivePage";
import LoginPage from "./pages/admin/LoginPage";
import ParticipantPage from "./pages/admin/ParticipantPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import ResultsPage from "./pages/admin/ResultsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import StudentFlow from "./pages/student/StudentFlow";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* /admin route'lari /:code dan OLDIN */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<ExamsPage />} />
        <Route path="exams/:id" element={<ExamLayout />}>
          <Route index element={<QuestionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="results" element={<ResultsPage />} />
        </Route>
        <Route path="participants/:pid" element={<ParticipantPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="/:code" element={<StudentFlow />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

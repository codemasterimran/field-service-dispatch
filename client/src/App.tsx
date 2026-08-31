import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';
import MyJobs from './pages/MyJobs';
import Alerts from './pages/Alerts';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'DISPATCHER'
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/my-jobs" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Root — redirect based on role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Dispatcher routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['DISPATCHER']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute allowedRoles={['DISPATCHER']}>
                <JobList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute allowedRoles={['DISPATCHER']}>
                <JobDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={['DISPATCHER']}>
                <Alerts />
              </ProtectedRoute>
            }
          />

          {/* Technician routes */}
          <Route
            path="/my-jobs"
            element={
              <ProtectedRoute allowedRoles={['TECHNICIAN']}>
                <MyJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-jobs/:id"
            element={
              <ProtectedRoute allowedRoles={['TECHNICIAN']}>
                <JobDetail />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

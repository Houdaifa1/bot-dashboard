import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './store/auth'
import { ToastProvider } from './store/toast'
import { Shell } from './components/layout/Shell'

// Pages — we'll fill these in one by one
import { LoginPage }       from './pages/Login'
import { DashboardPage }   from './pages/Dashboard'
import { ClinicPage }      from './pages/Clinic'
import { BotMessagesPage } from './pages/BotMessages'
import { SpecialtiesPage } from './pages/Specialties'
import { DoctorsPage }     from './pages/Doctors'
import { FaqsPage }        from './pages/Faqs'
import { AppointmentsPage} from './pages/Appointments'
import { HandoffPage }     from './pages/Handoff'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute><LoginPage /></PublicRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/clinic" element={
        <ProtectedRoute><ClinicPage /></ProtectedRoute>
      } />
      <Route path="/bot-messages" element={
        <ProtectedRoute><BotMessagesPage /></ProtectedRoute>
      } />
      <Route path="/specialties" element={
        <ProtectedRoute><SpecialtiesPage /></ProtectedRoute>
      } />
      <Route path="/doctors" element={
        <ProtectedRoute><DoctorsPage /></ProtectedRoute>
      } />
      <Route path="/faqs" element={
        <ProtectedRoute><FaqsPage /></ProtectedRoute>
      } />
      <Route path="/appointments" element={
        <ProtectedRoute><AppointmentsPage /></ProtectedRoute>
      } />
      <Route path="/handoff" element={
        <ProtectedRoute><HandoffPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
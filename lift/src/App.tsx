import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import { WorkoutProvider } from './hooks/useWorkoutSession'
import { Layout } from './components/layout/Layout'
import Login from './pages/Login'
import Log from './pages/Log'
import Program from './pages/Program'
// Recharts lives in these two; keep it out of the main bundle.
const Progress = lazy(() => import('./pages/Progress'))
const Library = lazy(() => import('./pages/Library'))

function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
      <span className="h-2 w-2 animate-pulse rotate-45 bg-gold" />
    </div>
  )
}

function RequireAuth({ authed, children }: { authed: boolean; children: ReactNode }) {
  return authed ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  const authed = !!session

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={authed ? <Navigate to="/log" replace /> : <Login />} />
        <Route
          element={
            <RequireAuth authed={authed}>
              <WorkoutProvider>
                <Layout />
              </WorkoutProvider>
            </RequireAuth>
          }
        >
          <Route path="/log" element={<Log />} />
          <Route path="/program" element={<Program />} />
          <Route path="/progress" element={<Suspense fallback={null}><Progress /></Suspense>} />
          <Route path="/library" element={<Suspense fallback={null}><Library /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to={authed ? '/log' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

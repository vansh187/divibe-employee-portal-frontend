import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { RouteErrorBoundary } from '@/components/errors/AppErrorFallback'
import NotFoundPage from '@/components/ui/NotFoundPage'
import AppShell from '@/layouts/AppShell'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import LeadsListPage from '@/features/leads/LeadsListPage'
import LeadDetailPage from '@/features/leads/LeadDetailPage'
import SiteVisitsListPage from '@/features/site-visits/SiteVisitsListPage'
import NewSiteVisitPage from '@/features/site-visits/NewSiteVisitPage'
import ProjectsPage from '@/features/properties/ProjectsPage'
import PropertyListPage from '@/features/properties/PropertyListPage'
import AttendancePage from '@/features/attendance/AttendancePage'
import DayOffCalendarPage from '@/features/day-off/DayOffCalendarPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'leads', element: <LeadsListPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'leads/:leadId', element: <LeadDetailPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'site-visits', element: <SiteVisitsListPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'site-visits/new', element: <NewSiteVisitPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'properties', element: <ProjectsPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'properties/:projectId', element: <PropertyListPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'attendance', element: <AttendancePage />, errorElement: <RouteErrorBoundary /> },
      { path: 'day-off', element: <DayOffCalendarPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'notifications', element: <NotificationsPage />, errorElement: <RouteErrorBoundary /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

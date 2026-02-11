import { Toaster } from "@/components/ui/toaster.tsx";
import { Toaster as Sonner } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TaskProvider } from "@/contexts/TaskContext.tsx";
import { ThemeProvider } from "@/contexts/ThemeContext.tsx";
import { AuthProvider } from "@/contexts/AuthContext.tsx";
import { MainLayout } from "@/components/layout/MainLayout.tsx";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute.tsx";
import Dashboard from "@/pages/Dashboard.tsx";
import Tasks from "@/pages/Tasks.tsx";
import TaskCreate from "@/pages/TaskCreate.tsx";
import TaskDetail from "@/pages/TaskDetail.tsx";
import CalendarPage from "@/pages/CalendarPage.tsx";
import Analytics from "@/pages/Analytics.tsx";
import Settings from "@/pages/Settings.tsx";
import Login from "@/pages/Login.tsx";
import Register from "@/pages/Register.tsx";
import ForgotPassword from "@/pages/ForgotPassword.tsx";
import NotFound from "@/pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TaskProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/tasks/create" element={<TaskCreate />} />
                  <Route path="/tasks/:id" element={<TaskDetail />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </TaskProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

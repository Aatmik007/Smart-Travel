import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Signup';
import PassengerDashboard from './pages/Dashboard/PassengerDashboard';
import DriverDashboard from './pages/Dashboard/DriverDashboard';
import AdminDashboard from './pages/Dashboard/AdminDashboard';
import TrackingMap from './pages/TrackingMap';
import RouteAssistant from './pages/RouteAssistant';

// Dashboard router wrapper based on user role
const DashboardHome = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-900">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-brand-500"></div>
          <div className="absolute text-brand-300 font-bold text-xs">JMove</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'driver':
      return <DriverDashboard />;
    case 'passenger':
    default:
      return <PassengerDashboard />;
  }
};

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-20">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-brand-900 text-slate-100 flex flex-col">
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-6">
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                <Route 
                  path="/track/:tripId" 
                  element={
                    <PrivateRoute>
                      <TrackingMap />
                    </PrivateRoute>
                  } 
                />
                
                <Route 
                  path="/ai-assistant" 
                  element={
                    <PrivateRoute>
                      <RouteAssistant />
                    </PrivateRoute>
                  } 
                />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

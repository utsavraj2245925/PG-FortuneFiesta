import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import LiveDraw from './pages/LiveDraw';
import GuestLive from './pages/GuestLive';
import GuestAdmin from './pages/GuestAdmin';
import ErrorBoundary from './components/ErrorBoundary';


function PrivateRoute({ children }) {
  const token = localStorage.getItem('pg_admin_token');
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  // Render Free-Tier Keep-Alive Heartbeat
  // Pings backend every 4 minutes to guarantee the free-tier service NEVER sleeps during the event
  useEffect(() => {
    const pingBackend = () => {
      fetch('/api/game/public-state').catch(() => {});
    };
    pingBackend();
    const interval = setInterval(pingBackend, 4 * 60 * 1000);
    const onVisibility = () => {
      if (!document.hidden) pingBackend();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="/live" element={<LiveDraw />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />
        <Route path="/guest-live" element={<GuestLive />} />
        <Route path="/admin/guests" element={<GuestAdmin />} /> 
      </Routes>
    </ErrorBoundary>
  );
}

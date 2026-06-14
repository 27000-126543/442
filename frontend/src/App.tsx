import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import { initSocket, disconnectSocket } from './socket';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Transport from './pages/Transport';
import Finance from './pages/Finance';
import Intelligence from './pages/Intelligence';
import Culture from './pages/Culture';
import Approvals from './pages/Approvals';
import Leaderboard from './pages/Leaderboard';
import Towers from './pages/Towers';
import Reports from './pages/Reports';
import Events from './pages/Events';
import Members from './pages/Members';

function App() {
  const { hydrate, token } = useAppStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      initSocket();
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [token]);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={token ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="transport" element={<Transport />} />
        <Route path="finance" element={<Finance />} />
        <Route path="intelligence" element={<Intelligence />} />
        <Route path="culture" element={<Culture />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="towers" element={<Towers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="events" element={<Events />} />
        <Route path="members" element={<Members />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

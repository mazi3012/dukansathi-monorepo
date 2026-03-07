import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import CustomerDetails from './pages/CustomerDetails';
import Landing from './pages/Landing';
import SystemSetup from './pages/SystemSetup';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Connections from './pages/Connections';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  // Ping backend to wake up Cloud Run instance (Cold Start Fix)
  useEffect(() => {
    try {
      const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
      const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
      fetch(`${API_URL}/health`).catch(() => { });
    } catch (e) { }
  }, []);

  return (
    <ChatProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ChatProvider>
  );
}

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SystemSetup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="sales" element={<Sales />} />
          <Route path="settings" element={<Settings />} />
          <Route path="connections" element={<Connections />} />
        </Route>
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

export default App;

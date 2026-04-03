import React, { useEffect, useState } from 'react';
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
import Forecast from './pages/Forecast';
import { ChatProvider } from './contexts/ChatContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { initSQLite } from './lib/sqlite';
import { syncEngine } from './lib/db/syncEngine';
import { registerSW } from 'virtual:pwa-register';
import Plans from './pages/Plans';

// Register PWA Service Worker
registerSW({ immediate: true });

function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    // Only show splash on first load
    const timer = setTimeout(() => setShowSplash(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Initial sync and network status listeners
    const init = async () => {
      try {
        await initSQLite();
        // Initial sync if online
        if (navigator.onLine) {
          syncEngine.syncAll();
        }
      } catch (e) {
        console.error("Failed to initialize local-first layer:", e);
      }
    };
    init();

    const handleOnline = () => {
      console.log("App back online, triggering sync...");
      syncEngine.syncAll();
    };

    window.addEventListener('online', handleOnline);

    // Ping backend to wake up Cloud Run instance (Cold Start Fix)
    try {
      const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
      const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
      fetch(`${API_URL}/health`).catch(() => { });
    } catch (e) { }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <SubscriptionProvider>
      <ChatProvider>
        {showSplash ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
        >
          <img src="/logo.svg" alt="Dukan Sathi Logo" className="w-32 h-32 drop-shadow-xl animate-bounce-slow" style={{ borderRadius: 32 }} />
        </motion.div>
      ) : (
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
        )}
      </ChatProvider>
    </SubscriptionProvider>
  );
// Optional: Add a slow bounce animation for the logo
// Add this to your global CSS if not present:
// @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
// .animate-bounce-slow { animation: bounce-slow 1.2s infinite; }
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
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="sales" element={<Sales />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="settings" element={<Settings />} />
          <Route path="connections" element={<Connections />} />
          <Route path="plans" element={<Plans />} />
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

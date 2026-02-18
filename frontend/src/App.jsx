import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
        </Route>
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

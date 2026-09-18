import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import SupportCta from './components/SupportCta';
import Footer from './components/Footer';
import ResumePaymentBanner from './components/ResumePaymentBanner';
import SupportWidget from './components/SupportWidget';
import Home from './pages/Home';
import Tutors from './pages/Tutors';
import TutorDetail from './pages/TutorDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import MockGateway from './pages/MockGateway';
import Admin from './pages/Admin';
import Affiliate from './pages/Affiliate';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
import Protected from './components/Protected';

export default function App() {
  return (
    <>
      <Navbar />
      <BottomNav />
      <ResumePaymentBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tutors" element={<Tutors />} />
        <Route path="/tutor/:slug" element={<TutorDetail />} />
        <Route path="/tutors/:id" element={<TutorDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payments/mock/:id" element={<MockGateway />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/affiliate" element={<Affiliate />} />
        <Route path="/syarat-ketentuan" element={<Terms />} />
        <Route path="/kebijakan-privasi" element={<Privacy />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SupportCta />
      <Footer />
      <SupportWidget />
    </>
  );
}

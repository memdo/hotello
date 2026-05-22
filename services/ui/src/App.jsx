import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import HotelDetailPage from './pages/HotelDetailPage';
import AdminPage from './pages/AdminPage';
import ExplorePage from './pages/ExplorePage';
import ProfilePage from './pages/ProfilePage';
import ReservationsPage from './pages/ReservationsPage';
import CommentsPage from './pages/CommentsPage';
import AgentChatbot from './components/AgentChatbot';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout toggleTheme={toggleTheme} theme={theme} />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchResultsPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="hotel/:id" element={<HotelDetailPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
      <AgentChatbot />
    </>
  );
}

export default App;

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { AuthTokenListener } from '@/components/AuthTokenListener';
import { RequireAuth } from '@/components/RequireAuth';
import { SearchPage } from '@/pages/SearchPage';
import { DownloadsPage } from '@/pages/DownloadsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { useInitializeLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';

const SessionVerifier = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const verifySession = useAuthStore((state) => state.verifySession);

  useEffect(() => {
    if (isAuthenticated) {
      verifySession();
    }
  }, [isAuthenticated, verifySession]);

  return null;
};

export const App = () => {
  useInitializeLiveryStore();

  return (
    <HashRouter>
      <AuthTokenListener />
      <SessionVerifier />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/search" replace />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="downloads" element={<DownloadsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </HashRouter>
  );
};

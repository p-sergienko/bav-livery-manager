import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SearchPage } from '@/pages/SearchPage';
import { DownloadsPage } from '@/pages/DownloadsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useInitializeLiveryStore } from '@/store/liveryStore';

export const App = () => {
  useInitializeLiveryStore();

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/search" replace />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

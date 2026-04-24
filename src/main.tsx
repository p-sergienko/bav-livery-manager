import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SkeletonTheme } from 'react-loading-skeleton';
import { useThemeStore } from './store/themeStore';
import { App } from './App';
import './styles/global.css';
import 'shepherd.js/dist/css/shepherd.css';
import './styles/tour.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container missing');
}

const queryClient = new QueryClient();

const ThemedSkeleton = ({ children }: { children: React.ReactNode }) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const isDark = currentTheme === 'dark';
  return (
    <SkeletonTheme
      baseColor={isDark ? '#222222' : '#e0e0e0'}
      highlightColor={isDark ? '#333333' : '#f5f5f5'}
    >
      {children}
    </SkeletonTheme>
  );
};

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedSkeleton>
        <App />
      </ThemedSkeleton>
    </QueryClientProvider>
  </React.StrictMode>
);

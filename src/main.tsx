import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SkeletonTheme } from 'react-loading-skeleton';
import { App } from './App';
import './styles/global.css';
import 'shepherd.js/dist/css/shepherd.css';
import './styles/tour.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container missing');
}

const queryClient = new QueryClient();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SkeletonTheme baseColor="#222222" highlightColor="#333333">
        <App />
      </SkeletonTheme>
    </QueryClientProvider>
  </React.StrictMode>
);

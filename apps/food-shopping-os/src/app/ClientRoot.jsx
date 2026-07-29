'use client';

import { useEffect } from 'react';
import App from '../App.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

export default function ClientRoot() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

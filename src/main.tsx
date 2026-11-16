import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FeedbackProvider } from './components/FeedbackProvider';

createRoot(document.getElementById('root')!).render(
  <FeedbackProvider>
    <App />
  </FeedbackProvider>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline persistence of records remains available if service-worker registration fails.
    });
  });
}

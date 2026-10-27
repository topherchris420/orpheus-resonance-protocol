import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';

// Heavier modes load on demand so the landing page stays small.
const Explore = lazy(() => import('./pages/Explore'));
const Research = lazy(() => import('./pages/Research'));
const Study = lazy(() => import('./pages/Study'));
const Replay = lazy(() => import('./pages/Replay'));
const Method = lazy(() => import('./pages/Method'));

const Loading = () => (
  <div role="status" className="flex min-h-screen items-center justify-center bg-o-bg text-sm text-o-text3">
    Loading…
  </div>
);

const App = () => (
  <TooltipProvider delayDuration={200}>
    <Toaster />
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Navigate to="/explore/orientation" replace />} />
          <Route path="/explore/:scenarioId" element={<Explore />} />
          <Route path="/research" element={<Research />} />
          <Route path="/study" element={<Study />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/method" element={<Method />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

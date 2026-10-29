import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Research tools (replay, evidence explorer, experiment workbench, study runner). They are not linked
// from the main experience and load only when one of these addresses is opened directly.
const Explore = lazy(() => import("./pages/Explore"));
const Research = lazy(() => import("./pages/Research"));
const Study = lazy(() => import("./pages/Study"));
const Replay = lazy(() => import("./pages/Replay"));
const Method = lazy(() => import("./pages/Method"));

const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/explore" element={<Navigate to="/explore/orientation" replace />} />
        <Route path="/explore/:scenarioId" element={<Suspense fallback={null}><Explore /></Suspense>} />
        <Route path="/research" element={<Suspense fallback={null}><Research /></Suspense>} />
        <Route path="/study" element={<Suspense fallback={null}><Study /></Suspense>} />
        <Route path="/replay" element={<Suspense fallback={null}><Replay /></Suspense>} />
        <Route path="/method" element={<Suspense fallback={null}><Method /></Suspense>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

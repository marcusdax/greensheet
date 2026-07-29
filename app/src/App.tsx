import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { NavigatorPage } from './pages/NavigatorPage';
import { CatalogPage } from './pages/CatalogPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { AutomationRulesPage } from './pages/AutomationRulesPage';
import { RoastersPage } from './pages/RoastersPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReservationsPage } from './pages/ReservationsPage';

// Import i18n to initialize it
import './i18n';

// Simple detector/redirect for root path /
const RootRedirect: React.FC = () => {
  const detectedLng = localStorage.getItem('greensheet:locale') || 'en-US';
  return <Navigate to={`/${detectedLng}/navigator`} replace />;
};

// Simple detector/redirect for /:locale path
const LocaleRedirect: React.FC = () => {
  return <Navigate to="navigator" replace />;
};

// Simple ErrorBoundary component for error catching
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Greensheet Platform ErrorBoundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md bg-surface p-8 rounded-lg border border-border shadow-e3 space-y-4">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="text-xl font-display font-semibold text-ink">
              Something went wrong
            </h1>
            <p className="text-xs text-muted leading-relaxed font-mono bg-recessed p-3 rounded text-left overflow-x-auto">
              {this.state.error?.message || 'An unexpected error occurred in the application.'}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('greensheet-store');
                window.location.reload();
              }}
              className="px-4 py-2 bg-navy text-white rounded-md text-xs font-semibold hover:bg-navy-800 shadow-e1 transition-all"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Root Redirects */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Localized routes wrapped in AppLayout */}
          <Route path="/:locale" element={<AppLayout />}>
            <Route index element={<LocaleRedirect />} />
            <Route path="navigator" element={<NavigatorPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="rules" element={<AutomationRulesPage />} />
            <Route path="roasters" element={<RoastersPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            {/* Fallback under locale */}
            <Route path="*" element={<Navigate to="navigator" replace />} />
          </Route>

          {/* Fallback globally */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

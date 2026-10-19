import AppRoutes from './routes/AppRoutes';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}

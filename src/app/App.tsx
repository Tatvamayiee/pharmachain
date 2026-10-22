import AppRoutes from './routes/AppRoutes';
import ScrollToTop from '../shared/components/ScrollToTop';
import { AuthProvider } from './providers/AuthContext';
import { ToastProvider } from './providers/ToastContext';

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

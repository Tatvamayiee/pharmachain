import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import FloatingAIButton from '../components/dashboard/FloatingAssistantButton';
import QRScannerModal from '../components/dashboard/QRScannerModal';
import AssistantChatDialog from '../components/dashboard/AssistantChatDialog';

/**
 * Authenticated shell used by every role. Sidebar contents differ by role via
 * ROLE_NAV; the QR modal and assistant button are shared.
 */
export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F8FF]">
      <TopNavbar
        onMenuClick={() => setMobileOpen(true)}
        onScanClick={() => setQrOpen(true)}
      />
      <Sidebar isMobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main id="main" className="pt-16 lg:pl-[300px] xl:pl-[320px]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>

      <QRScannerModal isOpen={qrOpen} onClose={() => setQrOpen(false)} />
      <AssistantChatDialog isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <FloatingAIButton onClick={() => setChatOpen(true)} />
    </div>
  );
}

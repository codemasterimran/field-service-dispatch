import { ReactNode } from 'react';
import Nav from './Nav';
import { useAuth } from '../auth/AuthContext';
import { useAlertCount } from '../hooks/usePolling';

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const alertCount = useAlertCount(user?.role === 'DISPATCHER');

  return (
    <div className="min-h-screen bg-cream-50">
      <Nav alertCount={alertCount} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

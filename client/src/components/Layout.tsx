import { ReactNode, useState, useEffect } from 'react';
import Nav from './Nav';

export default function Layout({ children }: { children: ReactNode }) {
  const [alertCount, setAlertCount] = useState(0);

  // Poll alert count every 60s — replaced with real fetch in Phase 9
  useEffect(() => {
    // placeholder — Phase 9 will wire this up
    setAlertCount(0);
  }, []);

  return (
    <div className="min-h-screen bg-cream-50">
      <Nav alertCount={alertCount} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

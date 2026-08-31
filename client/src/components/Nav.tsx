import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface NavItem {
  to: string;
  label: string;
}

export default function Nav({ alertCount = 0 }: { alertCount?: number }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const dispatcherLinks: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/alerts', label: 'Alerts' },
  ];

  const technicianLinks: NavItem[] = [
    { to: '/my-jobs', label: 'My Jobs' },
  ];

  const links = user.role === 'DISPATCHER' ? dispatcherLinks : technicianLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6">

        {/* Brand */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-800 hidden sm:block">FSD</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              {label === 'Alerts' ? (
                <span className="flex items-center gap-1.5">
                  Alerts
                  {alertCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </span>
              ) : label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-slate-800 leading-tight">{user.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{user.role}</p>
          </div>
          <button
            id="nav-logout"
            onClick={handleLogout}
            className="btn-ghost text-xs px-2 py-1"
          >
            Sign out
          </button>
        </div>

      </div>
    </header>
  );
}

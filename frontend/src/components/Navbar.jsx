import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, ShieldAlert, LogOut, MessageSquareCode, Bus, Compass } from 'lucide-react';
import { API_BASE } from '../utils/apiClient';

const Navbar = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user && token) {
      fetchNotifications();
    }
  }, [user, token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/utility/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/utility/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <nav className="glass-panel sticky top-0 z-50 px-6 py-4 shadow-md flex items-center justify-between">
      {/* Brand logo */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="bg-brand-500 text-white p-2 rounded-xl shadow-[0_0_15px_rgba(59,108,253,0.5)] flex items-center justify-center animate-bounce-slow">
          <Bus className="h-6 w-6" />
        </div>
        <div>
          <span className="font-extrabold text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-500 to-accent-teal">
            JammuMove
          </span>
          <span className="text-[10px] text-brand-300 block font-semibold tracking-widest uppercase">Smart Transit Platform</span>
        </div>
      </div>

      {/* Nav Links */}
      {user && (
        <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link to="/" className="flex items-center space-x-1 text-slate-300 hover:text-white transition">
            <Compass className="h-4 w-4 text-brand-400" />
            <span>Dashboard</span>
          </Link>
          <Link to="/ai-assistant" className="flex items-center space-x-1 text-slate-300 hover:text-accent-teal transition">
            <MessageSquareCode className="h-4 w-4 text-accent-teal" />
            <span>AI Route Guide</span>
          </Link>
        </div>
      )}

      {/* User Area */}
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-accent-rose text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-brand-850 border border-slate-700/50 rounded-xl shadow-2xl p-2 z-50 text-xs">
                  <div className="flex items-center justify-between p-2 border-b border-slate-700/50 mb-1">
                    <span className="font-bold text-slate-200">Notifications</span>
                    <span className="text-[10px] text-brand-400 cursor-pointer hover:underline" onClick={fetchNotifications}>Refresh</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">No notifications.</div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n._id} 
                          onClick={() => handleMarkRead(n._id)}
                          className={`p-2.5 mb-1 rounded-lg cursor-pointer transition flex items-start space-x-2 ${
                            n.read ? 'bg-transparent text-slate-400' : 'bg-brand-500/10 text-slate-100 hover:bg-brand-500/20'
                          }`}
                        >
                          {n.type === 'sos' ? (
                            <ShieldAlert className="h-4 w-4 text-accent-rose flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-2 w-2 bg-brand-500 rounded-full flex-shrink-0 mt-1.5" />
                          )}
                          <div>
                            <div className="font-semibold text-slate-200">{n.title}</div>
                            <div className="text-[10px] mt-0.5">{n.message}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile widget */}
            <div className="flex items-center space-x-3 bg-brand-850 px-3 py-1.5 rounded-xl border border-slate-800">
              <div className="h-8 w-8 bg-brand-500/30 rounded-full flex items-center justify-center text-brand-300 font-bold border border-brand-500">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left">
                <div className="font-semibold text-xs text-white leading-tight">{user.name}</div>
                <div className="text-[10px] text-brand-400 uppercase font-bold tracking-wider">{user.role}</div>
              </div>
              <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="p-1 text-slate-400 hover:text-accent-rose rounded-lg transition"
                title="Log Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-3">
            <Link 
              to="/login" 
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 hover:bg-slate-800/40 rounded-lg transition"
            >
              Sign In
            </Link>
            <Link 
              to="/register" 
              className="text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl shadow-[0_4px_14px_rgba(59,108,253,0.3)] transition"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

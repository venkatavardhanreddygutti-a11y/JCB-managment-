import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  ShieldCheck, 
  LogOut, 
  RefreshCw, 
  Globe, 
  Clock, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { 
  DeviceSession, 
  getActiveSessions, 
  revokeSession, 
  revokeOtherSessions, 
  registerDeviceSession,
  getDeviceId
} from '../utils';

interface ActiveDevicesCardProps {
  username: string;
  role: 'owner' | 'customer';
}

export default function ActiveDevicesCard({ username, role }: ActiveDevicesCardProps) {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadSessions = async () => {
    if (!username) return;
    // Register or touch current session first
    registerDeviceSession(username, role);
    const list = await getActiveSessions(username);
    setSessions(list);
  };

  useEffect(() => {
    loadSessions();

    // Listen for cross-tab or multi-device updates
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('jcb_multi_device_channel');
        channel.onmessage = () => {
          loadSessions();
        };
      }
    } catch (e) {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('jcb_sessions_')) {
        loadSessions();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [username, role]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      loadSessions();
      setRefreshing(false);
    }, 400);
  };

  const handleRevoke = (sessionId: string, isCurrent: boolean | undefined) => {
    if (isCurrent) {
      if (confirm('Are you sure you want to log out of this device?')) {
        revokeSession(username, sessionId);
        localStorage.removeItem('jcb_logged_in');
        localStorage.removeItem('jcb_logged_in_user');
        window.location.reload();
      }
      return;
    }

    revokeSession(username, sessionId);
    loadSessions();
    setActionSuccess('Device logged out successfully.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleRevokeOthers = () => {
    if (confirm('Are you sure you want to log out of all other devices? This device will remain logged in.')) {
      revokeOtherSessions(username);
      loadSessions();
      setActionSuccess('All other device sessions terminated.');
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'Mobile':
        return <Smartphone className="w-5 h-5 text-amber-600" />;
      case 'Tablet':
        return <Tablet className="w-5 h-5 text-amber-600" />;
      default:
        return <Monitor className="w-5 h-5 text-amber-600" />;
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'Active Now';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Active Now';
    }
  };

  return (
    <div id="active-devices-card" className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
      {/* Background Accent Pill */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/15">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <h4 className="text-sm font-black text-slate-900 tracking-tight">Active Device Logins & Sessions</h4>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Multi-Device Allowed
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Logged in on <span className="font-bold text-amber-900">{sessions.length} device{sessions.length > 1 ? 's' : ''}</span>. One account can be logged in on multiple phones, tablets, or laptops simultaneously.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs text-xs font-semibold flex items-center gap-1.5"
            title="Refresh active devices"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {sessions.length > 1 && (
            <button
              type="button"
              onClick={handleRevokeOthers}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out Others</span>
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Sessions List */}
      <div className="mt-4 space-y-2.5">
        {sessions.map((sess) => (
          <div
            key={sess.sessionId}
            className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
              sess.isCurrentDevice
                ? 'bg-white border-amber-400 shadow-sm ring-2 ring-amber-400/20'
                : 'bg-white/80 border-slate-200 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                {getDeviceIcon(sess.deviceType)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {sess.deviceName}
                  </p>
                  {sess.isCurrentDevice && (
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                      This Device
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Logged in: {formatDate(sess.loginTime)}</span>
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>{sess.ipAddress}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRevoke(sess.sessionId, sess.isCurrentDevice)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                sess.isCurrentDevice
                  ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                  : 'text-slate-600 hover:text-rose-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <LogOut className="w-3 h-3" />
              <span>{sess.isCurrentDevice ? 'Log Out' : 'Revoke'}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="mt-4 pt-3 border-t border-amber-500/10 flex items-start gap-2 text-[11px] text-slate-600">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-800">Multi-Device Synchronized Session:</strong> You can log into your account on multiple smartphones, site tablets, or desktop computers. Work logs, JCB bookings, and driver allocations will remain synchronized across all connected devices.
        </p>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Wifi, WifiOff, Download, RefreshCw, HardDrive, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useOfflineStatus } from '../pwa';

export default function OfflineIndicator() {
  const { isOnline, canInstall, isInstalled, installPwa, lastSyncTime, syncDataNow } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleManualSync = () => {
    setIsSyncing(true);
    syncDataNow();
    setTimeout(() => {
      setIsSyncing(false);
    }, 800);
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 animate-pulse'
          }`}
          title="Click to view offline storage & PWA status"
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Offline Mode</span>
            </>
          )}
        </button>

        {/* PWA Install Button (If browser ready) */}
        {canInstall && !isInstalled && (
          <button
            type="button"
            onClick={installPwa}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2.5 py-1 rounded-full text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            title="Install JCB Log on your device for 100% offline access"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}
      </div>

      {/* Popover detail panel */}
      {showDetails && (
        <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl p-4 z-50 text-zinc-200 text-xs leading-relaxed animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-2 font-bold text-zinc-100">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Offline Capabilities</span>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="text-zinc-400 hover:text-zinc-200 text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Connection State:</span>
              <span className={`font-bold flex items-center gap-1 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {isOnline ? 'Online (Connected)' : 'Offline (Local Storage)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Local Cache:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active & Saved
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Last Synced:</span>
              <span className="font-medium text-zinc-300">{lastSyncTime}</span>
            </div>

            <div className="p-2.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50 text-[11px] text-zinc-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {isOnline
                  ? 'All entries, bookings, and fleet updates are stored locally in offline storage and synced to server.'
                  : 'You are working offline! All changes will be stored locally on your device without losing data.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold py-1.5 px-3 rounded-lg border border-zinc-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isSyncing ? 'Syncing Storage...' : 'Sync Local Data'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  User, 
  Users, 
  Truck, 
  Phone, 
  TrendingUp, 
  Coins, 
  Download, 
  LayoutDashboard, 
  FileText, 
  X,
  ChevronRight,
  Filter,
  Check,
  Edit2,
  RefreshCw,
  Info,
  LogOut,
  ArrowUpDown,
  Sparkles,
  LayoutGrid,
  Layers,
  Camera,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Fuel
} from 'lucide-react';
import { JcbEntry } from './types';
import { SAMPLE_ENTRIES } from './sampleData';
import { calculateHours, calculateStats, formatCurrency, exportDataAsJSON, exportDataAsPDF, registerDeviceSession, getDeviceId } from './utils';
import { 
  fetchUserProfile, 
  updateUserProfileApi, 
  fetchEntriesApi, 
  saveEntriesApi, 
  fetchBookingsApi, 
  saveBookingsApi, 
  fetchFleetApi, 
  saveFleetApi,
  globalLogoutApi,
  validateSessionApi
} from './api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import LoginPage from './components/LoginPage';
import SplashScreen from './components/SplashScreen';
import OfflineIndicator from './components/OfflineIndicator';
import AiInsightsPanel from './components/AiInsightsPanel';
import CustomerPortal from './components/CustomerPortal';
import ActiveDevicesCard from './components/ActiveDevicesCard';

// Helper function to format date to a beautifully readable format (e.g., Jul 10, 2026)
const formatDisplayDate = (dateString: string) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = months[monthIndex] || month;
  return `${monthName} ${parseInt(day, 10)}, ${year}`;
};

export default function App() {
  // Authentication State
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('jcb_logged_in') === 'true';
  });
  const [loggedInUser, setLoggedInUser] = useState(() => {
    return localStorage.getItem('jcb_logged_in_user') || '';
  });
  const [userRole, setUserRole] = useState<'owner' | 'customer'>(() => {
    return (localStorage.getItem('jcb_user_role') as 'owner' | 'customer') || 'owner';
  });
  const [customerPortalInitialTab, setCustomerPortalInitialTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);

  const handleLoginSuccess = (user: string, role: 'owner' | 'customer') => {
    setIsLoggedIn(true);
    setLoggedInUser(user);
    setUserRole(role);
    setLogoutNotice(null);
    localStorage.setItem('jcb_logged_in', 'true');
    localStorage.setItem('jcb_logged_in_user', user);
    localStorage.setItem('jcb_user_role', role);
    
    // Redirect both admin and customer to dashboard after login
    setActiveTab('dashboard');
    setCustomerPortalInitialTab('dashboard');

    if (role === 'owner') {
      setTimeout(() => {
        detectOwnerLocation(false);
      }, 200);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser('');
    setUserRole('owner');
    localStorage.removeItem('jcb_logged_in');
    localStorage.removeItem('jcb_logged_in_user');
    localStorage.removeItem('jcb_user_role');
    localStorage.removeItem('jcb_current_session_id');
    setActiveTab('dashboard');
    setCustomerPortalInitialTab('dashboard');
  };

  const handleGlobalLogout = async () => {
    const userToLogout = loggedInUser;
    handleLogout(); // Clear local state immediately for instant feedback
    setLogoutNotice(null);

    if (userToLogout) {
      await globalLogoutApi(userToLogout);
      
      // Broadcast instant notification to all open tabs/windows
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('jcb_multi_device_channel');
          channel.postMessage({ type: 'GLOBAL_LOGOUT', username: userToLogout });
          channel.close();
        }
      } catch (e) {}
    }
  };

  // Real-time Session Validation Loop (Checks every page load, focus, and every 5-30s)
  useEffect(() => {
    if (!isLoggedIn || !loggedInUser) return;

    let isMounted = true;

    const performSessionCheck = async () => {
      const currentSessionId = localStorage.getItem('jcb_current_session_id') || undefined;
      const currentDeviceId = getDeviceId();

      const result = await validateSessionApi(loggedInUser, currentSessionId, currentDeviceId);

      if (isMounted && !result.valid) {
        setLogoutNotice(result.reason || 'You have been signed out globally across all active devices.');
        handleLogout();
      }
    };

    // 1. Initial check on load/login
    performSessionCheck();

    // 2. Poll every 5 seconds for fast cross-device logout reaction
    const intervalId = setInterval(performSessionCheck, 5000);

    // 3. Re-validate when window gains focus or tab becomes visible
    const handleFocus = () => {
      performSessionCheck();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // 4. Instant tab-to-tab sync via BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('jcb_multi_device_channel');
        broadcastChannel.onmessage = (event) => {
          if (
            event.data?.type === 'GLOBAL_LOGOUT' ||
            event.data?.type === 'SESSION_REVOKED' ||
            event.data?.type === 'OTHER_SESSIONS_REVOKED'
          ) {
            performSessionCheck();
          }
        };
      }
    } catch (e) {}

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [isLoggedIn, loggedInUser]);

  // Primary state loaded directly from shared server DB
  const [entries, setEntries] = useState<JcbEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'columns' | 'tabs'>('tabs');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [machines, setMachines] = useState<string[]>(['JCB 1', 'JCB 2', 'JCB 3']);
  const [newMachineName, setNewMachineName] = useState('');
  const [adminProfilePic, setAdminProfilePic] = useState<string | null>(null);

  // Master Owner Profile Persistence
  const [ownerPhone, setOwnerPhone] = useState('+91 91234 56789');
  const [ownerEmail, setOwnerEmail] = useState('fleet-owner@jcb-logistics.in');
  const [ownerCity, setOwnerCity] = useState('Bengaluru');
  const [ownerPincode, setOwnerPincode] = useState('560001');
  const [ownerLat, setOwnerLat] = useState<number>(12.9716);
  const [ownerLng, setOwnerLng] = useState<number>(77.5946);
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Multi-device central polling effect (polls shared server DB every 5s)
  useEffect(() => {
    if (!isLoggedIn) return;

    let isMounted = true;

    const syncCloudData = async () => {
      try {
        const [serverEntries, serverBookings, fleetData, userProf] = await Promise.all([
          fetchEntriesApi(),
          fetchBookingsApi(),
          fetchFleetApi(),
          loggedInUser ? fetchUserProfile(loggedInUser) : Promise.resolve(null)
        ]);

        if (!isMounted) return;

        if (Array.isArray(serverEntries)) {
          setEntries(serverEntries);
          setHasLoaded(true);
        }

        if (Array.isArray(serverBookings)) {
          const currentOwner = (loggedInUser || 'admin').trim().toLowerCase();
          const filtered = serverBookings.filter((b: any) => {
            const bOwner = (b.ownerId || 'admin').trim().toLowerCase();
            return bOwner === currentOwner;
          });
          setAdminBookings(filtered);
        }

        if (fleetData && Array.isArray(fleetData.fleetMachines) && fleetData.fleetMachines.length > 0) {
          const names = fleetData.fleetMachines.map((m: any) => typeof m === 'string' ? m : (m.id || m.name));
          setMachines(names);
        }

        if (fleetData && Array.isArray(fleetData.customDrivers) && fleetData.customDrivers.length > 0) {
          setCustomDrivers(fleetData.customDrivers);
        }

        if (userProf) {
          if (userProf.phone) setOwnerPhone(userProf.phone);
          if (userProf.email) setOwnerEmail(userProf.email);
          if (userProf.city) setOwnerCity(userProf.city);
          if (userProf.pincode) setOwnerPincode(userProf.pincode);
          if (userProf.lat !== undefined) setOwnerLat(userProf.lat);
          if (userProf.lng !== undefined) setOwnerLng(userProf.lng);
          if (userProf.password) setAdminPassword(userProf.password);
          if (userProf.profilePic !== undefined) setAdminProfilePic(userProf.profilePic || null);
        }
      } catch (e) {
        console.error('Auto sync poll error in App.tsx:', e);
      }
    };

    syncCloudData();
    const interval = setInterval(syncCloudData, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn, loggedInUser, userRole]);

  // Touch session & device heartbeat
  useEffect(() => {
    if (isLoggedIn && loggedInUser) {
      registerDeviceSession(loggedInUser, userRole);
    }
  }, [isLoggedIn, loggedInUser, userRole]);

  const handleAdminProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Please select an image smaller than 1.5MB for storage performance.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setAdminProfilePic(base64String);
        if (loggedInUser) {
          await updateUserProfileApi({ oldUsername: loggedInUser, profilePic: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminProfilePicDelete = async () => {
    if (confirm("Are you sure you want to remove your profile picture?")) {
      setAdminProfilePic(null);
      if (loggedInUser) {
        await updateUserProfileApi({ oldUsername: loggedInUser, profilePic: '' });
      }
    }
  };

  // Sync profile values from shared cloud database when loggedInUser changes
  useEffect(() => {
    if (loggedInUser) {
      fetchUserProfile(loggedInUser).then((profile) => {
        if (profile) {
          if (profile.phone) setOwnerPhone(profile.phone);
          if (profile.email) setOwnerEmail(profile.email);
          if (profile.city) setOwnerCity(profile.city);
          if (profile.pincode) setOwnerPincode(profile.pincode);
          if (profile.lat !== undefined) setOwnerLat(profile.lat);
          if (profile.lng !== undefined) setOwnerLng(profile.lng);
          if (profile.password) setAdminPassword(profile.password);
          if (profile.profilePic !== undefined) setAdminProfilePic(profile.profilePic || null);
        }
      });
    }
  }, [loggedInUser]);

  const detectOwnerLocation = (isManualClick = false) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(6));
          const lng = parseFloat(position.coords.longitude.toFixed(6));
          setOwnerLat(lat);
          setOwnerLng(lng);

          try {
            // Fetch reverse geocoding from OpenStreetMap Nominatim API
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
              headers: {
                'Accept-Language': 'en'
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (data && data.address) {
                const addr = data.address;
                const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || addr.state_district || 'Bengaluru';
                const pincode = addr.postcode || '560001';
                
                setOwnerCity(city);
                setOwnerPincode(pincode);

                // Auto sync with cloud DB
                if (loggedInUser) {
                  updateUserProfileApi({
                    username: loggedInUser,
                    city,
                    pincode,
                    lat,
                    lng
                  });
                }

                if (isManualClick) {
                  alert(`Successfully retrieved coordinates & address!\n\n📍 Coordinates: ${lat}, ${lng}\n🏙️ City: ${city}\n📮 Pincode: ${pincode}`);
                }
                return;
              }
            }
          } catch (fetchErr) {
            console.error('Reverse geocoding fetch error:', fetchErr);
          }
          
          if (isManualClick) {
            alert(`Successfully retrieved coordinates: ${lat}, ${lng}\n(Reverse geocoding address lookup failed or timed out. Please enter City & Pincode manually if needed)`);
          }
        },
        (error) => {
          if (isManualClick) {
            alert("Could not retrieve GPS coordinates automatically. Please enter them manually, or use default city/pincode matching.");
          }
        }
      );
    } else if (isManualClick) {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleGetOwnerLocation = () => detectOwnerLocation(true);

  // Auto detect location when logged in as admin/owner
  useEffect(() => {
    if (isLoggedIn && userRole === 'owner') {
      detectOwnerLocation(false);
    }
  }, [loggedInUser, isLoggedIn, userRole]);

  const handleSaveOwnerProfile = async () => {
    const u = (loggedInUser || 'admin').trim();
    const res = await updateUserProfileApi({
      username: u,
      phone: ownerPhone,
      email: ownerEmail,
      city: ownerCity,
      pincode: ownerPincode,
      lat: ownerLat,
      lng: ownerLng,
      password: adminPassword,
      profilePic: adminProfilePic || ''
    });

    if (res.success) {
      alert("Owner profile details, credentials, and fleet geolocations saved to shared cloud database!");
    } else {
      alert("Error saving profile to cloud database: " + (res.error || 'Unknown error'));
    }
  };

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedPendingCustomer, setSelectedPendingCustomer] = useState<string | null>(null);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number | null>(null);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [weekSearchQuery, setWeekSearchQuery] = useState('');
  // Active tab when in tab mode (or on mobile)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-entry' | 'records' | 'drivers' | 'profile'>('dashboard');

  const [customDrivers, setCustomDrivers] = useState<string[]>([]);
  const [driverRegistry, setDriverRegistry] = useState<{ 
    [name: string]: { 
      name: string; 
      phone: string; 
      status: 'Active' | 'Idle' | 'On Leave';
      salary?: number;
      advanceAmount?: number;
      details?: string;
    } 
  }>({
    'Rajesh Kumar': { 
      name: 'Rajesh Kumar', 
      phone: '+91 98765 43210', 
      status: 'Active',
      salary: 18000,
      advanceAmount: 2500,
      details: 'Heavy breaker attachments and excavation expert.' 
    },
    'Sukhvinder Singh': { 
      name: 'Sukhvinder Singh', 
      phone: '+91 91234 56789', 
      status: 'Active',
      salary: 17500,
      advanceAmount: 1200,
      details: 'Experienced in leveling, grader attachments, and canal work.' 
    },
    'Vikram Rathore': { 
      name: 'Vikram Rathore', 
      phone: '+91 88776 65544', 
      status: 'Active',
      salary: 19000,
      advanceAmount: 4500,
      details: 'Specialist for high-difficulty hilly and rocky excavation sites.' 
    },
  });

  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverSalary, setNewDriverSalary] = useState('16000');
  const [newDriverAdvance, setNewDriverAdvance] = useState('0');
  const [newDriverDetails, setNewDriverDetails] = useState('');
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);

  // States for inline editing of driver details & ledger
  const [editingDriverName, setEditingDriverName] = useState<string | null>(null);
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverSalary, setEditDriverSalary] = useState('');
  const [editDriverAdvance, setEditDriverAdvance] = useState('');
  const [editDriverDetails, setEditDriverDetails] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState<'Active' | 'Idle' | 'On Leave'>('Active');

  // Customer Bookings state & actions
  const [adminBookings, setAdminBookings] = useState<any[]>([]);

  const loadAdminBookings = async () => {
    try {
      const serverBookings = await fetchBookingsApi();
      const currentOwner = (loggedInUser || 'admin').trim().toLowerCase();
      const filtered = (serverBookings || []).filter((b: any) => {
        const bOwner = (b.ownerId || 'admin').trim().toLowerCase();
        return bOwner === currentOwner;
      });
      setAdminBookings(filtered);
    } catch (e) {
      console.error('Error loading admin bookings:', e);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userRole === 'owner') {
      loadAdminBookings();
    }
  }, [isLoggedIn, userRole, loggedInUser]);

  const handleApproveBooking = async (booking: any) => {
    try {
      const currentBookings = await fetchBookingsApi();
      const updatedList = (currentBookings || []).map((b: any) => b.id === booking.id ? { ...b, status: 'approved' } : b);
      await saveBookingsApi(updatedList);
      
      const currentOwner = (loggedInUser || 'admin').trim().toLowerCase();
      setAdminBookings(updatedList.filter((b: any) => (b.ownerId || 'admin').trim().toLowerCase() === currentOwner));
    } catch (e) {
      console.error(e);
    }

    setCustomerName(booking.customerName || '');
    setCustomerPhone('');
    setSiteLocation(booking.siteLocation || '');
    setWorkType(booking.workType || '');
    setJcbMachineId(booking.machineId || 'JCB 1');
    setDate(booking.date || new Date().toISOString().split('T')[0]);
    
    if (booking.startTime && booking.endTime) {
      setStartTime(booking.startTime);
      setEndTime(booking.endTime);
      setTrackingType('clock');
    } else {
      setTrackingType('hour-meter');
      if (booking.estimatedHours) {
        setStartMeter('1000');
        setEndMeter((1000 + parseFloat(booking.estimatedHours)).toString());
      }
    }
    setActiveTab('new-entry');
  };

  const handleDeclineBooking = async (bookingId: string) => {
    try {
      const currentBookings = await fetchBookingsApi();
      const updatedList = (currentBookings || []).map((b: any) => b.id === bookingId ? { ...b, status: 'declined' } : b);
      await saveBookingsApi(updatedList);
      
      const currentOwner = (loggedInUser || 'admin').trim().toLowerCase();
      setAdminBookings(updatedList.filter((b: any) => (b.ownerId || 'admin').trim().toLowerCase() === currentOwner));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMachine = async () => {
    const trimmed = newMachineName.trim();
    if (!trimmed) return;
    if (machines.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
      alert("A machine with this ID/name already exists!");
      return;
    }
    const updated = [...machines, trimmed];
    setMachines(updated);
    setNewMachineName('');
    await saveFleetApi(updated, customDrivers);
  };

  const handleRemoveMachine = async (machineName: string) => {
    const updated = machines.filter(m => m !== machineName);
    setMachines(updated);
    if (jcbMachineId === machineName) {
      setJcbMachineId(updated.length > 0 ? updated[0] : '');
    }
    await saveFleetApi(updated, customDrivers);
  };

  // New Entry Form State
  const [driverName, setDriverName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [jcbMachineId, setJcbMachineId] = useState(() => machines[0] || '');

  // Keep jcbMachineId selection aligned with available machines
  useEffect(() => {
    if (machines.length > 0) {
      if (!jcbMachineId || !machines.includes(jcbMachineId)) {
        setJcbMachineId(machines[0]);
      }
    }
  }, [machines, jcbMachineId]);
  const [ratePerHour, setRatePerHour] = useState<number>(1000);
  const [trackingType, setTrackingType] = useState<'hour-meter' | 'clock'>('hour-meter');
  const [startMeter, setStartMeter] = useState<string>('');
  const [endMeter, setEndMeter] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [dieselLiters, setDieselLiters] = useState<string>('');
  const [dieselAmount, setDieselAmount] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('pending');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [workType, setWorkType] = useState('');
  const [customHours, setCustomHours] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustomWorkType, setIsCustomWorkType] = useState(false);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const isSettingEditValues = React.useRef<boolean>(false);

  // Preset options for work description
  const workOptions = [
    { label: 'Levelling', emoji: '🚜' },
    { label: 'Digging', emoji: '🕳️' },
    { label: 'Trenching', emoji: '⛏️' },
    { label: 'Demolition', emoji: '💥' },
    { label: 'Loading', emoji: '🪵' },
    { label: 'Clearing', emoji: '🧹' },
    { label: 'Backfilling', emoji: '🔙' },
    { label: 'Grading', emoji: '📐' }
  ];

  const handleToggleWorkOption = (option: string) => {
    const trimmedWorkType = workType.trim();
    const lowerWorkType = trimmedWorkType.toLowerCase();
    const lowerOption = option.toLowerCase();
    
    if (lowerWorkType.includes(lowerOption)) {
      // If it exists, split by commas, clean, filter, and rejoin
      const parts = trimmedWorkType.split(',')
        .map(p => p.trim())
        .filter(p => p.toLowerCase() !== lowerOption && p !== '');
      setWorkType(parts.join(', '));
    } else {
      // If it doesn't exist, append neatly
      if (trimmedWorkType === '') {
        setWorkType(option);
      } else {
        setWorkType(`${trimmedWorkType}, ${option}`);
      }
    }
  };

  const isOptionSelected = (option: string) => {
    return workType.toLowerCase().includes(option.toLowerCase());
  };

  // Editing Entry State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Search and Filters for Records Column
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial'>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'driver-asc' | 'customer-asc'>('date-desc');
  
  // Selection state for bulk-delete option on records
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Custom Confirmation Modal State for iframe-safe confirmation dialogs
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Clear selections when filters, queries or sort changes to prevent accidental out-of-view deletions
  useEffect(() => {
    setSelectedIds([]);
  }, [searchQuery, statusFilter, driverFilter, sortBy]);

  // Calculate dynamic hour value for the current form values
  const currentCalculatedHours = customHours !== ''
    ? parseFloat(customHours) || 0
    : calculateHours({
        trackingType,
        startMeter: startMeter ? parseFloat(startMeter) : undefined,
        endMeter: endMeter ? parseFloat(endMeter) : undefined,
        startTime,
        endTime
      });

  const currentCalculatedAmount = customAmount !== ''
    ? parseFloat(customAmount) || 0
    : parseFloat((currentCalculatedHours * ratePerHour).toFixed(2));

  const handleGenerateNarrative = async () => {
    if (!customerName.trim()) {
      alert('Please enter a Customer or Project Name first to generate an AI narrative.');
      return;
    }
    setIsGeneratingNarrative(true);
    try {
      const response = await fetch('/api/gemini/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          jcbMachineId,
          ratePerHour,
          totalHours: currentCalculatedHours,
          totalAmount: currentCalculatedAmount,
          workType: workType || 'Excavation',
          siteLocation,
          date
        })
      });
      if (!response.ok) {
        throw new Error('Server returned an error');
      }
      const data = await response.json();
      if (data.text) {
        setWorkType(data.text);
        setIsCustomWorkType(true); // Open custom text area to display and allow editing the narrative
      }
    } catch (err) {
      console.error('Failed to generate narrative:', err);
      alert('Failed to generate AI narrative. Ensure GEMINI_API_KEY is configured in Settings > Secrets.');
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  // Automatically calculate Amount Charged when hours or rate changes
  useEffect(() => {
    if (isSettingEditValues.current) return;

    const hasEnteredHours = customHours !== '' || 
      (trackingType === 'hour-meter' && startMeter !== '' && endMeter !== '') ||
      (trackingType === 'clock' && startTime !== '' && endTime !== '');

    if (hasEnteredHours && currentCalculatedHours > 0 && ratePerHour > 0) {
      const calculated = parseFloat((currentCalculatedHours * ratePerHour).toFixed(2));
      setCustomAmount(calculated ? calculated.toString() : '');
    } else if (!hasEnteredHours) {
      setCustomAmount('');
    }
  }, [currentCalculatedHours, ratePerHour, customHours, trackingType, startMeter, endMeter, startTime, endTime]);

  // Auto-fill amount paid if fully paid
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(currentCalculatedAmount.toString());
    } else if (paymentStatus === 'pending') {
      setAmountPaid('0');
    }
  }, [paymentStatus, currentCalculatedAmount]);

  // Compute stats
  const stats = calculateStats(entries);

  // Derive list of pending payments
  const pendingEntries = entries.filter(e => e.paymentStatus === 'pending' || e.paymentStatus === 'partial');
  
  // Group by customer
  const pendingCustomersMap: Record<string, { name: string; phone: string; location: string; totalPending: number; entries: JcbEntry[] }> = pendingEntries.reduce((acc, entry) => {
    const cust = entry.customerName.trim() || 'Unknown Customer';
    if (!acc[cust]) {
      acc[cust] = {
        name: cust,
        phone: entry.customerPhone || 'N/A',
        location: entry.siteLocation || 'N/A',
        totalPending: 0,
        entries: []
      };
    }
    const outstanding = entry.paymentStatus === 'pending' ? entry.totalAmount : (entry.totalAmount - (entry.amountPaid || 0));
    acc[cust].totalPending += outstanding;
    acc[cust].entries.push(entry);
    return acc;
  }, {} as Record<string, { name: string; phone: string; location: string; totalPending: number; entries: JcbEntry[] }>);

  const pendingCustomersList: Array<{ name: string; phone: string; location: string; totalPending: number; entries: JcbEntry[] }> = Object.values(pendingCustomersMap).sort((a, b) => b.totalPending - a.totalPending);

  const currentPendingCustomerData = selectedPendingCustomer ? pendingCustomersMap[selectedPendingCustomer] : null;

  // Calculate Weekly Revenue (last 7 days)
  const weeklyRevenue = entries.reduce((sum, entry) => {
    const entryDate = new Date(entry.date);
    const today = new Date();
    entryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - entryDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays >= 0 && diffDays <= 7) {
      return sum + entry.totalAmount;
    }
    return sum;
  }, 0);

  // Calculate Weekly Revenue groups for Bar Graph (Week 1, Week 2, etc.)
  const getWeeklyRevenueData = () => {
    if (entries.length === 0) {
      return [];
    }
    
    // Sort entries by date ascending
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const firstEntryDate = new Date(sortedEntries[0].date);
    
    // Align date to standard Monday of its week
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };
    
    const minMonday = getMonday(firstEntryDate);
    
    // Group entries into week sums
    const weeksMap: { [weekNum: number]: { revenue: number; entries: JcbEntry[] } } = {};
    
    sortedEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      const entryMonday = getMonday(entryDate);
      
      const diffTime = entryMonday.getTime() - minMonday.getTime();
      const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
      const weekNum = diffWeeks + 1;
      
      if (!weeksMap[weekNum]) {
        weeksMap[weekNum] = { revenue: 0, entries: [] };
      }
      weeksMap[weekNum].revenue += entry.totalAmount;
      weeksMap[weekNum].entries.push(entry);
    });
    
    const maxWeekNum = Math.max(...Object.keys(weeksMap).map(Number), 1);
    
    const data = [];
    for (let i = 1; i <= maxWeekNum; i++) {
      const weekStart = new Date(minMonday.getTime() + (i - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      data.push({
        name: `Week ${i}`,
        Revenue: parseFloat((weeksMap[i]?.revenue || 0).toFixed(2)),
        entries: weeksMap[i]?.entries || [],
        dateRange: `${startStr} - ${endStr}`,
        weekNum: i
      });
    }
    
    return data;
  };

  const weeklyChartData = getWeeklyRevenueData();

  const currentWeekData = React.useMemo(() => {
    if (selectedWeekNum === null) return null;
    return weeklyChartData.find(w => w.weekNum === selectedWeekNum) || null;
  }, [selectedWeekNum, weeklyChartData]);

  const weekStats = React.useMemo(() => {
    if (!currentWeekData) return { totalHours: 0, totalRevenue: 0, totalJobs: 0, pendingAmount: 0 };
    const ents = currentWeekData.entries;
    const totalHours = ents.reduce((sum, e) => sum + e.totalHours, 0);
    const totalRevenue = currentWeekData.Revenue;
    const totalJobs = ents.length;
    const pendingAmount = ents.reduce((sum, e) => {
      if (e.paymentStatus === 'paid') return sum;
      const due = e.paymentStatus === 'pending' ? e.totalAmount : (e.totalAmount - (e.amountPaid || 0));
      return sum + due;
    }, 0);
    return { totalHours, totalRevenue, totalJobs, pendingAmount };
  }, [currentWeekData]);

  const filteredWeekEntries = React.useMemo(() => {
    if (!currentWeekData) return [];
    const query = weekSearchQuery.trim().toLowerCase();
    if (!query) return currentWeekData.entries;
    return currentWeekData.entries.filter(e => 
      e.customerName.toLowerCase().includes(query) ||
      e.driverName.toLowerCase().includes(query) ||
      (e.workType && e.workType.toLowerCase().includes(query)) ||
      e.jcbMachineId.toLowerCase().includes(query) ||
      (e.siteLocation && e.siteLocation.toLowerCase().includes(query))
    );
  }, [currentWeekData, weekSearchQuery]);

  // Unique list of drivers for filter dropdown
  const uniqueDrivers = Array.from(new Set([
    ...customDrivers,
    ...entries.map(e => e.driverName.trim()).filter(Boolean)
  ]));

  // Form submission / entry creation or editing
  const handleSubmitEntry = (e: FormEvent) => {
    e.preventDefault();

    if (!driverName.trim()) {
      alert('Please enter a Driver Name');
      return;
    }
    if (!customerName.trim()) {
      alert('Please enter a Customer or Project Name');
      return;
    }

    const calculatedHours = customHours !== ''
      ? parseFloat(customHours) || 0
      : calculateHours({
          trackingType,
          startMeter: startMeter ? parseFloat(startMeter) : undefined,
          endMeter: endMeter ? parseFloat(endMeter) : undefined,
          startTime,
          endTime
        });

    if (calculatedHours <= 0) {
      alert('Calculated hours must be greater than 0. Please check your meter readings or clock times.');
      return;
    }

    const calculatedAmount = customAmount !== ''
      ? parseFloat(customAmount) || 0
      : parseFloat((calculatedHours * ratePerHour).toFixed(2));
    const finalAmountPaid = paymentStatus === 'paid' 
      ? calculatedAmount 
      : paymentStatus === 'pending' 
        ? 0 
        : parseFloat(amountPaid) || 0;

    const entryData: JcbEntry = {
      id: editingId || `jcb-${Date.now()}`,
      date,
      driverName: driverName.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      siteLocation: siteLocation.trim() || 'General Site',
      jcbMachineId,
      ratePerHour: Number(ratePerHour),
      trackingType,
      startMeter: trackingType === 'hour-meter' && startMeter ? parseFloat(startMeter) : undefined,
      endMeter: trackingType === 'hour-meter' && endMeter ? parseFloat(endMeter) : undefined,
      startTime: trackingType === 'clock' ? startTime : undefined,
      endTime: trackingType === 'clock' ? endTime : undefined,
      dieselLiters: dieselLiters ? parseFloat(dieselLiters) : undefined,
      dieselAmount: dieselAmount ? parseFloat(dieselAmount) : undefined,
      totalHours: calculatedHours,
      totalAmount: calculatedAmount,
      paymentStatus,
      amountPaid: finalAmountPaid,
      workType: workType.trim(),
      createdAt: editingId 
        ? (entries.find(e => e.id === editingId)?.createdAt || new Date().toISOString())
        : new Date().toISOString()
    };

    let updatedEntries: JcbEntry[] = [];
    if (editingId) {
      // Edit existing
      updatedEntries = entries.map(entry => entry.id === editingId ? entryData : entry);
      setEditingId(null);
    } else {
      // Add new
      updatedEntries = [entryData, ...entries];
    }

    setEntries(updatedEntries);
    saveEntriesApi(updatedEntries);

    // Reset Form Fields with shield
    isSettingEditValues.current = true;
    setDriverName('');
    setCustomerName('');
    setCustomerPhone('');
    setSiteLocation('');
    setStartMeter('');
    setEndMeter('');
    setDieselLiters('');
    setDieselAmount('');
    setWorkType('');
    setCustomHours('');
    setCustomAmount('');
    setIsCustomWorkType(false);
    setPaymentStatus('pending');
    setAmountPaid('0');
    setDate(new Date().toISOString().split('T')[0]);

    setTimeout(() => {
      isSettingEditValues.current = false;
    }, 50);

    // Go to Records view on mobile/tablet mode to see updated listing
    setActiveTab('records');
  };

  // Start editing an entry
  const handleEditStart = (entry: JcbEntry) => {
    isSettingEditValues.current = true;
    setEditingId(entry.id);
    setDate(entry.date);
    setDriverName(entry.driverName);
    setCustomerName(entry.customerName);
    setCustomerPhone(entry.customerPhone || '');
    setSiteLocation(entry.siteLocation);
    setJcbMachineId(entry.jcbMachineId);
    setRatePerHour(entry.ratePerHour);
    setTrackingType(entry.trackingType);
    setStartMeter(entry.startMeter !== undefined ? entry.startMeter.toString() : '');
    setEndMeter(entry.endMeter !== undefined ? entry.endMeter.toString() : '');
    setStartTime(entry.startTime || '09:00');
    setEndTime(entry.endTime || '17:00');
    setDieselLiters(entry.dieselLiters !== undefined ? entry.dieselLiters.toString() : '');
    setDieselAmount(entry.dieselAmount !== undefined ? entry.dieselAmount.toString() : '');
    setPaymentStatus(entry.paymentStatus);
    setAmountPaid(entry.amountPaid.toString());
    setWorkType(entry.workType || '');
    setCustomHours(entry.totalHours.toString());
    setCustomAmount(entry.totalAmount.toString());

    // Set custom work type state if the loaded workType is not one of standard options
    const isStandard = workOptions.some(opt => opt.label.toLowerCase() === (entry.workType || '').toLowerCase());
    setIsCustomWorkType(entry.workType ? !isStandard : false);

    setActiveTab('new-entry'); // Focus on the form column
    
    // Reset the ref on the next tick so the dynamic calculations can resume for any subsequent edits
    setTimeout(() => {
      isSettingEditValues.current = false;
    }, 50);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    isSettingEditValues.current = true;
    setEditingId(null);
    setDriverName('');
    setCustomerName('');
    setCustomerPhone('');
    setSiteLocation('');
    setStartMeter('');
    setEndMeter('');
    setDieselLiters('');
    setDieselAmount('');
    setWorkType('');
    setCustomHours('');
    setCustomAmount('');
    setIsCustomWorkType(false);
    setPaymentStatus('pending');
    setAmountPaid('0');
    
    setTimeout(() => {
      isSettingEditValues.current = false;
    }, 50);
  };

  // Delete an entry
  const handleDeleteEntry = (id: string) => {
    showConfirm(
      'Delete Record',
      'Are you sure you want to delete this work record? This action cannot be undone.',
      () => {
        const updated = entries.filter(entry => entry.id !== id);
        setEntries(updated);
        saveEntriesApi(updated);
        if (editingId === id) {
          handleCancelEdit();
        }
      },
      'Delete',
      'Cancel'
    );
  };

  // Mark record as fully Paid instantly
  const handleMarkAsPaid = (id: string) => {
    const updated = entries.map(entry => {
      if (entry.id === id) {
        return {
          ...entry,
          paymentStatus: 'paid' as const,
          amountPaid: entry.totalAmount
        };
      }
      return entry;
    });
    setEntries(updated);
    saveEntriesApi(updated);
  };

  // Reset entries back to sample data
  const handleResetToSamples = () => {
    showConfirm(
      'Restore Demo Records',
      'Are you sure you want to restore demo records? This will overwrite your current logs and any added entries.',
      () => {
        setEntries(SAMPLE_ENTRIES);
        saveEntriesApi(SAMPLE_ENTRIES);
        handleCancelEdit();
      },
      'Restore',
      'Cancel'
    );
  };

  const renderEntryCard = (entry: JcbEntry) => {
    const outstanding = entry.totalAmount - (entry.amountPaid || 0);
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -15, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        key={entry.id} 
        className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow transition-all duration-200 relative group text-left ${
          editingId === entry.id ? 'ring-2 ring-amber-500 border-transparent' : 'border-slate-200'
        }`}
      >
        {/* Top Header Row */}
        <div className="flex justify-between items-start mb-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={selectedIds.includes(entry.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(prev => [...prev, entry.id]);
                  } else {
                    setSelectedIds(prev => prev.filter(id => id !== entry.id));
                  }
                }}
                className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> {formatDisplayDate(entry.date)}
              </p>
            </div>
            <h4 className="text-sm font-black text-slate-800 line-clamp-1">{entry.customerName}</h4>
            <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> {entry.siteLocation}
            </p>
          </div>

          {/* Payment Status Badges */}
          <div className="text-right flex flex-col items-end gap-1">
            {entry.paymentStatus === 'paid' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
              </span>
            ) : entry.paymentStatus === 'partial' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-full">
                <AlertCircle className="w-3.5 h-3.5" /> Partial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full">
                <Clock className="w-3.5 h-3.5" /> Unpaid
              </span>
            )}
            <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(entry.totalAmount)}</p>
          </div>
        </div>

        {/* JCB Details / Times */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2.5 text-[11px] text-slate-600 font-medium">
          <div>
            <span className="text-[9px] text-slate-400 block uppercase">Driver / Operator</span>
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> {entry.driverName}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase">JCB Machine</span>
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-400" /> {entry.jcbMachineId}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-[9px] text-slate-400 block uppercase">Duration / Time</span>
            <span className="font-bold text-slate-700">
              {entry.totalHours} Hrs 
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                ({entry.trackingType === 'hour-meter' 
                  ? `${entry.startMeter}→${entry.endMeter}m` 
                  : `${entry.startTime}→${entry.endTime}`})
              </span>
            </span>
          </div>
        </div>

        {/* Work Type if exists */}
        {entry.workType && (
          <p className="text-[11px] text-slate-600 mt-2.5 bg-slate-50/50 p-2 rounded border border-slate-100 border-dashed leading-relaxed flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Work Type:</span>
            <span className="text-slate-700 italic font-semibold">&ldquo;{entry.workType}&rdquo;</span>
          </p>
        )}

        {/* Financial settlement summary for Partial & Unpaid logs */}
        {entry.paymentStatus !== 'paid' && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold">
            <span className="text-rose-600">Pending: {formatCurrency(outstanding)}</span>
            <button
              onClick={() => handleMarkAsPaid(entry.id)}
              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 text-[10px] font-extrabold flex items-center gap-0.5 transition-all duration-150"
            >
              <Check className="w-3.5 h-3.5" /> Mark Fully Paid
            </button>
          </div>
        )}

        {/* Quick Edit/Delete Actions */}
        <div className="flex justify-end gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
          <button
            onClick={() => handleEditStart(entry)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => handleDeleteEntry(entry.id)}
            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </motion.div>
    );
  };

  // Filter and search entries
  const filteredEntries = entries.filter(entry => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      entry.driverName.toLowerCase().includes(query) ||
      entry.customerName.toLowerCase().includes(query) ||
      entry.siteLocation.toLowerCase().includes(query) ||
      entry.jcbMachineId.toLowerCase().includes(query);

    const matchesStatus = 
      statusFilter === 'all' || 
      entry.paymentStatus === statusFilter;

    const matchesDriver = 
      driverFilter === 'all' || 
      entry.driverName === driverFilter;

    return matchesSearch && matchesStatus && matchesDriver;
  }).sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortBy === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sortBy === 'driver-asc') {
      return a.driverName.localeCompare(b.driverName);
    }
    if (sortBy === 'customer-asc') {
      return a.customerName.localeCompare(b.customerName);
    }
    return 0;
  });

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) return;

    const name = newDriverName.trim();
    setDriverRegistry(prev => ({
      ...prev,
      [name]: {
        name,
        phone: newDriverPhone.trim() || '+91 95000 00000',
        status: 'Active',
        salary: Number(newDriverSalary) || 16000,
        advanceAmount: Number(newDriverAdvance) || 0,
        details: newDriverDetails.trim() || 'General Operator'
      }
    }));

    setCustomDrivers(prev => {
      if (prev.includes(name)) return prev;
      return [...prev, name];
    });

    setNewDriverName('');
    setNewDriverPhone('');
    setNewDriverSalary('16000');
    setNewDriverAdvance('0');
    setNewDriverDetails('');
    setShowAddDriverForm(false);
  };

  const handleSaveDriverEdit = (name: string) => {
    setDriverRegistry(prev => ({
      ...prev,
      [name]: {
        name,
        phone: editDriverPhone,
        status: editDriverStatus,
        salary: Number(editDriverSalary) || 0,
        advanceAmount: Number(editDriverAdvance) || 0,
        details: editDriverDetails
      }
    }));
    setEditingDriverName(null);
  };

  const renderDriversContent = () => {
    // Get unique drivers from custom list + entries
    const allDrivers = Array.from(new Set([
      ...customDrivers,
      ...entries.map(e => e.driverName.trim()).filter(Boolean)
    ]));

    // Filter by search query
    const filteredDrivers = allDrivers.filter(name => 
      name.toLowerCase().includes(driverSearchQuery.toLowerCase())
    );

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* Column Header */}
        <div className="p-5 border-b border-slate-100 flex-shrink-0 bg-white flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fleet Directory</h3>
            <h2 className="text-base font-black text-slate-800">JCB Operators ({allDrivers.length})</h2>
          </div>
          <button 
            onClick={() => setShowAddDriverForm(!showAddDriverForm)}
            className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            title="Register New Driver"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xl:inline">Add</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search operators..."
              value={driverSearchQuery}
              onChange={(e) => setDriverSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
            />
          </div>
          {driverSearchQuery && (
            <button 
              onClick={() => setDriverSearchQuery('')}
              className="px-2.5 py-1.5 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
          
          {/* Add Operator Inline Collapsible Form */}
          <AnimatePresence>
            {showAddDriverForm && (
              <motion.form 
                onSubmit={handleAddDriver}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-white border border-amber-200 rounded-xl p-4 shadow-sm space-y-3 flex-shrink-0"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" /> New Operator Registration
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowAddDriverForm(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operator Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Rajesh Kumar"
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                      <input 
                        type="text" 
                        placeholder="e.g. +91 98..."
                        value={newDriverPhone}
                        onChange={(e) => setNewDriverPhone(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monthly Salary (₹)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 16000"
                        value={newDriverSalary}
                        onChange={(e) => setNewDriverSalary(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Taken (₹)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 0"
                        value={newDriverAdvance}
                        onChange={(e) => setNewDriverAdvance(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operator Status</label>
                      <select
                        value={editDriverStatus}
                        onChange={(e: any) => setEditDriverStatus(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      >
                        <option value="Active">Active</option>
                        <option value="Idle">Idle</option>
                        <option value="On Leave">On Leave</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operator Details & Notes</label>
                    <textarea 
                      placeholder="e.g. Experienced in trenching work, highly recommended..."
                      value={newDriverDetails}
                      onChange={(e) => setNewDriverDetails(e.target.value)}
                      rows={2}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
                >
                  Register Operator
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Directory Listings */}
          {filteredDrivers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No operators matched your search.</p>
            </div>
          ) : (
            filteredDrivers.map(name => {
              // Retrieve or fallback registry details
              const reg = driverRegistry[name] || {
                name,
                phone: '+91 98765 43210',
                rate: 1200,
                status: 'Active' as const
              };

              // Compute driver metrics from actual entries
              const driverJobs = entries.filter(e => e.driverName.trim() === name.trim());
              const totalHours = driverJobs.reduce((sum, e) => sum + e.totalHours, 0);
              const totalRevenue = driverJobs.reduce((sum, e) => sum + e.totalAmount, 0);
              const totalJobs = driverJobs.length;

              // Check if driver has a job today or active
              const hasRecentJob = driverJobs.some(e => {
                const diffTime = Math.abs(new Date().getTime() - new Date(e.date).getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
              });

              const status = reg.status || (hasRecentJob ? 'Active' : 'Idle');

              // Initials for avatar
              const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

              return (
                <motion.div 
                  key={name}
                  whileHover={{ y: -1 }}
                  className={`p-3.5 rounded-xl border bg-white shadow-sm transition-all duration-200 ${
                    driverFilter === name 
                      ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md shadow-amber-500/5' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {editingDriverName === name ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Edit Operator Profile</span>
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">{status}</span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Contact Phone</label>
                          <input 
                            type="text" 
                            value={editDriverPhone}
                            onChange={(e) => setEditDriverPhone(e.target.value)}
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-semibold text-slate-800"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Monthly Salary (₹)</label>
                            <input 
                              type="number" 
                              value={editDriverSalary}
                              onChange={(e) => setEditDriverSalary(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-bold text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Extra Taken / Adv (₹)</label>
                            <input 
                              type="number" 
                              value={editDriverAdvance}
                              onChange={(e) => setEditDriverAdvance(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-bold text-rose-700"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Status</label>
                            <select
                              value={editDriverStatus}
                              onChange={(e: any) => setEditDriverStatus(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-semibold text-slate-800"
                            >
                              <option value="Active">Active</option>
                              <option value="Idle">Idle</option>
                              <option value="On Leave">On Leave</option>
                            </select>
                          </div>
                          <div className="flex items-end pb-0.5">
                            <div className="text-[10px] text-slate-400 font-bold">
                              Net: <span className="text-emerald-600 font-extrabold">₹{(Number(editDriverSalary) - Number(editDriverAdvance)).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Operator Notes & Details</label>
                          <textarea 
                            value={editDriverDetails}
                            onChange={(e) => setEditDriverDetails(e.target.value)}
                            rows={2}
                            placeholder="Operator specialization, machine history..."
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-medium text-slate-700 resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingDriverName(null)}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDriverEdit(name)}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        {/* Left: Avatar & Info */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center font-black text-amber-800 text-xs shadow-inner">
                            {initials}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800 leading-tight">{name}</h4>
                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" /> {reg.phone}
                            </p>
                          </div>
                        </div>

                        {/* Right: Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                          status === 'Active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : status === 'On Leave'
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </div>

                      {/* Operator Stats */}
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-50 rounded-lg p-2 text-center text-[10px] font-bold text-slate-500 border border-slate-100 mb-2.5">
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase tracking-wider mb-0.5">Total Hours</span>
                          <span className="text-slate-800 font-black">{totalHours.toFixed(1)} Hrs</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase tracking-wider mb-0.5">Total Jobs</span>
                          <span className="text-slate-800 font-black">{totalJobs}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase tracking-wider mb-0.5">Revenue</span>
                          <span className="text-amber-700 font-black">{formatCurrency(totalRevenue)}</span>
                        </div>
                      </div>

                      {/* Salary & Details & Extra Amount Taken Section */}
                      <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-2.5 mb-2.5 space-y-2">
                        {/* DETAILS */}
                        <div className="text-[11px] text-slate-600 leading-relaxed italic">
                          <span className="text-[8px] font-black text-slate-400 uppercase not-italic block mb-0.5 tracking-wider">Operator Details & Notes</span>
                          {reg.details ? `"${reg.details}"` : 'No details recorded for this operator.'}
                        </div>

                        {/* SALARY & EXTRA AMOUNT TAKEN */}
                        <div className="grid grid-cols-3 gap-1 border-t border-slate-200/60 pt-2 text-[10px]">
                          <div>
                            <span className="text-[8px] text-slate-400 block uppercase tracking-wider">Salary</span>
                            <span className="font-extrabold text-slate-700">₹{(reg.salary || 16000).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-rose-500 block uppercase tracking-wider">Extra Taken</span>
                            <span className="font-extrabold text-rose-600">₹{(reg.advanceAmount || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-emerald-600 block uppercase tracking-wider">Net Bal</span>
                            <span className="font-black text-emerald-700">₹{((reg.salary || 16000) - (reg.advanceAmount || 0)).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Row */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDriverName(name);
                            setEditDriverPhone(reg.phone || '');
                            setEditDriverSalary(String(reg.salary || 16000));
                            setEditDriverAdvance(String(reg.advanceAmount || 0));
                            setEditDriverDetails(reg.details || '');
                            setEditDriverStatus(status);
                          }}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-1"
                          title="Edit details, salary & advances"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Edit Info
                        </button>

                        <div className="flex gap-1">
                          {/* Clear filter or apply filter */}
                          {driverFilter === name ? (
                            <button
                              type="button"
                              onClick={() => setDriverFilter('all')}
                              className="px-2 py-1 bg-amber-500 text-slate-950 rounded-md text-[9px] font-extrabold uppercase hover:bg-amber-400 flex items-center gap-1 transition-all"
                            >
                              <Check className="w-2.5 h-2.5" /> Showing Logs
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDriverFilter(name);
                                // Switch to Work Records tab on mobile to let them see
                                if (layoutMode === 'tabs') {
                                  setActiveTab('records');
                                }
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 hover:border-amber-200 text-slate-600 rounded-md text-[9px] font-bold uppercase transition-all"
                            >
                              Filter Logs
                            </button>
                          )}

                          {/* Delete Custom Added Driver */}
                          {customDrivers.includes(name) && totalJobs === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomDrivers(prev => prev.filter(n => n !== name));
                                setDriverRegistry(prev => {
                                  const updated = { ...prev };
                                  delete updated[name];
                                  return updated;
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                              title="Unregister Operator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} logoutNotice={logoutNotice} />;
  }

  if (userRole === 'customer') {
    return (
      <CustomerPortal 
        customerName={loggedInUser} 
        entries={entries} 
        onLogout={handleGlobalLogout} 
        onUpdateEntries={(updated) => setEntries(updated)} 
        initialTab={customerPortalInitialTab}
      />
    );
  }

  return (
    <motion.div 
      id="jcb-app" 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="flex h-screen w-full bg-slate-100 text-slate-900 antialiased font-sans overflow-hidden"
    >
      
      {/* 1. Left Navigation Bar (Professional Polish theme style - Desktop) */}
      <nav id="sidebar-nav" className="hidden md:flex w-20 bg-slate-900 flex-col items-center py-6 justify-between border-r border-slate-800 flex-shrink-0 z-10">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Main Logo Container */}
          <div id="app-logo" className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30 group cursor-pointer hover:bg-amber-400 transition-all duration-300">
            <span className="text-slate-950 font-black text-xl select-none">JCB</span>
          </div>

          {/* Quick tab switch buttons (Visible on all screens, but drives tabs on tablet/mobile) */}
          <div className="flex flex-col gap-5 w-full px-2">
            <button
              id="nav-btn-dashboard"
              onClick={() => { setActiveTab('dashboard'); }}
              title="Dashboard"
              className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                activeTab === 'dashboard' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <LayoutDashboard className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Dash</span>
            </button>

            <button
              id="nav-btn-new-entry"
              onClick={() => { setActiveTab('new-entry'); }}
              title="New Entry Form"
              className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                activeTab === 'new-entry' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Plus className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Log</span>
            </button>

            <button
              id="nav-btn-records"
              onClick={() => { setActiveTab('records'); }}
              title="Work Records"
              className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                activeTab === 'records' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <FileText className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Recs</span>
            </button>

            <button
              id="nav-btn-drivers"
              onClick={() => { setActiveTab('drivers'); }}
              title="Driver Directory"
              className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                activeTab === 'drivers' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Users className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Driver</span>
            </button>

            <button
              id="nav-btn-profile"
              onClick={() => { setActiveTab('profile'); }}
              title="Profile & Settings"
              className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                activeTab === 'profile' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <User className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Prof</span>
            </button>
          </div>
        </div>

        {/* Footer actions of Nav */}
        <div className="flex flex-col items-center gap-4 w-full">
          <button 
            id="btn-demo-data"
            onClick={handleResetToSamples}
            title="Reset to Demo Data"
            className="p-2.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-amber-500 transition-all duration-200"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-amber-500 select-none overflow-hidden" title={`Logged in as ${loggedInUser || 'Operator'}`}>
            {adminProfilePic ? (
              <img src={adminProfilePic} alt="Admin" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              loggedInUser ? loggedInUser.slice(0, 2).toUpperCase() : 'JD'
            )}
          </div>
        </div>
      </nav>

      {/* Main Right Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <header id="app-header" className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
              JCB <span className="text-amber-600 font-black">WorkManager</span>
            </h1>
            <span className="hidden md:inline-flex px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full uppercase tracking-wider">
              Fleet Log
            </span>
          </div>

          {/* Desktop Layout Mode Switcher, Offline Indicator & Date */}
          <div className="flex items-center gap-3">
            <OfflineIndicator />
            <div className="hidden lg:flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLayoutMode('tabs')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'tabs' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Single Tab Focus View"
              >
                Focus Tabs
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('columns')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'columns' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Multi-Column Grid View"
              >
                3-Column Grid
              </button>
            </div>

            <span className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Dynamic Column Wrapper (Accommodates either 3 Columns Side-by-Side OR Single-column Tab Switcher) */}
        <div id="content-container" className="flex-1 overflow-hidden bg-slate-50 relative pb-16 md:pb-0">
          
          {/* Outer container adjusting for 3 columns side-by-side or tab view */}
          <div 
            id="columns-wrapper"
            className={`h-full w-full p-4 lg:p-6 gap-6 overflow-hidden ${
              layoutMode === 'columns' && activeTab !== 'profile'
                ? 'hidden lg:grid lg:grid-cols-12' // 3 unequal columns: Col1 (Dashboard): 3/12, Col2 (Form): 4/12, Col3 (Records): 5/12
                : 'hidden' // Mobile layout or Tabbed view or Profile active
            }`}
          >
            {/* COLUMN 1: DASHBOARD */}
            <motion.section 
              id="col-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
              className={`flex flex-col gap-4 overflow-hidden h-full ${
                layoutMode === 'columns' 
                  ? 'col-span-3' 
                  : activeTab === 'dashboard' ? 'flex flex-1' : 'hidden'
              }`}
            >
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-y-scroll custom-scrollbar h-full max-h-full">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard</h3>
                    <h2 className="text-base font-black text-slate-800">Fleet Analytics</h2>
                  </div>
                  <TrendingUp className="text-amber-500 w-5 h-5" />
                </div>

                {/* Grid of Mini Cards */}
                <div className="space-y-3">
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="p-3.5 bg-amber-50 rounded-lg border border-amber-100 shadow-sm cursor-pointer"
                  >
                    <p className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">Total Working Hours</p>
                    <p className="text-3xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                      {stats.totalHours} <span className="text-xs font-semibold text-slate-500">Hrs</span>
                    </p>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-100 shadow-sm cursor-pointer"
                  >
                    <p className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">Weekly Revenue (Last 7 Days)</p>
                    <p className="text-3xl font-black text-emerald-950 mt-1">
                      {formatCurrency(weeklyRevenue)}
                    </p>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
                  >
                    <p className="text-slate-700 text-[11px] font-bold uppercase tracking-wider">Total Billing (Revenue)</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </motion.div>
                </div>

                {/* Weekly Revenue Graph Section */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Weekly Revenue Trend
                    </h4>
                    <span className="text-[9px] bg-amber-500/10 text-amber-600 font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                      Click Bar to Inspect
                    </span>
                  </div>
                  {weeklyChartData.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No revenue logged yet.</p>
                  ) : (
                    <div className="w-full h-[180px] mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={weeklyChartData}
                          margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                            contentStyle={{ 
                              background: '#0f172a', 
                              border: 'none', 
                              borderRadius: '8px', 
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                            formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                          />
                          <Bar 
                            dataKey="Revenue" 
                            fill="#f59e0b" 
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(data) => {
                              if (data && data.payload) {
                                setSelectedWeekNum(data.payload.weekNum);
                                setShowWeekModal(true);
                              }
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Payments & Pending Section (Down the Weekly Revenue) */}
                <div className="mt-5 border-t border-slate-100 pt-4 space-y-3">
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="p-3.5 bg-blue-50 rounded-lg border border-blue-100 shadow-sm cursor-pointer"
                  >
                    <p className="text-blue-700 text-[11px] font-bold uppercase tracking-wider">Payments Received</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {formatCurrency(stats.totalPaid)}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full" 
                        style={{ width: `${stats.totalRevenue > 0 ? (stats.totalPaid / stats.totalRevenue) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    onClick={() => {
                      setShowPendingModal(true);
                      if (pendingCustomersList.length > 0) {
                        setSelectedPendingCustomer(pendingCustomersList[0].name);
                      } else {
                        setSelectedPendingCustomer(null);
                      }
                    }}
                    className="p-3.5 bg-rose-50 rounded-lg border border-rose-100 shadow-sm cursor-pointer hover:bg-rose-100/60 transition-colors"
                  >
                    <p className="text-rose-700 text-[11px] font-bold uppercase tracking-wider">Pending Payments</p>
                    <p className="text-2xl font-bold text-rose-900 mt-1">
                      {formatCurrency(stats.totalPending)}
                    </p>
                  </motion.div>
                </div>

                {/* Driver Hours performance */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Driver Utilization</h4>
                  <div className="space-y-3">
                    {Object.keys(stats.driverStats).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No driver data logged yet.</p>
                    ) : (
                      Object.entries(stats.driverStats).map(([driver, dstats]) => {
                        const percent = stats.totalHours > 0 ? (dstats.hours / stats.totalHours) * 100 : 0;
                        return (
                          <div key={driver} className="text-xs">
                            <div className="flex justify-between font-bold text-slate-700 mb-1">
                              <span>{driver}</span>
                              <span>{dstats.hours} Hrs ({dstats.count} jobs)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div 
                                className="bg-amber-500 h-2 rounded-full" 
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Client Booking Requests */}
                {adminBookings.some(b => b.status === 'pending') && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" /> Pending Client Bookings ({adminBookings.filter(b => b.status === 'pending').length})
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {adminBookings.filter(b => b.status === 'pending').map((booking) => (
                        <div key={booking.id} className="p-3 bg-amber-50/60 border border-amber-200/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800">{booking.customerName}</span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-md">{booking.date}</span>
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            <p>📍 Location: <strong>{booking.siteLocation}</strong></p>
                            <p>⚙️ Work: <strong>{booking.workType} ({booking.startTime || '08:00'}-{booking.endTime || '12:00'}, {booking.estimatedHours} hrs on {booking.machineId})</strong></p>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleDeclineBooking(booking.id)}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveBooking(booking)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black cursor-pointer shadow-sm transition-all"
                            >
                              Approve & Log
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Insights Co-Pilot Panel */}
                <div className="mt-6">
                  <AiInsightsPanel entries={entries} stats={stats} />
                </div>

                {/* Fuel/Alert simulation panel matching style */}
                <div className="mt-6 p-4 bg-slate-900 text-white rounded-xl shadow-inner">
                  <h4 className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                    <Info className="w-4 h-4" /> Operations Advisory
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    Set correct hourly rates to ensure accurate invoicing. Use <b>Hour Meter</b> tracking mode for raw machine logging.
                  </p>
                  <button 
                    onClick={() => exportDataAsJSON(entries)}
                    className="w-full py-2 bg-slate-800 rounded-lg text-xs font-bold text-amber-500 hover:bg-slate-700 transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Data Backup
                  </button>
                </div>
              </div>
            </motion.section>

            {/* COLUMN 2: NEW ENTRY FORM */}
            <motion.section 
              id="col-new-entry"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
              className={`flex flex-col h-full overflow-hidden ${
                layoutMode === 'columns' 
                  ? 'col-span-3' 
                  : activeTab === 'new-entry' ? 'flex flex-1' : 'hidden'
              }`}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {editingId ? 'Modify Record' : 'Data Input'}
                    </h3>
                    <h2 className="text-base font-black text-slate-800">
                      {editingId ? 'Edit Work Entry' : 'Log New JCB Session'}
                    </h2>
                  </div>
                  {editingId && (
                    <button 
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel Edit
                    </button>
                  )}
                </div>

                {/* Form scroll wrapper */}
                <form 
                  id="log-new-entry-form"
                  onSubmit={handleSubmitEntry} 
                  className="flex-1 overflow-y-auto p-5 space-y-5"
                >
                  {/* Date Input */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" /> Log Date
                    </label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-medium"
                    />
                  </div>

                  {/* JCB Machine Details Section */}
                  <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-3">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" /> 1. JCB Machine Details
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Machine ID</label>
                        <select 
                          value={jcbMachineId}
                          onChange={(e) => setJcbMachineId(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-800"
                        >
                          {machines.length === 0 ? (
                            <option value="">No Active Machines</option>
                          ) : (
                            machines.map((mach) => (
                              <option key={mach} value={mach}>⚡ {mach}</option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate Per Hour (₹)</label>
                        <input 
                          type="number"
                          min="0"
                          value={ratePerHour || ''}
                          onChange={(e) => setRatePerHour(parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 1000"
                          required
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Driver Details Section */}
                  <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-3">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> 2. Operator Details
                    </p>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Name *</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Rajesh Kumar"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Customer details */}
                  <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-3">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> 3. Customer & Site Details
                    </p>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer / Project Name *</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Aman Construction Group"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                        <input 
                          type="tel" 
                          placeholder="+91 98765 43210"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Site Location</label>
                        <input 
                          type="text" 
                          placeholder="Sector 62, Noida"
                          value={siteLocation}
                          onChange={(e) => setSiteLocation(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">Work Hours</label>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          placeholder={currentCalculatedHours > 0 ? `${currentCalculatedHours}` : "e.g. 8"}
                          value={customHours}
                          onChange={(e) => setCustomHours(e.target.value)}
                          className="w-full p-2 bg-amber-50 border border-amber-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">Amount Charged (₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder={currentCalculatedAmount > 0 ? `${currentCalculatedAmount}` : "e.g. 12000"}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="w-full p-2 bg-amber-50 border border-amber-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time Logging */}
                  <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> 4. Time Tracking
                      </p>
                      
                      {/* Tracking toggle */}
                      <div className="flex bg-slate-200 p-0.5 rounded-md text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setTrackingType('hour-meter')}
                          className={`px-2 py-1 rounded ${trackingType === 'hour-meter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                          Meter
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrackingType('clock')}
                          className={`px-2 py-1 rounded ${trackingType === 'clock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                          Clock
                        </button>
                      </div>
                    </div>

                    {trackingType === 'hour-meter' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Hour Meter</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="e.g. 1240.5"
                            value={startMeter}
                            onChange={(e) => setStartMeter(e.target.value)}
                            required={trackingType === 'hour-meter'}
                            className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Hour Meter</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="e.g. 1246.0"
                            value={endMeter}
                            onChange={(e) => setEndMeter(e.target.value)}
                            required={trackingType === 'hour-meter'}
                            className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-800"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                          <input 
                            type="time" 
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            required={trackingType === 'clock'}
                            className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Time</label>
                          <input 
                            type="time" 
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            required={trackingType === 'clock'}
                            className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial status */}
                  <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-3">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> 5. Payment Details
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select 
                          value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value as any)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        >
                          <option value="pending">Unpaid (Pending)</option>
                          <option value="partial">Partial Paid</option>
                          <option value="paid">Fully Paid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount Paid (₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          disabled={paymentStatus === 'paid' || paymentStatus === 'pending'}
                          value={paymentStatus === 'paid' ? currentCalculatedAmount : paymentStatus === 'pending' ? '0' : amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Work Type section */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Work Type</label>
                      <span className="text-[10px] font-semibold text-slate-400 italic">Select from list or type custom</span>
                    </div>

                    <select
                      value={isCustomWorkType ? 'Custom' : workType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setIsCustomWorkType(true);
                          setWorkType('');
                        } else {
                          setIsCustomWorkType(false);
                          setWorkType(val);
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">-- Select Work Type --</option>
                      {workOptions.map((opt) => (
                        <option key={opt.label} value={opt.label}>
                          {opt.emoji} {opt.label}
                        </option>
                      ))}
                      <option value="Custom">✏️ Custom / Other...</option>
                    </select>

                    {(isCustomWorkType || (!workOptions.some(opt => opt.label.toLowerCase() === workType.toLowerCase()) && workType !== '')) && (
                      <input 
                        type="text"
                        placeholder="Type custom work type here..."
                        value={workType}
                        onChange={(e) => setWorkType(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-2"
                      />
                    )}

                    <button
                      type="button"
                      onClick={handleGenerateNarrative}
                      disabled={isGeneratingNarrative}
                      className="w-full py-2 px-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 text-amber-700 border border-amber-300 hover:border-amber-400 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm mt-2"
                    >
                      {isGeneratingNarrative ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Crafting Smart Narrative...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          AI Smart Work Narrative
                        </>
                      )}
                    </button>
                  </div>

                  {/* Dynamically calculated bill preview */}
                  <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <span>Live Calculator</span>
                      <span className="text-amber-500">Auto generated bill</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-semibold text-slate-300">Total Hours Worked</span>
                      <div className="overflow-hidden h-7 flex items-center">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span 
                            key={currentCalculatedHours}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="text-lg font-black text-white inline-block"
                          >
                            {currentCalculatedHours} Hrs
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-slate-800 pt-2">
                      <span className="text-sm font-semibold text-slate-300">Total Bill Amount</span>
                      <div className="overflow-hidden h-9 flex items-center">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span 
                            key={currentCalculatedAmount}
                            initial={{ opacity: 0, scale: 0.9, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 5 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="text-2xl font-black text-amber-500 inline-block"
                          >
                            {formatCurrency(currentCalculatedAmount)}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <button 
                    type="submit" 
                    className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/10 hover:bg-amber-400 active:scale-[0.99] transition-all duration-150 uppercase tracking-wider text-xs"
                  >
                    {editingId ? 'Save Edited Entry' : 'Add Work Log Entry'}
                  </button>
                </form>
              </div>
            </motion.section>

            {/* COLUMN 3: RECORDS LISTING */}
            <motion.section 
              id="col-records"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
              className={`flex flex-col h-full overflow-hidden ${
                layoutMode === 'columns' 
                  ? 'col-span-3' 
                  : activeTab === 'records' ? 'flex flex-1' : 'hidden'
              }`}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex-shrink-0 bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved History</h3>
                      <h2 className="text-base font-black text-slate-800">Work Logs ({filteredEntries.length})</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="hidden sm:flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          title="Table View (with Driver column)"
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            viewMode === 'table' ? 'bg-white text-slate-850 shadow-sm font-black' : 'text-slate-500 hover:text-slate-750'
                          }`}
                        >
                          <LayoutGrid className="w-3 h-3 text-amber-500" />
                          <span>Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('card')}
                          title="Card View"
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            viewMode === 'card' ? 'bg-white text-slate-850 shadow-sm font-black' : 'text-slate-500 hover:text-slate-750'
                          }`}
                        >
                          <Layers className="w-3 h-3 text-amber-500" />
                          <span>Card</span>
                        </button>
                      </div>
                      <button 
                        onClick={() => exportDataAsPDF(filteredEntries, "JCB Work Logs Statement")}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Export PDF
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters Section */}
                  <div className="space-y-2.5">
                    {/* Search query */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Search driver, site, customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none transition-all font-medium"
                      />
                    </div>

                    {/* Filter selector row */}
                    <div className="hidden sm:grid sm:grid-cols-3 gap-2">
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                          <option value="all">All Payments</option>
                          <option value="paid">Paid</option>
                          <option value="pending">Unpaid</option>
                          <option value="partial">Partial</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold">
                        <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <select
                          value={driverFilter}
                          onChange={(e) => setDriverFilter(e.target.value)}
                          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                          <option value="all">All Drivers</option>
                          {uniqueDrivers.map(drv => (
                            <option key={drv} value={drv}>{drv}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                          <option value="date-desc">Date (New)</option>
                          <option value="date-asc">Date (Old)</option>
                          <option value="driver-asc">Driver Name</option>
                          <option value="customer-asc">Customer Name</option>
                        </select>
                      </div>
                    </div>

                    {/* Bulk Selection and Deletion Bar */}
                    {filteredEntries.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(filteredEntries.map(entry => entry.id));
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer accent-amber-500"
                          />
                          <span className="text-xs font-bold text-slate-500 hover:text-slate-700">
                            Select All ({filteredEntries.length})
                          </span>
                        </label>

                        {selectedIds.length > 0 && (
                          <button
                            onClick={() => {
                              showConfirm(
                                'Bulk Delete Records',
                                `Are you sure you want to delete the ${selectedIds.length} selected work records? This action cannot be undone.`,
                                () => {
                                  setEntries(prevEntries => {
                                    const updated = prevEntries.filter(entry => !selectedIds.includes(entry.id));
                                    return updated;
                                  });
                                  setSelectedIds([]);
                                },
                                'Delete Selected',
                                'Cancel'
                              );
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded font-bold text-xs flex items-center gap-1 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Listing of record cards */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  <AnimatePresence mode="popLayout">
                    {filteredEntries.length === 0 ? (
                      <motion.div 
                        key="no-records-column"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-slate-200 p-6"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <Search className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-extrabold text-slate-700">No work records found</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Try adjusting your search filters or add a new session log.</p>
                        {(searchQuery || statusFilter !== 'all' || driverFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('all');
                              setDriverFilter('all');
                            }}
                            className="mt-4 px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                          >
                            Reset Filters
                          </button>
                        )}
                      </motion.div>
                    ) : viewMode === 'table' ? (
                      <motion.div key="table-view-desktop-mobile" className="w-full">
                        <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm w-full">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                                <th className="p-3 text-center w-8">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedIds(filteredEntries.map(entry => entry.id));
                                      } else {
                                        setSelectedIds([]);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                                  />
                                </th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Customer / Location</th>
                                <th className="p-3">JCB Machine</th>
                                <th className="p-3">Driver / Operator</th>
                                <th className="p-3 text-center">Hours</th>
                                <th className="p-3 text-right">Billing</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredEntries.map((entry) => {
                                const outstanding = entry.totalAmount - entry.amountPaid;
                                return (
                                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(entry.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedIds(prev => [...prev, entry.id]);
                                          } else {
                                            setSelectedIds(prev => prev.filter(id => id !== entry.id));
                                          }
                                        }}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                                      />
                                    </td>
                                    <td className="p-3 font-semibold text-slate-500 whitespace-nowrap">
                                      {formatDisplayDate(entry.date)}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-extrabold text-slate-800">{entry.customerName}</div>
                                      <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 mt-0.5">
                                        <MapPin className="w-3 h-3 text-slate-400" /> {entry.siteLocation}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-extrabold text-slate-800 flex items-center gap-1 whitespace-nowrap">
                                        <Truck className="w-3.5 h-3.5 text-amber-500" /> {entry.jcbMachineId}
                                      </div>
                                      {entry.workType && (
                                        <div className="text-[10px] text-slate-400 italic font-medium mt-0.5 max-w-[150px] truncate">&ldquo;{entry.workType}&rdquo;</div>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-extrabold text-slate-800 flex items-center gap-1 whitespace-nowrap">
                                        <User className="w-3.5 h-3.5 text-slate-400" /> {entry.driverName}
                                      </div>
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold tracking-wider mt-1 inline-block">
                                        GPS Active
                                      </span>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <div className="font-black text-slate-800 font-mono">{entry.totalHours} Hrs</div>
                                      <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                                        {entry.trackingType === 'hour-meter' ? 'Meter' : 'Clock'}
                                      </div>
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      <div className="font-black text-slate-900 font-mono">{formatCurrency(entry.totalAmount)}</div>
                                      <div className="text-[10px] text-slate-400 font-medium">₹{entry.ratePerHour}/hr</div>
                                    </td>
                                    <td className="p-3 text-center">
                                      {entry.paymentStatus === 'paid' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold rounded-full uppercase">
                                          <Check className="w-2.5 h-2.5" /> Paid
                                        </span>
                                      ) : entry.paymentStatus === 'partial' ? (
                                        <span className="inline-flex flex-col items-center px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-bold rounded-md uppercase">
                                          <span>Partial</span>
                                          <span className="text-[8px] font-semibold text-rose-500 lowercase">due ₹{outstanding}</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex flex-col items-center px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold rounded-md uppercase">
                                          <span>Unpaid</span>
                                          <span className="text-[8px] font-semibold text-rose-500 lowercase">due ₹{entry.totalAmount}</span>
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleEditStart(entry)}
                                          className="p-1 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 rounded transition-colors cursor-pointer"
                                          title="Edit Record"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteEntry(entry.id)}
                                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                                          title="Delete Record"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="lg:hidden space-y-3 w-full">
                          {filteredEntries.map((entry) => renderEntryCard(entry))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="card-view-desktop-mobile" className="space-y-3 w-full">
                        {filteredEntries.map((entry) => renderEntryCard(entry))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>

            {/* COLUMN 4: DRIVERS LISTING */}
            <motion.section 
              id="col-drivers"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
              className={`flex flex-col h-full overflow-hidden ${
                layoutMode === 'columns' 
                  ? 'col-span-3' 
                  : activeTab === 'drivers' ? 'flex flex-1' : 'hidden'
              }`}
            >
              {renderDriversContent()}
            </motion.section>

          </div>

          {/* Single-Column Switcher view for Mobile or Tabbed Mode */}
          <div 
            id="mobile-tab-view"
            className={`h-full w-full p-4 flex flex-col gap-4 overflow-hidden ${
              layoutMode === 'tabs' || activeTab === 'profile' ? 'flex' : 'flex lg:hidden'
            }`}
          >
            {/* Direct Tab Rendering of Active View */}
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="mob-dash-tab"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  {/* Clone of Dashboard Content */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-y-auto h-full">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard</h3>
                      <h2 className="text-base font-black text-slate-800">Fleet Analytics</h2>
                    </div>
                    <TrendingUp className="text-amber-500 w-5 h-5" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">Total Working Hours</p>
                      <p className="text-3xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                        {stats.totalHours} <span className="text-xs font-semibold text-slate-500">Hrs</span>
                      </p>
                    </div>

                    <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">Weekly Revenue (Last 7 Days)</p>
                      <p className="text-3xl font-black text-emerald-950 mt-1">
                        {formatCurrency(weeklyRevenue)}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 sm:col-span-2">
                      <p className="text-slate-700 text-[11px] font-bold uppercase tracking-wider">Total Billing (Revenue)</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {formatCurrency(stats.totalRevenue)}
                      </p>
                    </div>
                  </div>

                  {/* Weekly Revenue Graph Section */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Weekly Revenue Trend
                      </h4>
                      <span className="text-[9px] bg-amber-500/10 text-amber-600 font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                        Click Bar to Inspect
                      </span>
                    </div>
                    {weeklyChartData.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No revenue logged yet.</p>
                    ) : (
                      <div className="w-full h-[180px] mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={weeklyChartData}
                            margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                              contentStyle={{ 
                                background: '#0f172a', 
                                border: 'none', 
                                borderRadius: '8px', 
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                              formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                            />
                            <Bar 
                              dataKey="Revenue" 
                              fill="#f59e0b" 
                              radius={[4, 4, 0, 0]}
                              maxBarSize={32}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(data) => {
                                if (data && data.payload) {
                                  setSelectedWeekNum(data.payload.weekNum);
                                  setShowWeekModal(true);
                                }
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Payments & Pending Section (Down the Weekly Revenue) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 border-t border-slate-100 pt-4">
                    <div className="p-3.5 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-blue-700 text-[11px] font-bold uppercase tracking-wider">Payments Received</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {formatCurrency(stats.totalPaid)}
                      </p>
                    </div>

                    <div 
                      onClick={() => {
                        setShowPendingModal(true);
                        if (pendingCustomersList.length > 0) {
                          setSelectedPendingCustomer(pendingCustomersList[0].name);
                        } else {
                          setSelectedPendingCustomer(null);
                        }
                      }}
                      className="p-3.5 bg-rose-50 rounded-lg border border-rose-100 shadow-sm cursor-pointer hover:bg-rose-100/60 transition-colors"
                    >
                      <p className="text-rose-700 text-[11px] font-bold uppercase tracking-wider">Pending Payments</p>
                      <p className="text-2xl font-bold text-rose-900 mt-1">
                        {formatCurrency(stats.totalPending)}
                      </p>
                    </div>
                  </div>

                  {/* Driver performance */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Driver Utilization</h4>
                    <div className="space-y-3">
                      {Object.keys(stats.driverStats).length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No driver data logged yet.</p>
                      ) : (
                        Object.entries(stats.driverStats).map(([driver, dstats]) => {
                          const percent = stats.totalHours > 0 ? (dstats.hours / stats.totalHours) * 100 : 0;
                          return (
                            <div key={driver} className="text-xs">
                              <div className="flex justify-between font-bold text-slate-700 mb-1">
                                <span>{driver}</span>
                                <span>{dstats.hours} Hrs ({dstats.count} jobs)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                  className="bg-amber-500 h-2 rounded-full" 
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Client Booking Requests */}
                  {adminBookings.some(b => b.status === 'pending') && (
                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" /> Pending Client Bookings ({adminBookings.filter(b => b.status === 'pending').length})
                      </h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {adminBookings.filter(b => b.status === 'pending').map((booking) => (
                          <div key={booking.id} className="p-3 bg-amber-50/60 border border-amber-200/50 rounded-xl space-y-2 text-left">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-slate-800">{booking.customerName}</span>
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-md">{booking.date}</span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                              <p>📍 Location: <strong>{booking.siteLocation}</strong></p>
                              <p>⚙️ Work: <strong>{booking.workType} ({booking.startTime || '08:00'}-{booking.endTime || '12:00'}, {booking.estimatedHours} hrs on {booking.machineId})</strong></p>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleDeclineBooking(booking.id)}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveBooking(booking)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black cursor-pointer shadow-sm transition-all"
                              >
                                Approve & Log
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Insights Co-Pilot Panel for Mobile Dashboard */}
                  <div className="mt-6">
                    <AiInsightsPanel entries={entries} stats={stats} />
                  </div>

                  <div className="mt-6 p-4 bg-slate-900 text-white rounded-xl shadow-inner text-center">
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      Generate full backups of your current stored entries to local storage JSON.
                    </p>
                    <button 
                      onClick={() => exportDataAsJSON(entries)}
                      className="w-full py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-amber-500 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Export Data Backup (.json)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'new-entry' && (
              <motion.div 
                key="mob-entry-tab"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {editingId ? 'Modify Record' : 'Data Input'}
                      </h3>
                      <h2 className="text-base font-black text-slate-800">
                        {editingId ? 'Edit Work Entry' : 'Log New JCB Session'}
                      </h2>
                    </div>
                    {editingId && (
                      <button 
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel Edit
                      </button>
                    )}
                  </div>

                  <form 
                    id="mobile-log-form"
                    onSubmit={handleSubmitEntry} 
                    className="flex-1 overflow-y-auto p-5 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" /> Log Date
                      </label>
                      <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      />
                    </div>

                    {/* Machine Details */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" /> 1. JCB Machine Details
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Machine ID</label>
                          <select 
                            value={jcbMachineId}
                            onChange={(e) => setJcbMachineId(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800"
                          >
                            {machines.length === 0 ? (
                              <option value="">No Active Machines</option>
                            ) : (
                              machines.map((mach) => (
                                <option key={mach} value={mach}>⚡ {mach}</option>
                              ))
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Rate Per Hour (₹)</label>
                          <input 
                            type="number"
                            min="0"
                            value={ratePerHour || ''}
                            onChange={(e) => setRatePerHour(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 1000"
                            required
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Operator */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> 2. Operator Details
                      </p>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Driver Name *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Rajesh Kumar"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          required
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> 3. Customer & Site Details
                      </p>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Customer Name *</label>
                        <input 
                          type="text" 
                          placeholder="Aman Construction"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Phone</label>
                          <input 
                            type="tel" 
                            placeholder="+91..."
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Location</label>
                          <input 
                            type="text" 
                            placeholder="Site Noida"
                            value={siteLocation}
                            onChange={(e) => setSiteLocation(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-amber-700 uppercase mb-0.5">Work Hours</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder={currentCalculatedHours > 0 ? `${currentCalculatedHours}` : "e.g. 8"}
                            value={customHours}
                            onChange={(e) => setCustomHours(e.target.value)}
                            className="w-full p-1.5 bg-amber-50 border border-amber-200 rounded text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-amber-700 uppercase mb-0.5">Amount Charged (₹)</label>
                          <input 
                            type="number" 
                            min="0"
                            placeholder={currentCalculatedAmount > 0 ? `${currentCalculatedAmount}` : "e.g. 12000"}
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full p-1.5 bg-amber-50 border border-amber-200 rounded text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Time Tracking */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> 4. Time Tracking
                        </p>
                        <div className="flex bg-slate-200 p-0.5 rounded text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={() => setTrackingType('hour-meter')}
                            className={`px-1.5 py-0.5 rounded ${trackingType === 'hour-meter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                          >
                            Meter
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrackingType('clock')}
                            className={`px-1.5 py-0.5 rounded ${trackingType === 'clock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                          >
                            Clock
                          </button>
                        </div>
                      </div>

                      {trackingType === 'hour-meter' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Start Meter</label>
                            <input 
                              type="number" 
                              step="0.01"
                              placeholder="1240.5"
                              value={startMeter}
                              onChange={(e) => setStartMeter(e.target.value)}
                              required={trackingType === 'hour-meter'}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">End Meter</label>
                            <input 
                              type="number" 
                              step="0.01"
                              placeholder="1246.0"
                              value={endMeter}
                              onChange={(e) => setEndMeter(e.target.value)}
                              required={trackingType === 'hour-meter'}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Start Time</label>
                            <input 
                              type="time" 
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              required={trackingType === 'clock'}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">End Time</label>
                            <input 
                              type="time" 
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              required={trackingType === 'clock'}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Financial status */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" /> 5. Payment Details
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Status</label>
                          <select 
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value as any)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                          >
                            <option value="pending">Unpaid</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Paid (₹)</label>
                          <input 
                            type="number" 
                            disabled={paymentStatus === 'paid' || paymentStatus === 'pending'}
                            value={paymentStatus === 'paid' ? currentCalculatedAmount : paymentStatus === 'pending' ? '0' : amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Work Type</label>
                      <select
                        value={isCustomWorkType ? 'Custom' : workType}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Custom') {
                            setIsCustomWorkType(true);
                            setWorkType('');
                          } else {
                            setIsCustomWorkType(false);
                            setWorkType(val);
                          }
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="">-- Select Work Type --</option>
                        {workOptions.map((opt) => (
                          <option key={opt.label} value={opt.label}>
                            {opt.emoji} {opt.label}
                          </option>
                        ))}
                        <option value="Custom">✏️ Custom / Other...</option>
                      </select>

                      {(isCustomWorkType || (!workOptions.some(opt => opt.label.toLowerCase() === workType.toLowerCase()) && workType !== '')) && (
                        <input 
                          type="text" 
                          placeholder="Type custom work type here..."
                          value={workType}
                          onChange={(e) => setWorkType(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 mt-2"
                        />
                      )}

                      <button
                        type="button"
                        onClick={handleGenerateNarrative}
                        disabled={isGeneratingNarrative}
                        className="w-full py-2 px-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 text-amber-700 border border-amber-300 hover:border-amber-400 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm mt-2"
                      >
                        {isGeneratingNarrative ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Crafting Smart Narrative...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            AI Smart Work Narrative
                          </>
                        )}
                      </button>
                    </div>

                    {/* Cost Preview */}
                    <div className="p-3 bg-slate-950 text-white rounded-lg flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">DYNAMIC COST</span>
                        <span className="font-extrabold text-amber-400">{formatCurrency(currentCalculatedAmount)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">TOTAL HOURS</span>
                        <span className="font-extrabold text-slate-100">{currentCalculatedHours} Hrs</span>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3 bg-amber-500 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider shadow"
                    >
                      {editingId ? 'Save Edited Entry' : 'Log Entry Record'}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {activeTab === 'records' && (
              <motion.div 
                key="mob-records-tab"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex-1 overflow-hidden flex flex-col"
              >
                {/* Clone of Records listing content */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex-shrink-0 bg-white">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved History</h3>
                        <h2 className="text-base font-black text-slate-800">Work Logs ({filteredEntries.length})</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="hidden sm:flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            title="Table View (with Driver column)"
                            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                              viewMode === 'table' ? 'bg-white text-slate-850 shadow-sm font-black' : 'text-slate-500 hover:text-slate-750'
                            }`}
                          >
                            <LayoutGrid className="w-3 h-3 text-amber-500" />
                            <span>Table</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('card')}
                            title="Card View"
                            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                              viewMode === 'card' ? 'bg-white text-slate-850 shadow-sm font-black' : 'text-slate-500 hover:text-slate-750'
                            }`}
                          >
                            <Layers className="w-3 h-3 text-amber-500" />
                            <span>Card</span>
                          </button>
                        </div>
                        <button 
                          onClick={() => exportDataAsPDF(filteredEntries, "JCB Work Logs Statement")}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Export PDF
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          placeholder="Search driver, site, customer..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white"
                        />
                      </div>

                      <div className="hidden sm:grid sm:grid-cols-3 gap-1.5">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 focus:outline-none"
                        >
                          <option value="all">All Payments</option>
                          <option value="paid">Paid Only</option>
                          <option value="pending">Unpaid Only</option>
                          <option value="partial">Partial Only</option>
                        </select>
                        <select
                          value={driverFilter}
                          onChange={(e) => setDriverFilter(e.target.value)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 focus:outline-none"
                        >
                          <option value="all">All Drivers</option>
                          {uniqueDrivers.map(drv => (
                            <option key={drv} value={drv}>{drv}</option>
                          ))}
                        </select>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 focus:outline-none"
                        >
                          <option value="date-desc">Date (New)</option>
                          <option value="date-asc">Date (Old)</option>
                          <option value="driver-asc">Driver Name</option>
                          <option value="customer-asc">Customer Name</option>
                        </select>
                      </div>
                    </div>

                    {/* Bulk Selection and Deletion Bar */}
                    {filteredEntries.length > 0 && (
                      <div className="mt-3 pt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(filteredEntries.map(entry => entry.id));
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer accent-amber-500"
                          />
                          <span className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                            Select All ({filteredEntries.length})
                          </span>
                        </label>

                        {selectedIds.length > 0 && (
                          <button
                            onClick={() => {
                              showConfirm(
                                'Bulk Delete Records',
                                `Are you sure you want to delete the ${selectedIds.length} selected work records? This action cannot be undone.`,
                                () => {
                                  setEntries(prevEntries => {
                                    const updated = prevEntries.filter(entry => !selectedIds.includes(entry.id));
                                    return updated;
                                  });
                                  setSelectedIds([]);
                                },
                                'Delete Selected',
                                'Cancel'
                              );
                            }}
                            className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded font-bold text-[10px] flex items-center gap-1 transition-all"
                          >
                            <Trash2 className="w-3 h-3" /> Delete Selected ({selectedIds.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                    <AnimatePresence mode="popLayout">
                      {viewMode === 'table' ? (
                        <motion.div key="table-view-history" className="w-full">
                          <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm w-full">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                                  <th className="p-3 text-center w-8">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.length}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedIds(filteredEntries.map(entry => entry.id));
                                        } else {
                                          setSelectedIds([]);
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                                    />
                                  </th>
                                  <th className="p-3">Date</th>
                                  <th className="p-3">Customer / Location</th>
                                  <th className="p-3">JCB Machine</th>
                                  <th className="p-3">Driver / Operator</th>
                                  <th className="p-3 text-center">Hours</th>
                                  <th className="p-3 text-right">Billing</th>
                                  <th className="p-3 text-center">Status</th>
                                  <th className="p-3 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredEntries.map((entry) => {
                                  const outstanding = entry.totalAmount - entry.amountPaid;
                                  return (
                                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={selectedIds.includes(entry.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedIds(prev => [...prev, entry.id]);
                                            } else {
                                              setSelectedIds(prev => prev.filter(id => id !== entry.id));
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                                        />
                                      </td>
                                      <td className="p-3 font-semibold text-slate-500 whitespace-nowrap">
                                        {formatDisplayDate(entry.date)}
                                      </td>
                                      <td className="p-3">
                                        <div className="font-extrabold text-slate-800">{entry.customerName}</div>
                                        <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 mt-0.5">
                                          <MapPin className="w-3 h-3 text-slate-400" /> {entry.siteLocation}
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-extrabold text-slate-800 flex items-center gap-1 whitespace-nowrap">
                                          <Truck className="w-3.5 h-3.5 text-amber-500" /> {entry.jcbMachineId}
                                        </div>
                                        {entry.workType && (
                                          <div className="text-[10px] text-slate-400 italic font-medium mt-0.5 max-w-[150px] truncate">&ldquo;{entry.workType}&rdquo;</div>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        <div className="font-extrabold text-slate-800 flex items-center gap-1 whitespace-nowrap">
                                          <User className="w-3.5 h-3.5 text-slate-400" /> {entry.driverName}
                                        </div>
                                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold tracking-wider mt-1 inline-block">
                                          GPS Active
                                        </span>
                                      </td>
                                      <td className="p-3 text-center whitespace-nowrap">
                                        <div className="font-black text-slate-800 font-mono">{entry.totalHours} Hrs</div>
                                        <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                                          {entry.trackingType === 'hour-meter' ? 'Meter' : 'Clock'}
                                        </div>
                                      </td>
                                      <td className="p-3 text-right whitespace-nowrap">
                                        <div className="font-black text-slate-900 font-mono">{formatCurrency(entry.totalAmount)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">₹{entry.ratePerHour}/hr</div>
                                      </td>
                                      <td className="p-3 text-center">
                                        {entry.paymentStatus === 'paid' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold rounded-full uppercase">
                                            <Check className="w-2.5 h-2.5" /> Paid
                                          </span>
                                        ) : entry.paymentStatus === 'partial' ? (
                                          <span className="inline-flex flex-col items-center px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-bold rounded-md uppercase">
                                            <span>Partial</span>
                                            <span className="text-[8px] font-semibold text-rose-500 lowercase">due ₹{outstanding}</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex flex-col items-center px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold rounded-md uppercase">
                                            <span>Unpaid</span>
                                            <span className="text-[8px] font-semibold text-rose-500 lowercase">due ₹{entry.totalAmount}</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleEditStart(entry)}
                                            className="p-1 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 rounded transition-colors cursor-pointer"
                                            title="Edit Record"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteEntry(entry.id)}
                                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                                            title="Delete Record"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="lg:hidden space-y-3 w-full">
                            {filteredEntries.map((entry) => renderEntryCard(entry))}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="card-view-history" className="space-y-3 w-full">
                          {filteredEntries.map((entry) => renderEntryCard(entry))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'drivers' && (
              <motion.div 
                key="mob-drivers-tab"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex-1 overflow-hidden flex flex-col h-full"
              >
                {renderDriversContent()}
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                key="mob-profile-tab"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex-1 overflow-y-auto"
              >
                {/* Admin/Owner Profile Panel */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fleet Admin Control</h3>
                      <h2 className="text-xl font-black text-slate-800">Owner Profile & Settings</h2>
                    </div>
                    <span className="self-start sm:self-auto px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
                      Owner Portal (Super-Admin)
                    </span>
                  </div>

                  {/* Interactive Admin Profile Header Card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                      <div className="relative group shrink-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-white flex items-center justify-center bg-slate-200 relative">
                          {adminProfilePic ? (
                            <img 
                              src={adminProfilePic} 
                              alt="Admin Profile" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-amber-500 font-extrabold text-2xl">
                              {loggedInUser ? loggedInUser.slice(0, 2).toUpperCase() : 'JD'}
                            </div>
                          )}
                          {/* Hover Overlay */}
                          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-black cursor-pointer gap-1">
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <span>CHANGE</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAdminProfilePicChange} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-800">{loggedInUser || 'Administrator'}</h3>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase">SYSTEM OVERSEER</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Manage and configure active machinery units, security pins, and system operators.</p>
                        
                        {/* Profile Picture Upload & Delete Links */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <label className="text-[10px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer transition-colors flex items-center gap-1">
                            <ImageIcon className="w-2.5 h-2.5" /> Upload Image
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAdminProfilePicChange} 
                              className="hidden" 
                            />
                          </label>
                          {adminProfilePic && (
                            <>
                              <span className="text-slate-300">|</span>
                              <button 
                                type="button" 
                                onClick={handleAdminProfilePicDelete}
                                className="text-[10px] text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                              >
                                Remove Photo
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Default Rate Per Hour</p>
                      <p className="font-mono text-2xl font-black text-slate-800 mt-1">₹1,000 <span className="text-xs text-slate-400 font-semibold">/ hr</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Owner</p>
                      <p className="text-sm font-bold text-slate-800 mt-2 truncate">{loggedInUser || 'Fleet Owner'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fleet Machines</p>
                      <p className="font-mono text-2xl font-black text-slate-800 mt-1">{machines.length} <span className="text-xs text-slate-400 font-semibold">Units</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Service Logs</p>
                      <p className="font-mono text-2xl font-black text-slate-800 mt-1">{entries.length} <span className="text-xs text-slate-400 font-semibold">Sheets</span></p>
                    </div>
                  </div>

                  {/* Settings Forms */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    {/* Security credentials & Fleet Geolocation */}
                    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/60 space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <User className="text-amber-500 w-4 h-4" /> Owner Credentials & Fleet Geolocation
                      </h3>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Owner ID / Name</label>
                            <input 
                               type="text" 
                               disabled 
                               value={loggedInUser === 'admin' ? "Verma Logistics (admin)" : loggedInUser === 'operator' ? "Reddy Equipment (operator)" : loggedInUser}
                               className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold cursor-not-allowed" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Office Contact Phone</label>
                            <input 
                              type="text" 
                              value={ownerPhone}
                              onChange={(e) => setOwnerPhone(e.target.value)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">System Owner Email</label>
                            <input 
                              type="email" 
                              value={ownerEmail}
                              onChange={(e) => setOwnerEmail(e.target.value)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Fleet Base City</label>
                            <input 
                              type="text" 
                              value={ownerCity}
                              onChange={(e) => setOwnerCity(e.target.value)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Base Pincode</label>
                            <input 
                              type="text" 
                              value={ownerPincode}
                              onChange={(e) => setOwnerPincode(e.target.value)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono" 
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <button
                              type="button"
                              onClick={handleGetOwnerLocation}
                              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-2 border border-amber-200 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5 text-amber-500" />
                              <span>Auto-Detect GPS</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-slate-100 p-2.5 rounded-lg border border-slate-200/60">
                          <div>
                            <label className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Latitude Coords</label>
                            <input 
                              type="number" 
                              step="any"
                              value={ownerLat}
                              onChange={(e) => setOwnerLat(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Longitude Coords</label>
                            <input 
                              type="number" 
                              step="any"
                              value={ownerLng}
                              onChange={(e) => setOwnerLng(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveOwnerProfile}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-md mt-2 flex items-center justify-center gap-1.5"
                        >
                          <span>Save & Sync Fleet Profile</span>
                        </button>
                      </div>
                    </div>

                    {/* Fleet status manager */}
                    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/60 space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                          <Truck className="text-amber-500 w-4 h-4" /> Machine Fleet Configuration
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Monitor and configure active operational statuses for JCB vehicle tracking and assignment lists.
                        </p>

                        {/* Add Machine Form Group */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Add New Machine</label>
                          <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <input
                              type="text"
                              placeholder="e.g. JCB 6 (Supermax)"
                              value={newMachineName}
                              onChange={(e) => setNewMachineName(e.target.value)}
                              className="flex-1 bg-slate-50 border-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMachine();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleAddMachine}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>

                        {/* Machines list */}
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {machines.length === 0 ? (
                            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 text-center font-medium">
                              No machines in the fleet. Please add one above.
                            </div>
                          ) : (
                            machines.map((jcb) => (
                              <div key={jcb} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-sm">
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-slate-800">{jcb}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold">GPS Active</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black border border-emerald-100 rounded-full">
                                    ACTIVE
                                  </span>
                                  <button
                                    type="button"
                                    title={`Delete ${jcb}`}
                                    onClick={() => handleRemoveMachine(jcb)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => alert("Fleet health diagnostics executed. All systems operational.")}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm mt-4 cursor-pointer"
                      >
                        Run Fleet Diagnostics
                      </button>
                    </div>
                  </div>

                  {/* Password simulation block */}
                  <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-3">
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Access Password Update</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-amber-800 block mb-1">New Account Password</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showAdminPassword ? "text" : "password"} 
                            placeholder="••••••••"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-2.5 text-slate-400 hover:text-amber-600 transition-colors p-1 cursor-pointer"
                            title={showAdminPassword ? "Hide password" : "Show password"}
                          >
                            {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            const u = (loggedInUser || 'admin').toLowerCase().trim();
                            const res = await updateUserProfileApi({ oldUsername: u, password: adminPassword });
                            if (res.success) {
                              alert("Security password updated successfully in production database.");
                            } else {
                              alert("Failed to update password: " + (res.error || 'Unknown error'));
                            }
                          }}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Device Active Sessions Card */}
                  <ActiveDevicesCard username={loggedInUser || 'admin'} role="owner" />

                  {/* Sign Out Card */}
                  <div className="p-5 bg-rose-50 rounded-xl border border-rose-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-rose-600 animate-pulse" /> Sign Out of Fleet Manager
                      </h4>
                      <p className="text-xs text-rose-700/80 font-medium">
                        This will securely end your administrator session and return you to the secure login screen.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGlobalLogout}
                      className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-6 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-rose-600/15 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out Now</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        </div>

      </main>

      {/* Mobile Horizontal Bottom Navigation Bar */}
      <nav id="mobile-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          id="mobile-nav-btn-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Dash</span>
        </button>

        <button
          id="mobile-nav-btn-new-entry"
          onClick={() => setActiveTab('new-entry')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'new-entry' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Log</span>
        </button>

        <button
          id="mobile-nav-btn-records"
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'records' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Recs</span>
        </button>

        <button
          id="mobile-nav-btn-drivers"
          onClick={() => setActiveTab('drivers')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'drivers' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Driver</span>
        </button>

        <button
          id="mobile-nav-btn-profile"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'profile' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Prof</span>
        </button>
      </nav>

      {/* Pending Payments & Customer Details Modal (Highly Polished, iFrame-Safe, and Beautifully Animated) */}
      <AnimatePresence>
        {showPendingModal && (
          <div id="pending-payments-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPendingModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()} 
              className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl border border-slate-100 relative z-10 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">Pending Payments Ledger</h3>
                    <p className="text-xs text-slate-500 font-semibold">
                      Total Pending Balance: <span className="text-rose-600 font-bold">{formatCurrency(stats.totalPending)}</span> across {pendingCustomersList.length} customers
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPendingModal(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Two-Pane Body */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Customer List */}
                <div className="w-full md:w-5/12 border-r border-slate-100 flex flex-col bg-slate-50/50">
                  <div className="p-4 border-b border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customers list</p>
                    <p className="text-xs text-slate-500">Select a customer to view their job worksheets and payment details.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {pendingCustomersList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 animate-pulse" />
                        <p className="text-sm font-bold text-slate-700">All Settled!</p>
                        <p className="text-xs text-slate-400 mt-1">No outstanding balances remaining across any customers.</p>
                      </div>
                    ) : (
                      pendingCustomersList.map((customer) => {
                        const isSelected = selectedPendingCustomer === customer.name;
                        return (
                          <button
                            key={customer.name}
                            onClick={() => setSelectedPendingCustomer(customer.name)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10'
                                : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-xs font-extrabold truncate uppercase tracking-tight ${isSelected ? 'text-slate-950' : 'text-slate-800'}`}>
                                {customer.name}
                              </h4>
                              <p className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-slate-900/80' : 'text-slate-400'}`}>
                                {customer.entries.length} pending job{customer.entries.length > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-xs font-black ${isSelected ? 'text-slate-955' : 'text-slate-800'}`}>
                                {formatCurrency(customer.totalPending)}
                              </p>
                              <p className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-slate-955' : 'text-rose-600'}`}>
                                Pending
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Pane: Customer & Jobs Details */}
                <div className="hidden md:flex md:w-7/12 flex-col bg-white">
                  {currentPendingCustomerData ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Customer Info Card */}
                      <div className="p-6 border-b border-slate-100 bg-slate-50/20">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                              Customer Ledger
                            </span>
                            <h3 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight mt-1.5">
                              {currentPendingCustomerData.name}
                            </h3>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding Balance</p>
                            <p className="text-2xl font-black text-rose-600 animate-pulse">
                              {formatCurrency(currentPendingCustomerData.totalPending)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold mt-4 bg-white p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phone</p>
                              <p className="text-slate-700 font-mono">{currentPendingCustomerData.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Site Location</p>
                              <p className="text-slate-700 truncate">{currentPendingCustomerData.location}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Active Pending Jobs List */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Unpaid Worksheets ({currentPendingCustomerData.entries.length})
                          </p>
                          <span className="text-[10px] text-slate-500 font-semibold italic">
                            Settle worksheets directly.
                          </span>
                        </div>

                        <div className="space-y-3">
                          {currentPendingCustomerData.entries.map((entry) => {
                            const entryOutstanding = entry.paymentStatus === 'pending' ? entry.totalAmount : (entry.totalAmount - (entry.amountPaid || 0));
                            return (
                              <div key={entry.id} className="p-4 rounded-xl border border-slate-100 bg-white space-y-3 shadow-sm hover:border-slate-200 transition-colors">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {entry.jcbMachineId}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-amber-500" /> {formatDisplayDate(entry.date)}
                                      </span>
                                    </div>
                                    <p className="text-xs font-extrabold text-slate-800 mt-1.5 uppercase tracking-tight">
                                      {entry.workType || 'General Excavation'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 block">Total: {formatCurrency(entry.totalAmount)}</span>
                                    <span className="text-xs font-black text-rose-600 block mt-0.5">Due: {formatCurrency(entryOutstanding)}</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100/60 text-[10px] font-semibold text-slate-500">
                                  <div>Operator: <span className="font-bold text-slate-700">{entry.driverName}</span></div>
                                  <div>Hours: <span className="font-bold text-slate-700">{entry.totalHours} Hrs</span></div>
                                  <div>Rate: <span className="font-bold text-slate-700">{formatCurrency(entry.ratePerHour || 1000)}/Hr</span></div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    onClick={() => handleMarkAsPaid(entry.id)}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-lg shadow-md shadow-emerald-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <Coins className="w-14 h-14 text-slate-200 mb-3" />
                      <h4 className="text-base font-extrabold text-slate-800">Select a Customer</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                        Choose a customer from the pending payments ledger on the left to inspect their profile details and settle unpaid worksheets.
                      </p>
                    </div>
                  )}
                </div>

                {/* Mobile view override overlay (for when customer is selected in single-column width) */}
                {currentPendingCustomerData && (
                  <div className="md:hidden absolute inset-0 bg-white z-20 flex flex-col">
                    {/* Header bar on mobile */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <button 
                        onClick={() => setSelectedPendingCustomer(null)}
                        className="text-xs font-black text-slate-500 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                      >
                        ← Back to List
                      </button>
                      <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                        Due: {formatCurrency(currentPendingCustomerData.totalPending)}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Customer Info */}
                      <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                          {currentPendingCustomerData.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold mt-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{currentPendingCustomerData.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{currentPendingCustomerData.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Jobs List */}
                      <div className="space-y-3">
                        {currentPendingCustomerData.entries.map((entry) => {
                          const entryOutstanding = entry.paymentStatus === 'pending' ? entry.totalAmount : (entry.totalAmount - (entry.amountPaid || 0));
                          return (
                            <div key={entry.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 space-y-2.5">
                              <div className="flex justify-between items-start text-xs font-bold text-slate-700">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{entry.jcbMachineId}</span>
                                  <span className="text-slate-500 font-bold text-[10px] flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-500" /> {formatDisplayDate(entry.date)}
                                  </span>
                                </div>
                                <span className="text-rose-600">{formatCurrency(entryOutstanding)}</span>
                              </div>
                              <p className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">{entry.workType}</p>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleMarkAsPaid(entry.id)}
                                  className="px-2.5 py-1 bg-emerald-500 text-white font-black text-[11px] rounded flex items-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Mark Paid
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Week Details Ledger Modal (Highly Polished, iFrame-Safe, and Beautifully Animated) */}
      <AnimatePresence>
        {showWeekModal && currentWeekData && (
          <div id="week-details-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowWeekModal(false);
                setWeekSearchQuery('');
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()} 
              className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl border border-slate-100 relative z-10 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">{currentWeekData.name} Details</h3>
                    <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> {currentWeekData.dateRange}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowWeekModal(false);
                    setWeekSearchQuery('');
                  }}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100 bg-slate-50/20 p-4 gap-3 text-center">
                <div className="p-3 bg-white rounded-xl border border-slate-100/60 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Billing</p>
                  <p className="text-base font-black text-amber-600 mt-1">{formatCurrency(weekStats.totalRevenue)}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100/60 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hours Worked</p>
                  <p className="text-base font-black text-slate-800 mt-1">{weekStats.totalHours.toFixed(1)} Hrs</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100/60 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Worksheets</p>
                  <p className="text-base font-black text-slate-800 mt-1">{weekStats.totalJobs} Entries</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100/60 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Payment</p>
                  <p className={`text-base font-black mt-1 ${weekStats.pendingAmount > 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                    {formatCurrency(weekStats.pendingAmount)}
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={weekSearchQuery}
                    onChange={(e) => setWeekSearchQuery(e.target.value)}
                    placeholder="Search worksheets by customer, driver, location..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium transition-all"
                  />
                  {weekSearchQuery && (
                    <button 
                      onClick={() => setWeekSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 text-xs absolute right-3 top-2.5 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
                  Showing {filteredWeekEntries.length} of {currentWeekData.entries.length} entries
                </span>
              </div>

              {/* Worksheets List */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {filteredWeekEntries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <Info className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No worksheets found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {weekSearchQuery ? 'Try adjusting your search query.' : 'No entries registered during this week.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredWeekEntries.map((entry) => {
                      const entryOutstanding = entry.paymentStatus === 'pending' ? entry.totalAmount : (entry.totalAmount - (entry.amountPaid || 0));
                      return (
                        <div 
                          key={entry.id} 
                          className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:border-slate-200/80 transition-all space-y-3 relative overflow-hidden"
                        >
                          {/* Accent bar indicating payment status */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            entry.paymentStatus === 'paid' 
                              ? 'bg-emerald-500' 
                              : entry.paymentStatus === 'partial' 
                                ? 'bg-amber-500' 
                                : 'bg-rose-500'
                          }`} />

                          {/* Row 1: Date, Machine ID, Customer and Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  {entry.jcbMachineId}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-amber-500" /> {formatDisplayDate(entry.date)}
                                </span>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  entry.paymentStatus === 'paid' 
                                    ? 'bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : entry.paymentStatus === 'partial' 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                  {entry.paymentStatus}
                                </span>
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-800 mt-1.5 uppercase tracking-tight">
                                {entry.customerName}
                              </h4>
                              {entry.siteLocation && (
                                <p className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" /> {entry.siteLocation}
                                </p>
                              )}
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worksheet Billing</p>
                              <p className="text-base font-black text-slate-900 mt-0.5">
                                {formatCurrency(entry.totalAmount)}
                              </p>
                              {entry.paymentStatus !== 'paid' && (
                                <p className="text-[11px] font-bold text-rose-600 mt-0.5">
                                  Due: {formatCurrency(entryOutstanding)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Operator & Hours Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-500 pl-4">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Operator</p>
                              <p className="text-slate-800 font-bold flex items-center gap-1 truncate">
                                <User className="w-3 h-3 text-slate-400" /> {entry.driverName}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Work Category</p>
                              <p className="text-slate-800 font-bold truncate">
                                {entry.workType || 'General Excavation'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hours Logged</p>
                              <p className="text-slate-800 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" /> {entry.totalHours} Hrs
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rate details</p>
                              <p className="text-slate-800 font-bold">
                                {formatCurrency(entry.ratePerHour)}/Hr
                              </p>
                            </div>
                          </div>

                          {/* Row 3: Notes if any */}
                          {entry.notes && (
                            <p className="text-xs text-slate-500 italic pl-4 border-l-2 border-slate-200 bg-slate-50/30 py-1 pr-2 rounded">
                              &ldquo;{entry.notes}&rdquo;
                            </p>
                          )}

                          {/* Row 4: Actions bar */}
                          <div className="flex justify-end items-center gap-2 pt-1 pl-2">
                            <button
                              onClick={() => {
                                setShowWeekModal(false);
                                setWeekSearchQuery('');
                                handleEditStart(entry);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit Job
                            </button>

                            {entry.paymentStatus !== 'paid' && (
                              <button
                                onClick={() => handleMarkAsPaid(entry.id)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-lg shadow-md shadow-emerald-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Settle/Mark Paid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal (Highly Polished, iFrame-Safe, and Beautifully Animated) */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div id="custom-confirm-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()} 
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 relative z-10"
            >
              <div className="flex items-start gap-3.5 mb-4">
                {confirmModal.title.toLowerCase().includes('restore') || confirmModal.title.toLowerCase().includes('demo') ? (
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 animate-bounce">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-800 leading-snug">{confirmModal.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-white font-black rounded-lg text-xs shadow-md transition-all ${
                    confirmModal.title.toLowerCase().includes('restore') || confirmModal.title.toLowerCase().includes('demo')
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

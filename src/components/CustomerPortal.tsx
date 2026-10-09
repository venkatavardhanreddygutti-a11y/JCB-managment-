import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Clock, 
  Receipt, 
  CreditCard, 
  Sparkles, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  SlidersHorizontal, 
  Calendar, 
  MapPin, 
  ArrowRight, 
  Plus, 
  ChevronRight, 
  Phone, 
  LogOut,
  TrendingUp,
  Briefcase,
  HelpCircle,
  Hash,
  X,
  Send,
  Bot,
  MessageSquare,
  User,
  Mic,
  Fuel,
  MicOff,
  Languages,
  Trash2,
  Camera,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import ActiveDevicesCard from './ActiveDevicesCard';
import OfflineIndicator from './OfflineIndicator';
import { JcbEntry } from '../types';
import { fetchUserProfile, updateUserProfileApi, fetchBookingsApi, saveBookingsApi, fetchFleetApi, saveFleetApi, saveEntriesApi, fetchUsers } from '../api';

interface CustomerPortalProps {
  customerName: string;
  entries: JcbEntry[];
  onLogout: () => void;
  onUpdateEntries: (updatedEntries: JcbEntry[]) => void;
  initialTab?: 'dashboard' | 'profile';
}

interface BookingRequest {
  id: string;
  customerName: string;
  date: string;
  machineId: string;
  siteLocation: string;
  workType: string;
  estimatedHours: number;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  startTime?: string;
  endTime?: string;
  ownerId: string;
  ownerName?: string;
}

interface JcbOwnerProfile {
  ownerId: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

const DEFAULT_OWNERS: JcbOwnerProfile[] = [
  {
    ownerId: 'admin',
    ownerName: 'Verma Heavy JCB Logistics',
    phone: '+91 91234 56789',
    email: 'fleet-owner@jcb-logistics.in',
    city: 'Bengaluru',
    pincode: '560001',
    latitude: 12.9716,
    longitude: 77.5946
  },
  {
    ownerId: 'operator',
    ownerName: 'Reddy Heavy Equipment & Dispatch',
    phone: '+91 98765 43210',
    email: 'operator-fleet@jcb-logistics.in',
    city: 'Bengaluru',
    pincode: '560034',
    latitude: 12.9345,
    longitude: 77.6201
  }
];

export default function CustomerPortal({ 
  customerName, 
  entries, 
  onLogout,
  onUpdateEntries,
  initialTab = 'dashboard'
}: CustomerPortalProps) {
  // State
  const [customerTab, setCustomerTab] = useState<'dashboard' | 'profile'>(initialTab);
  const [ownersList, setOwnersList] = useState<JcbOwnerProfile[]>(DEFAULT_OWNERS);
  const [machines, setMachines] = useState<string[]>(['JCB 1', 'JCB 2', 'JCB 3']);
  const [customerPin, setCustomerPin] = useState('1234');
  const [customerPhoneState, setCustomerPhoneState] = useState(() => {
    const matched = entries.find(e => e.customerName === customerName);
    return matched?.customerPhone || '+91 98765 43210';
  });
  const [customerEmail, setCustomerEmail] = useState('contact@corporate-partner.in');
  const [customerBillingCycle, setCustomerBillingCycle] = useState<'monthly' | 'bi-weekly' | 'job'>('monthly');
  const [customerPaymentPref, setCustomerPaymentPref] = useState<'upi' | 'card' | 'bank'>('bank');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  const [customerProfilePic, setCustomerProfilePic] = useState<string | null>(null);

  // Sync customer profile with cloud DB on mount/name change
  useEffect(() => {
    if (customerName) {
      fetchUserProfile(customerName).then((profile) => {
        if (profile) {
          if (profile.pin) setCustomerPin(profile.pin);
          if (profile.phone) setCustomerPhoneState(profile.phone);
          if (profile.email) setCustomerEmail(profile.email);
          if (profile.profilePic !== undefined) setCustomerProfilePic(profile.profilePic || null);
        }
      });
    }
  }, [customerName]);

  const handleCustomerProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Please select an image smaller than 1.5MB for storage performance.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomerProfilePic(base64String);
        updateUserProfileApi({
          username: customerName,
          profilePic: base64String
        }).then(() => {
          setProfileSuccessMsg("Profile picture successfully updated in cloud database.");
          setTimeout(() => setProfileSuccessMsg(null), 4000);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomerProfilePicDelete = () => {
    if (confirm("Are you sure you want to remove your profile picture?")) {
      setCustomerProfilePic(null);
      updateUserProfileApi({
        username: customerName,
        profilePic: ''
      }).then(() => {
        setProfileSuccessMsg("Profile picture removed from cloud database.");
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      });
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial'>('all');
  const [selectedWorksheet, setSelectedWorksheet] = useState<JcbEntry | null>(null);
  
  // AI summary states
  const [aiReport, setAiReport] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCardNum, setPaymentCardNum] = useState('');
  const [paymentCardExpiry, setPaymentCardExpiry] = useState('');
  const [paymentCardCvv, setPaymentCardCvv] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi'>('card');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Booking states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingMachine, setBookingMachine] = useState(() => machines[0] || '');
  const [bookingLocation, setBookingLocation] = useState('');
  const [bookingWorkType, setBookingWorkType] = useState('');
  const [bookingStartTime, setBookingStartTime] = useState('08:00');
  const [bookingEndTime, setBookingEndTime] = useState('12:00');
  const [bookingHours, setBookingHours] = useState('4');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingsList, setBookingsList] = useState<BookingRequest[]>([]);

  // Geolocation & Nearby Owner Selector States
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'granted' | 'denied' | 'error'>('idle');
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');
  const [ownerSearchCity, setOwnerSearchCity] = useState('');
  const [ownerSearchPincode, setOwnerSearchPincode] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('admin');

  const triggerGeolocation = () => {
    setGpsStatus('detecting');
    setGpsErrorMsg('');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCustomerLat(lat);
          setCustomerLng(lng);
          
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
                const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || addr.state_district || '';
                const pincode = addr.postcode || '';
                
                if (city) setOwnerSearchCity(city);
                if (pincode) setOwnerSearchPincode(pincode);
              }
            }
          } catch (e) {
            console.error('Reverse geocoding fetch error:', e);
          }
          
          setGpsStatus('granted');
        },
        (err) => {
          console.error('Geolocation error:', err);
          setGpsStatus('denied');
          if (err.code === err.PERMISSION_DENIED) {
            setGpsErrorMsg("Location permission denied by browser. Please enable location or use manual search.");
          } else {
            setGpsErrorMsg("Could not detect location. Please try again or use manual search.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsStatus('error');
      setGpsErrorMsg("Geolocation is not supported by this browser.");
    }
  };

  // Trigger geolocation detection when showBookingModal is true
  useEffect(() => {
    if (showBookingModal) {
      triggerGeolocation();
    }
  }, [showBookingModal]);

  // Haversine Distance Helper
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1)); // distance in km
  };

  const getSortedOwners = () => {
    const rawOwners = ownersList;
    
    const ownersWithDistance = rawOwners.map(owner => {
      let distance: number | null = null;
      if (customerLat !== null && customerLng !== null && owner.latitude && owner.longitude) {
        distance = getHaversineDistance(customerLat, customerLng, owner.latitude, owner.longitude);
      }
      return { ...owner, distance };
    });

    if (gpsStatus === 'granted' && customerLat !== null && customerLng !== null) {
      return [...ownersWithDistance].sort((a, b) => {
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return distA - distB;
      });
    }

    let filtered = ownersWithDistance;
    if (ownerSearchCity.trim()) {
      const q = ownerSearchCity.toLowerCase().trim();
      filtered = filtered.filter(o => o.city.toLowerCase().includes(q));
    }
    if (ownerSearchPincode.trim()) {
      const q = ownerSearchPincode.toLowerCase().trim();
      filtered = filtered.filter(o => o.pincode.toLowerCase().includes(q));
    }

    return filtered;
  };

  const sortedOwners = getSortedOwners();

  useEffect(() => {
    if (sortedOwners.length > 0) {
      const exists = sortedOwners.some(o => o.ownerId === selectedOwnerId);
      if (!exists) {
        setSelectedOwnerId(sortedOwners[0].ownerId);
      }
    }
  }, [customerLat, customerLng, gpsStatus, ownerSearchCity, ownerSearchPincode]);

  // AI Conversational Booking states
  const [bookingMode, setBookingMode] = useState<'ai' | 'manual'>('ai');
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ id: string; role: 'user' | 'model'; text: string }>>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I am your AI JCB Booking Assistant. ✨ Tell me what machine category you need, where your site is located, what date you want it, what kind of work you need done, and what times you would like it (our machines operate from morning 6:00 AM to evening 7:00 PM). I will draft the booking for you in real-time!"
    }
  ]);
  const [aiDraftDate, setAiDraftDate] = useState<string>('');
  const [aiDraftMachine, setAiDraftMachine] = useState<string>(() => machines[0] || '');
  const [aiDraftLocation, setAiDraftLocation] = useState<string>('');
  const [aiDraftWorkType, setAiDraftWorkType] = useState<string>('');
  const [aiDraftStartTime, setAiDraftStartTime] = useState<string>('08:00');
  const [aiDraftEndTime, setAiDraftEndTime] = useState<string>('12:00');
  const [aiDraftHours, setAiDraftHours] = useState<string>('4');
  const [isAiBookingReady, setIsAiBookingReady] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [showMobileAiChat, setShowMobileAiChat] = useState<boolean>(true);

  const handleRemoveMachine = async (machineName: string) => {
    const updated = machines.filter(m => m !== machineName);
    setMachines(updated);
    await saveFleetApi(updated, []);
    
    if (bookingMachine === machineName) {
      setBookingMachine(updated.length > 0 ? updated[0] : '');
    }
    if (aiDraftMachine === machineName) {
      setAiDraftMachine(updated.length > 0 ? updated[0] : '');
    }
  };

  // Speech Recognition & Language states
  const LANGUAGES = [
    { code: 'en-IN', name: 'English (India)', label: 'English' },
    { code: 'hi-IN', name: 'Hindi (हिन्दी)', label: 'हिन्दी' },
    { code: 'te-IN', name: 'Telugu (తెలుగు)', label: 'తెలుగు' },
    { code: 'ta-IN', name: 'Tamil (தமிழ்)', label: 'தமிழ்' },
    { code: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)', label: 'ಕನ್ನಡ' },
    { code: 'mr-IN', name: 'Marathi (मराठी)', label: 'मराठी' },
    { code: 'gu-IN', name: 'Gujarati (ગુજરાતી)', label: 'ગુજરાતી' },
    { code: 'bn-IN', name: 'Bengali (বাংলা)', label: 'বাংলা' }
  ];

  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionError("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      setTimeout(() => setRecognitionError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setRecognitionError("Microphone permission denied. Please allow microphone access.");
        } else {
          setRecognitionError(`Speech recognition failed: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setRecognitionError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setAiInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error(err);
      setRecognitionError("Could not start speech recognition.");
      setIsListening(false);
      setTimeout(() => setRecognitionError(null), 4000);
    }
  };

  // Time Utilities
  const calculateHoursFromTimes = (start: string, end: string): string => {
    if (!start || !end) return '4';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin <= 0) return '0';
    return (diffMin / 60).toFixed(1);
  };

  const validateBookingTimes = (start: string, end: string): string | null => {
    if (!start || !end) return null;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startVal = startHour + startMin / 60;
    const endVal = endHour + endMin / 60;

    if (startVal < 6 || startVal > 19) {
      return "JCB machines operate only from morning 6:00 AM to evening 7:00 PM.";
    }
    if (endVal < 6 || endVal > 19) {
      return "JCB machines operate only from morning 6:00 AM to evening 7:00 PM.";
    }
    if (startVal >= endVal) {
      return "End time must be after start time.";
    }
    return null;
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages, isAiThinking]);

  // Sync default machine values once loaded
  useEffect(() => {
    if (machines.length > 0) {
      if (!bookingMachine || !machines.includes(bookingMachine)) {
        setBookingMachine(machines[0]);
      }
      if (!aiDraftMachine || !machines.includes(aiDraftMachine)) {
        setAiDraftMachine(machines[0]);
      }
    }
  }, [machines, bookingMachine, aiDraftMachine]);

  // Load fleet, bookings, and owners from server DB + auto sync
  useEffect(() => {
    let isMounted = true;

    const loadCloudData = async () => {
      try {
        const [bookings, fleetData, usersList] = await Promise.all([
          fetchBookingsApi(),
          fetchFleetApi(),
          fetchUsers()
        ]);

        if (!isMounted) return;

        if (Array.isArray(bookings)) {
          setBookingsList(bookings.filter(b => b.customerName && b.customerName.toLowerCase().trim() === customerName.toLowerCase().trim()));
        }

        if (fleetData && Array.isArray(fleetData.fleetMachines) && fleetData.fleetMachines.length > 0) {
          const names = fleetData.fleetMachines.map((m: any) => typeof m === 'string' ? m : (m.id || m.name));
          setMachines(names);
        }

        if (Array.isArray(usersList) && usersList.length > 0) {
          const owners = usersList
            .filter(u => u.role === 'owner')
            .map(u => ({
              ownerId: u.username.toLowerCase(),
              ownerName: u.displayName || u.username,
              phone: u.phone || '+91 91234 56789',
              email: u.email || 'fleet-owner@jcb-logistics.in',
              city: u.city || 'Bengaluru',
              pincode: u.pincode || '560001',
              latitude: u.lat || 12.9716,
              longitude: u.lng || 77.5946
            }));
          if (owners.length > 0) {
            setOwnersList(owners);
          }
        }
      } catch (e) {
        console.error('Error fetching cloud data in CustomerPortal:', e);
      }
    };

    loadCloudData();
    const timer = setInterval(loadCloudData, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [customerName, showBookingModal]);

  const handleDeleteBooking = async (bookingId: string) => {
    if (confirm('Are you sure you want to cancel and delete this booking request?')) {
      try {
        const currentBookings = await fetchBookingsApi();
        const updatedList = currentBookings.filter((b: any) => b.id !== bookingId);
        await saveBookingsApi(updatedList);
        setBookingsList(updatedList.filter((b: any) => b.customerName.toLowerCase().trim() === customerName.toLowerCase().trim()));
      } catch (e) {
        console.error('Error deleting booking:', e);
      }
    }
  };

  // Compute calculations for client
  const clientEntries = entries.filter(
    e => e.customerName.toLowerCase().trim() === customerName.toLowerCase().trim()
  );

  const totalBilled = clientEntries.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalPaid = clientEntries.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalPending = totalBilled - totalPaid;
  const totalHours = clientEntries.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalJobs = clientEntries.length;

  const handleGenerateAiReport = async () => {
    if (clientEntries.length === 0) {
      setReportError("No worksheets recorded yet to generate an AI summary report.");
      return;
    }

    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: clientEntries }),
      });

      if (!response.ok) {
        throw new Error('Failed to reach Gemini insights proxy server');
      }

      const data = await response.json();
      if (data.insights) {
        setAiReport(data.insights);
      } else {
        setAiReport(data.text || "Report completed successfully.");
      }
    } catch (err: any) {
      console.error(err);
      // Fallback local descriptive summary if Gemini server is unconfigured
      const reportText = `**JCB Worksite Summary Report for ${customerName}**
  
*Total Worksheets:* ${totalJobs}
*Cumulative Machinery Hours:* ${totalHours.toFixed(1)} hrs
*Site Locations Engaged:* ${Array.from(new Set(clientEntries.map(e => e.siteLocation))).join(', ')}
*Principal Activities:* ${Array.from(new Set(clientEntries.map(e => e.workType))).join(', ')}
  
*Statement of Account:*
- Total Billed Services: ₹${totalBilled.toLocaleString('en-IN')}
- Amount Settled to Date: ₹${totalPaid.toLocaleString('en-IN')}
- Outstanding Balance Due: ₹${totalPending.toLocaleString('en-IN')}
  
*Customer Recommendation:* Outstanding work projects have been verified and computed securely. Please make a payment of ₹${totalPending.toLocaleString('en-IN')} to clear pending invoices and avoid interest charges.`;
      
      setAiReport(reportText);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim() || isAiThinking) return;

    const userMsg = aiInputText.trim();
    setAiInputText('');
    
    const newMsg = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      text: userMsg
    };

    const updatedMessages = [...aiChatMessages, newMsg];
    setAiChatMessages(updatedMessages);
    setIsAiThinking(true);

    try {
      const historyPayload = updatedMessages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const localDate = new Date().toISOString().split('T')[0];
      const localTime = new Date().toLocaleTimeString();

      // Bundle past requested bookings and completed worksheets as customer's booking history
      const combinedHistory = [
        ...bookingsList.map(b => ({
          type: 'requested_booking',
          id: b.id,
          date: b.date,
          machineId: b.machineId,
          siteLocation: b.siteLocation,
          workType: b.workType,
          estimatedHours: b.estimatedHours,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          createdAt: b.createdAt
        })),
        ...clientEntries.map(e => ({
          type: 'completed_worksheet',
          id: e.id,
          date: e.date,
          machineId: e.jcbMachineId,
          siteLocation: e.siteLocation,
          workType: e.workType || 'Excavation',
          estimatedHours: e.totalHours,
          startTime: e.startTime,
          endTime: e.endTime,
          status: 'completed',
          createdAt: e.createdAt || e.date
        }))
      ];

      // Sort by date/createdAt desc (most recent first)
      combinedHistory.sort((a, b) => {
        const dateA = a.createdAt || a.date;
        const dateB = b.createdAt || b.date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      const response = await fetch('/api/gemini/parse-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          localDate,
          localTime,
          bookingHistory: combinedHistory,
          selectedLanguage: LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'English'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to parse booking request');
      }

      const data = await response.json();
      
      const replyMsg = {
        id: `msg-${Date.now() + 1}`,
        role: 'model' as const,
        text: data.reply || "I've updated your booking draft."
      };

      setAiChatMessages(prev => [...prev, replyMsg]);

      if (data.extractedDetails) {
        const details = data.extractedDetails;
        if (details.date) setAiDraftDate(details.date);
        if (details.machineId) setAiDraftMachine(details.machineId);
        if (details.siteLocation) setAiDraftLocation(details.siteLocation);
        if (details.workType) setAiDraftWorkType(details.workType);
        if (details.startTime) setAiDraftStartTime(details.startTime);
        if (details.endTime) setAiDraftEndTime(details.endTime);
        if (details.estimatedHours) {
          setAiDraftHours(details.estimatedHours.toString());
        } else if (details.startTime && details.endTime) {
          setAiDraftHours(calculateHoursFromTimes(details.startTime, details.endTime));
        }
      }
      
      if (data.isReady !== undefined) {
        setIsAiBookingReady(data.isReady);
      }
    } catch (err) {
      console.error(err);
      setAiChatMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: "Sorry, I had trouble processing that request. Please try again or fill out the draft manually."
        }
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleAiDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiDraftLocation || !aiDraftWorkType || !aiDraftDate) {
      alert('Please fill out Date, Location, and Work Type in the AI Draft.');
      return;
    }

    const timeValidationErr = validateBookingTimes(aiDraftStartTime, aiDraftEndTime);
    if (timeValidationErr) {
      alert(timeValidationErr);
      return;
    }

    const newBooking: BookingRequest = {
      id: `bk-${Date.now()}`,
      customerName,
      date: aiDraftDate,
      machineId: aiDraftMachine,
      siteLocation: aiDraftLocation,
      workType: aiDraftWorkType,
      estimatedHours: parseFloat(aiDraftHours) || parseFloat(calculateHoursFromTimes(aiDraftStartTime, aiDraftEndTime)) || 4,
      startTime: aiDraftStartTime,
      endTime: aiDraftEndTime,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ownerId: selectedOwnerId,
      ownerName: ownersList.find(o => o.ownerId === selectedOwnerId)?.ownerName || 'JCB Logistics'
    };

    try {
      const currentBookings = await fetchBookingsApi();
      const currentList: BookingRequest[] = Array.isArray(currentBookings) ? currentBookings : [];
      currentList.unshift(newBooking);
      await saveBookingsApi(currentList);
      
      setBookingsList(currentList.filter(b => b.customerName && b.customerName.toLowerCase().trim() === customerName.toLowerCase().trim()));
      setBookingSuccess(true);
      
      setTimeout(() => {
        setBookingSuccess(false);
        setShowBookingModal(false);
        // Reset states
        setAiDraftLocation('');
        setAiDraftWorkType('');
        setAiDraftDate('');
        setAiDraftStartTime('08:00');
        setAiDraftEndTime('12:00');
        setAiDraftHours('4');
        setAiChatMessages([
          {
            id: 'welcome',
            role: 'model',
            text: "Hello! I am your AI JCB Booking Assistant. ✨ Tell me what machine category you need, where your site is located, what date you want it, what kind of work you need done, and what times you would like it (our machines operate from morning 6:00 AM to evening 7:00 PM). I will draft the booking for you in real-time!"
          }
        ]);
        setIsAiBookingReady(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingLocation || !bookingWorkType) {
      alert('Please fill out all fields.');
      return;
    }

    const timeValidationErr = validateBookingTimes(bookingStartTime, bookingEndTime);
    if (timeValidationErr) {
      alert(timeValidationErr);
      return;
    }

    const calculatedHoursVal = parseFloat(calculateHoursFromTimes(bookingStartTime, bookingEndTime));

    const newBooking: BookingRequest = {
      id: `bk-${Date.now()}`,
      customerName,
      date: bookingDate,
      machineId: bookingMachine,
      siteLocation: bookingLocation,
      workType: bookingWorkType,
      estimatedHours: calculatedHoursVal || parseFloat(bookingHours) || 4,
      startTime: bookingStartTime,
      endTime: bookingEndTime,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ownerId: selectedOwnerId,
      ownerName: ownersList.find(o => o.ownerId === selectedOwnerId)?.ownerName || 'JCB Logistics'
    };

    // Save to shared server database
    try {
      const currentBookings = await fetchBookingsApi();
      const currentList: BookingRequest[] = Array.isArray(currentBookings) ? currentBookings : [];
      currentList.unshift(newBooking);
      await saveBookingsApi(currentList);
      
      // Update local state
      setBookingsList(currentList.filter(b => b.customerName && b.customerName.toLowerCase().trim() === customerName.toLowerCase().trim()));
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSuccess(false);
        setShowBookingModal(false);
        setBookingLocation('');
        setBookingWorkType('');
        setBookingStartTime('08:00');
        setBookingEndTime('12:00');
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }
    if (amount > totalPending) {
      alert(`The payment amount exceeds your total outstanding balance of ₹${totalPending}.`);
      return;
    }

    setIsProcessingPayment(true);
    try {
      // payment succeeded! Now let's distribute the payment to pending entries in entries list!
      let remainingPayment = amount;
      
      // Update main admin ledger as well so the owner sees this payment!
      const updatedAllEntries = entries.map(entry => {
        if (entry.customerName.toLowerCase().trim() === customerName.toLowerCase().trim() && remainingPayment > 0) {
          const entryPending = entry.totalAmount - entry.amountPaid;
          if (entryPending > 0) {
            const paymentToApply = Math.min(entryPending, remainingPayment);
            const newPaid = entry.amountPaid + paymentToApply;
            remainingPayment -= paymentToApply;
            
            let status: 'paid' | 'pending' | 'partial' = 'pending';
            if (newPaid >= entry.totalAmount) status = 'paid';
            else if (newPaid > 0) status = 'partial';

            return {
              ...entry,
              amountPaid: newPaid,
              paymentStatus: status
            };
          }
        }
        return entry;
      });

      // Update server database
      await saveEntriesApi(updatedAllEntries);
      onUpdateEntries(updatedAllEntries);

      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentCardNum('');
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsProcessingPayment(false);
      alert('Payment processing failed on server.');
    }
  };

  // Filter worksheets
  const filteredWorksheets = clientEntries.filter(e => {
    const matchesSearch = 
      e.workType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.siteLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.jcbMachineId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.driverName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' || 
      e.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div id="customer-portal-root" className="flex flex-col h-screen w-full bg-white text-slate-800 overflow-hidden font-sans">
      {/* 1. Portal Header */}
      <header className="border-b border-slate-200 bg-slate-50/90 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {customerProfilePic ? (
            <img 
              src={customerProfilePic} 
              alt={customerName} 
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-cover rounded-xl border border-slate-200 shadow-md"
            />
          ) : (
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-slate-950 font-black text-base">{customerName.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-600 block">Client Portal</span>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">{customerName}</h1>
          </div>
        </div>

        {/* Offline Indicator & Dynamic Navigation Tabs */}
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto justify-end">
          <OfflineIndicator />
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-bold text-slate-500 flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => setCustomerTab('dashboard')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              customerTab === 'dashboard'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setCustomerTab('profile')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              customerTab === 'profile'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Profile</span>
          </button>
        </div>
      </div>
      </header>

      {/* 2. Scrollable Body */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {customerTab === 'dashboard' ? (
          <>
            {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Utilized</p>
              <p className="text-lg font-black text-slate-900">{totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">Hours</span></p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Work Sessions</p>
              <p className="text-lg font-black text-slate-900">{totalJobs} <span className="text-xs font-normal text-slate-500">Logs</span></p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Invoiced</p>
              <p className="text-lg font-black text-slate-900">₹{totalBilled.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Amount Settled</p>
              <p className="text-lg font-black text-emerald-600">₹{totalPaid.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between col-span-1 md:col-span-1">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Balance Due</p>
                <p className="text-lg font-black text-amber-600">₹{totalPending.toLocaleString('en-IN')}</p>
              </div>
            </div>
            {totalPending > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPaymentAmount(totalPending.toString());
                  setShowPaymentModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                title="Pay Outstanding Invoice"
              >
                <CreditCard className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Quick AI Summary Widget */}
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">AI Worksite Narrative Reporter</h3>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold font-mono">Gemini API Powered</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate an instant professional summary report of all machinery, excavation, and leveling operations carried out at your locations.
              </p>
            </div>

            {aiReport ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <div className="prose text-slate-700 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                  {aiReport}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAiReport('')}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Clear Report
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAiReport}
                    disabled={isGeneratingReport}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateAiReport}
                disabled={isGeneratingReport}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/5"
              >
                {isGeneratingReport ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Analyzing Worksheets & Drafting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>Generate AI Worksite Summary</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Quick Equipment Booking Widget */}
          <div className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Machinery Booking Request</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need more heavy machinery? Instantly submit a reservation request directly to our supervisors.
              </p>
            </div>

            {bookingsList.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 max-h-24 overflow-y-auto space-y-1.5">
                {bookingsList.map((bk) => (
                  <div key={bk.id} className="flex items-center justify-between text-[10px] border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                    <div className="truncate pr-2 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700 truncate">{bk.workType}</span>
                        {bk.ownerName && (
                          <span className="text-[8px] bg-slate-100 text-slate-600 font-bold px-1 rounded truncate">
                            👤 {bk.ownerName}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 block text-[9px] mt-0.5">{bk.date} ({bk.startTime || '08:00'} - {bk.endTime || '12:00'}) @ {bk.siteLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] border ${
                        bk.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        bk.status === 'declined' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {bk.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteBooking(bk.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Delete booking request"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBookingMode('manual');
                  setShowBookingModal(true);
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-2.5 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Standard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingMode('ai');
                  setShowBookingModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Book with AI ✨</span>
              </button>
            </div>
          </div>
        </div>

        {/* Worksheet Table Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/70">
            <div className="flex items-center gap-2 self-start sm:self-center">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Active Worksheets</h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200">
                {filteredWorksheets.length} of {clientEntries.length} Records
              </span>
            </div>

            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-60">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search work, location, machine..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-xs rounded-xl pl-9 pr-3 py-2 outline-none text-slate-800 transition-colors"
                />
              </div>

              {/* Status Tab Filter */}
              <div className="hidden sm:flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-[10px] font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'paid' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('partial')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'partial' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  Due
                </button>
              </div>
            </div>
          </div>

          {/* Worksheet Grid / Cards layout for high polish readability */}
          {filteredWorksheets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No worksheets match your filters</p>
              <p className="text-xs text-slate-500">Try clearing search text or resetting the status tags filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredWorksheets.map((item) => {
                const outstanding = item.totalAmount - item.amountPaid;
                return (
                  <div 
                    key={item.id} 
                    className="p-4 hover:bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                          {item.jcbMachineId}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-600 font-mono">
                          {item.date}
                        </span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[11px] font-bold text-slate-800">
                          Work: {item.workType || 'General Excavation'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.siteLocation}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Supervisor / Driver: <strong className="text-slate-700 font-semibold">{item.driverName}</strong></span>
                        <span>Total Hours: <strong className="text-slate-700 font-semibold">{item.totalHours} hrs</strong></span>
                        {item.trackingType === 'hour-meter' ? (
                          <span className="font-mono text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                            Meter: {item.startMeter} - {item.endMeter}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                            Time: {item.startTime} - {item.endTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t border-slate-100 md:border-0 pt-3 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-slate-500">Invoice Total</p>
                        <p className="text-sm font-black text-slate-900">₹{item.totalAmount.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-slate-500">
                          ₹{item.amountPaid.toLocaleString('en-IN')} paid
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border ${
                          item.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.paymentStatus}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedWorksheet(item)}
                          className="bg-white hover:bg-slate-100 text-slate-700 p-2 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200 transition-all shadow-sm"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Customer Profile View */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 md:p-8">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Profile Header Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full md:w-auto">
                    {/* Interactive Profile Picture Container */}
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-slate-100 flex items-center justify-center bg-slate-100 relative">
                        {customerProfilePic ? (
                          <img 
                            src={customerProfilePic} 
                            alt={customerName} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-3xl">
                            {customerName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {/* Hover Overlay */}
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer gap-1">
                          <Camera className="w-4 h-4" />
                          <span>Change</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleCustomerProfilePicChange} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest block mb-0.5">Enterprise Partner Account</span>
                      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{customerName}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-semibold mt-1">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> Site Contractor</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Active Account</span>
                      </div>
                      
                      {/* Photo management actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-[11px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer transition-colors flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Upload Profile Photo
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleCustomerProfilePicChange} 
                            className="hidden" 
                          />
                        </label>
                        {customerProfilePic && (
                          <>
                            <span className="text-slate-300">|</span>
                            <button 
                              type="button" 
                              onClick={handleCustomerProfilePicDelete}
                              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                            >
                              Remove Photo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-3 w-full md:w-auto shrink-0">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Security PIN</p>
                      <p className="font-mono text-sm font-bold text-slate-800">•••• ({customerPin})</p>
                    </div>
                  </div>
                </div>

                {/* Profile Success Toast */}
                {profileSuccessMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Edit General Settings */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-500" /> Account & Contact Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Registered Company Name</label>
                        <input
                          type="text"
                          disabled
                          value={customerName}
                          className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold cursor-not-allowed"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">Company name is registered with regional office.</p>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Company Phone Contact</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400"><Phone className="w-3.5 h-3.5" /></span>
                          <input
                            type="text"
                            value={customerPhoneState}
                            onChange={(e) => setCustomerPhoneState(e.target.value)}
                            className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Primary Email Address</label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileSuccessMsg("Contact information has been saved successfully.");
                          setTimeout(() => setProfileSuccessMsg(null), 4000);
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Save Contact Info
                      </button>
                    </div>
                  </div>

                  {/* Security PIN Settings */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-500" /> Account Security Access
                      </h3>
                      <div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                          Your customer account uses a 4-digit numeric Security PIN to authenticate access. Please keep this secure to protect your logs and bookings.
                        </p>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Update Security PIN (4 Digits)</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={customerPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setCustomerPin(val);
                          }}
                          placeholder="e.g. 1234"
                          className="w-full bg-white text-slate-800 font-mono text-center tracking-widest text-lg font-black border border-slate-200 rounded-lg py-2 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (customerPin.length !== 4) {
                          alert("PIN must be exactly 4 digits long.");
                          return;
                        }
                        updateUserProfileApi({
                          username: customerName,
                          pin: customerPin
                        }).then(() => {
                          setProfileSuccessMsg(`Security PIN successfully updated to ${customerPin} in cloud database!`);
                          setTimeout(() => setProfileSuccessMsg(null), 4000);
                        });
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Update Security PIN
                    </button>
                  </div>
                </div>

                {/* Operations Preferences Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-500" /> Administrative & Billing Preferences
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Default Billing Cycle</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['monthly', 'bi-weekly', 'job'] as const).map((cycle) => (
                          <button
                            key={cycle}
                            type="button"
                            onClick={() => setCustomerBillingCycle(cycle)}
                            className={`py-2 px-1 rounded-lg border text-center font-bold text-[10px] uppercase transition-all ${
                              customerBillingCycle === cycle
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {cycle === 'job' ? 'Per Job' : cycle}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1.5">Determines how frequently outstanding invoices are auto-compiled.</p>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Preferred Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['upi', 'card', 'bank'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setCustomerPaymentPref(mode)}
                            className={`py-2 px-1 rounded-lg border text-center font-bold text-[10px] uppercase transition-all ${
                              customerPaymentPref === mode
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {mode === 'bank' ? 'NEFT/RTGS' : mode}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1.5">Your invoices will display coordinates tailored to this method.</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">Changes are saved to your current browser profile.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileSuccessMsg("Billing preferences successfully updated.");
                        setTimeout(() => setProfileSuccessMsg(null), 4000);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2 px-5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>

                {/* Statistics Highlights */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase text-amber-500 tracking-wider">Historical Engagement Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="border-r border-slate-800 bg-transparent">
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total Logged Hours</p>
                      <p className="font-mono text-lg sm:text-2xl font-bold mt-1 text-slate-200">{totalHours.toFixed(1)}</p>
                    </div>
                    <div className="border-r border-slate-800 bg-transparent">
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wide">Work Sessions Completed</p>
                      <p className="font-mono text-lg sm:text-2xl font-bold mt-1 text-slate-200">{totalJobs}</p>
                    </div>
                    <div className="bg-transparent">
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wide">Pending Due Balance</p>
                      <p className={`font-mono text-lg sm:text-2xl font-bold mt-1 ${totalPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>₹{totalPending.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                {/* Multi-Device Active Sessions Card */}
                <ActiveDevicesCard username={customerName} role="customer" />

                {/* Sign Out Card */}
                <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-rose-600 animate-pulse" /> Sign Out of Your Account
                    </h4>
                    <p className="text-xs text-rose-700/80 font-medium">
                      This will securely log you out of your partner portal and return you to the secure login screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-6 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-rose-600/15 flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Now</span>
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* 3. Worksheet Details Modal */}
      <AnimatePresence>
        {selectedWorksheet && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                  <h3 className="font-black text-slate-900 tracking-tight">Worksheet ID: {selectedWorksheet.id}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWorksheet(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* 2 Column Details list */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Date Logged</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedWorksheet.date}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">JCB Equipment ID</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedWorksheet.jcbMachineId}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Driver / Supervisor</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedWorksheet.driverName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Type of Work</p>
                    <p className="text-sm font-semibold text-amber-600">{selectedWorksheet.workType || 'Excavation'}</p>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-100 pt-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-sans">Site Location Address</p>
                  <div className="flex items-start gap-1.5 text-xs text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{selectedWorksheet.siteLocation}</span>
                  </div>
                </div>

                {/* Meter details */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Tracking</p>
                    <p className="text-[11px] font-bold text-slate-700 uppercase">{selectedWorksheet.trackingType === 'hour-meter' ? 'Hour Meter' : 'Clock Duration'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">{selectedWorksheet.trackingType === 'hour-meter' ? 'Start Meter' : 'Start Time'}</p>
                    <p className="text-[11px] font-bold text-slate-800 font-mono">{selectedWorksheet.trackingType === 'hour-meter' ? selectedWorksheet.startMeter : selectedWorksheet.startTime}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">{selectedWorksheet.trackingType === 'hour-meter' ? 'End Meter' : 'End Time'}</p>
                    <p className="text-[11px] font-bold text-slate-800 font-mono">{selectedWorksheet.trackingType === 'hour-meter' ? selectedWorksheet.endMeter : selectedWorksheet.endTime}</p>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Hours Logged:</span>
                    <span className="font-mono text-slate-800 font-bold">{selectedWorksheet.totalHours} hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rate per Hour:</span>
                    <span className="font-mono text-slate-800 font-bold">₹{selectedWorksheet.ratePerHour || 1000}/hr</span>
                  </div>
                  <div className="border-t border-slate-200 my-1 pt-1.5 flex justify-between text-sm">
                    <span className="font-bold text-slate-700">Total Billed Due:</span>
                    <span className="font-black text-amber-600">₹{selectedWorksheet.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Paid to Date:</span>
                    <span className="font-bold text-emerald-600">₹{selectedWorksheet.amountPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Balance Outstanding:</span>
                    <span className="font-bold text-rose-600">₹{(selectedWorksheet.totalAmount - selectedWorksheet.amountPaid).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWorksheet(null)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all"
                >
                  Close Worksheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Pay Outstanding Balance Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <h3 className="font-black text-slate-900 tracking-tight">Clear Outstanding Balance</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {paymentSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">Payment Authorized Successfully!</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      ₹{parseFloat(paymentAmount).toLocaleString('en-IN')} has been credited to your JCB ledger account. Your worksheets status has been updated.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit}>
                  <div className="p-5 space-y-4 text-xs">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-600">Total Outstanding Balance:</span>
                      <span className="font-black text-amber-600 text-sm">₹{totalPending.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Method Selector */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${paymentMethod === 'card' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'hover:text-slate-900'}`}
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Credit / Debit Card</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('upi')}
                        className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${paymentMethod === 'upi' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'hover:text-slate-900'}`}
                      >
                        <Hash className="w-3 h-3" />
                        <span>UPI / QR Code</span>
                      </button>
                    </div>

                    {/* Payment Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount to Pay (INR)</label>
                      <input
                        type="number"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Enter amount"
                        max={totalPending}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                      />
                    </div>

                    {paymentMethod === 'card' ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Card Number</label>
                          <input
                            type="text"
                            required
                            value={paymentCardNum}
                            onChange={(e) => setPaymentCardNum(e.target.value)}
                            placeholder="4000 1234 5678 9010"
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expiry</label>
                            <input
                              type="text"
                              required
                              value={paymentCardExpiry}
                              onChange={(e) => setPaymentCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CVV</label>
                            <input
                              type="password"
                              required
                              value={paymentCardCvv}
                              onChange={(e) => setPaymentCardCvv(e.target.value)}
                              placeholder="•••"
                              maxLength={3}
                              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UPI ID (VPA)</label>
                        <input
                          type="text"
                          required
                          value={paymentUpiId}
                          onChange={(e) => setPaymentUpiId(e.target.value)}
                          placeholder="clientname@upi"
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingPayment}
                      className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                    >
                      {isProcessingPayment ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Submit Mock Payment</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Request Machinery Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-white border border-slate-200 w-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh] md:max-h-[85vh] ${
                bookingMode === 'ai' ? 'max-w-3xl' : 'max-w-md'
              }`}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  {bookingMode === 'ai' ? (
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <Calendar className="w-4 h-4 text-amber-500" />
                  )}
                  <h3 className="font-black text-slate-900 tracking-tight">
                    {bookingMode === 'ai' ? 'AI JCB Booking Assistant' : 'Request JCB Machine Booking'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle Tabs (Only show if not success state) */}
              {!bookingSuccess && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mx-5 mt-4">
                  <button
                    type="button"
                    onClick={() => setBookingMode('ai')}
                    className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      bookingMode === 'ai' 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Co-Pilot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode('manual')}
                    className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      bookingMode === 'manual' 
                        ? 'bg-white text-slate-800 border border-slate-200 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>Manual Form</span>
                  </button>
                </div>
              )}

              {bookingSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">Booking Request Logged!</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Your enquiry for a JCB excavator has been successfully submitted. Our operations team will contact you shortly to authorize dispatch.
                    </p>
                  </div>
                </div>
              ) : bookingMode === 'ai' ? (
                /* AI Chat & Live Draft View */
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
                  {/* Mobile Toggle AI Chat Bar */}
                  <div className="flex md:hidden items-center justify-between px-4 py-2 bg-amber-50/80 border-b border-amber-200/80 text-xs shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-amber-600" />
                      <span>AI Assistant Chat</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMobileAiChat(!showMobileAiChat)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      {showMobileAiChat ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide Chat</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show Chat</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-y-auto md:overflow-hidden md:h-[500px] flex-1 min-h-0">
                    {/* Left: Chat Pane */}
                    <div className={`h-[300px] md:h-full shrink-0 md:shrink flex-1 flex-col bg-slate-50 min-w-0 ${showMobileAiChat ? 'flex' : 'hidden md:flex'}`}>
                    {/* Top Language Select Bar */}
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center justify-between text-xs shrink-0 shadow-sm">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Languages className="w-3.5 h-3.5 text-amber-500" />
                        <span>Language / भाषा:</span>
                      </div>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => {
                          setSelectedLanguage(e.target.value);
                          if (isListening) {
                            if (recognitionRef.current) {
                              recognitionRef.current.stop();
                            }
                          }
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none text-[11px] cursor-pointer transition-all"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                      {aiChatMessages.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                          </div>
                          <div className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user' 
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-100' 
                              : 'bg-white text-slate-700 border border-slate-200 shadow-sm'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      
                      {isAiThinking && (
                        <div className="flex gap-2 max-w-[85%] mr-auto items-center">
                          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-400 text-xs shadow-sm">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChatMessage} className="p-3 border-t border-slate-200 bg-slate-100/70 flex flex-col gap-2 shrink-0">
                      {isListening && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[10px] animate-pulse font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                          <span>🎙️ Listening ({LANGUAGES.find(l => l.code === selectedLanguage)?.label})... Speak clearly.</span>
                        </div>
                      )}
                      {recognitionError && (
                        <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-[10px] font-medium leading-normal">
                          ⚠️ {recognitionError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={aiInputText}
                            onChange={(e) => setAiInputText(e.target.value)}
                            placeholder={
                              isListening 
                                ? "Listening... Speak now" 
                                : `Ask assistant in ${LANGUAGES.find(l => l.code === selectedLanguage)?.label}...`
                            }
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 text-xs rounded-xl pl-3 pr-10 py-2.5 outline-none text-slate-800 focus:border-amber-500 transition-colors"
                            disabled={isAiThinking}
                          />
                          <button
                            type="button"
                            onClick={toggleListening}
                            title={isListening ? "Stop voice input" : "Start voice input"}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                              isListening 
                                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={isAiThinking || !aiInputText.trim()}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer flex items-center justify-center shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Right: Live Interactive Draft Card */}
                  <div className={`w-full md:w-80 ${showMobileAiChat ? 'min-h-[320px] md:h-full' : 'h-full flex-1'} flex flex-col bg-slate-50/50 p-4 md:p-5 space-y-4 justify-between overflow-y-auto shrink-0 md:shrink scrollbar-thin`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                          <span>Live Booking Draft</span>
                        </h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${isAiBookingReady ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {isAiBookingReady ? 'Draft Complete' : 'Refining Details'}
                        </span>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        {/* Nearby JCB Owner Selector Section */}
                        <div className="p-3 bg-slate-100/80 border border-slate-200 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                              <span>Select Nearby Owner</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {gpsStatus === 'granted' ? (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> GPS Active
                                </span>
                              ) : gpsStatus === 'detecting' ? (
                                <span className="text-[8px] text-amber-600 font-semibold animate-pulse flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-500" /> Detecting...
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={triggerGeolocation}
                                  className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Retry detecting location"
                                >
                                  <RefreshCw className="w-2.5 h-2.5 text-amber-600" /> Detect GPS
                                </button>
                              )}
                            </div>
                          </div>

                          {/* GPS Error Message Alert */}
                          {gpsErrorMsg && (
                            <div className="p-1.5 bg-rose-50 border border-rose-100 rounded-lg text-[9px] text-rose-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{gpsErrorMsg}</span>
                            </div>
                          )}

                          {/* GPS Fallback Inputs */}
                          {(gpsStatus === 'denied' || gpsStatus === 'error' || gpsStatus === 'idle') && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] text-slate-500 leading-normal">
                                GPS is denied or unavailable. Filter below by City or Pincode:
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="City..."
                                    value={ownerSearchCity}
                                    onChange={(e) => setOwnerSearchCity(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-[10px] rounded-lg pl-5 pr-1 py-1 outline-none text-slate-800 focus:border-amber-500 font-semibold"
                                  />
                                  <Search className="w-2.5 h-2.5 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                                </div>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Pincode..."
                                    value={ownerSearchPincode}
                                    onChange={(e) => setOwnerSearchPincode(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-[10px] rounded-lg pl-5 pr-1 py-1 outline-none text-slate-800 focus:border-amber-500 font-semibold"
                                  />
                                  <MapPin className="w-2.5 h-2.5 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Owners List */}
                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5 scrollbar-thin">
                            {sortedOwners.length === 0 ? (
                              <p className="text-[9px] text-slate-400 italic py-2 text-center">No matching JCB owners found.</p>
                            ) : (
                              sortedOwners.map((owner) => {
                                const isSelected = selectedOwnerId === owner.ownerId;
                                return (
                                  <button
                                    key={owner.ownerId}
                                    type="button"
                                    onClick={() => setSelectedOwnerId(owner.ownerId)}
                                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-start justify-between gap-1.5 cursor-pointer ${
                                      isSelected 
                                        ? 'bg-amber-50 border-amber-300 text-slate-900 shadow-sm' 
                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-[10px] text-slate-800 truncate flex items-center gap-1">
                                        <span>{owner.ownerName}</span>
                                        {isSelected && <span className="text-[8px] bg-amber-500 text-slate-950 px-1 rounded-sm font-black">ACTIVE</span>}
                                      </p>
                                      <p className="text-[8px] text-slate-400 truncate mt-0.5">
                                        📍 {owner.city} • Pincode: {owner.pincode}
                                      </p>
                                    </div>
                                    
                                    {/* Distance Badge */}
                                    {owner.distance !== null ? (
                                      <span className={`text-[8px] shrink-0 font-bold px-1 py-0.5 rounded ${
                                        isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {owner.distance} km
                                      </span>
                                    ) : (
                                      <span className="text-[8px] shrink-0 font-medium px-1 py-0.5 rounded bg-slate-50 text-slate-400">
                                        Match
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Equipment Category</label>
                          <select
                            value={aiDraftMachine}
                            onChange={(e) => setAiDraftMachine(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800 cursor-pointer"
                          >
                            <option value="JCB 1">JCB Backhoe Loader (3DX Super)</option>
                            <option value="JCB 2">JCB Tracked Excavator (JS205)</option>
                            <option value="JCB 3">JCB Compact Compactor (116)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Date</label>
                          <input
                            type="date"
                            required
                            value={aiDraftDate}
                            onChange={(e) => setAiDraftDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Start Time</label>
                            <input
                              type="time"
                              required
                              value={aiDraftStartTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAiDraftStartTime(val);
                                setAiDraftHours(calculateHoursFromTimes(val, aiDraftEndTime));
                              }}
                              className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">End Time</label>
                            <input
                              type="time"
                              required
                              value={aiDraftEndTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAiDraftEndTime(val);
                                setAiDraftHours(calculateHoursFromTimes(aiDraftStartTime, val));
                              }}
                              className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Est. Hours</label>
                          <input
                            type="number"
                            required
                            disabled
                            value={aiDraftHours}
                            placeholder="Hours"
                            className="w-full bg-slate-100 border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-500 cursor-not-allowed"
                          />
                        </div>

                        {validateBookingTimes(aiDraftStartTime, aiDraftEndTime) && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 leading-normal font-medium">
                            ⚠️ {validateBookingTimes(aiDraftStartTime, aiDraftEndTime)}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Site Location</label>
                          <input
                            type="text"
                            required
                            value={aiDraftLocation}
                            onChange={(e) => setAiDraftLocation(e.target.value)}
                            placeholder="Awaiting location details..."
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800 focus:border-amber-500/40 transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Type of Work</label>
                          <input
                            type="text"
                            required
                            value={aiDraftWorkType}
                            onChange={(e) => setAiDraftWorkType(e.target.value)}
                            placeholder="Awaiting work details..."
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none text-slate-800 focus:border-amber-500/40 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleAiDraftSubmit}
                        disabled={!aiDraftLocation || !aiDraftWorkType || !aiDraftDate}
                        className={`w-full font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all ${
                          (aiDraftLocation && aiDraftWorkType && aiDraftDate)
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <span>Confirm AI Booking Request</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                /* Manual Form View */
                <form onSubmit={handleBookingSubmit} className="flex flex-col min-h-0 flex-1">
                  <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[50vh] md:max-h-[60vh] scrollbar-thin">
                    {/* Nearby JCB Owner Selector Section */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                          <span>Select Nearby Owner</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {gpsStatus === 'granted' ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> GPS Active
                            </span>
                          ) : gpsStatus === 'detecting' ? (
                            <span className="text-[8px] text-amber-600 font-semibold animate-pulse flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-500" /> Detecting...
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={triggerGeolocation}
                              className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Retry detecting location"
                            >
                              <RefreshCw className="w-2.5 h-2.5 text-amber-600" /> Detect GPS
                            </button>
                          )}
                        </div>
                      </div>

                      {/* GPS Error Message Alert */}
                      {gpsErrorMsg && (
                        <div className="p-1.5 bg-rose-50 border border-rose-100 rounded-lg text-[9px] text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{gpsErrorMsg}</span>
                        </div>
                      )}

                      {/* GPS Fallback Inputs */}
                      {(gpsStatus === 'denied' || gpsStatus === 'error' || gpsStatus === 'idle') && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-slate-500 leading-normal">
                            GPS is denied or unavailable. Filter below by City or Pincode:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="City..."
                                value={ownerSearchCity}
                                onChange={(e) => setOwnerSearchCity(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-[10px] rounded-lg pl-5 pr-1 py-1 outline-none text-slate-800 focus:border-amber-500 font-semibold"
                              />
                              <Search className="w-2.5 h-2.5 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Pincode..."
                                value={ownerSearchPincode}
                                onChange={(e) => setOwnerSearchPincode(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-[10px] rounded-lg pl-5 pr-1 py-1 outline-none text-slate-800 focus:border-amber-500 font-semibold"
                              />
                              <MapPin className="w-2.5 h-2.5 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Owners List */}
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5 scrollbar-thin">
                        {sortedOwners.length === 0 ? (
                          <p className="text-[9px] text-slate-400 italic py-2 text-center">No matching JCB owners found.</p>
                        ) : (
                          sortedOwners.map((owner) => {
                            const isSelected = selectedOwnerId === owner.ownerId;
                            return (
                              <button
                                key={owner.ownerId}
                                type="button"
                                onClick={() => setSelectedOwnerId(owner.ownerId)}
                                className={`w-full text-left p-2 rounded-lg border transition-all flex items-start justify-between gap-1.5 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-amber-50 border-amber-300 text-slate-900 shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-[10px] text-slate-800 truncate flex items-center gap-1">
                                    <span>{owner.ownerName}</span>
                                    {isSelected && <span className="text-[8px] bg-amber-500 text-slate-950 px-1 rounded-sm font-black">ACTIVE</span>}
                                  </p>
                                  <p className="text-[8px] text-slate-400 truncate mt-0.5">
                                    📍 {owner.city} • Pincode: {owner.pincode}
                                  </p>
                                </div>
                                
                                {/* Distance Badge */}
                                {owner.distance !== null ? (
                                  <span className={`text-[8px] shrink-0 font-bold px-1 py-0.5 rounded ${
                                    isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {owner.distance} km
                                  </span>
                                ) : (
                                  <span className="text-[8px] shrink-0 font-medium px-1 py-0.5 rounded bg-slate-50 text-slate-400">
                                    Match
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Equipment Category</label>
                      <select
                        value={bookingMachine}
                        onChange={(e) => setBookingMachine(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 cursor-pointer font-bold"
                      >
                        {machines.map((mach) => (
                          <option key={mach} value={mach} className="bg-white text-slate-800 font-bold">
                            ⚡ {mach}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desired Date</label>
                      <input
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Start Time</label>
                        <input
                          type="time"
                          required
                          value={bookingStartTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBookingStartTime(val);
                            setBookingHours(calculateHoursFromTimes(val, bookingEndTime));
                          }}
                          className="w-full bg-white border border-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">End Time</label>
                        <input
                          type="time"
                          required
                          value={bookingEndTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBookingEndTime(val);
                            setBookingHours(calculateHoursFromTimes(bookingStartTime, val));
                          }}
                          className="w-full bg-white border border-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estimated Hours</label>
                      <input
                        type="number"
                        required
                        disabled
                        value={bookingHours}
                        placeholder="Hours"
                        className="w-full bg-slate-100 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {validateBookingTimes(bookingStartTime, bookingEndTime) && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed font-semibold">
                        ⚠️ {validateBookingTimes(bookingStartTime, bookingEndTime)}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Site Location Address</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <MapPin className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={bookingLocation}
                          onChange={(e) => setBookingLocation(e.target.value)}
                          placeholder="Address, Landmark, Coordinates..."
                          className="w-full bg-white border border-slate-200 focus:border-amber-500 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none text-slate-800 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type of Operation</label>
                      <input
                        type="text"
                        required
                        value={bookingWorkType}
                        onChange={(e) => setBookingWorkType(e.target.value)}
                        placeholder="e.g. Trench Excavation, Demolition, Backfilling"
                        className="w-full bg-white border border-slate-200 focus:border-amber-500 text-sm rounded-xl px-3.5 py-2.5 outline-none text-slate-800 transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-5 border-t border-slate-200 bg-slate-50/70 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowBookingModal(false)}
                      className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center gap-1"
                    >
                      <span>Submit Request</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

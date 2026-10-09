import { JcbEntry, JcbStats } from './types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Format currency
export const formatCurrency = (amount: number, currencySymbol: string = '₹') => {
  return `${currencySymbol}${amount.toLocaleString('en-IN')}`;
};

// Calculate total hours from hour meter or clock times
export const calculateHours = (entry: Partial<JcbEntry>): number => {
  if (entry.trackingType === 'hour-meter') {
    if (entry.startMeter !== undefined && entry.endMeter !== undefined) {
      const diff = entry.endMeter - entry.startMeter;
      return Math.max(0, parseFloat(diff.toFixed(2)));
    }
  } else if (entry.trackingType === 'clock') {
    if (entry.startTime && entry.endTime) {
      const [startHour, startMin] = entry.startTime.split(':').map(Number);
      const [endHour, endMin] = entry.endTime.split(':').map(Number);
      
      let diffMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (diffMinutes < 0) {
        // Handle overnight shifts
        diffMinutes += 24 * 60;
      }
      return Math.max(0, parseFloat((diffMinutes / 60).toFixed(2)));
    }
  }
  return 0;
};

// Compute statistics from entries
export const calculateStats = (entries: JcbEntry[] = []): JcbStats => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const stats: JcbStats = {
    totalHours: 0,
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0,
    totalEntries: safeEntries.length,
    driverStats: {},
    customerStats: {},
    monthlyRevenue: {},
  };

  safeEntries.forEach((entry) => {
    if (!entry) return;
    const hrs = typeof entry.totalHours === 'number' && !isNaN(entry.totalHours) ? entry.totalHours : 0;
    const rev = typeof entry.totalAmount === 'number' && !isNaN(entry.totalAmount) ? entry.totalAmount : 0;
    const paid = typeof entry.amountPaid === 'number' && !isNaN(entry.amountPaid) ? entry.amountPaid : 0;

    stats.totalHours += hrs;
    stats.totalRevenue += rev;
    
    if (entry.paymentStatus === 'paid') {
      stats.totalPaid += rev;
    } else if (entry.paymentStatus === 'pending') {
      stats.totalPending += rev;
    } else if (entry.paymentStatus === 'partial') {
      stats.totalPaid += paid;
      stats.totalPending += Math.max(0, rev - paid);
    }

    // Driver stats
    const driver = (entry.driverName || '').trim();
    if (driver) {
      if (!stats.driverStats[driver]) {
        stats.driverStats[driver] = { hours: 0, revenue: 0, count: 0 };
      }
      stats.driverStats[driver].hours += hrs;
      stats.driverStats[driver].revenue += rev;
      stats.driverStats[driver].count += 1;
    }

    // Customer stats
    const customer = (entry.customerName || '').trim();
    if (customer) {
      if (!stats.customerStats[customer]) {
        stats.customerStats[customer] = { hours: 0, revenue: 0, count: 0 };
      }
      stats.customerStats[customer].hours += hrs;
      stats.customerStats[customer].revenue += rev;
      stats.customerStats[customer].count += 1;
    }

    // Monthly stats (YYYY-MM)
    const month = entry.date.substring(0, 7); // '2026-07'
    if (month) {
      stats.monthlyRevenue[month] = (stats.monthlyRevenue[month] || 0) + entry.totalAmount;
    }
  });

  // Limit float precision
  stats.totalHours = parseFloat(stats.totalHours.toFixed(2));
  stats.totalRevenue = parseFloat(stats.totalRevenue.toFixed(2));
  stats.totalPaid = parseFloat(stats.totalPaid.toFixed(2));
  stats.totalPending = parseFloat(stats.totalPending.toFixed(2));

  return stats;
};

// Export to JSON string and trigger file download
export const exportDataAsJSON = (entries: JcbEntry[]) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `jcb_work_records_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

// Export to beautifully styled landscape PDF with summary card statistics and status coloring
export const exportDataAsPDF = (entries: JcbEntry[], title: string = "JCB Work Record Report") => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Calculate statistics for the exported entries
  let totalHours = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  let totalPending = 0;

  entries.forEach((entry) => {
    totalHours += entry.totalHours;
    totalBilled += entry.totalAmount;
    if (entry.paymentStatus === 'paid') {
      totalPaid += entry.totalAmount;
    } else if (entry.paymentStatus === 'pending') {
      totalPending += entry.totalAmount;
    } else if (entry.paymentStatus === 'partial') {
      totalPaid += entry.amountPaid || 0;
      totalPending += (entry.totalAmount - (entry.amountPaid || 0));
    }
  });

  // 1. BRANDED HEADER BANNER
  // Draw solid Dark Slate top background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(10, 10, 277, 24, 'F');

  // Draw JCB Signature Amber Yellow side stripe
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(10, 10, 6, 24, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text("JCB WORK MANAGEMENT SYSTEM", 22, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11); // amber-500 text
  doc.text(title.toUpperCase(), 22, 27);

  // Metadata Information on right side
  doc.setTextColor(156, 163, 175); // gray-400
  doc.setFontSize(8.5);
  doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 225, 19);
  doc.text(`Export Type: ADMIN STATEMENT`, 225, 25);
  doc.text(`Total Records: ${entries.length} Jobs`, 225, 31);

  // 2. METRICS CARDS (Generates a row of 4 KPI blocks)
  const cardWidth = 64;
  const cardHeight = 22;
  const cardY = 38;
  const cardSpacing = 7;

  const cardData = [
    { label: 'TOTAL HOURS UTILIZED', value: `${totalHours.toFixed(1)} Hrs`, isSpecial: true },
    { label: 'TOTAL INVOICED REVENUE', value: `₹${totalBilled.toLocaleString('en-IN')}` },
    { label: 'COLLECTED AMOUNT', value: `₹${totalPaid.toLocaleString('en-IN')}`, isGreen: true },
    { label: 'OUTSTANDING DUE', value: `₹${totalPending.toLocaleString('en-IN')}`, isRed: true }
  ];

  cardData.forEach((card, index) => {
    const x = 10 + index * (cardWidth + cardSpacing);
    
    // Select Card Colors dynamically
    if (card.isGreen) {
      doc.setFillColor(240, 253, 250); // green-50
      doc.setDrawColor(22, 163, 74); // green-600
    } else if (card.isRed) {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(220, 38, 38); // red-600
    } else {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
    }
    
    doc.rect(x, cardY, cardWidth, cardHeight, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (card.isGreen) {
      doc.setTextColor(22, 101, 52); // green-800
    } else if (card.isRed) {
      doc.setTextColor(153, 27, 27); // red-800
    } else {
      doc.setTextColor(100, 116, 139); // slate-500
    }
    doc.text(card.label, x + 4, cardY + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    if (card.isGreen) {
      doc.setTextColor(21, 128, 61); // green-700
    } else if (card.isRed) {
      doc.setTextColor(185, 28, 28); // red-700
    } else if (card.isSpecial) {
      doc.setTextColor(217, 119, 6); // amber-600
    } else {
      doc.setTextColor(15, 23, 42); // slate-900
    }
    doc.text(card.value, x + 4, cardY + 16);
  });

  // 3. TABLE DATA FORMATTING
  const tableData = entries.map((entry) => {
    const outstanding = entry.totalAmount - entry.amountPaid;
    let paymentText = entry.paymentStatus.toUpperCase();
    if (entry.paymentStatus === 'partial') {
      paymentText = `PARTIAL\n(Bal: ₹${outstanding.toLocaleString('en-IN')})`;
    } else if (entry.paymentStatus === 'pending') {
      paymentText = `PENDING\n(Bal: ₹${entry.totalAmount.toLocaleString('en-IN')})`;
    }
    
    const machineName = entry.jcbMachineId === 'JCB 1' ? 'JCB Backhoe (3DX)' 
                      : entry.jcbMachineId === 'JCB 2' ? 'JCB Excavator'
                      : entry.jcbMachineId === 'JCB 3' ? 'JCB Compactor'
                      : entry.jcbMachineId;

    return [
      entry.date,
      `${entry.customerName}\n${entry.customerPhone}`,
      `${machineName}\n(${entry.workType || 'Excavation'})`,
      entry.driverName,
      entry.siteLocation,
      `${entry.totalHours} Hrs`,
      `Rate: ₹${(entry.ratePerHour || 1000).toLocaleString('en-IN')}/hr\nTotal: ₹${entry.totalAmount.toLocaleString('en-IN')}`,
      paymentText
    ];
  });

  autoTable(doc, {
    startY: 65,
    head: [['Date', 'Customer & Contact', 'Machine & Work Type', 'Driver / Supervisor', 'Worksite Location', 'Hours', 'Billing Details', 'Payment Status']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42], // deep slate header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Date
      1: { cellWidth: 38 }, // Customer
      2: { cellWidth: 38 }, // Machine
      3: { cellWidth: 30 }, // Driver
      4: { cellWidth: 58 }, // Location
      5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // Hours
      6: { cellWidth: 39 }, // Billing details
      7: { cellWidth: 40, halign: 'center' }, // Payment Status badge
    },
    willDrawCell: (data) => {
      // Color-coded status badges for Payment column (index 7)
      if (data.section === 'body' && data.column.index === 7) {
        const rowData = entries[data.row.index];
        if (rowData) {
          const status = rowData.paymentStatus;
          if (status === 'paid') {
            data.cell.styles.fillColor = [240, 253, 250]; // soft green bg
            data.cell.styles.textColor = [21, 128, 61]; // green-700
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'partial') {
            data.cell.styles.fillColor = [254, 243, 199]; // soft yellow bg
            data.cell.styles.textColor = [217, 119, 6]; // amber-700
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.fillColor = [254, 242, 242]; // soft red bg
            data.cell.styles.textColor = [185, 28, 28]; // red-700
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
    margin: { left: 10, right: 10, bottom: 15 },
    willDrawPage: (data) => {
      // Page titles for multiple pages report
      if (data.pageNumber > 1) {
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(10, 8, 277, 10, 'F');
        doc.setFillColor(245, 158, 11); // amber-500
        doc.rect(10, 8, 3, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("JCB WORK MANAGEMENT SYSTEM  -  DETAILED WORK RECORDS REPORT", 16, 14.5);
        doc.setFontSize(7.5);
        doc.setTextColor(245, 158, 11);
        doc.text(`PAGE ${data.pageNumber}`, 268, 14.5);
      }
    },
    didDrawPage: (data) => {
      // Bottom footer layout
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("System generated document. Work logs verified by on-site operations controller.", 10, 201);
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')} | Verified Statement`, 10, 205);
      doc.text(`Page ${data.pageNumber}`, 273, 203);
    }
  });

  // Save/Download the file
  const filename = `jcb_work_records_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// ==========================================
// Multi-Device & Session Management Utilities
// ==========================================

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
  deviceName: string;
  ipAddress: string;
  loginTime: string;
  lastActive: string;
  role: 'owner' | 'customer';
  isCurrentDevice?: boolean;
}

// Get or create unique persistent Device ID for this client/browser
export const getDeviceId = (): string => {
  let devId = localStorage.getItem('jcb_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    localStorage.setItem('jcb_device_id', devId);
  }
  return devId;
};

// Detect current device details
export const getDeviceDetails = (): { deviceType: 'Mobile' | 'Tablet' | 'Desktop'; deviceName: string } => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let deviceType: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/Mobile|iPhone|Android|iPod|BlackBerry/i.test(ua)) {
    deviceType = 'Mobile';
  }

  let os = 'Device';
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux PC';
  else if (ua.includes('Android')) os = 'Android Phone';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';

  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Firefox')) browser = 'Firefox';

  return {
    deviceType,
    deviceName: `${browser} on ${os}`
  };
};

// Register session when logging in or accessing the app (Supports concurrent multi-device logins!)
export const registerDeviceSession = (username: string, role: 'owner' | 'customer'): DeviceSession => {
  const currentDeviceId = getDeviceId();
  const { deviceType, deviceName } = getDeviceDetails();
  const normalizedUser = username.toLowerCase().trim();
  const nowStr = new Date().toISOString();

  const currentSession: DeviceSession = {
    sessionId: 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    deviceId: currentDeviceId,
    deviceType,
    deviceName,
    ipAddress: 'Active Network Session (Multi-Device)',
    loginTime: nowStr,
    lastActive: nowStr,
    role
  };

  // Sync session with backend API
  localStorage.setItem('jcb_current_session_id', currentSession.sessionId);

  fetch('/api/sessions/touch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: normalizedUser, session: currentSession })
  }).catch(() => {});

  // Broadcast session registration event to other tabs/devices
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('jcb_multi_device_channel');
      channel.postMessage({ type: 'SESSION_REGISTERED', username: normalizedUser, session: currentSession });
      channel.close();
    }
  } catch (e) {
    // Ignore BroadcastChannel fallback errors
  }

  return currentSession;
};

// Fetch all active sessions for a user
export const getActiveSessions = async (username: string): Promise<DeviceSession[]> => {
  if (!username) return [];
  const currentDeviceId = getDeviceId();
  const normalizedUser = username.toLowerCase().trim();

  try {
    const res = await fetch(`/api/sessions?username=${encodeURIComponent(normalizedUser)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
        return data.sessions.map((s: DeviceSession) => ({
          ...s,
          isCurrentDevice: s.deviceId === currentDeviceId
        }));
      }
    }
  } catch (e) {
    // API network fallback
  }

  // Fallback local session if API is initializing
  const { deviceType, deviceName } = getDeviceDetails();
  return [{
    sessionId: 'sess_current',
    deviceId: currentDeviceId,
    deviceType,
    deviceName,
    ipAddress: 'Current Session',
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    role: 'owner',
    isCurrentDevice: true
  }];
};

// Revoke specific session
export const revokeSession = (username: string, sessionId: string) => {
  const normalizedUser = username.toLowerCase().trim();

  fetch('/api/sessions/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: normalizedUser, sessionId })
  }).catch(() => {});

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('jcb_multi_device_channel');
      channel.postMessage({ type: 'SESSION_REVOKED', username: normalizedUser, revokedSessionId: sessionId });
      channel.close();
    }
  } catch (e) {}
};

// Revoke all other sessions except current
export const revokeOtherSessions = (username: string) => {
  const currentDeviceId = getDeviceId();
  const normalizedUser = username.toLowerCase().trim();

  fetch('/api/sessions/revoke-others', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: normalizedUser, currentDeviceId })
  }).catch(() => {});

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('jcb_multi_device_channel');
      channel.postMessage({ type: 'OTHER_SESSIONS_REVOKED', username: normalizedUser, currentDeviceId });
      channel.close();
    }
  } catch (e) {}
};



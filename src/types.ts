export interface JcbEntry {
  id: string;
  date: string;
  driverName: string;
  
  // Customer Details
  customerName: string;
  customerPhone: string;
  siteLocation: string;
  
  // JCB Details
  jcbMachineId: string;
  ratePerHour?: number;
  
  // Time Tracking Type
  trackingType: 'hour-meter' | 'clock';
  
  // Time Details
  startMeter?: number;
  endMeter?: number;
  startTime?: string;
  endTime?: string;
  
  // Diesel Details
  dieselLiters?: number;
  dieselAmount?: number;
  
  // Calculations
  totalHours: number;
  totalAmount: number;
  
  // Financials
  paymentStatus: 'paid' | 'pending' | 'partial';
  amountPaid: number;
  workType: string;
  
  createdAt: string;
}

export interface JcbStats {
  totalHours: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  totalEntries: number;
  driverStats: { [name: string]: { hours: number; revenue: number; count: number } };
  customerStats: { [name: string]: { hours: number; revenue: number; count: number } };
  monthlyRevenue: { [month: string]: number };
}

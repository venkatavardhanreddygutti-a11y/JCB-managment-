import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { SAMPLE_ENTRIES } from './src/sampleData';

// Load environment variables
dotenv.config();

// Shared Database File Path
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

const DEFAULT_USERS: Record<string, any> = {
  admin: {
    username: 'admin',
    displayName: 'Fleet Owner / Admin',
    role: 'owner',
    password: 'password',
    phone: '+91 91234 56789',
    email: 'fleet-owner@jcb-logistics.in',
    city: 'Bengaluru',
    pincode: '560001',
    lat: 12.9716,
    lng: 77.5946,
    profilePic: '',
    updatedAt: Date.now(),
  },
  operator: {
    username: 'operator',
    displayName: 'Field Operator',
    role: 'owner',
    password: 'password',
    phone: '+91 98765 43210',
    email: 'operator-fleet@jcb-logistics.in',
    city: 'Bengaluru',
    pincode: '560034',
    lat: 12.9352,
    lng: 77.6245,
    profilePic: '',
    updatedAt: Date.now(),
  },
  'aman construction group': {
    username: 'Aman Construction Group',
    displayName: 'Aman Construction Group',
    role: 'customer',
    pin: '1234',
    phone: '+91 98765 43210',
    email: 'contact@amanconstructions.in',
    profilePic: '',
    updatedAt: Date.now(),
  },
  'verma builders & developers': {
    username: 'Verma Builders & Developers',
    displayName: 'Verma Builders & Developers',
    role: 'customer',
    pin: '1234',
    phone: '+91 91234 56789',
    email: 'info@vermabuilders.com',
    profilePic: '',
    updatedAt: Date.now(),
  },
  'shree cement agency': {
    username: 'Shree Cement Agency',
    displayName: 'Shree Cement Agency',
    role: 'customer',
    pin: '1234',
    phone: '+91 88888 77777',
    email: 'billing@shreecement.in',
    profilePic: '',
    updatedAt: Date.now(),
  },
  'national highways authority': {
    username: 'National Highways Authority',
    displayName: 'National Highways Authority',
    role: 'customer',
    pin: '1234',
    phone: '+91 99999 88888',
    email: 'contracts@nhai.gov.in',
    profilePic: '',
    updatedAt: Date.now(),
  },
  'gmr infrastructure ltd': {
    username: 'GMR Infrastructure Ltd',
    displayName: 'GMR Infrastructure Ltd',
    role: 'customer',
    pin: '1234',
    phone: '+91 97777 66666',
    email: 'procurement@gmr.in',
    profilePic: '',
    updatedAt: Date.now(),
  },
};

const DEFAULT_FLEET_MACHINES = [
  { id: 'JCB 1', name: 'JCB Backhoe Loader (3DX Super)', status: 'Active', operator: 'Rajesh Kumar' },
  { id: 'JCB 2', name: 'JCB Tracked Excavator (JS205)', status: 'Active', operator: 'Sukhvinder Singh' },
  { id: 'JCB 3', name: 'JCB Compact Compactor (116)', status: 'Maintenance', operator: 'Vikram Rathore' },
];

const DEFAULT_CUSTOM_DRIVERS = [
  'Rajesh Kumar',
  'Sukhvinder Singh',
  'Vikram Rathore',
  'Amit Sharma'
];

const DEFAULT_BOOKINGS = [
  {
    id: 'bk-101',
    customerName: 'Aman Construction Group',
    customerPhone: '+91 98765 43210',
    machineId: 'JCB 1',
    siteLocation: 'Sector 62 Metro Extension, Noida',
    workType: 'Levelling',
    estimatedHours: 6,
    startTime: '08:00',
    endTime: '14:00',
    date: '2026-07-22',
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'bk-102',
    customerName: 'Verma Builders & Developers',
    customerPhone: '+91 91234 56789',
    machineId: 'JCB 2',
    siteLocation: 'Greenwood Residency Phase 2',
    workType: 'Excavation',
    estimatedHours: 8,
    startTime: '09:00',
    endTime: '17:00',
    date: '2026-07-23',
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      if (!parsed.users) parsed.users = {};
      // Ensure DEFAULT_USERS exist if missing
      for (const [key, defUser] of Object.entries(DEFAULT_USERS)) {
        if (!parsed.users[key]) {
          parsed.users[key] = defUser;
        }
      }

      if (!Array.isArray(parsed.entries)) parsed.entries = SAMPLE_ENTRIES;
      if (!Array.isArray(parsed.bookings)) parsed.bookings = DEFAULT_BOOKINGS;
      if (!Array.isArray(parsed.fleetMachines)) parsed.fleetMachines = DEFAULT_FLEET_MACHINES;
      if (!Array.isArray(parsed.customDrivers)) parsed.customDrivers = DEFAULT_CUSTOM_DRIVERS;
      if (!parsed.sessions) parsed.sessions = {};

      return parsed;
    }
  } catch (e) {
    console.error('Error reading db.json, fallback to defaults:', e);
  }

  const initialData = {
    users: { ...DEFAULT_USERS },
    entries: [...SAMPLE_ENTRIES],
    bookings: [...DEFAULT_BOOKINGS],
    fleetMachines: [...DEFAULT_FLEET_MACHINES],
    customDrivers: [...DEFAULT_CUSTOM_DRIVERS],
    sessions: {},
  };
  writeDb(initialData);
  return initialData;
}

function writeDb(data: any) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing db.json:', e);
  }
}

// Lazy initialization of GoogleGenAI client to avoid crashes if API key is not set during startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Robust helper to perform generateContent with retries and fallback models
async function generateContentWithFallback(
  client: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
) {
  const modelsToTry = [
    params.primaryModel || 'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite'
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generateContent with model: ${model} (attempt ${attempt}/2)`);
        const response = await client.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`[Gemini API] Error with model ${model} (attempt ${attempt}):`, error.message || error);
        
        // If it's a 503 or 429 or any server-side error, retry or move to the next model
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models failed.');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use body parsing middleware
  app.use(express.json({ limit: '10mb' }));

  // ===============================================
  // SHARED DATABASE & PROFILE REST API ENDPOINTS
  // ===============================================

  // Get all user profiles
  app.get('/api/users', (req, res) => {
    const db = readDb();
    res.json(Object.values(db.users || {}));
  });

  // Get specific user profile
  app.get('/api/users/profile', (req, res) => {
    const db = readDb();
    const username = (req.query.username as string || '').toLowerCase().trim();
    if (!username) {
      return res.status(400).json({ error: 'Username parameter required' });
    }
    const user = db.users[username] || Object.values(db.users).find((u: any) => u.username.toLowerCase().trim() === username);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json({ success: true, user });
  });

  // Login handler
  app.post('/api/login', (req, res) => {
    const db = readDb();
    const { username, password, role, customerPasscode, offlineUserData } = req.body;

    // Auto-restore user from offlineUserData if server DB was re-created on fresh container
    if (offlineUserData && offlineUserData.username) {
      const restoreKey = offlineUserData.username.toLowerCase().trim();
      if (!db.users[restoreKey]) {
        db.users[restoreKey] = offlineUserData;
        writeDb(db);
      }
    }

    if (role === 'customer') {
      const custName = (username || '').trim();
      const normalizedKey = custName.toLowerCase();
      
      if (!custName) {
        return res.status(400).json({ error: 'Customer name is required' });
      }
      if (!customerPasscode) {
        return res.status(400).json({ error: 'Customer Access PIN is required' });
      }

      let customerUser = db.users[normalizedKey] || Object.values(db.users).find((u: any) => u.username.toLowerCase().trim() === normalizedKey);
      
      const targetPin = customerUser?.pin || '1234';
      if (customerPasscode !== targetPin && customerPasscode !== '1234') {
        return res.status(401).json({ error: 'Invalid Client Access PIN. Use 1234 for demo purposes.' });
      }

      if (!customerUser) {
        customerUser = {
          username: custName,
          displayName: custName,
          role: 'customer',
          pin: customerPasscode || '1234',
          phone: '+91 98765 43210',
          email: `${normalizedKey.replace(/[^a-z0-9]/g, '')}@jcb-client.in`,
          profilePic: '',
          updatedAt: Date.now(),
        };
        db.users[normalizedKey] = customerUser;
        writeDb(db);
      }

      return res.json({ success: true, user: customerUser });
    }

    // Owner / Admin Login
    const inputUser = (username || '').toLowerCase().trim();
    if (!inputUser || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    let ownerUser = db.users[inputUser] || Object.values(db.users).find((u: any) => u.username.toLowerCase().trim() === inputUser);

    if (
      (inputUser === 'admin' && (password === 'password' || password === 'admin123')) ||
      (inputUser === 'operator' && (password === 'password' || password === 'admin123')) ||
      (ownerUser && ownerUser.password === password)
    ) {
      if (!ownerUser) {
        ownerUser = {
          username: (username || inputUser).trim(),
          displayName: inputUser === 'operator' ? 'Field Operator' : 'Fleet Owner / Admin',
          role: 'owner',
          password: password,
          phone: inputUser === 'operator' ? '+91 98765 43210' : '+91 91234 56789',
          email: inputUser === 'operator' ? 'operator-fleet@jcb-logistics.in' : 'fleet-owner@jcb-logistics.in',
          city: 'Bengaluru',
          pincode: inputUser === 'operator' ? '560034' : '560001',
          lat: inputUser === 'operator' ? 12.9352 : 12.9716,
          lng: inputUser === 'operator' ? 77.6245 : 77.5946,
          profilePic: '',
          updatedAt: Date.now(),
        };
        db.users[inputUser] = ownerUser;
        writeDb(db);
      }
      return res.json({ success: true, user: ownerUser });
    }

    return res.status(401).json({ error: 'Invalid username or password. Check credentials or try standard operator login.' });
  });

  // Sync offline user accounts and data from client local storage to server DB
  app.post('/api/sync-offline-data', (req, res) => {
    const db = readDb();
    const { users, entries, bookings, fleetMachines, customDrivers } = req.body;

    let changes = false;

    // Sync users
    if (Array.isArray(users)) {
      for (const u of users) {
        if (u && u.username) {
          const key = u.username.toLowerCase().trim();
          if (!db.users[key] || (u.updatedAt && u.updatedAt > (db.users[key].updatedAt || 0))) {
            db.users[key] = u;
            changes = true;
          }
        }
      }
    }

    // Sync entries
    if (Array.isArray(entries)) {
      const existingIds = new Set((db.entries || []).map((e: any) => e.id));
      for (const e of entries) {
        if (e && e.id && !existingIds.has(e.id)) {
          db.entries.unshift(e);
          existingIds.add(e.id);
          changes = true;
        }
      }
    }

    // Sync bookings
    if (Array.isArray(bookings)) {
      const existingIds = new Set((db.bookings || []).map((b: any) => b.id));
      for (const b of bookings) {
        if (b && b.id && !existingIds.has(b.id)) {
          db.bookings.unshift(b);
          existingIds.add(b.id);
          changes = true;
        }
      }
    }

    // Sync fleet machines
    if (Array.isArray(fleetMachines)) {
      const existingIds = new Set((db.fleetMachines || []).map((m: any) => m.id));
      for (const m of fleetMachines) {
        if (m && m.id && !existingIds.has(m.id)) {
          db.fleetMachines.push(m);
          existingIds.add(m.id);
          changes = true;
        }
      }
    }

    // Sync custom drivers
    if (Array.isArray(customDrivers)) {
      const existingSet = new Set(db.customDrivers || []);
      for (const d of customDrivers) {
        if (d && typeof d === 'string' && !existingSet.has(d)) {
          db.customDrivers.push(d);
          existingSet.add(d);
          changes = true;
        }
      }
    }

    if (changes) {
      writeDb(db);
    }

    res.json({
      success: true,
      users: Object.values(db.users),
      entries: db.entries,
      bookings: db.bookings,
      fleetMachines: db.fleetMachines,
      customDrivers: db.customDrivers
    });
  });

  // User registration
  app.post('/api/register', (req, res) => {
    const db = readDb();
    const { username, password, phone, role } = req.body;

    const formattedUser = (username || '').trim();
    const normalizedKey = formattedUser.toLowerCase();

    if (!formattedUser || !password || !phone) {
      return res.status(400).json({ error: 'Please fill in all registration fields.' });
    }

    if (db.users[normalizedKey]) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    const newUser = {
      username: formattedUser,
      displayName: formattedUser,
      role: role || 'owner',
      password: password,
      phone: phone,
      email: `${normalizedKey.replace(/[^a-z0-9]/g, '')}@jcb-fleet.in`,
      city: 'Bengaluru',
      pincode: '560001',
      lat: 12.9716,
      lng: 77.5946,
      profilePic: '',
      updatedAt: Date.now(),
    };

    db.users[normalizedKey] = newUser;
    writeDb(db);

    res.json({ success: true, user: newUser });
  });

  // Update user profile
  app.post('/api/profile/update', (req, res) => {
    const db = readDb();
    const { oldUsername, username, displayName, phone, email, city, pincode, lat, lng, profilePic, password, pin } = req.body;

    const targetKey = (oldUsername || username || '').toLowerCase().trim();
    const newKey = (username || oldUsername || '').toLowerCase().trim();

    if (!targetKey) {
      return res.status(400).json({ error: 'Target username is required' });
    }

    let user = db.users[targetKey] || Object.values(db.users).find((u: any) => u.username.toLowerCase().trim() === targetKey);

    if (!user) {
      user = {
        username: username || targetKey,
        displayName: displayName || username || targetKey,
        role: 'owner',
        updatedAt: Date.now(),
      };
    }

    if (username !== undefined) user.username = username;
    if (displayName !== undefined) user.displayName = displayName;
    if (phone !== undefined) user.phone = phone;
    if (email !== undefined) user.email = email;
    if (city !== undefined) user.city = city;
    if (pincode !== undefined) user.pincode = pincode;
    if (lat !== undefined) user.lat = lat;
    if (lng !== undefined) user.lng = lng;
    if (profilePic !== undefined) user.profilePic = profilePic;
    if (password !== undefined) user.password = password;
    if (pin !== undefined) user.pin = pin;
    user.updatedAt = Date.now();

    if (targetKey !== newKey) {
      delete db.users[targetKey];
    }
    db.users[newKey] = user;

    writeDb(db);

    res.json({ success: true, user });
  });

  // Reset password
  app.post('/api/reset-password', (req, res) => {
    const db = readDb();
    const { username, phone, newPassword } = req.body;

    const normalizedKey = (username || '').toLowerCase().trim();
    let user = db.users[normalizedKey] || Object.values(db.users).find((u: any) => u.username.toLowerCase().trim() === normalizedKey);

    if (!user) {
      return res.status(404).json({ error: 'This username is not registered in the cloud fleet database.' });
    }

    user.password = newPassword;
    user.updatedAt = Date.now();
    db.users[normalizedKey] = user;
    writeDb(db);

    res.json({ success: true, user });
  });

  // Work entries
  app.get('/api/entries', (req, res) => {
    const db = readDb();
    res.json({ success: true, entries: db.entries || [] });
  });

  app.post('/api/entries', (req, res) => {
    const db = readDb();
    const { entries } = req.body;
    if (Array.isArray(entries)) {
      db.entries = entries;
      writeDb(db);
    }
    res.json({ success: true, entries: db.entries });
  });

  // Customer bookings
  app.get('/api/bookings', (req, res) => {
    const db = readDb();
    res.json({ success: true, bookings: db.bookings || [] });
  });

  app.post('/api/bookings', (req, res) => {
    const db = readDb();
    const { bookings } = req.body;
    if (Array.isArray(bookings)) {
      db.bookings = bookings;
      writeDb(db);
    }
    res.json({ success: true, bookings: db.bookings });
  });

  // Fleet machines & custom drivers
  app.get('/api/fleet', (req, res) => {
    const db = readDb();
    res.json({
      success: true,
      fleetMachines: db.fleetMachines || [],
      customDrivers: db.customDrivers || []
    });
  });

  app.post('/api/fleet', (req, res) => {
    const db = readDb();
    const { fleetMachines, customDrivers } = req.body;
    if (Array.isArray(fleetMachines)) db.fleetMachines = fleetMachines;
    if (Array.isArray(customDrivers)) db.customDrivers = customDrivers;
    writeDb(db);
    res.json({
      success: true,
      fleetMachines: db.fleetMachines,
      customDrivers: db.customDrivers
    });
  });

  // Multi-device sessions
  app.get('/api/sessions', (req, res) => {
    const db = readDb();
    const username = (req.query.username as string || '').toLowerCase().trim();
    const userSessions = db.sessions[username] || [];
    res.json({ success: true, sessions: userSessions });
  });

  app.post('/api/sessions/touch', (req, res) => {
    const db = readDb();
    const { username, session } = req.body;
    const userKey = (username || '').toLowerCase().trim();

    if (!userKey || !session) {
      return res.status(400).json({ error: 'Username and session object required' });
    }

    let list: any[] = db.sessions[userKey] || [];
    const idx = list.findIndex((s: any) => s.deviceId === session.deviceId);

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session, lastActive: new Date().toISOString() };
    } else {
      list.push({ ...session, lastActive: new Date().toISOString() });
    }

    db.sessions[userKey] = list;
    writeDb(db);
    res.json({ success: true, sessions: list });
  });

  app.post('/api/sessions/revoke', (req, res) => {
    const db = readDb();
    const { username, sessionId } = req.body;
    const userKey = (username || '').toLowerCase().trim();

    if (db.sessions[userKey]) {
      db.sessions[userKey] = db.sessions[userKey].filter((s: any) => s.sessionId !== sessionId);
      writeDb(db);
    }
    res.json({ success: true, sessions: db.sessions[userKey] || [] });
  });

  app.post('/api/sessions/revoke-others', (req, res) => {
    const db = readDb();
    const { username, currentDeviceId } = req.body;
    const userKey = (username || '').toLowerCase().trim();

    if (db.sessions[userKey]) {
      db.sessions[userKey] = db.sessions[userKey].filter((s: any) => s.deviceId === currentDeviceId);
      writeDb(db);
    }
    res.json({ success: true, sessions: db.sessions[userKey] || [] });
  });

  // Global logout - invalidates all active sessions across all devices for this account
  app.post('/api/sessions/global-logout', (req, res) => {
    const db = readDb();
    const { username } = req.body;
    const userKey = (username || '').toLowerCase().trim();

    if (!userKey) {
      return res.status(400).json({ error: 'Username is required for global logout' });
    }

    // Immediately clear all sessions for this account
    db.sessions[userKey] = [];
    db.globalLogoutTime = db.globalLogoutTime || {};
    db.globalLogoutTime[userKey] = Date.now();
    writeDb(db);

    res.json({ success: true, message: 'Successfully signed out globally across all devices' });
  });

  // Session validation endpoint - checked periodically & on page load/focus
  app.post('/api/sessions/validate', (req, res) => {
    const db = readDb();
    const { username, sessionId, deviceId } = req.body;
    const userKey = (username || '').toLowerCase().trim();

    if (!userKey) {
      return res.status(400).json({ valid: false, reason: 'Username is required' });
    }

    const userSessions = db.sessions[userKey] || [];

    // If user has no sessions at all or was globally logged out, return invalid
    if (!userSessions || userSessions.length === 0) {
      return res.json({
        valid: false,
        reason: 'Session has been invalidated or signed out globally across all devices.'
      });
    }

    // Check if session or device exists in active sessions list
    const sessionMatch = userSessions.find((s: any) => 
      (sessionId && s.sessionId === sessionId) || (deviceId && s.deviceId === deviceId)
    );

    if (!sessionMatch) {
      return res.json({
        valid: false,
        reason: 'This device session was revoked or signed out.'
      });
    }

    // Update lastActive timestamp on successful validation
    sessionMatch.lastActive = new Date().toISOString();
    writeDb(db);

    res.json({ valid: true });
  });


  // API Route: Generate Professional Work Log Narrative
  app.post('/api/gemini/narrative', async (req, res) => {
    try {
      const client = getGeminiClient();
      const { customerName, jcbMachineId, ratePerHour, totalHours, totalAmount, workType, siteLocation, date } = req.body;

      const prompt = `You are a professional assistant for a JCB / excavator leasing and contract company.
Generate a professional, polished 2-3 sentence work log narrative based on the following session log details:
- Date: ${date || 'Today'}
- Customer Name: ${customerName || 'N/A'}
- Machine Used: ${jcbMachineId || 'JCB 1'}
- Location: ${siteLocation || 'N/A'}
- Task Type: ${workType || 'Excavation'}
- Hours Worked: ${totalHours} hours
- Hourly Rate: ₹${ratePerHour} per hour
- Total Billing: ₹${totalAmount}

The narrative should read like an official entry in a business ledger or invoice attachment. It should focus on professional execution, site progress, and billing clarity. Do not include placeholders. Use realistic excavator terminology. Make it direct and business-appropriate.`;

      const response = await generateContentWithFallback(client, {
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });

      res.json({ text: response.text?.trim() || '' });
    } catch (error: any) {
      console.error('Error in /api/gemini/narrative:', error);
      res.status(500).json({ error: error.message || 'Failed to generate narrative with Gemini.' });
    }
  });

  // API Route: Generate Fleet & Cashflow Insights
  app.post('/api/gemini/insights', async (req, res) => {
    try {
      const client = getGeminiClient();
      const { entries, stats } = req.body;

      const prompt = `You are an expert AI Fleet Operations and Cashflow Strategist for JCB/Excavator businesses.
Analyze the following fleet log and financial statistics, and provide professional business insights:

FLEET STATS SUMMARY:
- Total Logged Jobs: ${stats.totalEntries || 0}
- Total Work Hours: ${stats.totalHours || 0} Hrs
- Total Scheduled Billing: ₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}
- Total Cash Received: ₹${(stats.totalPaid || 0).toLocaleString('en-IN')}
- Total Payments Outstanding: ₹${(stats.totalPending || 0).toLocaleString('en-IN')}

RECENT WORK ENTRIES LOG:
${JSON.stringify(entries?.slice(0, 30) || [])}

Provide high-level, actionable insights, analysis on machine/driver utilization, and customized, highly professional reminder drafts that the fleet owner can send to clients who have outstanding balances.`;

      const response = await generateContentWithFallback(client, {
        contents: prompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { 
                type: Type.STRING, 
                description: 'A professional high-level summary of fleet performance, active projects, and cashflow health.' 
              },
              efficiencyAdvice: { 
                type: Type.STRING, 
                description: 'Actionable fleet recommendations focusing on driver performance, machinery scheduling, or rate optimization.' 
              },
              financialsAnalysis: { 
                type: Type.STRING, 
                description: 'Detailed analysis of cashflow, billing speed, and risk factors regarding pending/partial payments.' 
              },
              customerReminders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING },
                    dueAmount: { type: Type.NUMBER },
                    suggestedMessage: { 
                      type: Type.STRING, 
                      description: 'A polite, friendly, and professional SMS/WhatsApp message draft reminding the customer about their outstanding balance in a business-appropriate tone.' 
                    },
                  },
                  required: ['customerName', 'dueAmount', 'suggestedMessage'],
                },
                description: 'List of custom reminder messages for customers with unpaid balances (pending or partial status).'
              },
            },
            required: ['summary', 'efficiencyAdvice', 'financialsAnalysis', 'customerReminders'],
          },
        },
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('Error in /api/gemini/insights:', error);
      res.status(500).json({ error: error.message || 'Failed to generate fleet insights.' });
    }
  });

  // API Route: AI Assisted Booking Parser & Conversation Engine
  app.post('/api/gemini/parse-booking', async (req, res) => {
    try {
      const client = getGeminiClient();
      const { history, localTime, localDate, bookingHistory, selectedLanguage } = req.body;

      const formattedHistory = (history || []).map((msg: any) => {
        const roleName = msg.role === 'user' ? 'Customer' : 'AI Assistant';
        return `${roleName}: ${msg.text}`;
      }).join('\n');

      // Format past booking history for prompt
      let bookingHistoryStr = "No previous booking history found.";
      if (bookingHistory && bookingHistory.length > 0) {
        bookingHistoryStr = bookingHistory.map((b: any, idx: number) => {
          return `Booking #${idx + 1}:
  - Type: ${b.type === 'completed_worksheet' ? 'Completed Job' : 'Requested booking'} (Status: ${b.status})
  - Machine Type/ID: ${b.machineId}
  - Site Location: ${b.siteLocation}
  - Type of Work: ${b.workType}
  - Duration/Estimated Hours: ${b.estimatedHours} hrs
  - Scheduled Slot: ${b.startTime || '08:00'} to ${b.endTime || '12:00'}
  - Date: ${b.date}
  - Logged/Created At: ${b.createdAt || b.date}`;
        }).join('\n\n');
      }

      const systemInstruction = `You are an intelligent, conversational, and highly helpful AI JCB Booking Assistant for a premier JCB / heavy machinery rental company.
Your main goal is to assist users in creating, modifying, or repeating bookings.

CRITICAL MULTILINGUAL INSTRUCTION:
- The customer's preferred communication language is: ${selectedLanguage || 'English'}.
- You MUST reply to the user using this language (${selectedLanguage || 'English'}) for the "reply" conversational text. If they selected a specific regional language (e.g., Hindi, Telugu, Tamil, Kannada, Marathi, Gujarati, Bengali, etc.), respond fluently, naturally, and grammatically correctly in that language.
- Ensure any draft summaries or descriptions are presented politely in their preferred language.

The current local date is: ${localDate || '2026-07-20'}
The current local time is: ${localTime || '22:13:24'}

The available machines for booking are:
- "JCB 1": JCB Backhoe Loader (3DX Super) - Ideal for general loading, digging, and backfilling.
- "JCB 2": JCB Tracked Excavator (JS205) - Ideal for heavy excavation, demolition, and quarrying.
- "JCB 3": JCB Compact Compactor (116) - Ideal for leveling, roadwork, and soil compacting.

IMPORTANT OPERATIONAL HOURS CONSTRAINT:
- JCB machinery works ONLY from morning 6:00 AM (06:00) to evening 7:00 PM (19:00).
- Bookings must be requested strictly within this operational window (06:00 to 19:00).
- If the user requests a time slot outside of 6:00 AM to 7:00 PM (for example, "1:00 am to 2:00 am"), you MUST:
  1. Politely explain in your response that JCB machines operate only from 6:00 AM to 7:00 PM.
  2. Set "startTime" and "endTime" to null (or adjust/default them to a standard valid slot, e.g., "08:00" and "12:00" or similar) and ask the customer to pick a time within the allowable operating hours.
  3. Set "isReady" to false because the requested slot is out-of-hours.

CUSTOMER'S PAST BOOKING HISTORY:
${bookingHistoryStr}

YOUR RESPONSIBILITIES & BEHAVIORAL PROTOCOLS:
1. HELP WITH CREATION, MODIFICATION, AND REPEATING BOOKINGS:
   - If the user says "book the previous one", "same as last booking", "repeat my booking", "do it again", or similar, identify the most recent booking from the CUSTOMER'S PAST BOOKING HISTORY above.
   - For a repeat booking: Copy all details from that previous booking, including the machine ID ("machineId" like "JCB 1"), type of work ("workType"), site location ("siteLocation"), duration ("estimatedHours"), "startTime", and "endTime".
   - If previous booking history is completely empty/unavailable and they ask for a repeat, politely explain that you don't have a record of past bookings, and ask for details like machine type, location, and date.
   - NEVER say you do not have access to previous bookings if the booking history is provided in the CUSTOMER'S PAST BOOKING HISTORY section above!
   - Modify only the fields requested by the user. For instance, if they ask to repeat the last booking but for "next Friday", keep all other details identical and update only the target date to next Friday's resolved date.

2. DRAFT EXTRACTION FIELDS (extractedDetails):
   - "date": Target date for booking. Must be in YYYY-MM-DD format. Resolve relative expressions (e.g. "tomorrow", "next Monday", "this Friday") relative to current date: ${localDate || '2026-07-20'}.
   - "machineId": Exactly "JCB 1", "JCB 2", "JCB 3", or null if not specified.
   - "siteLocation": Site address or landmark, or null if not specified.
   - "workType": Type of operations (e.g., excavation, trenching, road leveling), or null if not specified.
   - "startTime": Start time of the booking in "HH:MM" (24-hour) format (MUST be between "06:00" and "19:00"). If unspecified, or if user requests an out-of-bounds time, default to null.
   - "endTime": End time of the booking in "HH:MM" (24-hour) format (MUST be between "06:00" and "19:00"). If unspecified, or if user requests an out-of-bounds time, default to null.
   - "estimatedHours": Duration in hours as a number. If both startTime and endTime are specified, calculate this as the difference between them (e.g., "08:00" to "12:00" is 4 hours). Otherwise, default to 4 or copy from the previous booking.

3. CONVERSE & SUMMARIZE:
   - Always converse naturally, politely, and keep responses concise (1-2 sentences max by default).
   - If all required fields ("date", "machineId", "siteLocation", "workType", "startTime", "endTime") are filled within the valid 06:00-19:00 window, and the booking is ready to be requested, ALWAYS summarize the complete booking in your reply before asking for confirmation. Example reply: "I have prepared a draft of your booking for JCB Backhoe Loader (JCB 1) at [Location] on [Date] from [startTime] to [endTime] ([Hours] hours) of [Work Type]. Would you like to confirm?"
   - Set "isReady" to true ONLY if you have successfully gathered/extracted/copied a valid target date, machineId, siteLocation, workType, AND valid startTime and endTime (both within 06:00 to 19:00, with startTime < endTime), AND you have summarized it for confirmation in your reply. Otherwise, set it to false and ask for the missing or corrected details.

Analyze the transcript of conversation below, especially the latest user message, and output a JSON response matching the required schema. Ensure the extractedDetails object has all fields (use null if not specified, or copy from past bookings if repeating).

CONVERSATION TRANSCRIPT:
${formattedHistory}`;

      const response = await generateContentWithFallback(client, {
        contents: 'Help me draft a JCB booking request.',
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { 
                type: Type.STRING, 
                description: 'A friendly response addressing the user. Acknowledge what they provided and ask for remaining details, or summarize the full booking before final confirmation.' 
              },
              extractedDetails: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: 'YYYY-MM-DD format. If unspecified, return null. Resolve relative expressions to dates relative to ' + localDate },
                  machineId: { type: Type.STRING, description: 'Must be "JCB 1" | "JCB 2" | "JCB 3" | null' },
                  siteLocation: { type: Type.STRING, description: 'Site address or landmark, or null' },
                  workType: { type: Type.STRING, description: 'Type of excavation/operation, or null' },
                  estimatedHours: { type: Type.NUMBER, description: 'Number of hours, or null' },
                  startTime: { type: Type.STRING, description: 'Start time in 24-hour format HH:MM between 06:00 and 19:00, or null' },
                  endTime: { type: Type.STRING, description: 'End time in 24-hour format HH:MM between 06:00 and 19:00, or null' }
                },
                required: ['date', 'machineId', 'siteLocation', 'workType', 'estimatedHours', 'startTime', 'endTime']
              },
              isReady: { 
                type: Type.BOOLEAN, 
                description: 'Set to true ONLY if we have gathered/copied a valid date, machineId, siteLocation, workType, startTime, and endTime, and summarized it.' 
              }
            },
            required: ['reply', 'extractedDetails', 'isReady']
          }
        }
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('Error in /api/gemini/parse-booking:', error);
      res.status(500).json({ error: error.message || 'Failed to parse booking request.' });
    }
  });

  // Catch-all 404 handler for /api routes to prevent Vite SPA fallback from returning HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Serve static assets in production, otherwise mount Vite in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();

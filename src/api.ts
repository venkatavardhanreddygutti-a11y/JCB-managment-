export interface UserProfile {
  username: string;
  displayName: string;
  role: 'owner' | 'customer';
  password?: string;
  phone?: string;
  email?: string;
  city?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  profilePic?: string;
  pin?: string;
  updatedAt?: number;
}

// Helper function to safely parse JSON responses
async function parseJsonSafely(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Invalid response format (expected application/json, got ${contentType || 'text'})`);
  }
  return res.json();
}

// Fetch all registered users from persistent server DB
export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    const users = await parseJsonSafely(res);
    return Array.isArray(users) ? users : [];
  } catch (e) {
    console.warn('Unable to fetch users from server DB:', e);
    return [];
  }
}

// Fetch specific user profile from server DB
export async function fetchUserProfile(username: string): Promise<UserProfile | null> {
  if (!username) return null;
  try {
    const res = await fetch(`/api/users/profile?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await parseJsonSafely(res);
    return data.user || null;
  } catch (e) {
    console.warn('Unable to fetch user profile from server DB:', e);
    return null;
  }
}

// Authenticate against server DB
export async function loginApi(payload: any): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }
    return data;
  } catch (e: any) {
    console.warn('Server login error:', e);
    return { success: false, error: 'Network error connecting to production server.' };
  }
}

// Register new user into server DB
export async function registerApi(payload: any): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }
    return data;
  } catch (e: any) {
    console.warn('Server registration error:', e);
    return { success: false, error: 'Network error connecting to production server.' };
  }
}

// Update profile in server DB
export async function updateUserProfileApi(profileData: Partial<UserProfile> & { oldUsername?: string }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update profile' };
    }
    return data;
  } catch (e: any) {
    console.warn('Server profile update error:', e);
    return { success: false, error: 'Network error connecting to production server.' };
  }
}

// Reset password in server DB
export async function resetPasswordApi(payload: any): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to reset password' };
    }
    return data;
  } catch (e: any) {
    console.warn('Server password reset error:', e);
    return { success: false, error: 'Network error connecting to production server.' };
  }
}

// Fetch all work entries from server DB
export async function fetchEntriesApi(): Promise<any[]> {
  try {
    const res = await fetch('/api/entries');
    if (!res.ok) throw new Error('Failed to fetch entries');
    const data = await parseJsonSafely(res);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (e) {
    console.warn('Unable to fetch entries from server DB:', e);
    return [];
  }
}

// Save work entries to server DB
export async function saveEntriesApi(entries: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Error saving entries to server DB:', e);
    return false;
  }
}

// Fetch all customer bookings from server DB
export async function fetchBookingsApi(): Promise<any[]> {
  try {
    const res = await fetch('/api/bookings');
    if (!res.ok) throw new Error('Failed to fetch bookings');
    const data = await parseJsonSafely(res);
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch (e) {
    console.warn('Unable to fetch bookings from server DB:', e);
    return [];
  }
}

// Save customer bookings to server DB
export async function saveBookingsApi(bookings: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookings }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Error saving bookings to server DB:', e);
    return false;
  }
}

// Fetch fleet machines & custom drivers from server DB
export async function fetchFleetApi(): Promise<{ fleetMachines: any[]; customDrivers: any[] }> {
  try {
    const res = await fetch('/api/fleet');
    if (!res.ok) throw new Error('Failed to fetch fleet');
    const data = await parseJsonSafely(res);
    return {
      fleetMachines: Array.isArray(data.fleetMachines) ? data.fleetMachines : [],
      customDrivers: Array.isArray(data.customDrivers) ? data.customDrivers : []
    };
  } catch (e) {
    console.warn('Unable to fetch fleet from server DB:', e);
    return { fleetMachines: [], customDrivers: [] };
  }
}

// Save fleet machines & custom drivers to server DB
export async function saveFleetApi(fleetMachines: any[], customDrivers: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fleetMachines, customDrivers }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Error saving fleet to server DB:', e);
    return false;
  }
}

// Sessions API
export async function fetchSessionsApi(username: string): Promise<any[]> {
  if (!username) return [];
  try {
    const res = await fetch(`/api/sessions?username=${encodeURIComponent(username)}`);
    if (!res.ok) return [];
    const data = await parseJsonSafely(res);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

export async function touchSessionApi(username: string, session: any): Promise<any[]> {
  try {
    const res = await fetch('/api/sessions/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, session }),
    });
    if (!res.ok) return [];
    const data = await parseJsonSafely(res);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

export async function revokeSessionApi(username: string, sessionId: string): Promise<any[]> {
  try {
    const res = await fetch('/api/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionId }),
    });
    if (!res.ok) return [];
    const data = await parseJsonSafely(res);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

export async function revokeOtherSessionsApi(username: string, currentDeviceId: string): Promise<any[]> {
  try {
    const res = await fetch('/api/sessions/revoke-others', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, currentDeviceId }),
    });
    if (!res.ok) return [];
    const data = await parseJsonSafely(res);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

export async function globalLogoutApi(username: string): Promise<{ success: boolean; message?: string }> {
  if (!username) return { success: false };
  try {
    const res = await fetch('/api/sessions/global-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) return { success: false };
    const data = await parseJsonSafely(res);
    return data;
  } catch (e) {
    return { success: false };
  }
}

export async function validateSessionApi(username: string, sessionId?: string, deviceId?: string): Promise<{ valid: boolean; reason?: string }> {
  if (!username) return { valid: false, reason: 'No user specified' };
  try {
    const res = await fetch('/api/sessions/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionId, deviceId }),
    });
    if (!res.ok) return { valid: true };
    const data = await parseJsonSafely(res);
    return data;
  } catch (e) {
    return { valid: true };
  }
}

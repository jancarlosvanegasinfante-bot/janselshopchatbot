import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase environment credentials
let SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || "";
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || "";

// Clean up the URL if the user accidentally included /rest/v1/
if (SUPABASE_URL.endsWith('/rest/v1/')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1/', '');
} else if (SUPABASE_URL.endsWith('/rest/v1')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1', '');
}

// Initialize real Supabase client only if keys are present
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

console.log("[Supabase] Client initialized. Mode:", supabase ? "Cloud Production" : "Local Emulated (Auto-Fallback)");

// -------------------------------------------------------------
// 🔐 AUTH LAYER: SUPABASE AUTH & EMULATED LOCAL BACKEND
// -------------------------------------------------------------

export interface SupabaseUser {
  uid: string;
  email: string | null;
  phone?: string | null;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: Array<{ providerId: string; email: string | null }>;
}

// Global Auth State
let currentAuthUser: SupabaseUser | null = (() => {
  try {
    const cached = localStorage.getItem("jansel_supabase_user");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
})();

const authListeners = new Set<(user: SupabaseUser | null) => void>();

// Auth object simulating Firebase Auth
export const auth = {
  get currentUser() {
    return currentAuthUser;
  }
};

// Listeners helper
function notifyAuthListeners() {
  localStorage.setItem("jansel_supabase_user", currentAuthUser ? JSON.stringify(currentAuthUser) : "");
  authListeners.forEach(listener => listener(currentAuthUser));
}

// Supabase or Emulated Auth functions
export function onAuthStateChanged(authObj: any, callback: (user: SupabaseUser | null) => void) {
  authListeners.add(callback);
  
  // Trigger immediate initial call
  callback(currentAuthUser);

  // If Supabase is real, sync with real auth session changes
  let unsubscribeReal: (() => void) | null = null;
  if (supabase) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentAuthUser = {
          uid: session.user.id,
          email: session.user.email || null,
          phone: session.user.phone || session.user.user_metadata?.phone || null,
          displayName: session.user.user_metadata?.full_name || session.user.phone || session.user.user_metadata?.phone || session.user.email?.split("@")[0] || "Usuario Supabase",
          emailVerified: !!session.user.email_confirmed_at,
          isAnonymous: false,
          tenantId: null,
          providerData: [{ providerId: session.user.app_metadata?.provider || "phone", email: session.user.email || null }]
        };
      } else {
        currentAuthUser = null;
      }
      notifyAuthListeners();
    });
    unsubscribeReal = () => subscription.unsubscribe();
  }

  return () => {
    authListeners.delete(callback);
    if (unsubscribeReal) unsubscribeReal();
  };
}

// Google Auth provider mock to maintain same imports as Firebase
export class GoogleAuthProvider {
  static PROVIDER_ID = "google.com";
}

// Sign in with Popup / Google Login
export async function signInWithPopup(authObj: any, provider: any): Promise<any> {
  console.log("[Supabase Auth] Attempting Google Sign-In...");
  
  if (supabase) {
    // Real Supabase OAuth flow
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return { user: currentAuthUser };
  } else {
    // Emulated Success - login using Jansel Shop Admin user
    await new Promise(r => setTimeout(r, 800));
    currentAuthUser = {
      uid: "usr_emulated_jansel_admin",
      email: "janselshop@gmail.com",
      displayName: "Jansel Admin (Local)",
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [{ providerId: "google.com", email: "janselshop@gmail.com" }]
    };
    notifyAuthListeners();
    return { user: currentAuthUser };
  }
}

// Sign in with Email and Password
export async function signInWithPhoneOtp(phone: string): Promise<any> {
  console.log(`[Supabase Auth] Sign in with phone OTP: ${phone}`);
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    if (error) throw error;
    return data;
  } else {
    // Emulate sending OTP
    await new Promise(r => setTimeout(r, 600));
    console.log(`[Emulated Auth] Sent OTP to ${phone}`);
    return { message: "OTP sent" };
  }
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<any> {
  console.log(`[Supabase Auth] Verify OTP for: ${phone}`);
  if (supabase) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    if (error) throw error;
    if (data.user) {
      currentAuthUser = {
        uid: data.user.id,
        email: data.user.email || null,
        phone: data.user.phone || phone,
        displayName: data.user.user_metadata?.full_name || data.user.phone || phone || "Usuario SMS",
        emailVerified: !!data.user.email_confirmed_at,
        isAnonymous: false,
        tenantId: null,
        providerData: [{ providerId: "phone", email: data.user.email || null }]
      };
      notifyAuthListeners();
    }
    return data;
  } else {
    // Emulate verify
    await new Promise(r => setTimeout(r, 600));
    if (token !== "123456" && token !== "000000") {
      throw new Error("Código incorrecto (Usa 123456 en entorno de pruebas).");
    }
    
    currentAuthUser = {
      uid: "usr_emulated_jansel_admin",
      email: "jancarlosvanegasinfante@gmail.com",
      phone: phone,
      displayName: phone,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [{ providerId: "phone", email: "jancarlosvanegasinfante@gmail.com" }]
    };
    notifyAuthListeners();
    return { user: currentAuthUser };
  }
}

export async function loginWithPhoneOrName(identifier: string, password: string): Promise<any> {
  console.log(`[Auth] Manual login for: ${identifier}`);
  
  if (password.length < 3) {
    throw new Error("La contraseña debe tener al menos 3 caracteres.");
  }
  
  await new Promise(r => setTimeout(r, 600)); // fake delay
  
  currentAuthUser = {
    uid: "usr_emulated_jansel_admin",
    email: "jancarlosvanegasinfante@gmail.com",
    displayName: identifier,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [{ providerId: "local", email: "jancarlosvanegasinfante@gmail.com" }]
  };
  
  notifyAuthListeners();
  return { user: currentAuthUser };
}

// Sign up with Email and Password
export async function signUpWithEmailAndPassword(email: string, password: string): Promise<any> {
  console.log(`[Supabase Auth] Sign up with email: ${email}`);
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: email.split("@")[0]
        }
      }
    });
    if (error) throw error;
    return data;
  } else {
    // Emulate Sign Up
    await new Promise(r => setTimeout(r, 600));
    if (password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }
    currentAuthUser = {
      uid: `usr_${btoa(email).replace(/[^a-zA-Z0-9]/g, "").substring(0, 15)}`,
      email,
      displayName: email.split("@")[0],
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [{ providerId: "email", email }]
    };
    notifyAuthListeners();
    return { user: currentAuthUser };
  }
}

// Sign Out
export async function signOut(authObj: any): Promise<void> {
  console.log("[Supabase Auth] Logging out...");
  if (supabase) {
    await supabase.auth.signOut();
  }
  currentAuthUser = null;
  notifyAuthListeners();
}


// -------------------------------------------------------------
// 🗄️ DATABASE LAYER: FIRESTORE-COMPATIBLE WRAPPER
// -------------------------------------------------------------

// Firestore database representation
export const db = {
  type: "supabase-proxy"
};

// Storage reference placeholder
export const storage = {
  type: "supabase-storage"
};

// Helper mock to match exports
export function ref(storageObj: any, path: string) {
  return { storageObj, path };
}

// Emulated download URL or actual media cache URL
export async function getDownloadURL(refObj: any): Promise<string> {
  // Extract id from path 'products/docId'
  const parts = refObj.path.split("/");
  const id = parts[parts.length - 1];
  return `/api/media/${id}.jpg`;
}

// Upload file bytes to the server
export async function uploadBytes(refObj: any, file: File | Blob): Promise<any> {
  const parts = refObj.path.split("/");
  const id = parts[parts.length - 1];
  
  // Convert to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(",")[1];
      try {
        const response = await fetch("/api/admin/cache-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            mimeType: file.type || "image/jpeg",
            data: base64data
          })
        });
        const resJson = await response.json();
        resolve({ ref: { path: refObj.path, name: id }, ...resJson });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
  });
}

// Query structure helpers to emulate firestore API
export class QueryConstraint {
  constructor(public type: string, public field: string, public op: string, public value: any) {}
}

export function collection(dbObj: any, collectionName: string) {
  return { type: "collection", name: collectionName };
}

export function doc(dbObj: any, collectionName: string, docId?: string) {
  return { type: "doc", collection: collectionName, id: docId || Math.random().toString(36).substring(2, 11) };
}

export function where(field: string, op: string, value: any) {
  return new QueryConstraint("where", field, op, value);
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc") {
  return new QueryConstraint("orderBy", field, direction, null);
}

export function limit(value: number) {
  return new QueryConstraint("limit", "", "", value);
}

export function query(collectionRef: any, ...constraints: QueryConstraint[]) {
  return {
    type: "query",
    collection: collectionRef.name,
    constraints
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// Fetch single document
export async function getDoc(docRef: any): Promise<any> {
  const url = `/api/db/getDoc?collection=${docRef.collection}&id=${docRef.id}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch doc: ${response.statusText}`);
  }
  const result = await response.json();
  return {
    id: docRef.id,
    exists: () => result.exists,
    data: () => result.data,
    ref: docRef
  };
}

// Fetch multiple documents
export async function getDocs(queryObj: any): Promise<any> {
  const isQuery = queryObj.type === "query";
  const collectionName = isQuery ? queryObj.collection : queryObj.name;
  const constraints = isQuery ? queryObj.constraints : [];

  const response = await fetch("/api/db/getDocs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection: collectionName, constraints })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch docs: ${response.statusText}`);
  }

  const result = await response.json();
  const docs = (result.docs || []).map((docData: any) => ({
    id: docData.id,
    exists: () => true,
    data: () => docData.data,
    ref: { type: "doc", collection: collectionName, id: docData.id }
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback)
  };
}

// Save or merge single document
export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }): Promise<void> {
  const response = await fetch("/api/db/setDoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collection: docRef.collection,
      id: docRef.id,
      data,
      merge: options?.merge !== false
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to set doc: ${response.statusText}`);
  }
}

// Update existing document fields
export async function updateDoc(docRef: any, data: any): Promise<void> {
  const response = await fetch("/api/db/updateDoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collection: docRef.collection || docRef.ref?.collection,
      id: docRef.id || docRef.ref?.id,
      data
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to update doc: ${response.statusText}`);
  }
}

// Create new document with random ID
export async function addDoc(collectionRef: any, data: any): Promise<any> {
  const id = Math.random().toString(36).substring(2, 15);
  const docRef = { type: "doc", collection: collectionRef.name, id };
  await setDoc(docRef, data);
  return {
    id,
    ref: docRef
  };
}

// Delete document
export async function deleteDoc(docRef: any): Promise<void> {
  const response = await fetch("/api/db/deleteDoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collection: docRef.collection,
      id: docRef.id
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to delete doc: ${response.statusText}`);
  }
}

// Batch writes helper
export function writeBatch(dbObj?: any) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

// Real-time updates subscription using beautiful short polling
export function onSnapshot(queryObj: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  let isStopped = false;
  
  const fetchAndUpdate = async () => {
    if (isStopped) return;
    try {
      let snapshot;
      if (queryObj.type === "doc") {
        snapshot = await getDoc(queryObj);
      } else {
        snapshot = await getDocs(queryObj);
      }
      if (!isStopped) {
        onNext(snapshot);
      }
    } catch (err) {
      console.warn("[onSnapshot Polling Error]:", err);
      if (onError && !isStopped) onError(err);
    }
  };

  // Immediate fetch
  fetchAndUpdate();

  // Poll every 3.5 seconds to keep the UI perfectly synchronized without iframe websocket issues
  const intervalId = setInterval(fetchAndUpdate, 3500);

  return () => {
    isStopped = true;
    clearInterval(intervalId);
  };
}

// Handle errors gracefully without crashing
export function handleFirestoreError(error: unknown, operationType: string, path: string | null) {
  console.error(`[Supabase Proxy Error] Operation: ${operationType}, Path: ${path}`, error);
}

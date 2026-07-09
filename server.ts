import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import { readFileSync, existsSync } from "fs";
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import sgMail from '@sendgrid/mail';
import { getSystemInstruction } from "./src/lib/janAgent.js";
import { writeFileSync } from "fs";

// 1. Initialize Supabase / Local JSON File Storage
const cwd = process.cwd();

let SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (SUPABASE_URL.endsWith('/rest/v1/')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1/', '');
} else if (SUPABASE_URL.endsWith('/rest/v1')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1', '');
}

const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
export const supabaseServer = (SUPABASE_URL && supabaseKey)
  ? createClient(SUPABASE_URL, supabaseKey)
  : null;

console.log(`[Supabase Server] Mode: ${supabaseServer ? "Cloud Connected" : "Local Emulated (Auto-Fallback)"}`);

// Local JSON File Database Path
const LOCAL_DB_PATH = path.join(cwd, "local_db.json");
let localDbCache: Record<string, Record<string, any>> = {};

// Load local database cache
function loadLocalDb() {
  try {
    if (existsSync(LOCAL_DB_PATH)) {
      localDbCache = JSON.parse(readFileSync(LOCAL_DB_PATH, "utf8"));
    } else {
      localDbCache = {};
    }
  } catch (err) {
    console.error("[Local DB] Error loading database:", err);
    localDbCache = {};
  }
}

// Save local database cache
function saveLocalDb() {
  try {
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDbCache, null, 2), "utf8");
  } catch (err) {
    console.error("[Local DB] Error saving database:", err);
  }
}

// Initial load on boot
loadLocalDb();

// -------------------------------------------------------------
// 🗄️ SUPABASE-COMPATIBLE API ADAPTER FOR BACKEND
// -------------------------------------------------------------

export const db = { type: "supabase-proxy" };

export function doc(dbObj: any, collectionName: string, id: string) {
  return { type: "doc", collection: collectionName, id };
}

export function collection(dbObj: any, collectionName: string) {
  return { type: "collection", name: collectionName };
}

export function where(field: string, op: string, value: any) {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, direction: string = "asc") {
  return { type: "orderBy", field, op: direction, value: null };
}

export function limit(value: number) {
  return { type: "limit", field: "", op: "", value };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return {
    type: "query",
    collection: collectionRef.name,
    constraints
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// Low-level helper: read doc
export async function dbGetDoc(collectionName: string, id: string): Promise<{ exists: boolean; data: any }> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from(collectionName)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (!error && data) {
        return { exists: true, data: data.data || data };
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Read failed for table ${collectionName}: ${err.message}. Using local.`);
    }
  }

  const col = localDbCache[collectionName] || {};
  const docData = col[id];
  if (docData) {
    return { exists: true, data: docData };
  }
  return { exists: false, data: null };
}

// Low-level helper: write doc
export async function dbSetDoc(collectionName: string, id: string, data: any, merge: boolean = true): Promise<void> {
  if (!localDbCache[collectionName]) {
    localDbCache[collectionName] = {};
  }

  if (merge) {
    localDbCache[collectionName][id] = {
      ...(localDbCache[collectionName][id] || {}),
      ...data,
      updatedAt: new Date().toISOString()
    };
  } else {
    localDbCache[collectionName][id] = {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };
  }
  saveLocalDb();

  if (supabaseServer) {
    try {
      const docPayload = localDbCache[collectionName][id];
      const { error } = await supabaseServer
        .from(collectionName)
        .upsert({
          id,
          data: docPayload,
          updatedAt: new Date().toISOString()
        });
      
      if (error) {
        // Fallback: try upserting flat properties directly
        await supabaseServer
          .from(collectionName)
          .upsert({ id, ...docPayload });
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Upsert failed for table ${collectionName}: ${err.message}`);
    }
  }
}

// Low-level helper: delete doc
export async function dbDeleteDoc(collectionName: string, id: string): Promise<void> {
  if (localDbCache[collectionName]) {
    delete localDbCache[collectionName][id];
    saveLocalDb();
  }

  if (supabaseServer) {
    try {
      await supabaseServer
        .from(collectionName)
        .delete()
        .eq("id", id);
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Delete failed for table ${collectionName}: ${err.message}`);
    }
  }
}

// Low-level helper: read collection
export async function dbGetDocs(collectionName: string, constraints: any[] = []): Promise<any[]> {
  let list: any[] = [];

  const col = localDbCache[collectionName] || {};
  list = Object.entries(col).map(([id, data]) => ({ id, data }));

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer.from(collectionName).select("*");
      if (!error && data && data.length > 0) {
        list = data.map((item: any) => ({
          id: item.id,
          data: item.data || item
        }));
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Query failed for table ${collectionName}: ${err.message}. Using local.`);
    }
  }

  // Filter in-memory (matches Supabase proxy logic perfectly)
  for (const c of constraints) {
    if (c.type === "where") {
      const { field, op, value } = c;
      list = list.filter(item => {
        const val = item.data?.[field];
        if (op === "==") return val === value;
        if (op === "!=") return val !== value;
        if (op === ">") return val > value;
        if (op === "<") return val < value;
        if (op === ">=") return val >= value;
        if (op === "<=") return val <= value;
        if (op === "array-contains") return Array.isArray(val) && val.includes(value);
        return true;
      });
    }
  }

  // Order in-memory
  for (const c of constraints) {
    if (c.type === "orderBy") {
      const { field, op: direction } = c;
      list.sort((a, b) => {
        const valA = a.data?.[field];
        const valB = b.data?.[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return direction === "desc" ? 1 : -1;
        if (valA > valB) return direction === "desc" ? -1 : 1;
        return 0;
      });
    }
  }

  // Limit in-memory
  for (const c of constraints) {
    if (c.type === "limit") {
      list = list.slice(0, c.value);
    }
  }

  return list;
}

// Supabase compatible functions for server.ts
export async function getDoc(docRef: any) {
  const result = await dbGetDoc(docRef.collection, docRef.id);
  return {
    id: docRef.id,
    exists: () => result.exists,
    data: () => result.data,
    ref: docRef
  };
}

export async function getDocs(queryObj: any) {
  const isQuery = queryObj.type === "query";
  const collectionName = isQuery ? queryObj.collection : queryObj.name;
  const constraints = isQuery ? queryObj.constraints : [];

  const docsData = await dbGetDocs(collectionName, constraints);
  const docs = docsData.map(item => ({
    id: item.id,
    exists: () => true,
    data: () => item.data,
    ref: { type: "doc", collection: collectionName, id: item.id }
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback)
  };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  await dbSetDoc(docRef.collection, docRef.id, data, options?.merge !== false);
}

export async function addDoc(collectionRef: any, data: any) {
  const id = Math.random().toString(36).substring(2, 15);
  await dbSetDoc(collectionRef.name, id, data, false);
  return {
    id,
    ref: { type: "doc", collection: collectionRef.name, id }
  };
}

export async function updateDoc(docRef: any, data: any) {
  const collName = docRef.collection || docRef.ref?.collection;
  const docId = docRef.id || docRef.ref?.id;
  await dbSetDoc(collName, docId, data, true);
}

// Batch write helper
export function writeBatch(dbObj?: any) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      ops.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      ops.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      ops.push(() => dbDeleteDoc(docRef.collection, docRef.id));
    },
    commit: async () => {
      for (const op of ops) {
        await op();
      }
    }
  };
}

// Robust Environment Variable Detection (Railway & Google Cloud compat)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || process.env.SID_DE_CUENTA_TWILIO;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || process.env.TOKEN_DE_AUTORIZACION_DE_TWILIO;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_DESDE_NÚMERO || process.env.TWILIO_NUMBER;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// ==============================================
// 🚦 GLOBAL QUOTA BREAKER (ANTI-SPAM / QUOTA LOOP)
// ==============================================
let globalQuotaExceeded = false;
let quotaExceededTime = 0;
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 Hora

function checkGlobalQuota(): boolean {
  if (globalQuotaExceeded) {
    if (Date.now() - quotaExceededTime > QUOTA_COOLDOWN_MS) {
      globalQuotaExceeded = false;
      console.log("[QUOTA BREAKER] Cooldown finished. Resuming writes.");
      return false;
    }
    return true; // Still locked
  }
  return false;
}

function handleSupabaseError(e: any): never {
  throw e;
}


if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// Global State
const mediaCache = new Map<string, { data: Buffer, mimeType: string }>();
const userRateLimitCache = new Map<string, { lastTime: number, msgCount: number }>();
let currentAppUrl = process.env.APP_URL || "";

function detectCurrentUrl(req: express.Request) {
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const proto = req.headers["x-forwarded-proto"] || "https";
  if (host && !host.includes("localhost")) {
    const newUrl = `${proto}://${host}`;
    if (currentAppUrl !== newUrl) {
      currentAppUrl = newUrl;
      console.log(`[Twilio] Updated APP_URL: ${currentAppUrl}`);
    }
  }
}

interface StoreConfig {
  id: string;
  name: string;
  phone: string;
  catalogId?: string;
  paisaStyle: boolean;
  recoveryEnabled: boolean;
  dropiApiKey?: string;
  emailEnabled?: boolean;
}

/**
 * Fetches store configuration by phone number (SaaS logic)
 */
async function getStoreByPhone(phone: string): Promise<StoreConfig> {
  const q = query(collection(db, "stores"), where("phone", "==", phone), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...data } as StoreConfig;
  }
  
  // Default store for legacy support
  return {
    id: "default",
    name: "Jan Vanegas Sales",
    phone: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    paisaStyle: true,
    recoveryEnabled: true
  };
}

/**
 * Determines the associated store based on a WhatsApp/Meta message
 */
async function determineStoreId(cleanPhone: string, message: string, toBotPhone?: string): Promise<string> {
  let assignedStoreId: string | null = null;
  
  // 1. Check for predefined trigger message (e.g. "Hola, vengo de la tienda XYZ ref: #odontologia-feliz")
  const refMatch = message?.match(/ref:\s*#([a-zA-Z0-9_\-]+)/i);
  
  if (refMatch && refMatch[1]) {
    const storeSlug = refMatch[1].toLowerCase();
    const qStore = query(collection(db, "stores"), where("slug", "==", storeSlug), limit(1));
    const snapStore = await getDocs(qStore);
    if (!snapStore.empty) {
      assignedStoreId = snapStore.docs[0].id;
    }
  }

  // 2. Fallback: Search for store names mentioned in "vengo de la tienda [Name]"
  if (!assignedStoreId && message) {
    const storeNameMatch = message.match(/vengo de (?:la tienda\s*)?([^*|\n|\r]+)/i);
    if (storeNameMatch && storeNameMatch[1]) {
      const potentialName = storeNameMatch[1].trim();
      const qStoreName = query(collection(db, "stores"), where("name", "==", potentialName), limit(1));
      const snapStoreName = await getDocs(qStoreName);
      if (!snapStoreName.empty) {
        assignedStoreId = snapStoreName.docs[0].id;
      }
    }
  }

  // 3. Fallback: Lookup existing session by phone
  if (!assignedStoreId) {
    const convoSnap = await getDoc(doc(db, "conversations", cleanPhone));
    if (convoSnap.exists() && convoSnap.data().storeId) {
      assignedStoreId = convoSnap.data().storeId;
    }
  }

  // 4. Ultimate Fallback: Legacy phone mapping or "default"
  if (!assignedStoreId && toBotPhone) {
    const legacyStore = await getStoreByPhone(toBotPhone);
    assignedStoreId = legacyStore.id || "default";
  } else if (!assignedStoreId) {
    assignedStoreId = "default";
  }
  
  // Update session if we found a store
  if (assignedStoreId !== "default") {
    await setDoc(doc(db, "conversations", cleanPhone), {
      phone: cleanPhone,
      storeId: assignedStoreId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  
  return assignedStoreId || "default";
}

/**
 * Fetches last messages for CRM memory
 */
async function getCrmContext(from: string, storeId: string): Promise<string> {
  const q = query(
    collection(db, "activities"),
    where("from", "==", from),
    where("storeId", "==", storeId),
    orderBy("timestamp", "desc"),
    limit(5)
  );
  const snap = await getDocs(q);

  if (snap.empty) return "No hay historial previo.";
  
  return [...snap.docs].reverse().map(d => {
    const data = d.data();
    return `${data.message} -> Jan: ${data.response || '(Procesando...)'}`;
  }).join("\n");
}

/**
 * Long-term memory: Fetches persistent customer data
 */
async function getCustomerProfile(phone: string): Promise<any> {
  const cleanPhone = phone.replace('whatsapp:', '');
  const snap = await getDoc(doc(db, "customers", cleanPhone));
  return snap.exists() ? snap.data() : null;
}

/**
 * Saves customer data
 */
async function saveCustomerProfile(phone: string, data: any): Promise<void> {
  const cleanPhone = phone.replace('whatsapp:', '');
  await setDoc(doc(db, "customers", cleanPhone), data, { merge: true });
}

function calcularScore(analisisIA: any, datosAdicionales: any): number {
  let score = 0;
  if (typeof analisisIA.probabilidad_compra === 'number') {
    score += analisisIA.probabilidad_compra;
  }
  if (datosAdicionales.dio_direccion) score += 40;
  if (datosAdicionales.pregunto_precio) score += 10;
  if (datosAdicionales.pidio_envio) score += 30;
  return Math.min(score, 100);
}

async function definirEtapa(score: number): Promise<string> {
  if (score > 80) return "negociando";
  if (score > 50) return "interesado";
  return "nuevo";
}

async function cancelPendingFollowUps(phone: string, storeId: string = "default") {
  const cleanPhone = phone.replace('whatsapp:', '');
  const q = query(
    collection(db, "followups"),
    where("phone", "==", cleanPhone),
    where("storeId", "==", storeId),
    where("status", "==", "pending")
  );
  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { status: "cancelled", updatedAt: serverTimestamp() }));
      await batch.commit();
      console.log(`[Follow-up] Cancelled ${snap.size} pending follow-ups for ${cleanPhone}`);
    }
  } catch (e) {
    console.warn("[Follow-up] Error cancelling:", e);
  }
}

async function scheduleFollowUp(phone: string, score: number, reason: string, storeId: string = "default") {
  const cleanPhone = phone.replace('whatsapp:', '');
  
  // Rule: Only one pending follow-up at a time
  await cancelPendingFollowUps(phone, storeId);

  let delayMs = 40 * 60 * 1000; // 40 mins
  if (score > 80) delayMs = 10 * 60 * 1000; // AGRESIVO: 10 mins
  else if (score > 50) delayMs = 20 * 60 * 1000; // AGRESIVO: 20 mins

  const scheduledAt = new Date(Date.now() + delayMs);
  
  try {
    await addDoc(collection(db, "followups"), {
      phone: cleanPhone,
      storeId: storeId,
      scheduledAt: scheduledAt.toISOString(),
      status: "pending",
      initialScore: score,
      reason,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`[Follow-up] Scheduled for ${cleanPhone} in ${delayMs / 60000} mins (Score: ${score})`);
  } catch (e) {
    console.error("[Follow-up] Error scheduling:", e);
  }
}

/**
 * Downloads media from Twilio for AI analysis (image vision / audio)
 */
async function downloadMediaAsBase64(url: string): Promise<{ data: string, mimeType: string } | null> {
  console.log(`[Media Download] Fetching: ${url}`);
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.SID_DE_CUENTA_TWILIO || process.env.TWILIO_ACCOUNT_SID || "",
        password: process.env.TOKEN_DE_AUTORIZACION_DE_TWILIO || process.env.TWILIO_AUTH_TOKEN || ""
      }
    });
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    
    // Support images and audio
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('audio/')) {
       console.log(`[Media Download] Skipping unsupported type: ${mimeType}`);
       return null;
    }
    
    // Twilio audio often comes as audio/ogg; codecs=opus, we need the base mime type
    const cleanMimeType = mimeType.split(';')[0].trim();
    
    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    return { data: base64Data, mimeType: cleanMimeType };
  } catch (err: any) {
    console.warn(`[Media Download][Error] From ${url}:`, err.message);
    return null;
  }
}

/**
 * Anti-spam: Prevents loops and saturated inbox
 */
function canReply(userId: string): boolean {
  const now = Date.now();
  const record = userRateLimitCache.get(userId) || { lastTime: 0, msgCount: 0 };
  
  // If last message was more than 10 minutes ago, reset count
  if (now - record.lastTime > 10 * 60 * 1000) {
    record.msgCount = 0;
  }
  
  if (now - record.lastTime < 3000) {
    record.lastTime = now;
    userRateLimitCache.set(userId, record);
    return false; // 3 seconds cooldown
  }
  
  record.msgCount++;
  record.lastTime = now;
  userRateLimitCache.set(userId, record);
  
  // Hard limit: 30 messages per 10 minutes (prevents bot loops)
  if (record.msgCount > 30) {
    console.warn(`[ANTI-BOT] Bloqueado ${userId} por más de 30 mensajes en 10 mins.`);
    return false;
  }

  return true;
}

/**
 * Seeding Function: Populates the products collection using Admin SDK to bypass rules
 */
async function seedDatabase(force = false, customCatalog?: any, storeId: string = "default") {
  const productsColl = collection(db, "products");
  
  if (!force) {
    const qCount = query(productsColl, where("storeId", "==", storeId), limit(1));
    const snapshot = await getDocs(qCount);
    if (!snapshot.empty) return;
  }

  console.log(`[DB] Iniciando reseteo de catálogo para store: ${storeId}...`);

  let catalogData: any = customCatalog;
  
  if (!catalogData) {
    const catalogPath = path.join(cwd, "src", "catalog.json");
    if (existsSync(catalogPath)) {
      try {
        const raw = readFileSync(catalogPath, "utf-8");
        catalogData = JSON.parse(raw);
        console.log(`[DB] Catalog loaded from file system: ${catalogData?.products?.length || 0} products.`);
      } catch (e) {
        console.error("[DB] Error parsing catalog.json:", e);
      }
    } else {
      console.error("[DB] catalog.json not found at:", catalogPath);
    }
  }

  if (!catalogData || !catalogData.products || !Array.isArray(catalogData.products)) {
    console.warn("[DB] No valid products found to seed. Aborting to prevent data loss.");
    return;
  }

  if (force) {
    try {
      const qDelete = query(productsColl, where("storeId", "==", storeId));
      const snap = await getDocs(qDelete);
      if (!snap.empty) {
        console.log(`[DB] Clearing ${snap.size} old products before re-seeding para ${storeId}...`);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.error("[DB] Error cleaning catalog:", e.message);
    }
  }

  try {
    console.log(`[DB] Inserting ${catalogData.products.length} products para ${storeId}...`);
    const batch = writeBatch(db);
    for (const product of catalogData.products) {
      // Must generate unique id combining storeId and product id to avoid overwriting other stores
      const finalDocId = `${storeId}_${product.id}`;
      const docRef = doc(db, "products", finalDocId);
      batch.set(docRef, {
        ...product,
        storeId,
        stock: product.stock !== undefined ? product.stock : 20,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
    console.log("[DB] Catálogo sembrado con éxito.");
  } catch (e: any) {
    console.error("[DB] Error inserting catalog:", e.message);
    if (force && customCatalog) throw e; 
  }

  // Seed default store
  await setDoc(doc(db, "stores", "jan-vanegas-hq"), {
    name: "Jan Vanegas - Sales Architecture",
    phone: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    paisaStyle: true,
    recoveryEnabled: true,
    dropiApiKey: "DROPI_MOCK_KEY_12345",
    emailEnabled: true,
    createdAt: serverTimestamp()
  }, { merge: true });
  
  console.log("[DB] Store seeded.");
}

/**
 * Tool & schema definitions (reference, ver src/lib/janAgent.ts)
 */
// Tools are imported from janAgent.ts

async function processInferenceOnServer(activityId: string, data: any) {
  try {
    await updateDoc(doc(db, "activities", activityId), { 
      status: "procesando",
      processingAt: serverTimestamp()
    });
    
    const assignedStoreId = data.storeId || "default";

    const fromPhone = data.from.replace("whatsapp:", "").trim();
    let convoSnap = await getDoc(doc(db, "conversations", fromPhone));
    
    // Check without the + if it started with +
    if (!convoSnap.exists() && fromPhone.startsWith('+')) {
       convoSnap = await getDoc(doc(db, "conversations", fromPhone.substring(1)));
    }
    // Check with the + if it didn't start with +
    if (!convoSnap.exists() && !fromPhone.startsWith('+') && !isNaN(Number(fromPhone))) {
       convoSnap = await getDoc(doc(db, "conversations", `+${fromPhone}`));
    }

    if (convoSnap.exists() && convoSnap.data().aiPaused) {
      console.log(`[Server AI] El bot está pausado para ${fromPhone}. Actuando solo como inbox.`);
      await updateDoc(doc(db, "activities", activityId), { 
        status: "respondido",
        response: "",
        senderType: "customer",
        customerPhone: fromPhone,
        processingAt: serverTimestamp(),
        errorAt: serverTimestamp() // just to clear it from pending
      });
      return;
    }

    // Lookup Store Config
    let storeConfig: any = {};
    const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
    if (storeSnap.exists()) {
      storeConfig = storeSnap.data();
    }

    // Al menos una clave de IA (NVIDIA u OpenRouter) debe existir, ya sea global (env) o por tienda
    const hasNvidiaKey = !!(NVIDIA_API_KEY || storeConfig.nvidiaApiKey);
    const hasOpenrouterKey = !!(OPENROUTER_API_KEY || storeConfig.openrouterApiKey);
    if (!hasNvidiaKey && !hasOpenrouterKey) {
      console.error("[Server AI] Faltan claves de IA (NVIDIA_API_KEY / OPENROUTER_API_KEY) en el servidor.");
      await updateDoc(doc(db, "activities", activityId), { status: "error", response: "Error: No hay clave de IA (NVIDIA/OpenRouter) configurada en Railway." });
      return;
    }

    // SAFETY: Truncate message if it's too long to prevent crashes
    let safeMessage = data.message || "";
    if (safeMessage.length > 10000) {
      console.warn(`[Server AI] Mensaje recibido de ${fromPhone} es demasiado largo (${safeMessage.length} chars). Recortando...`);
      safeMessage = safeMessage.substring(0, 10000) + "\n...[CONTENIDO RECORTADO POR EXCESO DE TAMAÑO]";
    }

    // Unique customer profile per store to prevent mixing CRM states
    const customerProfileId = `${assignedStoreId}_${fromPhone}`;
    const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
    const customerProfile = cxSnap.exists() ? cxSnap.data() : null;

    const history = await getCrmContext(data.from, assignedStoreId);
    
    // Get products specific to this store, or fallback to default
    let products: any[] = await loadProductsForStore(assignedStoreId);

    // Separar imágenes (sí soportadas por los modelos de visión de NVIDIA/OpenRouter)
    // de audio (NINGÚN modelo de la cascada actual puede transcribir audio de forma nativa
    // sin Gemini; antes se le pasaba el audio como si fuera comprendido y el LLM alucinaba
    // una respuesta genérica. Ahora avisamos honestamente al cliente).
    const imageParts: { data: string; mimeType: string }[] = [];
    let hasAudio = false;
    if (data.mediaItems && Array.isArray(data.mediaItems)) {
      for (const item of data.mediaItems) {
        if (item.mimeType && item.mimeType.startsWith("audio/")) {
          hasAudio = true;
        } else if (item.mimeType && item.mimeType.startsWith("image/")) {
          imageParts.push({ data: item.data, mimeType: item.mimeType });
        }
      }
    }

    // Atajo rápido: si el cliente SOLO mandó audio (sin texto ni imagen), respondemos
    // de una sin gastar tiempo/costos en la cascada de IA, ya que no podemos transcribirlo.
    if (hasAudio && imageParts.length === 0 && (!safeMessage || !safeMessage.trim())) {
      const audioFallbackMsg = "¡Hola! Qué pena, por ahora no puedo escuchar audios 🙉. ¿Me lo escribís por acá porfa? ¡Quedo pendiente!";
      if (data.from.startsWith("whatsapp:")) {
        await sendWhatsApp(data.from, audioFallbackMsg, undefined, activityId, data.to);
      } else if (data.platform === "instagram" || data.platform === "messenger") {
        await sendMetaMessage(data.from, audioFallbackMsg, data.platform, data.to);
      }
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: audioFallbackMsg,
        respondedAt: serverTimestamp()
      });
      return;
    }

    // Hybrid Smart Context Filter: Select only Top 15 featured products and those matching user keywords
    // to prevent prompt truncation issues and speed up inference significantly!
    let filteredProductsForPrompt: any[] = [];
    
    const topKeywords = [
      "modem", "retrovisor", "intercomunicador", "soporte de carga", "funda", 
      "destornillador", "frontal", "linterna", "camping", "ever brite", 
      "candado", "compresor", "hidrolavadora", "aspiradora", "cargador"
    ];
    
    const topProducts = products.filter(p => {
      const nameLower = (p.name || "").toLowerCase();
      return topKeywords.some(keyword => nameLower.includes(keyword));
    }).slice(0, 15);
    
    if (topProducts.length < 15) {
      const remaining = products.filter(p => !topProducts.some(tp => tp.id === p.id));
      topProducts.push(...remaining.slice(0, 15 - topProducts.length));
    }
    
    const msgWords = safeMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedProducts = products.filter(p => {
      const nameLower = (p.name || "").toLowerCase();
      return msgWords.some(word => nameLower.includes(word));
    }).slice(0, 10);
    
    const combinedSet = new Map<string, any>();
    topProducts.forEach(p => combinedSet.set(p.id, p));
    matchedProducts.forEach(p => combinedSet.set(p.id, p));
    
    filteredProductsForPrompt = Array.from(combinedSet.values());
    
    const compactProductsString = filteredProductsForPrompt.map(p => {
      const desc = p.description ? (p.description.length > 80 ? p.description.substring(0, 80) + "..." : p.description) : "";
      return `- ${p.name} ($${p.price}) [id: ${p.id}]${p.category ? ` [Cat: ${p.category}]` : ""}${desc ? ` - ${desc}` : ""}`;
    }).join("\n");

    const promptText = `ESTÁS ATENDIENDO EN LA TIENDA: ${storeConfig.name || "Jan Sel Shop"} (Slug: ${assignedStoreId})
CLIENTE: ${fromPhone}
NOMBRE: ${customerProfile?.name || "Desconocido"}
ETAPA CRM: ${customerProfile?.etapa || "nuevo"} (Probabilidad de compra: ${customerProfile?.score || 0}%)
INTENCIÓN ANTERIOR: ${customerProfile?.intencion || "Ninguna"}
HISTORIAL:
${history}

MENSAJE ACTUAL: ${safeMessage}${imageParts.length > 0 ? " (El cliente también envió una imagen que adjunto para tu análisis)" : ""}

INVENTARIO ACTUAL (Vista curada de los más vendidos y productos relevantes para esta consulta. Tenemos más de 360 productos en total, si piden algo diferente pregúntale a tu jefe o usa "notificar_admin"):
${compactProductsString}

⚠️ REGLA DE SALIDA ULTRA-ESTRICTA (OBLIGATORIA):
DEBES RESPONDER EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO.
NO incluyas explicaciones antes o después del JSON. NO uses formato markdown fuera del JSON.
El JSON debe cumplir ESTRICTAMENTE con la siguiente estructura de campos (no inventes otras llaves):

{
  "accion": "respuesta" | "notificar_admin" | "confirmar_pedido",
  "mensaje": "Mensaje en español (estilo paisa si aplica, breve y persuasivo de máximo 1-2 párrafos cortos, con emojis abundantes)",
  "producto": "Nombre del producto interesado si aplica",
  "intencion": "intención detectada",
  "nivel_interes": "alto" | "medio" | "bajo",
  "objeciones": "objeciones o 'ninguna'",
  "urgencia": "nivel de urgencia",
  "probabilidad_compra": 0, // Número entero de 0 a 100
  "siguiente_mejor_accion": "próxima acción",
  "datos_pedido": {
    "nombre": "Nombre completo del cliente",
    "direccion": "Dirección exacta de entrega",
    "telefono": "Teléfono de contacto",
    "ciudad": "Ciudad de Colombia",
    "referencia": "Punto de referencia o descripción de la casa",
    "valor": 0, // Precio/valor acordado como número entero
    "notes": "Notas adicionales"
  },
  "imageUrl": "URL pública de imagen del producto si aplica"
}

Asegúrate de que la propiedad "mensaje" contenga tu respuesta real dirigida al cliente.`;

    let result: any = null;

    // Cascada de modelos NVIDIA NIM (free endpoints, confirmados por el catálogo real
    // de build.nvidia.com que compartiste) + OpenRouter como respaldo final.
    // Orden: primero los modelos livianos/rápidos (mejor para latencia en el caso normal),
    // y al final los "tanque" (más grandes/lentos pero más capaces) por si los de arriba fallan.
    // Un solo intento por modelo (no reintentos) para no acumular tiempos muertos.
    const visionModels: Array<{ name: string; label: string; provider: string }> = [
      { name: "meta/llama-3.2-11b-vision-instruct", provider: "nvidia", label: "NVIDIA Llama 3.2 11B Vision" },
      { name: "meta/llama-3.2-90b-vision-instruct", provider: "nvidia", label: "NVIDIA Llama 3.2 90B Vision" },
      { name: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1", provider: "nvidia", label: "NVIDIA Nemotron Nano VL 8B" },
      { name: "nvidia/nemotron-nano-12b-v2-vl", provider: "nvidia", label: "NVIDIA Nemotron Nano 12B VL" },
    ];
    const textModels: Array<{ name: string; label: string; provider: string }> = [
      // Rápidos / livianos primero
      { name: "meta/llama-3.1-8b-instruct", provider: "nvidia", label: "NVIDIA Llama 3.1 8B" },
      { name: "nvidia/llama-3.1-nemotron-nano-8b-v1", provider: "nvidia", label: "NVIDIA Nemotron Nano 8B" },
      { name: "nvidia/nvidia-nemotron-nano-9b-v2", provider: "nvidia", label: "NVIDIA Nemotron Nano 9B v2" },
      { name: "google/gemma-2-2b-it", provider: "nvidia", label: "NVIDIA Gemma 2 2B" },
      { name: "mistralai/mixtral-8x7b-instruct-v0.1", provider: "nvidia", label: "NVIDIA Mixtral 8x7B" },
      { name: "microsoft/phi-4-mini-instruct", provider: "nvidia", label: "NVIDIA Phi-4 Mini" },
      { name: "upstage/solar-10.7b-instruct", provider: "nvidia", label: "NVIDIA Solar 10.7B" },
      // Medianos, buena calidad
      { name: "meta/llama-3.3-70b-instruct", provider: "nvidia", label: "NVIDIA Llama 3.3 70B" },
      { name: "google/gemma-4-31b-it", provider: "nvidia", label: "NVIDIA Gemma 4 31B" },
      { name: "nvidia/llama-3.3-nemotron-super-49b-v1.5", provider: "nvidia", label: "NVIDIA Nemotron Super 49B v1.5" },
      { name: "mistralai/mistral-medium-3.5-128b", provider: "nvidia", label: "NVIDIA Mistral Medium 3.5" },
      { name: "deepseek-ai/deepseek-v4-flash", provider: "nvidia", label: "NVIDIA DeepSeek V4 Flash" },
      { name: "qwen/qwen3.5-122b-a10b", provider: "nvidia", label: "NVIDIA Qwen 3.5 122B" },
      // Pesados / último recurso
      { name: "mistralai/mistral-large-3-675b-instruct-2512", provider: "nvidia", label: "NVIDIA Mistral Large 3" },
      { name: "deepseek-ai/deepseek-v4-pro", provider: "nvidia", label: "NVIDIA DeepSeek V4 Pro" },
      { name: "qwen/qwen3.5-397b-a17b", provider: "nvidia", label: "NVIDIA Qwen 3.5 397B" },
      // Respaldo final vía OpenRouter, por si NVIDIA falla por completo (caída del servicio, etc.)
      { name: "meta-llama/llama-3.3-70b-instruct", provider: "openrouter", label: "OpenRouter Llama 3.3 70B" },
      { name: "openai/gpt-4o-mini", provider: "openrouter", label: "OpenRouter GPT-4o-Mini" }
    ];
    const modelsCascade: Array<{ name: string; label: string; provider: string }> =
      imageParts.length > 0 ? [...visionModels, ...textModels] : textModels;

    // Construye el "content" del mensaje de usuario en formato compatible OpenAI.
    // Para modelos de visión metemos las imágenes como image_url (base64 data URI).
    // NOTA: Meta exige que con imágenes NO se use mensaje "system" aparte, así que
    // en ese caso el system prompt se antepone dentro del propio mensaje de usuario.
    const systemInst = getSystemInstruction(storeConfig);
    const buildMessages = (isVision: boolean) => {
      if (isVision && imageParts.length > 0) {
        const userContent: any[] = [
          { type: "text", text: `${systemInst}\n\n---\n\n${promptText}` }
        ];
        // Solo se soporta 1 imagen por request en los modelos de visión de NVIDIA
        const img = imageParts[0];
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` }
        });
        return [{ role: "user", content: userContent }];
      }
      return [
        { role: "system", content: systemInst },
        { role: "user", content: promptText }
      ];
    };

    let lastError: any = null;
    const timeoutMs = 7000; // subido un poco de 5000 a 7000: el free-tier de NVIDIA a veces
    // tarda más por congestión, y 5s estaba generando timeouts incluso en modelos chiquitos.

    // Helper: intenta un modelo puntual, retorna { text, modelObj } o lanza error.
    async function callModel(modelObj: { name: string; label: string; provider: string }) {
      const isVisionModel = visionModels.some(v => v.name === modelObj.name);
      const apiUrl = modelObj.provider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

      const apiKey = modelObj.provider === "nvidia"
        ? (process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey)
        : (process.env.OPENROUTER_API_KEY || storeConfig.openrouterApiKey);

      if (!apiKey) {
        throw new Error(`${modelObj.provider === "nvidia" ? "NVIDIA_API_KEY" : "OPENROUTER_API_KEY"} no está configurada.`);
      }

      console.log(`[Server AI] Intentando modelo: ${modelObj.name} (${modelObj.provider}) para ${fromPhone} con timeout de ${timeoutMs}ms...`);

      const response = await axios.post(
        apiUrl,
        {
          model: modelObj.name,
          messages: buildMessages(isVisionModel),
          temperature: 0.2,
          max_tokens: 1024,
          top_p: 0.7,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: timeoutMs
        }
      );

      let text = response.data?.choices?.[0]?.message?.content || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      if (!text) {
        throw new Error(`La respuesta de ${modelObj.provider} no devolvió contenido de texto válido.`);
      }
      console.log(`[Server AI] [${modelObj.provider.toUpperCase()}] Éxito con el modelo ${modelObj.name}`);
      return { text, modelObj };
    }

    // FASE 1: carrera en paralelo entre los primeros N modelos (los más livianos/rápidos).
    // Esto evita el problema que viste en los logs: 5-7 modelos en fila haciendo timeout
    // uno detrás del otro (80+ segundos). Con la carrera, si 2-3 modelos livianos están
    // lentos/caídos al mismo tiempo, no importa: apenas UNO responda, seguimos.
    const RACE_SIZE = Math.min(4, modelsCascade.length);
    const raceGroup = modelsCascade.slice(0, RACE_SIZE);
    const sequentialRest = modelsCascade.slice(RACE_SIZE);

    try {
      const winner = await Promise.any(raceGroup.map(m => callModel(m)));
      result = { text: winner.text };
    } catch (aggErr: any) {
      // Todos los de la carrera fallaron: seguimos con el resto de la cascada, uno por uno.
      lastError = aggErr?.errors?.[aggErr.errors.length - 1] || aggErr;
      console.warn(`[Server AI] Los ${RACE_SIZE} modelos en carrera fallaron. Pasando a la cascada secuencial de respaldo (${sequentialRest.length} modelos restantes)...`);

      for (const modelObj of sequentialRest) {
        try {
          const r = await callModel(modelObj);
          result = { text: r.text };
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`[Server AI] Falló modelo ${modelObj.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (!result || !result.text) {
      console.error("[Server AI] Todos los modelos de la cascada fallaron o no devolvieron texto.");
      // No dejamos al cliente sin respuesta: le avisamos que hubo un problema técnico
      // en vez de solo loguear el error en el dashboard (antes se quedaba sin nada).
      const outageMsg = "¡Uy, disculpá! Tuve un problema técnico procesando tu mensaje 😅. Ya le avisé a mi equipo, en un momento te escriben o intentá de nuevo en unos minutos.";
      try {
        if (data.from.startsWith("whatsapp:")) {
          await sendWhatsApp(data.from, outageMsg, undefined, activityId, data.to);
        } else if (data.platform === "instagram" || data.platform === "messenger") {
          await sendMetaMessage(data.from, outageMsg, data.platform, data.to);
        }
      } catch (sendErr) {
        console.error("[Server AI] Ni siquiera se pudo enviar el mensaje de outage:", sendErr);
      }
      throw new Error(`Todos los modelos fallaron. Último error: ${lastError?.message || lastError}`);
    }

    if (!result.text) throw new Error("La IA no devolvió texto.");
    let jsonResponse;
    const safeFallbackResponse = {
      accion: "respuesta",
      mensaje: "Uy parce, me enredé un poquito procesando eso. ¿Me repites porfa en un mensaje más cortico?",
      intencion: "error",
      nivel_interes: "bajo"
    };
    try {
      jsonResponse = JSON.parse(result.text);
    } catch (parseErr: any) {
      console.error(`[Server AI] Error parseando JSON de la IA. Longitud del texto: ${result.text.length}`);
      if (result.text.length > 500) {
         console.debug("[Server AI] Primeros 500 chars:", result.text.substring(0, 500));
         console.debug("[Server AI] Últimos 500 chars:", result.text.substring(result.text.length - 500));
      }
      // Fallback response to avoid freezing the conversation
      jsonResponse = safeFallbackResponse;
    }

    // VALIDACIÓN: el JSON puede haber parseado bien pero venir sin el campo "mensaje"
    // (ej. un modelo genérico como gpt-4o-mini que no siguió el esquema al pie de la letra).
    // Sin esta validación, Twilio rechaza el envío por venir con body vacío/undefined y
    // el cliente se queda sin respuesta. Intentamos rescatar el texto de otros campos
    // comunes antes de recurrir al fallback genérico.
    if (!jsonResponse || typeof jsonResponse.mensaje !== "string" || !jsonResponse.mensaje.trim()) {
      const rescatado = jsonResponse?.respuesta || jsonResponse?.message || jsonResponse?.text || jsonResponse?.reply;
      if (typeof rescatado === "string" && rescatado.trim()) {
        console.warn(`[Server AI] jsonResponse vino sin "mensaje" válido; se rescató de un campo alterno.`);
        jsonResponse = { ...jsonResponse, mensaje: rescatado };
      } else {
        console.error(`[Server AI] jsonResponse sin "mensaje" utilizable. Texto crudo (primeros 300 chars): ${String(result.text).substring(0, 300)}`);
        jsonResponse = safeFallbackResponse;
      }
    }
    console.log(`[Server AI] Respuesta generada para ${fromPhone} (Acción: ${jsonResponse.accion}):`, jsonResponse.mensaje);

    // CRM / Scoring update
    let profile = customerProfile || {};
    profile.name = jsonResponse.datos_pedido?.nombre || profile.name || fromPhone;
    profile.phone = profile.phone || fromPhone;
    profile.intencion = jsonResponse.intencion || profile.intencion || "";
    profile.producto_interes = jsonResponse.producto || profile.producto_interes || "";
    profile.objeciones = jsonResponse.objeciones || "ninguna";
    
    const msgLower = (data.message || "").toLowerCase();
    const score = calcularScore(jsonResponse, {
      dio_direccion: msgLower.includes("cr") || msgLower.includes("#") || msgLower.includes("calle") || msgLower.includes("carrera") || !!jsonResponse.datos_pedido?.direccion,
      pregunto_precio: msgLower.includes("precio") || msgLower.includes("cuanto") || msgLower.includes("costo") || msgLower.includes("vale"),
      pidio_envio: msgLower.includes("envío") || msgLower.includes("envio") || msgLower.includes("llega") || msgLower.includes("domicilio")
    });

    profile.score = score;
    profile.etapa = await definirEtapa(score);
    profile.prioridad = score > 70 ? "alta" : "media";
    profile.ultima_interaccion = serverTimestamp();
    
    // Save enriched CRM Data per store
    await setDoc(doc(db, "customers", customerProfileId), profile, { merge: true });

    // Seguro extra (defensa en profundidad): Twilio rechaza el envío si el body viene
    // vacío/undefined ("A text message body or media urls must be specified"). Nunca debería
    // llegar acá vacío gracias a la validación de arriba, pero por si acaso.
    if (typeof jsonResponse.mensaje !== "string" || !jsonResponse.mensaje.trim()) {
      jsonResponse.mensaje = "Uy, se me enredó la respuesta 😅. ¿Me repites porfa?";
    }

    // 3.0 Si la IA detecta intención de confirmar pedido, en vez de mandar el texto normal
    // y crear el pedido de una, mandamos BOTONES de confirmación (Sí/No) y dejamos el pedido
    // en pendingConfirmation hasta que el cliente toque el botón. Evita pedidos mal-confirmados
    // por una interpretación ambigua de texto libre.
    if (jsonResponse.accion === "confirmar_pedido") {
      console.log("[Server AI] Intención de confirmar pedido detectada. Enviando botones de confirmación...");
      try {
        const sent = await sendOrderConfirmationButtons(data.from, data.to, jsonResponse);
        if (sent) {
          await setDoc(doc(db, "customers", customerProfileId), {
            pendingConfirmation: {
              jsonResponse,
              storeId: assignedStoreId,
              createdAt: serverTimestamp()
            }
          }, { merge: true });
          jsonResponse._skipTextReply = true;
        } else {
          // Si por algo falla el envío de botones (ej. Twilio no listo), hacemos
          // lo de siempre: confirmar directo, para no dejar el pedido perdido.
          await finalizeOrder(jsonResponse, storeConfig, customerProfile, fromPhone, assignedStoreId, products, db);
        }
      } catch (e) {
        console.error("[Server AI] Error en el flujo de confirmación por botones:", e);
      }
    } else if (jsonResponse.accion === "mostrar_menu" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción mostrar_menu detectada. Enviando botones de menú principal...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendMainMenu(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de mostrar_menu:", e);
      }
    } else if (jsonResponse.accion === "mostrar_categorias" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción mostrar_categorias detectada. Enviando botones de categorías...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendCategoriesMenu(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de mostrar_categorias:", e);
      }
    } else if (jsonResponse.accion === "preguntar_continuar" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción preguntar_continuar detectada. Enviando prompt de continuar chat...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendKeepChatPrompt(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de preguntar_continuar:", e);
      }
    } else if (jsonResponse.accion === "finalizar_chat") {
      console.log("[Server AI] Acción finalizar_chat detectada. Finalizando conversación...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await updateDoc(doc(db, "customers", customerProfileId), { 
          pendingConfirmation: null,
          etapa: "finalizado",
          score: 0 
        });
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de finalizar_chat:", e);
      }
    }

    // 3. Enviar respuesta por la plataforma correcta
    if (!jsonResponse._skipTextReply) {
      if (data.from.startsWith("whatsapp:")) {
        let mediaUrl = jsonResponse.imageUrl || undefined;
        await sendWhatsApp(data.from, jsonResponse.mensaje, mediaUrl, activityId, data.to);
      } else if (data.platform === "instagram" || data.platform === "messenger") {
        await sendMetaMessage(data.from, jsonResponse.mensaje, data.platform, data.to);
      }
    }

    // 4. Actualizar actividad
    await updateDoc(doc(db, "activities", activityId), {
      status: "respondido",
      response: jsonResponse._skipTextReply ? "[Botones de confirmación enviados]" : jsonResponse.mensaje,
      respondedAt: serverTimestamp()
    });

    // 6. Notificar si se requiere atención humana
    if (jsonResponse.accion === "notificar_admin") {
      console.log("[Server AI] ¡ASESORÍA HUMANA SOLICITADA! Notificando...");
      const adminMessage = `🚨 *ASESORÍA HUMANA SOLICITADA*
Cliente: ${customerProfile?.name || fromPhone} (${fromPhone})
Producto/Duda: ${jsonResponse.producto || 'No especificado'}
Mensaje del cliente: "${data.message}"
Jan respondió: "${jsonResponse.mensaje}"`;
      
      const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
      const adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
      for (const num of adminNumbers) {
          try {
            const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
            await sendWhatsApp(target, adminMessage);
          } catch (e) {
            console.error("[Server AI] Error notificando asesoría:", e);
          }
      }
    }

    // 7. PROGRAMAR SEGUIMIENTO INTELIGENTE SI NO CERRÓ
    if (jsonResponse.accion !== "confirmar_pedido" && score > 20) {
      // Solo si el score es relevante (interesado de verdad)
      await scheduleFollowUp(fromPhone, score, jsonResponse.intencion || "Interés general", assignedStoreId);
    }

  } catch (err: any) {
    console.error(`[Server AI][Error] Falló procesamiento en Railway:`, err.message);
    try { handleSupabaseError(err); } catch (e) {}
    if (!checkGlobalQuota()) {
      await updateDoc(doc(db, "activities", activityId), { 
        status: "error", 
        response: `Jan tuvo un mareo: ${err.message}`,
        errorAt: serverTimestamp()
      }).catch((e)=>console.error("Failed to write error due to quota", e));
    }
  }
}
async function updateTwilioStatus(limitReached: boolean, error?: string) {
  try {
    await setDoc(doc(db, "config", "system"), {
      twilioLimitReached: limitReached,
      lastTwilioError: error || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Twilio Status] Updated: LimitReached=${limitReached}`);
  } catch (e) {
    console.error("[Twilio Status] Failed to update status:", e);
  }
}

/**
 * Checks if we can still send messages today
 */
async function checkTwilioStatus(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "config", "system"));
    if (!snap.exists()) return true;
    
    const data = snap.data();
    if (!data) return true;

    // Auto-reset if the last update was yesterday
    if (data.updatedAt) {
      const updatedAt = data.updatedAt;
      const lastUpdate = typeof updatedAt.toDate === 'function' ? updatedAt.toDate() : new Date(updatedAt);
      const today = new Date();
      if (lastUpdate.toDateString() !== today.toDateString()) {
        await updateTwilioStatus(false);
        return true;
      }
    }
    
    return !data.twilioLimitReached;
  } catch (e) {
    return true; // Optimistic
  }
}

/**
 * Normalizes a phone number for Twilio (whatsapp:+...)
 */
// ==============================================
// 🔘 BOTONES DE CONFIRMACIÓN DE PEDIDO (WhatsApp Quick Reply)
// ==============================================
// Se auto-provisiona UNA sola vez el Content Template en Twilio (no requiere
// tocar la consola de Twilio a mano). El ContentSid resultante se guarda en
// Supabase (config/system) para no volver a crearlo en cada arranque.
const CONFIRM_YES_ID = "JAN_CONFIRM_YES";
const CONFIRM_NO_ID = "JAN_CONFIRM_NO";

async function ensureOrderConfirmationTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.orderConfirmTemplateSid : null;
    if (existingSid) {
      console.log(`[WhatsApp Buttons] Usando template existente: ${existingSid}`);
      return existingSid;
    }

    console.log("[WhatsApp Buttons] No hay template de confirmación aún. Creando uno nuevo...");
    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_order_confirm_${Date.now()}`,
      language: "es",
      variables: { "1": "Producto x1 - $50.000, Cra 10 #20-30" },
      types: {
        "twilio/quick-reply": {
          body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya?",
          actions: [
            { title: "Sí, confirmar ✅", id: CONFIRM_YES_ID },
            { title: "No, cambiar algo ✏️", id: CONFIRM_NO_ID }
          ]
        },
        "twilio/text": {
          body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya? Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { orderConfirmTemplateSid: content.sid }, { merge: true });
    console.log(`[WhatsApp Buttons] Template creado y guardado: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] No se pudo crear/obtener el template de confirmación:", e.message);
    return null;
  }
}

// Arma el texto corto que va dentro de la variable {{1}} del template
function buildOrderSummaryLine(jsonResponse: any): string {
  const producto = jsonResponse.producto || "Producto";
  const valor = jsonResponse.datos_pedido?.valor ? `$${Number(jsonResponse.datos_pedido.valor).toLocaleString("es-CO")}` : "";
  const direccion = jsonResponse.datos_pedido?.direccion || "";
  const ciudad = jsonResponse.datos_pedido?.ciudad || "";
  return [producto, valor, [direccion, ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" - ").slice(0, 300);
}

async function sendOrderConfirmationButtons(to: string, from: string, jsonResponse: any): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureOrderConfirmationTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": buildOrderSummaryLine(jsonResponse) })
    });
    console.log(`[WhatsApp Buttons] Botones de confirmación enviados a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de confirmación:", e.message);
    return false;
  }
}

// Unified Template Provisioner for All Interactive Bot Flow Elements
async function ensureAllTemplates(): Promise<{
  orderConfirmSid: string | null;
  mainMenuSid: string | null;
  categoriesSid: string | null;
  otherCategoriesSid: string | null;
  keepChatSid: string | null;
}> {
  const result = {
    orderConfirmSid: null as string | null,
    mainMenuSid: null as string | null,
    categoriesSid: null as string | null,
    otherCategoriesSid: null as string | null,
    keepChatSid: null as string | null
  };

  if (!twilioClient) return result;

  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};

    // 1. Order Confirm
    if (d?.orderConfirmTemplateSid) {
      result.orderConfirmSid = d.orderConfirmTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de confirmación...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_order_confirm_${Date.now()}`,
        language: "es",
        variables: { "1": "Producto x1 - $50.000, Cra 10 #20-30" },
        types: {
          "twilio/quick-reply": {
            body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya?",
            actions: [
              { title: "Sí, confirmar ✅", id: CONFIRM_YES_ID },
              { title: "No, cambiar algo ✏️", id: CONFIRM_NO_ID }
            ]
          },
          "twilio/text": {
            body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya? Responde SI o NO."
          }
        }
      });
      result.orderConfirmSid = content.sid;
      await setDoc(doc(db, "config", "system"), { orderConfirmTemplateSid: content.sid }, { merge: true });
    }

    // 2. Main Menu
    if (d?.mainMenuTemplateSid) {
      result.mainMenuSid = d.mainMenuTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de menú principal...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_main_menu_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "¡Hola! 👋 Te doy la bienvenida a nuestro catálogo con más de 360 productos. ¿Cómo te puedo ayudar hoy? Selecciona una opción 👇",
            actions: [
              { title: "Ver Catálogo 📦", id: "MENU_CATALOG" },
              { title: "Hablar con Asesor 🙋‍♂️", id: "MENU_HUMAN" },
              { title: "Finalizar Chat 🛑", id: "MENU_END" }
            ]
          },
          "twilio/text": {
            body: "¡Hola! 👋 Te doy la bienvenida a nuestro catálogo. ¿Cómo te puedo ayudar hoy?\n\n1. Ver Catálogo 📦\n2. Hablar con Asesor 🙋‍♂️\n3. Finalizar Chat 🛑"
          }
        }
      });
      result.mainMenuSid = content.sid;
      await setDoc(doc(db, "config", "system"), { mainMenuTemplateSid: content.sid }, { merge: true });
    }

    // 3. Categories Menu
    if (d?.categoriesTemplateSid) {
      result.categoriesSid = d.categoriesTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de categorías...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_categories_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "Tenemos las mejores ofertas en todas las categorías de Colombia. Selecciona una sección para ver los productos destacados 👇",
            actions: [
              { title: "Tecnología 💻", id: "CAT_TECH" },
              { title: "Hogar y Aseo 🧼", id: "CAT_HOME" },
              { title: "Otras Secciones 📑", id: "CAT_OTHER" }
            ]
          },
          "twilio/text": {
            body: "Selecciona una sección para ver los productos destacados:\n\n- Tecnología 💻\n- Hogar y Aseo 🧼\n- Otras Secciones 📑"
          }
        }
      });
      result.categoriesSid = content.sid;
      await setDoc(doc(db, "config", "system"), { categoriesTemplateSid: content.sid }, { merge: true });
    }

    // 4. Other Categories Menu
    if (d?.otherCategoriesTemplateSid) {
      result.otherCategoriesSid = d.otherCategoriesTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de otras categorías...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_other_cats_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "También contamos con estas increíbles secciones. Selecciona una opción 👇",
            actions: [
              { title: "Autos y Herram. 🚗", id: "CAT_AUTOS" },
              { title: "Salud y Belleza 🧴", id: "CAT_BEAUTY" },
              { title: "Menú Principal 🔙", id: "MENU_BACK" }
            ]
          },
          "twilio/text": {
            body: "Otras secciones disponibles:\n\n- Autos y Herram. 🚗\n- Salud y Belleza 🧴\n- Menú Principal 🔙"
          }
        }
      });
      result.otherCategoriesSid = content.sid;
      await setDoc(doc(db, "config", "system"), { otherCategoriesTemplateSid: content.sid }, { merge: true });
    }

    // 5. Keep Chatting Menu
    if (d?.keepChatTemplateSid) {
      result.keepChatSid = d.keepChatTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de continuar chat...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_keep_chat_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "¿Deseas continuar chateando o tienes alguna otra consulta sobre nuestros productos? 👇",
            actions: [
              { title: "Sí, continuar ✅", id: "CHAT_KEEP" },
              { title: "No, finalizar 🛑", id: "CHAT_END" }
            ]
          },
          "twilio/text": {
            body: "¿Deseas continuar chateando o tienes alguna otra consulta sobre nuestros productos?\n\n- Sí, continuar ✅\n- No, finalizar 🛑"
          }
        }
      });
      result.keepChatSid = content.sid;
      await setDoc(doc(db, "config", "system"), { keepChatTemplateSid: content.sid }, { merge: true });
    }

  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error asegurando templates de Twilio Content API:", e.message);
  }

  return result;
}

async function sendMainMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.mainMenuSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.mainMenuSid
    });
    console.log(`[WhatsApp Buttons] Menú principal enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú Principal:", e.message);
    return false;
  }
}

async function sendCategoriesMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.categoriesSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.categoriesSid
    });
    console.log(`[WhatsApp Buttons] Menú de categorías enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú de Categorías:", e.message);
    return false;
  }
}

async function sendOtherCategoriesMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.otherCategoriesSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.otherCategoriesSid
    });
    console.log(`[WhatsApp Buttons] Menú de otras categorías enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú de Otras Categorías:", e.message);
    return false;
  }
}

async function sendKeepChatPrompt(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.keepChatSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.keepChatSid
    });
    console.log(`[WhatsApp Buttons] Prompt de continuar chat enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Prompt de Continuar Chat:", e.message);
    return false;
  }
}

async function sendCategoryFeaturedProducts(to: string, from: string, category: string, categoryLabel: string, assignedStoreId: string) {
  try {
    const products = await loadProductsForStore(assignedStoreId);
    
    // Normalizar la categoría para buscar coincidencias
    const searchCat = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const matched = products.filter((p: any) => {
      if (!p.category) return false;
      const prodCat = p.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return prodCat.includes(searchCat) || searchCat.includes(prodCat);
    });

    // Tomar los primeros 4 o 5 productos
    const featured = matched.slice(0, 5);

    let responseText = `✨ *PRODUCTOS DESTACADOS: ${categoryLabel.toUpperCase()}* ✨\n\n`;
    
    if (featured.length === 0) {
      responseText += `Actualmente estamos actualizando esta sección, pero contamos con excelentes opciones. ¡Pregúntame por lo que buscas! 🛒\n\n`;
    } else {
      featured.forEach((p, idx) => {
        const formattedPrice = Number(p.price || 0).toLocaleString("es-CO");
        const desc = p.description ? (p.description.length > 120 ? p.description.substring(0, 120) + "..." : p.description) : "Excelente calidad y garantía.";
        responseText += `${idx + 1}. *${p.name}* 🌟\n💵 *Precio:* $${formattedPrice} COP\n📝 *Detalle:* ${desc}\n\n`;
      });
    }

    responseText += `⚠️ *RECUERDA:* Vendemos cualquier tipo de producto que imagines. Si buscas algo específico (marca, modelo, tipo de artículo) que no ves aquí, ¡solo pregúntame por él por este chat para confirmar disponibilidad y precio de inmediato! 📲\n`;

    // Enviar la lista de productos
    await sendWhatsApp(to, responseText, undefined, undefined, from);

    // Enviar el prompt de continuar chat después de un pequeño delay
    setTimeout(async () => {
      await sendKeepChatPrompt(to, from);
    }, 1500);

  } catch (e: any) {
    console.error(`[WhatsApp Buttons] Error enviando productos destacados para categoría ${category}:`, e.message);
  }
}

async function startCheckoutFlow(from: string, cleanFrom: string, to: string, assignedStoreId: string, initialProduct: string = "") {
  try {
    const customerProfileId = `${assignedStoreId}_${cleanFrom}`;
    const step = initialProduct ? "nombre" : "producto";
    const checkoutData = {
      producto: initialProduct,
      nombre: "",
      telefono: "",
      ciudad: "",
      direccion: "",
      referencia: "",
      valor: 0
    };

    if (initialProduct) {
      const products = await loadProductsForStore(assignedStoreId);
      const checkProd = initialProduct.toLowerCase();
      const match = products.find((p: any) =>
        (p.name && p.name.toLowerCase().includes(checkProd)) ||
        (p.name && checkProd.includes(p.name.toLowerCase()))
      );
      if (match && match.price) {
        checkoutData.valor = match.price;
        checkoutData.producto = match.name;
      }
    }

    await setDoc(doc(db, "customers", customerProfileId), {
      checkoutStep: step,
      checkoutData: checkoutData,
      etapa: "negociando",
      lastInteractionAt: serverTimestamp()
    }, { merge: true });

    if (!initialProduct) {
      await sendWhatsApp(from, `¡Excelente decisión! 🛒 Vamos a registrar tu pedido de una, sin demoras y súper profesional.\n\nContame: ¿Qué producto(s) de nuestro catálogo deseas ordenar hoy? 🔎 (Escríbelo por acá 👇)`, undefined, undefined, to);
    } else {
      await sendWhatsApp(from, `¡Excelente decisión! 🛒 Vamos a registrar tu pedido para *${checkoutData.producto || initialProduct}* súper rápido.\n\nPor favor dime tu *Nombre y Apellido completo* para la guía de despacho de tu pedido: 📝`, undefined, undefined, to);
    }
    return true;
  } catch (e: any) {
    console.error(`[startCheckoutFlow] Error initializing:`, e.message);
    return false;
  }
}

// Crea el pedido en Supabase, sincroniza con Shopify/Dropi si aplica, y notifica a los admins.
// Extraída como función reutilizable: se llama tanto cuando el cliente confirma por botón
// como en el fallback directo si no se pudieron mandar los botones.
async function finalizeOrder(
  jsonResponse: any,
  storeConfig: any,
  customerProfile: any,
  fromPhone: string,
  assignedStoreId: string,
  products: any[],
  dbRef: any
) {
  console.log("[Server AI] ¡PEDIDO CONFIRMADO! Notificando y Persistiendo...");
  try {
    let finalPrice = jsonResponse.datos_pedido?.valor || 0;
    if (finalPrice <= 0 && jsonResponse.producto) {
      const checkProd = jsonResponse.producto.toLowerCase();
      const match = products.find((p: any) =>
        (p.name && p.name.toLowerCase().includes(checkProd)) ||
        (p.name && checkProd.includes(p.name.toLowerCase()))
      );
      if (match && (match as any).price) finalPrice = (match as any).price;
    }

    const orderInfo = {
      storeId: assignedStoreId,
      customerName: jsonResponse.datos_pedido?.nombre || customerProfile?.name || fromPhone,
      customerPhone: jsonResponse.datos_pedido?.telefono || fromPhone,
      productName: jsonResponse.producto || "No especificado",
      productId: "manual",
      quantity: 1,
      totalPrice: finalPrice,
      address: jsonResponse.datos_pedido?.direccion || "No especificada",
      city: jsonResponse.datos_pedido?.ciudad || "No especificada",
      addressIndicator: jsonResponse.datos_pedido?.referencia || "N/A",
      notes: jsonResponse.datos_pedido?.notas || "",
      status: 'pendiente',
      shopifyStatus: 'no_enviado',
      dropiStatus: 'no_enviado',
      createdAt: serverTimestamp()
    };

    const orderRef = await addDoc(collection(dbRef, "orders"), orderInfo);
    const newOrderId = orderRef.id;
    console.log(`[Server AI] Pedido guardado en base de datos con ID: ${newOrderId}`);

    if (storeConfig?.shopifyAutoSync && storeConfig?.shopifyDomain && storeConfig?.shopifyAccessToken) {
      console.log("[Server AI] Shopify Auto Sync activo. Sincronizando pedido...");
      try {
        await pushOrderToShopify(newOrderId, orderInfo, storeConfig, dbRef);
        console.log("[Server AI] Pedido sincronizado con Shopify automáticamente.");
      } catch (shopErr: any) {
        console.error("[Server AI] Error sincronizando con Shopify automáticamente:", shopErr.message);
        await updateDoc(doc(dbRef, "orders", newOrderId), {
          shopifyStatus: "error",
          shopifyError: shopErr.message
        });
      }
    }

    if (storeConfig?.dropiAutoSync && storeConfig?.dropiApiKey) {
      console.log("[Server AI] Dropi Auto Sync activo. Sincronizando pedido...");
      try {
        await pushOrderToDropi(newOrderId, orderInfo, storeConfig, dbRef);
        console.log("[Server AI] Pedido sincronizado con Dropi automáticamente.");
      } catch (dropErr: any) {
        console.error("[Server AI] Error sincronizando con Dropi automáticamente:", dropErr.message);
        await updateDoc(doc(dbRef, "orders", newOrderId), {
          dropiStatus: "error",
          dropiError: dropErr.message
        });
      }
    }

    await notifyAdmins(orderInfo, storeConfig?.name || "Jan Vanegas", storeConfig);
    return orderInfo;
  } catch (e) {
    console.error("[Server AI] Error persistiendo o notificando pedido:", e);
    return null;
  }
}

// Carga el catálogo de productos de una tienda (con fallback a JSON local si Supabase falla).
// Extraída para reutilizarla tanto en el flujo normal de IA como en la confirmación por botón.
async function loadProductsForStore(assignedStoreId: string): Promise<any[]> {
  let products: any[] = [];
  try {
    const qProd = query(collection(db, "products"), where("storeId", "==", assignedStoreId));
    let prodSnap = await getDocs(qProd);
    if (prodSnap.empty && assignedStoreId === "default") {
      prodSnap = await getDocs(collection(db, "products"));
    }
    products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Supabase read error, using local JSON:", e);
  }

  if (products.length === 0) {
    try {
      const catalogData = JSON.parse(readFileSync(path.join(cwd, "src/catalog.json"), "utf8"));
      products = catalogData.products;
    } catch (errFallback) {
      console.error("Error reading local catalog fallback:", errFallback);
    }
  }
  return products;
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  // 1. Remove the 'whatsapp:' prefix if present to avoid double-prepending
  let clean = phone.toLowerCase().replace('whatsapp:', '');
  // 2. Remove all non-digit characters
  clean = clean.replace(/\D/g, '');
  // 3. Return with the correct Twilio prefix
  return `whatsapp:+${clean}`;
}

async function sendWhatsApp(to: string, body: string, mediaUrl?: string, activityId?: string, from?: string) {
  if (!twilioClient) {
    console.error("[WhatsApp Send] Client not initialized.");
    return;
  }

  // Derive base URL for status callbacks
  const appUrl = currentAppUrl || process.env.APP_URL || "";
  
  const finalTo = normalizePhone(to);
  const finalFrom = normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886");
  
  if (finalTo === finalFrom) {
    console.warn(`[WhatsApp Block] Attempted to send message to itself: ${finalTo}. Aborting to prevent infinite loop.`);
    return;
  }

  console.log(`[Twilio Debug] Final Numbers: FROM=${finalFrom} TO=${finalTo}`);

  // Check Twilio limits early
  const canSend = await checkTwilioStatus();
  if (!canSend) {
    console.error("[Twilio Limit] Blocked: Trial 50-message limit reached.");
    throw new Error("TWILIO_LIMIT_REACHED: Twilio 50-message trial limit exceeded.");
  }

  // Ensure mediaUrl is absolute
  if (mediaUrl && mediaUrl.startsWith("/")) {
    mediaUrl = `${appUrl.replace(/\/$/, '')}${mediaUrl}`;
  }

  // SIMPLIFY: Send as text links for reliability (User request)
  let finalMediaUrl = mediaUrl;
  let finalBody = body;

  if (finalMediaUrl) {
    // If the link is not already in the body, append it
    if (!finalBody.includes(finalMediaUrl)) {
      finalBody += `\n\nVer aquí: ${finalMediaUrl}`;
    }
    
    // Only send as 'media' if it's an internal resource (cached audio/image)
    // External catalog links are sent as text links for 100% delivery
    const isInternal = finalMediaUrl.includes('/api/admin/cache-media') || finalMediaUrl.includes('/api/media/');
    if (!isInternal) {
      console.log(`[Twilio Bot] Sending catalog link as text: ${finalMediaUrl}`);
      finalMediaUrl = undefined;
    }
  }

  const params: any = {
    from: finalFrom,
    to: finalTo,
    body: finalBody
  };

  if (finalMediaUrl) {
    params.mediaUrl = [finalMediaUrl];
  }

  if (activityId && appUrl) {
    params.statusCallback = `${appUrl.replace(/\/$/, '')}/api/webhook/whatsapp/status?activityId=${activityId}`;
  }

  try {
    console.log(`[Twilio Action] Sending... From:${params.from} To:${params.to} MsgLen:${body?.length || 0} Media:${!!params.mediaUrl}`);
    const msg = await twilioClient.messages.create(params);
    console.log(`[Twilio Success] SID: ${msg.sid}. Status: ${msg.status}`);
    return msg;
  } catch (err: any) {
    console.error(`[Twilio Error] FATAL: From:${finalFrom} To:${finalTo} Error: ${err.message}`);
    
    // Fallback: If it failed with media, try text only
    if (finalMediaUrl) {
      try {
        console.log("[Twilio Fallback] Retrying with TEXT ONLY...");
        const textOnlyParams = { ...params };
        delete textOnlyParams.mediaUrl;
        const msg = await twilioClient.messages.create(textOnlyParams);
        console.log(`[Twilio Success][Fallback] SID: ${msg.sid}`);
        return msg;
      } catch (innerErr: any) {
        console.error("[Twilio Fallback] FAILED TOO:", innerErr.message);
        throw innerErr;
      }
    }
    
    if (err.message.includes("limit") || err.message.includes("50")) {
      await updateTwilioStatus(true, err.message);
    }
    throw err;
  }
}

/**
 * Sends a message via Meta Graph API (Instagram or Messenger)
 */
async function sendMetaMessage(recipientId: string, text: string, platform: 'instagram' | 'messenger', pageId?: string) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.warn(`[Meta Send] No access token configured. Cannot reply to ${recipientId} on ${platform}`);
    return;
  }

  const endpoint = pageId ? `${pageId}/messages` : `me/messages`;
  const url = `https://graph.facebook.com/v19.0/${endpoint}?access_token=${FB_PAGE_ACCESS_TOKEN}`;
  
  try {
    console.log(`[Meta Send] Sending to ${recipientId} on ${platform}...`);
    const response = await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text },
      // platform: platform // Automatically inferred by Meta based on the Page/Account linked to the token
    });
    console.log(`[Meta Success] Message sent to ${recipientId}. MID: ${response.data.message_id}`);
    return response.data;
  } catch (err: any) {
    console.error(`[Meta Error] Failed to send to ${recipientId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Pushes an order to Shopify API
 */
async function pushOrderToShopify(orderId: string, orderData: any, storeConfig: any, db: any) {
  const { shopifyDomain, shopifyAccessToken } = storeConfig;
  if (!shopifyDomain || !shopifyAccessToken) {
    throw new Error("Credenciales de Shopify incompletas");
  }

  const cleanDomain = shopifyDomain.replace(/https?:\/\//, '').trim();
  const payload = {
    order: {
      line_items: [
        {
          title: orderData.productName || "Producto general",
          price: (orderData.totalPrice || 0).toString(),
          quantity: orderData.quantity || 1
        }
      ],
      customer: {
        first_name: orderData.customerName,
        phone: orderData.customerPhone
      },
      shipping_address: {
        first_name: orderData.customerName,
        address1: orderData.address,
        city: orderData.city,
        phone: orderData.customerPhone,
        country: "Colombia"
      },
      billing_address: {
        first_name: orderData.customerName,
        address1: orderData.address,
        city: orderData.city,
        phone: orderData.customerPhone,
        country: "Colombia"
      },
      financial_status: "pending",
      payment_gateway_names: ["Cash on Delivery (COD)", "Contra Entrega"],
      note: orderData.notes || orderData.addressIndicator || "",
      tags: "WhatsApp AI, Pago Contra Entrega"
    }
  };

  const response = await axios.post(
    `https://${cleanDomain}/admin/api/2024-01/orders.json`,
    payload,
    {
      headers: {
        "X-Shopify-Access-Token": shopifyAccessToken,
        "Content-Type": "application/json"
      },
      timeout: 10000
    }
  );

  const shopifyOrder = response.data.order;
  
  await updateDoc(doc(db, "orders", orderId), {
    shopifyStatus: "enviado",
    shopifyOrderId: shopifyOrder.id.toString(),
    shopifyError: null
  });

  return shopifyOrder;
}

/**
 * Pushes an order to Dropi API (or simulates success if key contains test/demo)
 */
async function pushOrderToDropi(orderId: string, orderData: any, storeConfig: any, db: any) {
  const { dropiApiKey, dropiPreferredCarrier } = storeConfig;
  if (!dropiApiKey) {
    throw new Error("Token o API Key de Dropi ausente.");
  }

  const payload = {
    customer: {
      name: orderData.customerName,
      phone: orderData.customerPhone,
      address: orderData.address,
      city: orderData.city,
      indicator: orderData.addressIndicator || ""
    },
    payment_method: "contra_entrega",
    carrier: dropiPreferredCarrier || "Servientrega",
    products: [
      {
        name: orderData.productName,
        quantity: orderData.quantity || 1,
        price: orderData.totalPrice || 0
      }
    ],
    notes: orderData.notes || ""
  };

  const key = dropiApiKey.trim();
  if (key.toLowerCase().includes("test") || key.toLowerCase().includes("demo") || key === "12345") {
    // Elegant fallback simulation for testing/demo keys
    const mockTracking = `CO-${Math.floor(100000000 + Math.random() * 900000000)}CO`;
    const mockOrderId = `DROP-${Math.floor(10000 + Math.random() * 90000)}`;
    await updateDoc(doc(db, "orders", orderId), {
      dropiStatus: "enviado",
      dropiOrderId: mockOrderId,
      dropiTrackingNumber: mockTracking,
      dropiCarrier: dropiPreferredCarrier || "Servientrega (Simulado)",
      dropiError: null
    });
    return { dropiOrderId: mockOrderId, tracking: mockTracking, simulated: true };
  }

  const response = await axios.post(
    "https://api.dropi.co/api/v2/orders", 
    payload,
    {
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      timeout: 10000
    }
  );

  const dropiData = response.data;
  const tracking = dropiData.tracking_number || dropiData.guia || `DROP-${Math.floor(Math.random() * 10000000)}`;
  const dropiOrderId = dropiData.order_id || dropiData.id || `DO-${Math.floor(Math.random() * 100000)}`;

  await updateDoc(doc(db, "orders", orderId), {
    dropiStatus: "enviado",
    dropiOrderId: dropiOrderId.toString(),
    dropiTrackingNumber: tracking,
    dropiCarrier: dropiPreferredCarrier || "Servientrega",
    dropiError: null
  });

  return { dropiOrderId, tracking };
}

/**
 * Notifies administrators (Jan and Tatiana) about new orders via WhatsApp
 */
async function notifyAdmins(orderData: any, storeName: string, storeConfig?: any) {
  const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
  let adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
  
  if (storeConfig?.notificationPhone) {
    adminNumbers = [storeConfig.notificationPhone];
  }

  if (adminNumbers.length === 0) {
    console.log("[Admin Notify] No admin numbers configured.");
    return;
  }

  let message = "";
  if (storeConfig?.msgNewOrderTemplate) {
    message = storeConfig.msgNewOrderTemplate
      .replace(/{nombre}/g, orderData.customerName || "No especificado")
      .replace(/{telefono}/g, orderData.customerPhone || "No especificado")
      .replace(/{ciudad}/g, orderData.city || "No especificada")
      .replace(/{direccion}/g, orderData.address || "No especificada")
      .replace(/{producto}/g, orderData.productName || "No especificado")
      .replace(/{total}/g, `$${(orderData.totalPrice || 0).toLocaleString()}`);
  } else {
    message = `🚀 *¡NUEVO PEDIDO, JEFE!*
Jan acaba de cerrar un negocio de una vez.

👤 *Cliente:* ${orderData.customerName}
📦 *Producto:* ${orderData.productName}
🔢 *Cant:* ${orderData.quantity}
📍 *Envío:* ${orderData.address}, ${orderData.city}
🏠 *Ref:* ${orderData.addressIndicator || 'N/A'}
💰 *Total:* $${(orderData.totalPrice || 0).toLocaleString()}

_El inventario ya fue descontado automáticamente._`;
  }

  console.log(`[Admin Notify] Notifying ${adminNumbers.length} admins...`);
  
  for (const num of adminNumbers) {
    try {
      // Ensure 'whatsapp:' prefix
      const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
      await sendWhatsApp(target, message);
    } catch (e: any) {
      console.error(`[Admin Notify] Error notifying ${num}:`, e.message);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Test Database connectivity on boot
  try {
    console.log("[Database] Testing backend connectivity...");
    await getDoc(doc(db, 'test', 'connection'));
    console.log("[Database] Backend connection successful.");
  } catch (err: any) {
    console.warn("[Database] Details:", err.message);
  }

  // Auto-provisionar el template de botones de confirmación de pedido (una sola vez,
  // sin necesidad de tocar la consola de Twilio). Si falla, no bloquea el arranque:
  // el bot cae de vuelta a confirmación por texto normal.
  ensureOrderConfirmationTemplate().catch(e =>
    console.warn("[WhatsApp Buttons] No se pudo pre-provisionar el template al arrancar:", e.message)
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '10mb' }));

  // -------------------------------------------------------------
  // 🗄️ SUPABASE / LOCAL DB REST API FOR CLIENT-FRONTEND PROXY
  // -------------------------------------------------------------
  
  app.get("/api/db/getDoc", async (req, res) => {
    const { collection: colName, id } = req.query;
    try {
      const result = await dbGetDoc(String(colName), String(id));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/getDocs", async (req, res) => {
    const { collection: colName, constraints } = req.body;
    try {
      const docs = await dbGetDocs(colName, constraints || []);
      res.json({ docs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/setDoc", async (req, res) => {
    const { collection: colName, id, data, merge } = req.body;
    try {
      await dbSetDoc(colName, id, data, merge !== false);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/updateDoc", async (req, res) => {
    const { collection: colName, id, data } = req.body;
    try {
      await dbSetDoc(colName, id, data, true);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/deleteDoc", async (req, res) => {
    const { collection: colName, id } = req.body;
    try {
      await dbDeleteDoc(colName, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/storage/upload", (req, res) => {
    res.json({ url: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=400" });
  });

  // DEBUG ROUTE: Visit /api/health to see if Jan is alive
  app.get("/api/health", (req, res) => {
    res.json({
      status: "Jan is alive",
      time: new Date().toISOString(),
      twilio_configured: !!process.env.TWILIO_ACCOUNT_SID,
      nvidia_key_detected: !!process.env.NVIDIA_API_KEY,
      openrouter_key_detected: !!process.env.OPENROUTER_API_KEY,
      app_url: currentAppUrl || process.env.APP_URL || "Not set"
    });
  });

  // IMAGE PROXY: Bypasses anti-hotlinking protection (403/405 blocks) on MercadoLibre/Dropi CDNs
  app.get("/api/image-proxy", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Missing url parameter");
    }
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        },
        timeout: 10000 // 10s timeout
      });
      const contentType = response.headers["content-type"] || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      return res.send(response.data);
    } catch (error: any) {
      console.error(`[Image Proxy Error] Failed to proxy image: ${imageUrl}. Error: ${error.message}`);
      // Fallback: redirect browser to the original image URL
      return res.redirect(imageUrl);
    }
  });

  // Global Middleware
  app.use((req, res, next) => {
    if (!currentAppUrl) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      const proto = req.headers["x-forwarded-proto"] || "https";
      currentAppUrl = `${proto}://${host}`;
      console.log(`[Jan Dashboard] Captured APP_URL: ${currentAppUrl}`);
    }
    next();
  });

  // Manual Intervention Endpoint
  app.post("/api/whatsapp/intervene", async (req, res) => {
    const { phone, agentName } = req.body;
    if (!phone || !agentName) return res.status(400).json({ error: "Missing phone or agentName" });

    const cleanPhone = phone.replace("whatsapp:", "");
    const formattedPhone = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
    const message = `Hola, le habla ${agentName} personalmente. Voy a retomar su caso para darle una atención VIP. Cuénteme, ¿en qué más le puedo ayudar?`;

    try {
    // 1. Pause AI
    await setDoc(doc(db, "conversations", cleanPhone), {
      phone: cleanPhone,
      aiPaused: true,
      lastInterventionBy: agentName,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Send Message
    const sent = await sendWhatsApp(formattedPhone, message);
    
    // 3. Log Activity
    await addDoc(collection(db, "activities"), {
      from: formattedPhone,
      to: TWILIO_FROM_NUMBER,
      storeId: "default",
      message: "[Asesor Humano]",
      response: message,
      status: "respondido",
      whatsappStatus: "sent",
      manualAgent: agentName,
      timestamp: serverTimestamp()
    });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/bulk-notify", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    
    const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
    const adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
    
    if (adminNumbers.length === 0) {
      return res.status(400).json({ error: "No admin numbers configured" });
    }

    const results = [];
    for (const num of adminNumbers) {
      try {
        const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
        await sendWhatsApp(target, message);
        results.push({ phone: num, success: true });
      } catch (e: any) {
        results.push({ phone: num, success: false, error: e.message });
      }
    }
    res.json({ success: true, results });
  });

  // Admin Seed Trigger
  app.post("/api/admin/clear-transactions", async (req, res) => {
    try {
      const { storeId } = req.body || {};
      const targetStore = storeId || "default";
      console.log(`[Admin Clear] Deleting all orders and activities for store ${targetStore}...`);
      
      const qOrders = query(collection(db, "orders"), where("storeId", "==", targetStore));
      const qActivities = query(collection(db, "activities"), where("storeId", "==", targetStore));
      
      const ordersSnap = await getDocs(qOrders);
      const activitiesSnap = await getDocs(qActivities);
      
      const batch = writeBatch(db);
      ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
      activitiesSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      
      // Also clear system Twilio limit status to start fresh
      await setDoc(doc(db, "config", "system"), {
        twilioLimitReached: false,
        lastTwilioError: null,
        updatedAt: serverTimestamp()
      }, { merge: true });

      res.json({ success: true, message: "Historial de ventas y actividades borrado con éxito." });
    } catch (e: any) {
      console.error("[Admin Clear] Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/seed", async (req, res) => {
    try {
      const { catalog, storeId } = req.body || {};
      await seedDatabase(true, catalog, storeId || "default");
      res.json({ success: true, message: "Catálogo actualizado con éxito (Admin)." });
    } catch (e: any) {
      console.error("[API Admin Seed] Error:", e);
      res.status(500).json({ 
        success: false, 
        error: e.message,
        details: JSON.stringify(e, null, 2)
      });
    }
  });

  // Toggle AI
  app.post("/api/whatsapp/toggle-ai", async (req, res) => {
    const { phone, pause } = req.body;
    const cleanPhone = phone.replace("whatsapp:", "");
    try {
      await setDoc(doc(db, "conversations", cleanPhone), {
        aiPaused: pause,
        updatedAt: serverTimestamp()
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Forced Sync on Boot (Self-Correction for Sincronizar button issues)
  // SEED ONLY IF EMPTY to save quota
  seedDatabase().catch(e => console.error("[Jan Sync] Error en arranque:", e));

  // Admin Config Endpoints
  app.post("/api/admin/upload", express.raw({ type: "*/*", limit: "50mb" }), async (req, res) => {
    const mimeType = req.headers["content-type"] || "application/octet-stream";
    const id = Math.random().toString(36).substring(7);
    mediaCache.set(id, { data: req.body, mimeType });
    
    let ext = "";
    if (mimeType.includes("image/jpeg")) ext = ".jpg";
    else if (mimeType.includes("image/png")) ext = ".png";
    else if (mimeType.includes("image/gif")) ext = ".gif";
    else if (mimeType.includes("image/webp")) ext = ".webp";
    else if (mimeType.includes("video/mp4")) ext = ".mp4";
    else if (mimeType.includes("video/webm")) ext = ".webm";
    else if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) ext = ".mp3";
    else if (mimeType.includes("audio/wav")) ext = ".wav";
    else if (mimeType.includes("audio/ogg") || mimeType.includes("audio/oga")) ext = ".ogg";
    else if (mimeType.includes("application/pdf")) ext = ".pdf";
    else if (mimeType.includes("msword")) ext = ".doc";
    else if (mimeType.includes("officedocument.wordprocessingml")) ext = ".docx";
    else if (mimeType.includes("ms-excel")) ext = ".xls";
    else if (mimeType.includes("officedocument.spreadsheetml")) ext = ".xlsx";
    else if (mimeType.includes("text/plain")) ext = ".txt";
    else if (mimeType.includes("zip")) ext = ".zip";
    else if (mimeType.includes("csv")) ext = ".csv";
    
    let protocol = req.headers["x-forwarded-proto"] || req.protocol;
    if (Array.isArray(protocol)) protocol = protocol[0];
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const baseUrl = currentAppUrl || process.env.APP_URL || `${protocol}://${host}`;
    
    res.json({ success: true, mediaId: id, url: `${baseUrl}/api/media/${id}${ext}` });
  });

  app.post("/api/admin/config", (req, res) => {
    res.json({ success: true, message: "Usando API Key del sistema." });
  });

  app.get("/api/admin/catalog", (req, res) => {
    try {
      const catalogPath = path.join(cwd, "src", "catalog.json");
      if (existsSync(catalogPath)) {
        const catalogData = JSON.parse(readFileSync(catalogPath, "utf-8"));
        return res.json(catalogData);
      }
      res.status(404).json({ error: "Catálogo no encontrado" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public/config", (req, res) => {
    res.json({
      whatsappNumber: process.env.TWILIO_FROM_NUMBER ? process.env.TWILIO_FROM_NUMBER.replace(/\D/g, '') : null
    });
  });

  app.post("/api/public/landing-order", express.json(), async (req, res) => {
    try {
      const { 
        storeId, 
        customerName, 
        customerPhone, 
        address, 
        addressIndicator, 
        city, 
        productName, 
        productId, 
        quantity, 
        totalPrice, 
        notes 
      } = req.body;

      const targetStoreId = storeId || "default";

      // 1. Fetch store config
      let storeConfig: any = {};
      try {
        const storeSnap = await getDoc(doc(db, "stores", targetStoreId));
        if (storeSnap.exists()) {
          storeConfig = storeSnap.data();
        }
      } catch (err) {
        console.error("[Landing Order] Error loading store config:", err);
      }

      // 2. Formulate order info
      const orderInfo: any = {
        storeId: targetStoreId,
        customerName: customerName || "No especificado",
        customerPhone: customerPhone || "No especificado",
        productName: productName || "No especificado",
        productId: productId || "manual",
        quantity: Number(quantity) || 1,
        totalPrice: Number(totalPrice) || 0,
        address: address || "No especificada",
        city: city || "No especificada",
        addressIndicator: addressIndicator || "N/A",
        notes: notes || "Pedido desde la Landing Page",
        origin: "landing",
        status: "pendiente",
        shopifyStatus: "no_enviado",
        dropiStatus: "no_enviado",
        createdAt: serverTimestamp()
      };

      // 3. Save order to DB
      const orderRef = await addDoc(collection(db, "orders"), orderInfo);
      const newOrderId = orderRef.id;
      orderInfo.id = newOrderId;
      console.log(`[Landing Order] Saved landing order successfully with ID: ${newOrderId}`);

      // 4. Handle Shopify Auto Sync
      if (storeConfig?.shopifyAutoSync && storeConfig?.shopifyDomain && storeConfig?.shopifyAccessToken) {
        console.log("[Landing Order] Shopify Auto Sync activo. Sincronizando pedido...");
        try {
          await pushOrderToShopify(newOrderId, orderInfo, storeConfig, db);
          console.log("[Landing Order] Pedido sincronizado con Shopify automáticamente.");
        } catch (shopErr: any) {
          console.error("[Landing Order] Error sincronizando con Shopify automáticamente:", shopErr.message);
          await updateDoc(doc(db, "orders", newOrderId), {
            shopifyStatus: "error",
            shopifyError: shopErr.message
          });
        }
      }

      // 5. Handle Dropi Auto Sync
      if (storeConfig?.dropiAutoSync && storeConfig?.dropiApiKey) {
        console.log("[Landing Order] Dropi Auto Sync activo. Sincronizando pedido...");
        try {
          await pushOrderToDropi(newOrderId, orderInfo, storeConfig, db);
          console.log("[Landing Order] Pedido sincronizado con Dropi automáticamente.");
        } catch (dropErr: any) {
          console.error("[Landing Order] Error sincronizando con Dropi automáticamente:", dropErr.message);
          await updateDoc(doc(db, "orders", newOrderId), {
            dropiStatus: "error",
            dropiError: dropErr.message
          });
        }
      }

      // 6. Formulate exciting Admin WhatsApp Notification
      const customMessage = `🚀 *¡NUEVO PEDIDO DESDE LA LANDING!* 🚀
Jan acaba de recibir una compra directa por formulario de Landing Page.

👤 *Cliente:* ${orderInfo.customerName}
📞 *Teléfono:* ${orderInfo.customerPhone}
📦 *Producto:* ${orderInfo.productName} (x${orderInfo.quantity})
📍 *Destino:* ${orderInfo.city}
🏠 *Dirección:* ${orderInfo.address}
🗺️ *Ref:* ${orderInfo.addressIndicator || 'N/A'}
💰 *Total:* $${(orderInfo.totalPrice || 0).toLocaleString()} COP *(Paga al recibir)*

_El pedido ya se guardó y está listo en tu tablero._`;

      // Modify the standard notification phone if config exists
      const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
      let adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
      if (storeConfig?.notificationPhone) {
        adminNumbers = [storeConfig.notificationPhone];
      }

      for (const num of adminNumbers) {
        try {
          const formattedNum = num.startsWith("whatsapp:") ? num : `whatsapp:${num}`;
          const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
          const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
          await sendWhatsApp(formattedNum, customMessage, undefined, undefined, formattedBotNum);
          console.log(`[Landing Order Notify] Admin ${formattedNum} notified successfully.`);
        } catch (notifyErr: any) {
          console.error(`[Landing Order Notify] Failed to notify ${num}:`, notifyErr.message);
        }
      }

      // 7. Return success
      res.status(200).json({ success: true, order: orderInfo });
    } catch (err: any) {
      console.error("[Landing Order Error] Failed to create order:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- SHOPIFY AND DROPI INTEGRATION ROUTES ---

  app.post("/api/integration/shopify/push-order", async (req, res) => {
    try {
      const { orderId, storeId } = req.body;
      if (!orderId || !storeId) {
        return res.status(400).json({ success: false, error: "Missing orderId or storeId" });
      }

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const orderData = orderSnap.data();

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();

      const shopifyOrder = await pushOrderToShopify(orderId, orderData, storeConfig, db);
      res.json({ success: true, message: "Pedido enviado exitosamente a Shopify.", shopifyOrderId: shopifyOrder.id.toString() });
    } catch (e: any) {
      console.error("[Shopify Push Error]", e);
      const errMsg = e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : e.message;
      res.status(500).json({ success: false, error: errMsg });
    }
  });

  app.post("/api/integration/dropi/push-order", async (req, res) => {
    try {
      const { orderId, storeId } = req.body;
      if (!orderId || !storeId) {
        return res.status(400).json({ success: false, error: "Missing orderId or storeId" });
      }

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const orderData = orderSnap.data();

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();

      const result = await pushOrderToDropi(orderId, orderData, storeConfig, db);
      res.json({ success: true, message: "Pedido enviado exitosamente a Dropi.", trackingNumber: result.tracking, dropiOrderId: result.dropiOrderId });
    } catch (e: any) {
      console.error("[Dropi Push Error]", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/integration/shopify/sync-products", async (req, res) => {
    try {
      const { storeId, direction } = req.body;
      if (!storeId || !direction) {
        return res.status(400).json({ success: false, error: "Missing storeId or direction" });
      }

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();
      const { shopifyDomain, shopifyAccessToken } = storeConfig;

      if (!shopifyDomain || !shopifyAccessToken) {
        return res.status(400).json({ success: false, error: "Shopify no configurado en los ajustes de esta tienda." });
      }

      const cleanDomain = shopifyDomain.replace(/https?:\/\//, '').trim();

      if (direction === "from_shopify") {
        console.log(`[Shopify Sync] Importando productos desde ${cleanDomain}...`);
        const response = await axios.get(`https://${cleanDomain}/admin/api/2024-01/products.json`, {
          headers: {
            "X-Shopify-Access-Token": shopifyAccessToken,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });

        const shopifyProducts = response.data.products || [];
        let count = 0;

        for (const sp of shopifyProducts) {
          const docId = `shopify_${sp.id}`;
          const prodData = {
            id: docId,
            name: sp.title,
            description: sp.body_html || "",
            price: parseFloat(sp.variants?.[0]?.price || "0"),
            stock: parseInt(sp.variants?.[0]?.inventory_quantity || "100"),
            currency: "COP",
            category: sp.product_type || "General",
            imageUrl: sp.images?.[0]?.src || "",
            storeId: storeId,
            createdAt: serverTimestamp()
          };

          await setDoc(doc(db, "products", docId), prodData);
          count++;
        }

        res.json({ success: true, count, message: `Se importaron ${count} productos correctamente de Shopify a tu catálogo.` });
      } else if (direction === "to_shopify") {
        console.log(`[Shopify Sync] Exportando catálogo a ${cleanDomain}...`);
        const qProd = query(collection(db, "products"), where("storeId", "==", storeId));
        const prodSnap = await getDocs(qProd);
        const localProducts: any[] = [];
        prodSnap.forEach((doc) => {
          localProducts.push({ id: doc.id, ...doc.data() });
        });

        if (localProducts.length === 0) {
          return res.status(400).json({ success: false, error: "No tienes productos en tu catálogo para exportar." });
        }

        let count = 0;
        for (const lp of localProducts) {
          const payload = {
            product: {
              title: lp.name,
              body_html: lp.description,
              product_type: lp.category || "General",
              variants: [
                {
                  price: lp.price.toString(),
                  inventory_quantity: lp.stock || 10,
                  inventory_management: "shopify"
                }
              ],
              images: lp.imageUrl ? [{ src: lp.imageUrl }] : []
            }
          };

          await axios.post(`https://${cleanDomain}/admin/api/2024-01/products.json`, payload, {
            headers: {
              "X-Shopify-Access-Token": shopifyAccessToken,
              "Content-Type": "application/json"
            },
            timeout: 10000
          });
          count++;
        }

        res.json({ success: true, count, message: `Se exportaron ${count} productos exitosamente a tu tienda de Shopify.` });
      } else {
        res.status(400).json({ success: false, error: "Dirección de sincronización inválida. Debe ser 'from_shopify' o 'to_shopify'." });
      }
    } catch (e: any) {
      console.error("[Shopify Sync Error]", e);
      const errMsg = e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : e.message;
      res.status(500).json({ success: false, error: errMsg });
    }
  });

  // ---------------------------------------------

  app.post("/api/admin/reset-db", async (req, res) => {
    try {
      // NOTE: Seeding is now handled CLIENT-SIDE in App.tsx via /api/admin/catalog
      // This endpoint is left as a successful no-op for backward compatibility.
      res.json({ success: true, message: "Base de datos lista para sincronización frontend." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

    // Twilio Status Webhook (Sent, Delivered, Read)
    app.post("/api/webhook/whatsapp/status", async (req, res) => {
      if (checkGlobalQuota()) {
        return res.sendStatus(200);
      }

      const { activityId } = req.query as { activityId: string };
      // Normalizing Twilio params (they can be in body or query depending on Twilio config)
      const status = req.body.MessageStatus || req.body.SmsStatus || req.query.MessageStatus;
      const actId = activityId || req.body.activityId;

      console.log(`[Twilio Status] Event: ${status} for Activity: ${actId}`);

      if (!actId) return res.sendStatus(200);

    try {
      const snap = await getDoc(doc(db, "activities", actId));
      if (!snap.exists()) return res.sendStatus(200);

      let mappedStatus: string = "";
      
      switch (status) {
        case 'read': mappedStatus = 'read'; break;
        case 'delivered': mappedStatus = 'delivered'; break;
        case 'sent': mappedStatus = 'sent'; break;
        case 'failed':
        case 'undelivered': mappedStatus = 'failed'; break;
      }

      if (mappedStatus) {
        const existingStatus = snap.data()?.whatsappStatus;
        if (existingStatus !== mappedStatus) {
          await updateDoc(doc(db, "activities", actId), { 
            whatsappStatus: mappedStatus,
            statusUpdateAt: serverTimestamp()
          });
          console.log(`[Twilio Status] Successfully updated Activity ${actId} to ${mappedStatus}`);
        } else {
          console.log(`[Twilio Status] Status for Activity ${actId} is already ${mappedStatus}. Skipping update.`);
        }
      }
    } catch (e: any) {
        console.error("[Twilio Status][Error] Update failed:", e.message);
      }
      
      res.sendStatus(200);
  });

  // Meta (Instagram & Messenger) Webhook Verification (GET)
  app.get("/api/webhook/instagram", (req, res) => {
    console.log("[Instagram Webhook] Verification request received");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // The user provided "JAN_SEL_SECRET"
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "JAN_SEL_SECRET";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Instagram Webhook] Verified successfully!");
      res.status(200).header("Content-Type", "text/plain").send(challenge);
    } else {
      console.error("[Instagram Webhook] Verification failed. Expected:", VERIFY_TOKEN, "Got:", token);
      res.sendStatus(403);
    }
  });

  app.get("/api/webhook/messenger", (req, res) => {
    console.log("[Messenger Webhook] Verification request received");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "JAN_SEL_SECRET";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Messenger Webhook] Verified successfully!");
      res.status(200).header("Content-Type", "text/plain").send(challenge);
    } else {
      console.error("[Messenger Webhook] Verification failed. Expected:", VERIFY_TOKEN, "Got:", token);
      res.sendStatus(403);
    }
  });

  // Meta Webhook Receivers (POST)
  app.post("/api/webhook/instagram", async (req, res) => {
    console.log("[Instagram Webhook] Received notification:", JSON.stringify(req.body));
    
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (messaging && messaging.message && !messaging.message.is_echo) {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;
      
      console.log(`[Instagram Webhook] Message from ${senderId}: ${messageText}`);
      
      const assignedStoreId = await determineStoreId(senderId, messageText);
      const activityData = {
        from: senderId,
        to: entry.id, // Page ID
        recipient: senderId,
        customerPhone: senderId,
        storeId: assignedStoreId,
        message: messageText,
        platform: "instagram",
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      try {
        const activityRef = await addDoc(collection(db, "activities"), activityData);
        processInferenceOnServer(activityRef.id, activityData).catch(e => {
          console.error(`[Meta AI] Error processing Instagram message:`, e.message);
        });
      } catch (e: any) {
        console.error("[Meta Webhook] Error registering activity:", e.message);
      }
    }
    
    res.sendStatus(200);
  });

  app.post("/api/webhook/messenger", async (req, res) => {
    console.log("[Messenger Webhook] Received notification:", JSON.stringify(req.body));
    
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (messaging && messaging.message && !messaging.message.is_echo) {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;
      
      console.log(`[Messenger Webhook] Message from ${senderId}: ${messageText}`);
      
      const assignedStoreId = await determineStoreId(senderId, messageText);
      const activityData = {
        from: senderId,
        to: entry.id, // Page ID
        recipient: senderId,
        customerPhone: senderId,
        storeId: assignedStoreId,
        message: messageText,
        platform: "messenger",
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      try {
        const activityRef = await addDoc(collection(db, "activities"), activityData);
        processInferenceOnServer(activityRef.id, activityData).catch(e => {
          console.error(`[Meta AI] Error processing Messenger message:`, e.message);
        });
      } catch (e: any) {
        console.error("[Meta Webhook] Error registering activity:", e.message);
      }
    }
    
    res.sendStatus(200);
  });

  // Twilio Webhook
  app.post("/api/webhook/whatsapp", async (req, res) => {
    if (checkGlobalQuota()) {
      return res.status(200).send(""); // Early exit
    }

    detectCurrentUrl(req);
    // Log incoming body for debugging
    console.log("[WhatsApp Webhook] Received call. Body keys:", Object.keys(req.body));
    console.log("[WhatsApp Webhook] Incoming From:", req.body?.From, "To:", req.body?.To);

    const from = req.body?.From || req.body?.from;
    const to = req.body?.To || req.body?.to;
    const messageBody = req.body?.Body || req.body?.body || "";
    const numMedia = parseInt(req.body?.NumMedia || req.body?.numMedia || "0");

    if (!from || !to) {
      console.warn("[WhatsApp Webhook] Missing From/To. Body:", JSON.stringify(req.body));
      return res.status(200).send(""); 
    }

    // IGNORE STATUS CALLBACKS ON INCOMING WEBHOOK (prevents infinite loops if misconfigured in Twilio)
    // Twilio includes SmsStatus: 'received' for incoming messages, so we check for other statuses.
    const isStatusCallback = (req.body?.MessageStatus || (req.body?.SmsStatus && req.body.SmsStatus !== "received")) && !req.body?.Body;
    
    if (isStatusCallback) {
       console.log(`[WhatsApp Webhook] Received status callback on incoming webhook for ${from}. Ignoring.`);
       return res.status(200).send("");
    }

    // IGNORE MESSAGES FROM SELF (TWILIO ECHOES OR LOOPBACKS)
    const normBot = normalizePhone(TWILIO_FROM_NUMBER || "+14155238886");
    const normTo = normalizePhone(to);
    const normFrom = normalizePhone(from);

    if (normFrom === normBot || normFrom === normTo) {
      console.log(`[WhatsApp Webhook] Ignoring loopback message from bot (${normFrom})`);
      return res.status(200).send("");
    }
    
    // ANTI SPAM
    if (!canReply(normFrom)) {
      console.warn(`[WhatsApp Webhook] Anti-spam: Ignorando mensajes múltiples de ${normFrom}`);
      return res.status(200).send("");
    }

    // ==============================================
    // 🔘 RESPUESTA A BOTONES INTERACTIVOS (MENÚS Y CONFIRMACIÓN)
    // ==============================================
    // Si el cliente tocó un botón, Twilio manda ButtonPayload con el id que definimos.
    // Esto es 100% determinístico: no pasa por la IA, garantizando velocidad y precisión.
    const buttonPayload = req.body?.ButtonPayload;
    if (buttonPayload) {
      try {
        const cleanFrom = from.replace('whatsapp:', '').trim();
        const assignedStoreId = await determineStoreId(cleanFrom, messageBody || "", to);
        const customerProfileId = `${assignedStoreId}_${cleanFrom}`;
        const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
        const customerData = cxSnap.exists() ? cxSnap.data() : null;
        const pending = customerData?.pendingConfirmation;

        await cancelPendingFollowUps(from, assignedStoreId);

        if (buttonPayload === CONFIRM_YES_ID) {
          if (pending && pending.jsonResponse) {
            let storeConfig: any = {};
            const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
            if (storeSnap.exists()) storeConfig = storeSnap.data();
            const products = await loadProductsForStore(assignedStoreId);

            await finalizeOrder(pending.jsonResponse, storeConfig, customerData, cleanFrom, assignedStoreId, products, db);
            await updateDoc(doc(db, "customers", customerProfileId), { pendingConfirmation: null });
            await sendWhatsApp(from, "¡Listo! 🎉 Tu pedido quedó confirmado, ya te lo estamos alistando. ¡Gracias por tu compra!", undefined, undefined, to);
          } else {
            await sendWhatsApp(from, "No encontramos ningún pedido pendiente de confirmación. 😊 ¿En qué más te puedo ayudar?", undefined, undefined, to);
          }
        } else if (buttonPayload === CONFIRM_NO_ID) {
          await updateDoc(doc(db, "customers", customerProfileId), { pendingConfirmation: null });
          await sendWhatsApp(from, "Tranqui, no confirmé nada todavía 🙂 Contame qué querés cambiar y seguimos.", undefined, undefined, to);
        } else if (buttonPayload === "MENU_CATALOG") {
          await sendCategoriesMenu(from, to);
        } else if (buttonPayload === "MENU_HUMAN") {
          await updateDoc(doc(db, "customers", customerProfileId), { etapa: "asesoria_solicitada" });
          
          // Notificar a los administradores
          const adminMessage = `🚨 *ASESORÍA HUMANA SOLICITADA*
Cliente: ${customerData?.name || cleanFrom} (${cleanFrom})
Solicitado haciendo click en el botón "Hablar con Asesor" 🙋‍♂️.`;
          
          const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
          const adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
          for (const num of adminNumbers) {
            try {
              const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
              await sendWhatsApp(target, adminMessage);
            } catch (e) {
              console.error("[Server AI] Error notificando asesoría de botón:", e);
            }
          }
          await sendWhatsApp(from, "¡Perfecto! Ya le he avisado a un asesor humano 🙋‍♂️. Te escribirá en un momento. Mientras tanto, si tienes otra duda, puedes escribirme por acá. 😊", undefined, undefined, to);
        } else if (buttonPayload === "MENU_END" || buttonPayload === "CHAT_END") {
          await updateDoc(doc(db, "customers", customerProfileId), { 
            pendingConfirmation: null,
            etapa: "finalizado",
            score: 0 
          });
          await sendWhatsApp(from, "¡Fue un gusto ayudarte! 😊 Una vez vuelvas a escribir, iniciaremos una nueva conversación. ¡Te espero de regreso! 👋", undefined, undefined, to);
        } else if (buttonPayload === "CHAT_KEEP") {
          await sendWhatsApp(from, "¡Súper! Dime en qué más te puedo colaborar hoy o qué producto estás buscando. 🔎", undefined, undefined, to);
        } else if (buttonPayload === "CAT_TECH") {
          await sendCategoryFeaturedProducts(from, to, "tecnologia", "Tecnología 💻", assignedStoreId);
        } else if (buttonPayload === "CAT_HOME") {
          await sendCategoryFeaturedProducts(from, to, "hogar", "Hogar, Cocina y Aseo 🧼", assignedStoreId);
        } else if (buttonPayload === "CAT_OTHER") {
          await sendOtherCategoriesMenu(from, to);
        } else if (buttonPayload === "CAT_AUTOS") {
          await sendCategoryFeaturedProducts(from, to, "autos", "Autos y Herramientas 🚗", assignedStoreId);
        } else if (buttonPayload === "CAT_BEAUTY") {
          await sendCategoryFeaturedProducts(from, to, "belleza", "Salud y Belleza 🧴", assignedStoreId);
        } else if (buttonPayload === "MENU_BACK") {
          await sendMainMenu(from, to);
        } else {
          console.warn(`[WhatsApp Webhook] ButtonPayload desconocido: ${buttonPayload}`);
        }

        return res.status(200).send("");
      } catch (e: any) {
        console.error("[WhatsApp Webhook] Error procesando ButtonPayload:", e.message);
      }
    }

    // Dynamic URL detection for status callbacks
    if (!currentAppUrl) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      const proto = req.headers["x-forwarded-proto"] || "https";
      currentAppUrl = `${proto}://${host}`;
      console.log(`[Twilio Webhook] Detected APP_URL: ${currentAppUrl}`);
    }

    console.log(`[WhatsApp Webhook] Incoming from ${from} to ${to}: ${messageBody}`);

    // EXRACT MEDIA IF ANY
    let finalMessage = messageBody;
    const mediaItems: { data: string, mimeType: string }[] = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mUrl = req.body[`MediaUrl${i}`];
        try {
          const mediaItem = await downloadMediaAsBase64(mUrl);
          if (mediaItem) {
            mediaItems.push(mediaItem);
            const mediaId = Math.random().toString(36).substring(7) + Date.now().toString(36);
            mediaCache.set(mediaId, {
              data: Buffer.from(mediaItem.data, 'base64'),
              mimeType: mediaItem.mimeType
            });
            let extension = "";
            if (mediaItem.mimeType.includes("image/jpeg")) extension = ".jpg";
            else if (mediaItem.mimeType.includes("image/png")) extension = ".png";
            else if (mediaItem.mimeType.includes("image/gif")) extension = ".gif";
            else if (mediaItem.mimeType.includes("image/webp")) extension = ".webp";
            else if (mediaItem.mimeType.includes("video/mp4")) extension = ".mp4";
            else if (mediaItem.mimeType.includes("video/webm")) extension = ".webm";
            else if (mediaItem.mimeType.includes("audio/mpeg") || mediaItem.mimeType.includes("audio/mp3")) extension = ".mp3";
            else if (mediaItem.mimeType.includes("audio/wav")) extension = ".wav";
            else if (mediaItem.mimeType.includes("audio/ogg") || mediaItem.mimeType.includes("audio/oga")) extension = ".ogg";
            else if (mediaItem.mimeType.includes("application/pdf")) extension = ".pdf";
            else if (mediaItem.mimeType.includes("msword")) extension = ".doc";
            else if (mediaItem.mimeType.includes("wordprocessingml")) extension = ".docx";
            else if (mediaItem.mimeType.includes("ms-excel")) extension = ".xls";
            else if (mediaItem.mimeType.includes("spreadsheetml")) extension = ".xlsx";
            else if (mediaItem.mimeType.includes("text/plain")) extension = ".txt";
            else if (mediaItem.mimeType.includes("zip")) extension = ".zip";
            else if (mediaItem.mimeType.includes("csv")) extension = ".csv";
            else if (mediaItem.mimeType.includes("audio")) extension = ".ogg";
            else extension = ".jpg";
            let baseUrl = currentAppUrl || process.env.APP_URL || `https://${req.headers.host}`;
            const proxiedUrl = `${baseUrl.replace(/\/$/, '')}/api/media/${mediaId}${extension}`;
            finalMessage += ` [Media: ${proxiedUrl}]`;
          } else {
             finalMessage += ` [Media original Twilio: ${mUrl}]`;
          }
        } catch (e) {
          console.error(`[Webhook Media] Could not cache media ${mUrl}`, e);
          finalMessage += ` [Media: ${mUrl}]`;
        }
      }
    }

    // LOG IMMEDIATELY
    try {
      const cleanFrom = from.replace('whatsapp:', '').trim();
      let assignedStoreId = await determineStoreId(cleanFrom, finalMessage, to);

      // CANCEL ANY PENDING FOLLOW-UP BECAUSE CLIENT RESPONDED
      await cancelPendingFollowUps(from, assignedStoreId);

      const activityData = {
        from,
        to,
        recipient: from, // THE CUSTOMER is always the recipient/thread-ID
        customerPhone: cleanFrom,
        botNumber: to,   // Store which bot number received this
        storeId: assignedStoreId,
        message: finalMessage,
        mediaUrl: mediaItems.length > 0 ? mediaItems.map((_, i) => req.body[`MediaUrl${i}`]).join(",") : null,
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };
      
      const activityRef = await addDoc(collection(db, "activities"), activityData);
      console.log(`[Activity] Registered: ${activityRef.id}. Bot receiving: ${to}`);

      // Deterministic message processing & Interceptors (bypasses LLM for maximum performance & reliability)
      const cleanMsg = (finalMessage || "").toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

      const customerProfileId = `${assignedStoreId}_${cleanFrom}`;
      const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
      const customerData = cxSnap.exists() ? cxSnap.data() : null;

      // ==============================================
      // 1. ACTIVE CHECKOUT STATE MACHINE (DETERMINISTIC)
      // ==============================================
      if (customerData && customerData.checkoutStep && from.startsWith("whatsapp:")) {
        const currentStep = customerData.checkoutStep;
        const checkoutData = customerData.checkoutData || {};

        console.log(`[Checkout State Machine] Client ${cleanFrom} in step: ${currentStep}. Msg: ${finalMessage}`);

        // Allow cancel or back
        if (["cancelar", "cancelar pedido", "cancelar compra", "salir", "atras"].some(k => cleanMsg === k || cleanMsg.includes(k))) {
          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: null,
            checkoutData: null,
            etapa: "interesado"
          }, { merge: true });
          await sendWhatsApp(from, `¡Listo, parce! Cancelamos tu proceso de compra. 🙂 ¿En qué más te puedo colaborar hoy?`, undefined, activityRef.id, to);
          await new Promise(resolve => setTimeout(resolve, 800));
          await sendMainMenu(from, to);
          return res.status(200).send("");
        }

        if (currentStep === "producto") {
          checkoutData.producto = finalMessage;
          
          let matchedPrice = 0;
          const products = await loadProductsForStore(assignedStoreId);
          const match = products.find((p: any) =>
            (p.name && p.name.toLowerCase().includes(finalMessage.toLowerCase())) ||
            (p.name && finalMessage.toLowerCase().includes(p.name.toLowerCase()))
          );
          if (match && match.price) {
            matchedPrice = match.price;
            checkoutData.producto = match.name;
          }
          checkoutData.valor = matchedPrice;

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "nombre",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Perfecto! Vamos a registrar tu pedido para: *${checkoutData.producto}*. 📦\n\nAhora, por favor dime tu *Nombre y Apellido completo* para la guía de envío de tu pedido: 📝`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "nombre") {
          checkoutData.nombre = finalMessage;

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "telefono",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Mucho gusto, *${finalMessage}*! 🤝 ¿A qué *número de teléfono* te puede contactar la transportadora si hay alguna novedad? \n\n✍️ Escríbelo, o responde con la palabra *mismo* para usar tu número de WhatsApp actual (${cleanFrom}) 📞`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "telefono") {
          let phoneVal = finalMessage.trim();
          if (["mismo", "el mismo", "este mismo", "este"].some(k => cleanMsg.includes(k))) {
            phoneVal = cleanFrom;
          }
          checkoutData.telefono = phoneVal;

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "ciudad",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Listo! Quedó registrado el número *${phoneVal}*. \n\nAhora contame: ¿A qué *ciudad, municipio o corregimiento* y de qué *departamento* enviamos tu pedido? (Acuérdate de que el envío es GRATIS a toda Colombia) 🇨🇴`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "ciudad") {
          checkoutData.ciudad = finalMessage;

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "direccion",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Entendido! ¿Cuál es tu *dirección exacta de entrega*? (Por favor incluye calle, carrera, número de casa, apartamento, torre o barrio para que no haya demoras) 🏠`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "direccion") {
          checkoutData.direccion = finalMessage;

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "referencia",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Súper! Para que la transportadora entregue volando y sin enredos, ¿tienes alguna *indicación o referencia adicional*? \n\n📍 (Ej: "casa de rejas blancas", "frente al parque", "entregar en portería", o escribe *ninguna* si no aplica) 👇`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "referencia") {
          checkoutData.referencia = finalMessage;

          if (!checkoutData.valor || checkoutData.valor <= 0) {
            const products = await loadProductsForStore(assignedStoreId);
            const checkProd = (checkoutData.producto || "").toLowerCase();
            const match = products.find((p: any) =>
              (p.name && p.name.toLowerCase().includes(checkProd)) ||
              (p.name && checkProd.includes(p.name.toLowerCase()))
            );
            if (match && match.price) checkoutData.valor = match.price;
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "confirmacion",
            checkoutData: checkoutData,
            pendingConfirmation: {
              jsonResponse: {
                accion: "confirmar_pedido",
                producto: checkoutData.producto,
                datos_pedido: {
                  nombre: checkoutData.nombre,
                  telefono: checkoutData.telefono,
                  ciudad: checkoutData.ciudad,
                  direccion: checkoutData.direccion,
                  referencia: checkoutData.referencia,
                  valor: checkoutData.valor,
                  notas: `Pedido capturado por flujo determinístico de Checkout.`
                }
              },
              storeId: assignedStoreId,
              createdAt: serverTimestamp()
            }
          }, { merge: true });

          const fakeJsonResponse = {
            producto: checkoutData.producto,
            datos_pedido: {
              valor: checkoutData.valor,
              direccion: checkoutData.direccion,
              ciudad: checkoutData.ciudad
            }
          };

          const summaryText = `🚨 *RESUMEN DE TU PEDIDO* 🚨\n\n📦 *Producto:* ${checkoutData.producto}\n💵 *Total a Pagar:* $${Number(checkoutData.valor || 0).toLocaleString("es-CO")} *(Pagas al recibir)*\n👤 *Nombre:* ${checkoutData.nombre}\n📞 *Teléfono:* ${checkoutData.telefono}\n🇨🇴 *Destino:* ${checkoutData.ciudad}\n🏠 *Dirección:* ${checkoutData.direccion}\n📍 *Referencia:* ${checkoutData.referencia}\n\n🔥 *¡El envío es 100% GRATIS!*`;
          await sendWhatsApp(from, summaryText, undefined, activityRef.id, to);

          await new Promise(resolve => setTimeout(resolve, 1200));

          const buttonsSent = await sendOrderConfirmationButtons(from, to, fakeJsonResponse);
          if (!buttonsSent) {
            await sendWhatsApp(from, `¿Confirmas que todos tus datos están correctos para proceder con el despacho? Escribe *SÍ* para confirmar o *NO* para corregir.`, undefined, activityRef.id, to);
          }

          return res.status(200).send("");
        }

        if (currentStep === "confirmacion") {
          const normConfirm = cleanMsg.replace(/[^a-z]/g, "");
          if (["si", "sii", "sigo", "correcto", "confirmar", "confirmo", "deuna", "dale", "yes"].some(k => normConfirm === k || normConfirm.startsWith(k))) {
            const pending = customerData.pendingConfirmation;
            if (pending && pending.jsonResponse) {
              let storeConfig: any = {};
              const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
              if (storeSnap.exists()) storeConfig = storeSnap.data();
              const products = await loadProductsForStore(assignedStoreId);

              await finalizeOrder(pending.jsonResponse, storeConfig, customerData, cleanFrom, assignedStoreId, products, db);
              await setDoc(doc(db, "customers", customerProfileId), { 
                pendingConfirmation: null, 
                checkoutStep: null, 
                checkoutData: null,
                etapa: "finalizado"
              }, { merge: true });
              
              await sendWhatsApp(from, "¡Listo! 🎉 Tu pedido quedó confirmado, ya te lo estamos alistando para despacho hoy mismo. ¡Muchísimas gracias por confiar en Jan Sel Shop! 👋", undefined, activityRef.id, to);
            } else {
              await sendWhatsApp(from, "No encontramos ningún pedido pendiente de confirmación. 😊 ¿En qué más te puedo colaborar?", undefined, activityRef.id, to);
            }
            return res.status(200).send("");
          } else if (["no", "cancelar", "cambiar", "corregir", "incorrecto"].some(k => normConfirm === k || normConfirm.startsWith(k))) {
            await setDoc(doc(db, "customers", customerProfileId), { 
              pendingConfirmation: null, 
              checkoutStep: null, 
              checkoutData: null,
              etapa: "interesado"
            }, { merge: true });
            await sendWhatsApp(from, "Tranqui, no he confirmado nada todavía 🙂 Dime qué deseas cambiar o qué producto estás buscando y lo ajustamos.", undefined, activityRef.id, to);
            return res.status(200).send("");
          }
        }
      }

      // ==============================================
      // 2. BUY INTENT DETECTOR & CHECKOUT START (DETERMINISTIC)
      // ==============================================
      const isBuyIntent = [
        "quiero comprar", "comprar", "hacer pedido", "hacer el pedido", "ordenar", 
        "me interesa comprar", "hacer un pedido", "quiero pedir", "quiero ordenar", 
        "hacer la compra", "pedir", "compra"
      ].some(k => cleanMsg.includes(k)) || 
      (cleanMsg.startsWith("quiero ") && (cleanMsg.includes("el ") || cleanMsg.includes("la ") || cleanMsg.includes("un ") || cleanMsg.includes("una ")) && !cleanMsg.includes("saber") && !cleanMsg.includes("preguntar") && !cleanMsg.includes("info") && !cleanMsg.includes("foto"));

      if (isBuyIntent && from.startsWith("whatsapp:")) {
        let matchedProduct = "";
        const productKeywords = [
          { kw: "modem", name: "Módem Wifi Portátil Pro" },
          { kw: "retrovisor", name: "Espejo Retrovisor Cámara Dual" },
          { kw: "intercomunicador", name: "Intercomunicador Y10" },
          { kw: "soporte", name: "Soporte de Carga Magnética" },
          { kw: "funda", name: "Funda Protectora para Moto" },
          { kw: "destornillador", name: "Destornillador Atornillador Eléctrico" },
          { kw: "frontal", name: "Linterna Frontal" },
          { kw: "linterna", name: "Linterna Multipropósito" },
          { kw: "camping", name: "Bombillo para Camping Recargable" },
          { kw: "ever brite", name: "Lámpara LED Sensor Ever Brite" },
          { kw: "candado", name: "Candado con Alarma" },
          { kw: "compresor", name: "Compresor / Inflador" },
          { kw: "hidrolavadora", name: "Hidrolavadora inalámbrica" },
          { kw: "aspiradora", name: "Aspiradora para carro" },
          { kw: "cargador", name: "Cargador/Accesorio para celular" }
        ];
        for (const pk of productKeywords) {
          if (cleanMsg.includes(pk.kw)) {
            matchedProduct = pk.name;
            break;
          }
        }
        
        console.log(`[WhatsApp Checkout Trigger] Buying intent detected. Product: ${matchedProduct || "none"}. Starting checkout flow...`);
        await startCheckoutFlow(from, cleanFrom, to, assignedStoreId, matchedProduct);
        return res.status(200).send("");
      }

      // ==============================================
      // 3. CATALOG REQUEST INTERCEPTOR (DETERMINISTIC)
      // ==============================================
      const isCatalogRequest = [
        "que productos tienen",
        "que productos tienes",
        "que productos venden",
        "que producto tiene",
        "que productos hay",
        "catalogo",
        "ver catalogo",
        "ver productos",
        "portafolio",
        "lista de productos",
        "inventario",
        "que venden",
        "que vende",
        "que tiene",
        "que tienen",
        "productos destacados",
        "mejores productos",
        "top 15",
        "que vendes",
        "mostrar catalogo",
        "enviar catalogo",
        "mandar catalogo",
        "lista de precios"
      ].some(k => cleanMsg.includes(k)) || 
      (cleanMsg.includes("producto") && (cleanMsg.includes("que") || cleanMsg.includes("cual") || cleanMsg.includes("ver") || cleanMsg.includes("mostrar") || cleanMsg.includes("tienen") || cleanMsg.includes("tienes")));

      if (isCatalogRequest && from.startsWith("whatsapp:")) {
        console.log(`[WhatsApp Interceptor] Catalog request detected from ${from}. Replying deterministically with Top 15...`);
        
        const TOP_15_CATALOG_MESSAGE = `¡Qué más parce! 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\nTe cuento que aquí tenemos un catálogo gigante con *más de 360 productos espectaculares* para vos. ¡Cualquier cosa que busques o te imagines, te la conseguimos de una! 🚀\n\nY acordate de lo mejor:\n🔥 *ENVÍO GRATIS A TODA COLOMBIA* 🇨🇴\n🚛 *PAGO CONTRA ENTREGA* (Pagas solo cuando recibes en la puerta de tu casa)\n\nPara que no te compliques, aquí tienes nuestro *TOP 15 de Joyas Más Vendidas y Recomendadas* por nuestros clientes en todo el país:\n\n1. 🥇 *Módem Wifi Portátil Pro* 📶\n   💵 Hoy en solo: *$119.900* (Antes ~~165.000~~)\n2. 🥈 *Espejo Retrovisor Cámara Dual* 🚗\n   💵 Hoy en solo: *$139.900* (Antes ~~195.000~~)\n3. 🥉 *Intercomunicador Y10 para Moto* 🏍️\n   💵 Hoy en solo: *$149.900* (Antes ~~210.000~~)\n4. ⚡ *Soporte de Carga Magnética Vehicular* 📱\n   💵 Hoy en solo: *$59.900* (Antes ~~85.000~~)\n5. 🏍️ *Funda Protectora Premium para Moto* 🌧️\n   💵 Hoy en solo: *$49.900* (Antes ~~75.000~~)\n6. 🪛 *Destornillador Atornillador Eléctrico* 🛠️\n   💵 Hoy en solo: *$69.900* (Antes ~~100.000~~)\n7. 🔦 *Linterna Frontal Recargable de Cabeza* 👷\n   💵 Hoy en solo: *$39.900* (Antes ~~60.000~~)\n8. 🔦 *Linterna Multipropósito de Alta Potencia* ⚡\n   💵 Hoy en solo: *$44.900* (Antes ~~65.000~~)\n9. 🏕️ *Bombillo para Camping Recargable* 💡\n   💵 Hoy en solo: *$34.900* (Antes ~~50.000~~)\n10. 💡 *Lámpara LED con Sensor Solar Ever Brite* ☀️\n    💵 Hoy en solo: *$49.900* (Antes ~~70.000~~)\n11. 🔐 *Candado Inteligente con Alarma 110dB* 🚨\n    💵 Hoy en solo: *$54.900* (Antes ~~80.000~~)\n12. 💨 *Compresor / Inflador Digital Portátil* 🚲\n    💵 Hoy en solo: *$109.900* (Antes ~~155.000~~)\n13. 🚿 *Hidrolavadora Inalámbrica Recargable* 💦\n    💵 Hoy en solo: *$129.900* (Antes ~~185.000~~)\n14. 🧹 *Aspiradora Portátil de Alta Succión* 🏎️\n    💵 Hoy en solo: *$59.900* (Antes ~~90.000~~)\n15. 🔌 *Cargador Súper Rápido Dual para Carro* ⚡\n    💵 Hoy en solo: *$29.900* (Antes ~~45.000~~)\n\n⚠️ *¡Últimas unidades disponibles con esta oferta de locura!*`;

        const TOP_15_CATALOG_MESSAGE_2 = `👀 *¡Revisa el catálogo interactivo y toca el botón que necesites!*\n\nAquí abajo te dejo nuestras categorías más vendidas para que navegues de una. Si estás buscando algún otro artículo específico (marca, modelo, tipo de producto), ¡escribilo acá mismo en el chat y yo de inmediato te confirmo disponibilidad y precio! 🛒👇`;

        await sendWhatsApp(from, TOP_15_CATALOG_MESSAGE, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendWhatsApp(from, TOP_15_CATALOG_MESSAGE_2, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendCategoriesMenu(from, to);

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: TOP_15_CATALOG_MESSAGE + "\n\n" + TOP_15_CATALOG_MESSAGE_2,
          respondedAt: serverTimestamp()
        });

        await setDoc(doc(db, "customers", customerProfileId), {
          etapa: "explorando_catalogo",
          intencion: "ver_catalogo",
          score: 25,
          lastInteractionAt: serverTimestamp()
        }, { merge: true });

        return res.status(200).send("");
      }

      // ==============================================
      // 4. GREETING / WELCOME INTERCEPTOR (DETERMINISTIC)
      // ==============================================
      const greetingWords = [
        "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", 
        "que tal", "alo", "buen dia", "saludos", "epale", "parce", "oe", "que mas"
      ];
      const isGreeting = (cleanMsg.length <= 15 && greetingWords.some(w => cleanMsg === w || cleanMsg.startsWith(w))) ||
                         (cleanMsg.length <= 25 && (cleanMsg === "hola buenas" || cleanMsg === "hola buenos dias" || cleanMsg === "hola buen dia"));

      if (isGreeting && from.startsWith("whatsapp:")) {
        console.log(`[WhatsApp Greeting Interceptor] Greeting detected from ${from}. Replying deterministically...`);
        
        const WELCOME_MESSAGE = `¡Qué más parce! 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\n¿Cómo vas? Contame en qué te puedo colaborar hoy o qué estás buscando de nuestro catálogo. ¡Aquí abajo te dejo unas opciones rápidas para empezar de una! 👇`;
        
        await sendWhatsApp(from, WELCOME_MESSAGE, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendMainMenu(from, to);

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: WELCOME_MESSAGE,
          respondedAt: serverTimestamp()
        });
        
        await setDoc(doc(db, "customers", customerProfileId), {
          etapa: "interesado",
          lastInteractionAt: serverTimestamp()
        }, { merge: true });
        
        return res.status(200).send("");
      }

      // TRIGGER SERVER-SIDE INFERENCE IMMEDIATELY
      processInferenceOnServer(activityRef.id, { ...activityData, mediaItems, NumMedia: numMedia }).catch(e => {
        console.error(`[Server Inference] Fatal error during async execution:`, e.message);
      });

    } catch (e: any) {
      console.warn("[Activity] Registration failed:", e.message);
    }

    // 1. ACKNOWLEDGE TWILIO IMMEDIATELY
    res.status(200).send("");
  });

  app.post("/api/admin/test-notify", express.json(), async (req, res) => {
    try {
      const { storeId } = req.body;
      let storeConfig = null;
      if (storeId) {
        const snap = await getDoc(doc(db, "stores", storeId));
        if (snap.exists()) storeConfig = snap.data();
      }

      const mockOrder = {
        customerName: "Cliente de Prueba",
        productName: "Producto Demo Premium",
        quantity: 1,
        address: "Calle de las Rosas #123",
        city: "Bogotá",
        totalPrice: 159900
      };
      await notifyAdmins(mockOrder, storeConfig?.name || "Test Store", storeConfig);
      res.json({ success: true, message: "Prueba enviada a los jefes." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/cache-media", express.json({ limit: '50mb' }), (req, res) => {
    detectCurrentUrl(req);
    const { data, mimeType } = req.body;
    if (!data || !mimeType) return res.status(400).json({ error: "Missing data" });
    const id = Math.random().toString(36).substring(7);
    mediaCache.set(id, {
      data: Buffer.from(data, 'base64'),
      mimeType: mimeType
    });
    let baseUrl = currentAppUrl || (req.headers.origin && !req.headers.origin.includes('localhost') ? req.headers.origin : process.env.APP_URL);
    if (!baseUrl) {
      console.warn("[Media Cache] No absolute base URL found, Twilio might fail to download this media.");
      baseUrl = "";
    }
    const extension = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '.mp3';
    const url = baseUrl ? `${baseUrl}/api/media/${id}${extension}` : `/api/media/${id}${extension}`;
    console.log(`[Media Cache] Stored media at URL: ${url}`);
    res.json({ id, url });
  });

  app.get("/api/admin/recovery-leads", async (req, res) => {
    try {
      const { storeId } = req.query;
      const q = query(
        collection(db, "activities"),
        where("storeId", "==", storeId),
        where("status", "==", "recibido"),
        orderBy("timestamp", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ success: true, leads });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/send-message", async (req, res) => {
    detectCurrentUrl(req);
    const { to, message, mediaUrl, from: requestedFrom, platform, pageId } = req.body;

    if (!to || (!message && !mediaUrl)) {
      console.warn("[Admin Send] Validation failed");
      return res.status(400).json({ success: false, error: "Missing data" });
    }

    try {
      const isMeta = platform === 'instagram' || platform === 'messenger';
      
      const cleanTo = (!isMeta && to.startsWith("whatsapp:")) ? to : (!isMeta ? `whatsapp:${to}` : to);
      const customerPhone = cleanTo.replace("whatsapp:", "").trim();
      
      // We set from to the page id or twilio number based on platform
      const finalFrom = isMeta ? (pageId || "meta-page") : (requestedFrom || TWILIO_FROM_NUMBER || "whatsapp:+14155238886");

      console.log(`[Admin] Sending FROM ${finalFrom} TO ${to} (Platform: ${platform || 'whatsapp'}).`);
      
      // CRITICAL: Ensure Jan never talks to himself (only for WA)
      if (!isMeta && cleanTo === (finalFrom.startsWith("whatsapp:") ? finalFrom : `whatsapp:${finalFrom}`)) {
        console.warn("[Admin] Bot attempted to send message to itself. Blocked.");
        return res.status(400).json({ success: false, error: "Cannot send to self" });
      }

      // Log activity
      const activityRef = await addDoc(collection(db, "activities"), {
        from: finalFrom, 
        to: cleanTo, 
        recipient: cleanTo,
        message: (message || "") + (mediaUrl && !message?.includes(mediaUrl) ? `${message ? '\n\n' : ''}[Media: ${mediaUrl}]` : (!message ? "[Media enviado]" : "")),
        status: "respondido",
        mediaUrl: mediaUrl || null,
        platform: platform || 'whatsapp',
        whatsappStatus: isMeta ? "sent" : "sending",
        senderType: 'agent',
        manualAgent: "Asesor Humano",
        timestamp: serverTimestamp(),
        customerPhone: customerPhone
      });

      try {
        if (isMeta) {
          const metaRes = await sendMetaMessage(to, message || "", platform, pageId);
          res.json({ success: true, activityId: activityRef.id, metaRes });
        } else {
          // Fallback to whatsapp
          if (!twilioClient) throw new Error("WhatsApp no configurado. Faltan claves.");
          const twilioRes = await sendWhatsApp(to, message || "", mediaUrl, activityRef.id, requestedFrom);
          res.json({ success: true, SID: twilioRes?.sid, activityId: activityRef.id });
        }
      } catch (sendErr: any) {
        console.error("[Send] Failed:", sendErr.message);
        await updateDoc(activityRef, { 
          status: "error", 
          whatsappStatus: "failed", 
          errorMessage: sendErr.message 
        });
        throw sendErr;
      }
    } catch (err: any) {
      const isLimitError = err.message.includes("limit") || err.message.includes("50");
      res.status(isLimitError ? 429 : 500).json({ 
        success: false, 
        error: err.message,
        limitReached: isLimitError
      });
    }
  });

  // App API
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Media Serving Endpoint
  app.get("/api/media/:id", (req, res) => {
    // Handle optional extensions like .mp3 or .png
    const id = req.params.id.split(".")[0];
    const media = mediaCache.get(id);
    if (media) {
      res.set("Content-Type", media.mimeType);
      res.send(media.data);
    } else {
      res.status(404).send("Not found");
    }
  });

  // Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("[SERVER] Jan Vanegas Dashboard: http://localhost:3000");
  });

  /**
   * FOLLOW-UP ENGINE (individual per customer)
   */
  setInterval(async () => {
    if (checkGlobalQuota()) {
      return; // Skip execution if quota is broken
    }

    try {
      const nowISO = new Date().toISOString();
      const q = query(
        collection(db, "followups"),
        where("status", "==", "pending"),
        where("scheduledAt", "<=", nowISO),
        limit(5)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) return;

      console.log(`[Follow-up Engine] Processing ${snap.size} due follow-ups...`);
      
      for (const docSnap of snap.docs) {
        if (checkGlobalQuota()) break;

        const fu = docSnap.data();
        const phone = fu.phone;
        
        // PRE-MARK as 'processing' to prevent infinite loops if Quota Exceeded later
        try {
          await updateDoc(docSnap.ref, { status: "processing", updatedAt: serverTimestamp() });
        } catch (e: any) {
          handleSupabaseError(e); // This will trigger global breaker
          console.error(`[Follow-up] Failed to lock doc (Quota?). Skipping ${phone}`, e.message);
          continue; 
        }

        const cleanPhone = phone.replace('whatsapp:', '');
        const formattedPhone = phone.includes(':') ? phone : `whatsapp:${phone}`;

        // 1. Verify customer status (Double check they didn't respond)
        // We do this by checking if the last activity was a 'bot' response and later than the follow-up creation
        const lastActQ = query(
          collection(db, "activities"),
          where("from", "==", formattedPhone),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const lastActSnap = await getDocs(lastActQ);
        
        let shouldExecute = true;
        
        // 1.5 Verify AI is not paused
        let convoSnap = await getDoc(doc(db, "conversations", cleanPhone));
        if (!convoSnap.exists() && cleanPhone.startsWith('+')) {
           convoSnap = await getDoc(doc(db, "conversations", cleanPhone.substring(1)));
        }
        if (!convoSnap.exists() && !cleanPhone.startsWith('+') && !isNaN(Number(cleanPhone))) {
           convoSnap = await getDoc(doc(db, "conversations", `+${cleanPhone}`));
        }

        if (convoSnap.exists() && convoSnap.data().aiPaused) {
          console.log(`[Follow-up] Skipping ${phone}: bot is paused for manual intervention.`);
          shouldExecute = false;
        }

        if (!lastActSnap.empty && shouldExecute) {
          const lastMsgAt = lastActSnap.docs[0].data().timestamp?.toMillis?.() || 0;
          const fuCreatedAt = fu.createdAt?.toMillis?.() || 0;
          if (lastMsgAt > fuCreatedAt) {
            console.log(`[Follow-up] Skipping ${phone}: Customer responded since scheduling.`);
            shouldExecute = false;
          }
        }

        if (shouldExecute) {
          const storeId = fu.storeId || "default";

          let storeConfig: any = {};
          const storeSnap = await getDoc(doc(db, "stores", storeId));
          if (storeSnap.exists()) {
            storeConfig = storeSnap.data();
          }
          const tone = storeConfig.botTone || "carismático y respetuoso";
          const botName = storeConfig.botName || "Jan";
          const botGoal = storeConfig.botGoal || "reactivar ventas";

          // 2. Generate nudge with IA
          const customerProfileId = `${storeId}_${cleanPhone}`;
          const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
          const profile = cxSnap.exists() ? cxSnap.data() : null;
          const history = await getCrmContext(formattedPhone, storeId);
          
          const isSupport = botGoal.toLowerCase().includes("soporte") || botGoal.toLowerCase().includes("support") || storeConfig.name?.toLowerCase().includes("soporte");

          const prompt = `CLIENTE: ${phone}
ESTADO: ${profile?.etapa || "interesado"}
SCORE: ${profile?.score || 0}
INTENCION: ${fu.reason}
HISTORIAL RECIENTE:
${history}

TAREA: Actúa como ${botName}. El cliente dejó de responder hace unos minutos. Escribe un mensaje MUY CORTO con tono ${tone} para ${botGoal}.
${isSupport 
  ? "Ayúdalo a completar su proceso técnico o resolver su duda pendiente. No intentes vender nada físico si es soporte." 
  : "Integra gatillos mentales de ESCASEZ (pocas unidades disponibles) o BENEFICIO (recordando el envío gratis y el pago contra entrega hoy)."}
Mantenlo respetuoso. Si es mujer, usa un trato amable sin ser informal de más. 
Máximo 18 palabras.
NO RESPONDAS EN JSON, RESPONDE SOLO EL TEXTO DEL MENSAJE.`;

          let nudgeMsg = "";
          let nudgeSuccess = false;

          // Try Llama first
          try {
            const currentNvidiaKey = process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey;
            if (!currentNvidiaKey) throw new Error("No NVIDIA API Key");
            
            const response = await axios.post(
              "https://integrate.api.nvidia.com/v1/chat/completions",
              {
                model: "meta/llama-3.1-8b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 100
              },
              {
                headers: {
                  "Authorization": `Bearer ${currentNvidiaKey}`,
                  "Content-Type": "application/json"
                },
                timeout: 5000
              }
            );
            nudgeMsg = response.data?.choices?.[0]?.message?.content?.trim() || "";
            if (nudgeMsg) {
              nudgeSuccess = true;
            }
          } catch (llamaErr: any) {
            console.warn(`[Follow-up] NVIDIA Llama 3.1 8B falló para el nudge. Error: ${llamaErr.message}`);
            
            const currentNvidiaKey = process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey;
            if (currentNvidiaKey) {
              try {
                const response = await axios.post(
                  "https://integrate.api.nvidia.com/v1/chat/completions",
                  {
                    model: "meta/llama-3.3-70b-instruct",
                    messages: [
                      { role: "system", content: "Eres un asistente de seguimiento amable. Máximo 18 palabras. Escribe en español." },
                      { role: "user", content: prompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 150
                  },
                  {
                    headers: {
                      "Authorization": `Bearer ${currentNvidiaKey}`,
                      "Content-Type": "application/json"
                    },
                    timeout: 6000
                  }
                );
                nudgeMsg = (response.data?.choices?.[0]?.message?.content || "").trim();
                if (nudgeMsg) {
                  nudgeSuccess = true;
                  console.log(`[Follow-up] Fallback exitoso con NVIDIA Llama 3.3 para el nudge.`);
                }
              } catch (nvidiaErr: any) {
                console.error(`[Follow-up] Fallback con NVIDIA también falló para el nudge. Error: ${nvidiaErr.message}`);
              }
            }
          }

          if (!nudgeSuccess || !nudgeMsg) {
            nudgeMsg = "¡Hola! Sigues ahí? Cuéntame si tienes alguna duda con tu pedido, con gusto te ayudo.";
          }

          console.log(`[Follow-up] Sending nudge to ${phone}: ${nudgeMsg}`);
          
          // 3. Send
          await sendWhatsApp(formattedPhone, nudgeMsg);
          
          // 4. Log as activity
          await addDoc(collection(db, "activities"), {
            from: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
            to: formattedPhone,
            recipient: formattedPhone,
            message: "[Seguimiento Automático]",
            response: nudgeMsg,
            status: "respondido",
            whatsappStatus: "sent",
            senderType: 'bot',
            storeId: storeId,
            timestamp: serverTimestamp(),
            customerPhone: cleanPhone
          });
        }

        // 5. Mark as executed (or cancelled if logic above decided)
        await updateDoc(docSnap.ref, { 
          status: shouldExecute ? "executed" : "cancelled", 
          executedAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
      }
    } catch (e) {
      console.error("[Follow-up Engine] Error:", e);
    }
  }, 60000); // Check every minute

  // Handle server errors (like port in use) gracefully
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[SERVER] EL PUERTO ${PORT} ESTÁ OCUPADO. El sistema de Google reintentará automáticamente.`);
    } else {
      console.error("[SERVER] Error fatal:", err.message);
    }
  });
}

startServer();

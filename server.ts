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
import crypto from "crypto";

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
  // HARDCODED UNIFIED STORE OVERRIDE
  // All messages and events will funnel to the single "default" session per the user's request
  return "default";
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
 * Transcribe un audio de WhatsApp usando un modelo multimodal con soporte de
 * audio vía OpenRouter (NVIDIA NIM no expone modelos de audio en este stack).
 * Se intenta una pequeña cascada de modelos; si todos fallan, retorna null y
 * el llamador debe caer al mensaje honesto de "no pude escuchar el audio".
 *
 * NOTA IMPORTANTE PARA JOSÉ MARÍA: esto quedó implementado con la mejor
 * integración disponible (formato estándar OpenAI "input_audio"), pero no lo
 * pude probar contra la API real sin tus keys desplegadas en Railway. Twilio
 * manda el audio de WhatsApp como audio/ogg (codec opus). Si el modelo
 * rechaza el formato "ogg", prueba cambiando `audioFormat` abajo a "mp3" o
 * "wav" tras revisar qué acepta el modelo elegido, o dime y lo ajustamos
 * viendo el error real de los logs de Railway.
 */
async function transcribeAudioWithAI(base64Audio: string, mimeType: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.warn("[Audio Transcribe] No hay OPENROUTER_API_KEY configurada, no se puede transcribir.");
    return null;
  }

  let audioFormat = "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) audioFormat = "mp3";
  else if (mimeType.includes("wav")) audioFormat = "wav";
  else if (mimeType.includes("ogg") || mimeType.includes("oga")) audioFormat = "ogg";

  const candidateModels = [
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001"
  ];

  for (const model of candidateModels) {
    try {
      const resp = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe exactamente lo que dice este audio en español. Responde SOLO con el texto transcrito, sin explicaciones ni comillas." },
                { type: "input_audio", input_audio: { data: base64Audio, format: audioFormat } }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        },
        {
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const text = resp.data?.choices?.[0]?.message?.content;
      if (text && typeof text === "string" && text.trim().length > 0) {
        console.log(`[Audio Transcribe] Transcripción exitosa con ${model}`);
        return text.trim();
      }
    } catch (e: any) {
      console.warn(`[Audio Transcribe] Falló ${model}:`, e?.response?.data?.error?.message || e.message);
    }
  }
  return null;
}

/**
 * Cuando el cliente manda una foto de un producto, hacemos una llamada de
 * visión CORTA Y BARATA (un solo modelo, respuesta breve) solo para sacar
 * 3-6 palabras clave de lo que se ve (tipo de producto, color, características
 * visibles). Con esas palabras buscamos coincidencias REALES en el catálogo,
 * en vez de dejar que el modelo principal invente un producto/precio que no
 * existe. Si esto falla, simplemente no agrega contexto extra y el flujo
 * sigue normal (el modelo principal igual recibe la imagen).
 */
const imageKeywordCache = new Map<string, { keywords: string[]; time: number }>();

async function identifyProductKeywordsFromImage(imagePart: { data: string; mimeType: string }): Promise<string[]> {
  const apiKey = NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) return [];

  // Cache por hash del contenido: si Twilio reintenta el webhook (timeouts,
  // reintentos de red) o el cliente reenvía la misma imagen, no pagamos la
  // llamada de visión dos veces.
  const cacheKey = crypto.createHash("md5").update(imagePart.data).digest("hex");
  const cached = imageKeywordCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
    console.log("[Image Product Match] Usando resultado en caché (misma imagen reciente)");
    return cached.keywords;
  }

  try {
    const resp = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        model: "meta/llama-3.2-11b-vision-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Mira esta imagen de un producto. Responde SOLO con 3 a 6 palabras clave en español separadas por coma que describan qué tipo de producto es (categoría, uso, color si aplica). No agregues explicaciones ni frases completas. Ejemplo de respuesta válida: camisa, ropa, algodon, azul" },
              { type: "image_url", image_url: { url: `data:${imagePart.mimeType};base64,${imagePart.data}` } }
            ]
          }
        ],
        max_tokens: 60,
        temperature: 0.1
      },
      {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 15000
      }
    );
    const text = resp.data?.choices?.[0]?.message?.content || "";
    const stopWords = new Set(["para", "con", "del", "los", "las", "una", "unos", "unas", "uso", "que", "como", "esta", "esto", "este"]);
    const keywords = text
      .split(/[,;\n\s]+/)
      .map((k: string) => k.trim().toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ''))
      .filter((k: string) => k.length > 3 && !stopWords.has(k))
      .slice(0, 8);
    imageKeywordCache.set(cacheKey, { keywords, time: Date.now() });
    return keywords;
  } catch (e: any) {
    console.warn("[Image Product Match] No se pudo identificar el producto de la imagen:", e?.response?.data?.error?.message || e.message);
    return [];
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
 * Valida que un request al webhook realmente venga de Twilio (usando la firma
 * X-Twilio-Signature + tu Auth Token), y no de cualquiera que descubra la URL
 * y mande POSTs falsos simulando ser un cliente (gastando tus créditos de IA,
 * metiendo pedidos falsos, etc.)
 *
 * MODO SEGURO POR DEFECTO: por ahora esto solo AUDITA (loguea si la firma no
 * cuadra) pero NO BLOQUEA nada, para no arriesgarnos a tumbar el bot en
 * producción por un detalle de URL/dominio que no puedo verificar sin
 * desplegarlo. Revisa los logs de Railway por unos días buscando
 * "[Twilio Security] Firma inválida" — si NO aparece para tráfico real de
 * clientes, activa la variable de entorno STRICT_TWILIO_SIGNATURE_VALIDATION=true
 * en Railway para que empiece a BLOQUEAR (403) los requests falsos de verdad.
 */
function validateTwilioWebhookSignature(req: express.Request): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn("[Twilio Security] TWILIO_AUTH_TOKEN no configurado, no se puede validar la firma del webhook.");
    return true;
  }
  const twilioSignature = req.headers["x-twilio-signature"] as string | undefined;
  if (!twilioSignature) {
    console.warn(`[Twilio Security] Request sin X-Twilio-Signature. IP: ${req.ip}`);
    return false;
  }
  try {
    const base = (currentAppUrl || process.env.APP_URL || `${req.protocol}://${req.headers.host}`).replace(/\/$/, "");
    const fullUrl = `${base}${req.originalUrl}`;
    const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, fullUrl, req.body || {});
    if (!isValid) {
      console.warn(`[Twilio Security] Firma inválida para ${fullUrl}. IP: ${req.ip}`);
    }
    return isValid;
  } catch (e: any) {
    console.warn("[Twilio Security] Error validando firma:", e.message);
    return false;
  }
}

const STRICT_TWILIO_SIGNATURE_VALIDATION = process.env.STRICT_TWILIO_SIGNATURE_VALIDATION === "true";

/**
 * Media (audio/imagen) por cliente: límite aparte del rate-limit general de
 * texto, porque transcribir audio y analizar imágenes cuesta más (llamadas
 * extra de IA). Evita que alguien queme presupuesto de OpenRouter/NVIDIA
 * mandando fotos o audios en bucle.
 */
const mediaRateLimitCache = new Map<string, { lastTime: number, count: number }>();
function canProcessMedia(userId: string): boolean {
  const now = Date.now();
  const record = mediaRateLimitCache.get(userId) || { lastTime: 0, count: 0 };
  if (now - record.lastTime > 15 * 60 * 1000) {
    record.count = 0;
  }
  record.count++;
  record.lastTime = now;
  mediaRateLimitCache.set(userId, record);
  // Límite: 8 audios/imágenes por cliente cada 15 minutos
  if (record.count > 8) {
    console.warn(`[ANTI-SPAM] ${userId} superó el límite de 8 audios/imágenes en 15 min. Bloqueando análisis de IA extra.`);
    return false;
  }
  return true;
}


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

// Detecta respuestas afirmativas/negativas en texto libre (fallback por si el
// cliente escribe en vez de tocar el botón). Se usa para el atajo determinístico
// de "pendingImageOffer" y evita que la IA vuelva a preguntar lo mismo en loop.
function isAffirmativeText(text: string): boolean {
  const t = normalizeCatText(text).trim();
  return /^(si+|s|dale|claro|obvio|de una|listo|ok|okay|vale|me interesa|lo quiero|quiero eso|si porfa|si porfavor|si por favor|si señor|si señora)$/.test(t) ||
    /^(si|s[ií]),?\s/.test(t);
}
function isNegativeText(text: string): boolean {
  const t = normalizeCatText(text).trim();
  return /^(no+|no gracias|nel|no porfa|no por ahora|no por favor|nop)$/.test(t);
}

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

    // ==============================================
    // 🔘 ATAJO DETERMINÍSTICO: respuesta a oferta de producto por imagen
    // ==============================================
    // Si el turno anterior identificamos un producto por FOTO y le mandamos
    // botones (pendingImageOffer), y el cliente responde por TEXTO en vez de
    // tocar el botón (ej. escribe "SI"), resolvemos acá mismo sin volver a
    // pasar por la IA. Esto es lo que eliminaba el loop de "¿te interesa?".
    const hasNewImageThisTurn = Array.isArray(data.mediaItems) && data.mediaItems.some((it: any) => it.mimeType?.startsWith("image/"));
    if (!hasNewImageThisTurn && customerProfile?.pendingImageOffer?.producto) {
      const rawText = (data.message || "").trim();
      if (isAffirmativeText(rawText)) {
        console.log(`[Server AI] Cliente confirmó por texto el producto identificado por imagen (${customerProfile.pendingImageOffer.producto}). Pasando directo a checkout...`);
        const cleanFrom = data.from.replace("whatsapp:", "").trim();
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
        await startCheckoutFlow(data.from, cleanFrom, data.to, assignedStoreId, customerProfile.pendingImageOffer.producto);
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: "[Checkout iniciado desde oferta por imagen confirmada por texto]",
          respondedAt: serverTimestamp()
        });
        return;
      } else if (isNegativeText(rawText)) {
        console.log(`[Server AI] Cliente rechazó por texto el producto identificado por imagen.`);
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
        await sendWhatsApp(data.from, "Tranqui 🙂 ¿Buscas algo más o te muestro otras opciones?", undefined, activityId, data.to);
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: "[Oferta por imagen descartada]",
          respondedAt: serverTimestamp()
        });
        return;
      }
      // Si no fue ni sí ni no claro, dejamos que siga el flujo normal (la IA
      // responderá con el contexto de la foto ya identificada previamente).
    }

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

    // Antes: si el cliente mandaba SOLO audio, respondíamos de una que no
    // podíamos escucharlo (para no gastar tiempo/costo en una cascada que
    // igual iba a alucinar). Ahora intentamos transcribirlo de verdad con un
    // modelo de audio (ver `transcribeAudioWithAI`) y solo si eso falla,
    // avisamos honestamente al cliente.
    if (hasAudio && imageParts.length === 0 && (!safeMessage || !safeMessage.trim())) {
      const audioItem = data.mediaItems.find((it: any) => it.mimeType?.startsWith("audio/"));

      if (audioItem && !canProcessMedia(fromPhone)) {
        const rateLimitMsg = "¡Uy! Me has mandado varios audios seguidos y necesito un momentico para ponerme al día 😅. ¿Me das un par de minutos o me escribes directamente?";
        if (data.from.startsWith("whatsapp:")) {
          await sendWhatsApp(data.from, rateLimitMsg, undefined, activityId, data.to);
        } else if (data.platform === "instagram" || data.platform === "messenger") {
          await sendMetaMessage(data.from, rateLimitMsg, data.platform, data.to);
        }
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: rateLimitMsg,
          respondedAt: serverTimestamp()
        });
        return;
      }

      const transcript = audioItem ? await transcribeAudioWithAI(audioItem.data, audioItem.mimeType) : null;

      if (transcript) {
        console.log(`[Server AI] Audio transcrito de ${fromPhone}: "${transcript}"`);
        safeMessage = transcript;
        // Sigue el flujo normal más abajo usando este texto transcrito como si
        // el cliente lo hubiera escrito.
      } else {
        const audioFallbackMsg = "¡Hola! Qué pena, no logré entender bien tu audio 🙉. ¿Me lo escribís por acá porfa? ¡Quedo pendiente!";
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
    }

    // Hybrid Smart Context Filter: Select only Top 15 featured products and those matching user keywords
    // to prevent prompt truncation issues and speed up inference significantly!
    let filteredProductsForPrompt: any[] = [];

    // Si mandó una imagen, identificamos palabras clave del producto ANTES de
    // armar el contexto, para que los productos reales que coinciden con la
    // foto queden garantizados dentro del inventario que ve la IA (y no se
    // pierdan en el recorte de 360+ productos).
    let imageMatchedProducts: any[] = [];
    let imageKeywords: string[] = [];
    if (imageParts.length > 0 && canProcessMedia(fromPhone)) {
      imageKeywords = await identifyProductKeywordsFromImage(imageParts[0]);
      if (imageKeywords.length > 0) {
        const scoredProducts = products.map(p => {
          const nameLower = (p.name || "").toLowerCase();
          const catLower = (p.category || "").toLowerCase();
          let score = 0;
          for (const k of imageKeywords) {
            if (nameLower.includes(k)) score += 2;
            else if (catLower.includes(k)) score += 1;
          }
          return { product: p, score };
        }).filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score);
        
        imageMatchedProducts = scoredProducts.slice(0, 5).map(item => item.product);
        console.log(`[Image Product Match] Palabras clave detectadas: ${imageKeywords.join(", ")} | Coincidencias en catálogo: ${imageMatchedProducts.length}`);
      }
    }

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
    imageMatchedProducts.forEach(p => combinedSet.set(p.id, p));

    filteredProductsForPrompt = Array.from(combinedSet.values());
    
    const compactProductsString = filteredProductsForPrompt.map(p => {
      const desc = p.description ? (p.description.length > 80 ? p.description.substring(0, 80) + "..." : p.description) : "";
      const isImageMatch = imageMatchedProducts.some(imp => imp.id === p.id);
      return `- ${p.name} ($${p.price}) [id: ${p.id}]${p.category ? ` [Cat: ${p.category}]` : ""}${desc ? ` - ${desc}` : ""}${isImageMatch ? " ⭐ COINCIDE CON LA FOTO QUE ENVIÓ EL CLIENTE" : ""}`;
    }).join("\n");

    const promptText = `ESTÁS ATENDIENDO EN LA TIENDA: ${storeConfig.name || "Jan Sel Shop"} (Slug: ${assignedStoreId})
CLIENTE: ${fromPhone}
NOMBRE: ${customerProfile?.name || "Desconocido"}
ETAPA CRM: ${customerProfile?.etapa || "nuevo"} (Probabilidad de compra: ${customerProfile?.score || 0}%)
INTENCIÓN ANTERIOR: ${customerProfile?.intencion || "Ninguna"}
HISTORIAL:
${history}

MENSAJE ACTUAL: ${safeMessage}${imageParts.length > 0 ? ` (El cliente también envió una imagen que adjunto para tu análisis.${imageMatchedProducts.length > 0 ? ` Ya identificamos posibles coincidencias reales en el inventario, marcadas abajo con ⭐ — si la foto se parece a alguno de esos, ofrécelo con seguridad usando su nombre y precio EXACTOS del inventario, no inventes uno nuevo.` : ` No encontramos una coincidencia exacta en el inventario para esta foto — descríbele lo que ves y pregúntale qué necesita para poder ayudarlo mejor, sin inventar un producto que no existe.`}` : ""}

INVENTARIO ACTUAL (Vista curada de los más vendidos y productos relevantes para esta consulta. Tenemos más de 360 productos en total, si piden algo diferente pregúntale a tu jefe o usa "notificar_admin"):
${compactProductsString}

⚠️ REGLA DE SALIDA ULTRA-ESTRICTA (OBLIGATORIA):
DEBES RESPONDER EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO.
NO incluyas explicaciones antes o después del JSON. NO uses formato markdown fuera del JSON.
El JSON debe cumplir ESTRICTAMENTE con la siguiente estructura de campos (no inventes otras llaves):

{
  "accion": "respuesta" | "notificar_admin" | "confirmar_pedido" | "iniciar_checkout",
  "explicacion_accion": "Usa 'iniciar_checkout' SI el cliente acaba de decir que SÍ quiere comprar o llevar el producto pero NO tienes sus datos de envío. Usa 'confirmar_pedido' SOLO si YA tienes todos sus datos (nombre, dirección, etc.).",
  "mensaje": "Mensaje en español (tono cercano de vendedor colombiano real, natural y variado — evita sonar repetitivo o de guion. Breve y persuasivo, máximo 1-2 párrafos cortos, con emojis con moderación, no en cada frase)",
  "producto": "Nombre del producto interesado si aplica (usa el nombre EXACTO del inventario, nunca inventado)",
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
    "cantidad": 1, // Cantidad de unidades pedidas (número entero, por defecto 1 si el cliente no especifica)
    "notes": "Notas adicionales"
  },
  "imageUrl": "URL pública de imagen del producto si aplica (SOLO devuélvela si el cliente pide una foto explícitamente, o si es la PRIMERA VEZ que le ofreces este producto. NUNCA la devuelvas si él fue quien te envió la foto a ti)"
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
    const systemInst = getSystemInstruction({
      ...storeConfig,
      storeUrl: currentAppUrl || process.env.APP_URL || "https://jansel-shop.com"
    });
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

      // CRÍTICO: algunos modelos (ej. NVIDIA meta/llama-3.1-8b-instruct) ignoran
      // el response_format:"json_object" y devuelven prosa/markdown en vez de
      // JSON. Antes esto se aceptaba como "éxito" (solo se validaba que no
      // viniera vacío) y el texto de prosa terminaba rompiendo el JSON.parse
      // más abajo, cayendo al mensaje genérico de "me enredé". Ahora validamos
      // el JSON AQUÍ MISMO: si no parsea, lo tratamos como fallo de este
      // modelo para que la cascada siga probando el siguiente.
      try {
        JSON.parse(text);
      } catch {
        throw new Error(`El modelo ${modelObj.name} devolvió texto que no es JSON válido (probablemente prosa/markdown).`);
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

    // Pausa "humana" antes de responder: un vendedor real no contesta en
    // 200ms, se demora un poco leyendo/escribiendo. Esto ayuda a que el bot
    // no se sienta tan robótico. Proporcional al largo del mensaje, con topes
    // para no hacer esperar de más ni sentirse instantáneo.
    const humanDelayMs = Math.min(4000, Math.max(1200, jsonResponse.mensaje.length * 25));
    await new Promise(resolve => setTimeout(resolve, humanDelayMs));

    // 3.0 Si la IA detecta intención de confirmar pedido, en vez de mandar el texto normal
    // y crear el pedido de una, mandamos BOTONES de confirmación (Sí/No) y dejamos el pedido
    // en pendingConfirmation hasta que el cliente toque el botón. Evita pedidos mal-confirmados
    // por una interpretación ambigua de texto libre.
    if (jsonResponse.accion === "iniciar_checkout") {
      console.log("[Server AI] Intención de comprar detectada por IA. Pasando al flujo determinístico de checkout...");
      const cleanFrom = data.from.replace("whatsapp:", "").trim();
      // Si venía de una oferta por imagen pendiente, la limpiamos: ya se resolvió.
      if (customerProfile?.pendingImageOffer) {
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
      }
      await startCheckoutFlow(data.from, cleanFrom, data.to, assignedStoreId, jsonResponse.producto || "");
      jsonResponse._skipTextReply = true;
    } else if (imageParts.length > 0 && imageMatchedProducts.length > 0 && jsonResponse.producto && jsonResponse.accion === "respuesta" && data.from.startsWith("whatsapp:")) {
      // Producto real identificado a partir de la FOTO que envió el cliente.
      // En vez de dejar la conversación abierta en texto libre (lo que causaba
      // el loop de "¿te interesa?" repetido), mandamos el mensaje de la IA
      // seguido de botones Sí/No deterministas, y guardamos pendingImageOffer
      // para resolver la respuesta del cliente sin margen de error.
      console.log(`[Server AI] Producto identificado por imagen (${jsonResponse.producto}). Enviando botones de confirmación de interés...`);
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        const sentBtns = await sendImageProductButtons(data.from, data.to, jsonResponse.producto);
        if (sentBtns) {
          await setDoc(doc(db, "customers", customerProfileId), {
            pendingImageOffer: {
              producto: jsonResponse.producto,
              createdAt: serverTimestamp()
            }
          }, { merge: true });
        }
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de botones de producto por imagen:", e);
      }
    } else if (jsonResponse.accion === "confirmar_pedido") {
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
        if (imageParts.length > 0 && mediaUrl) {
           console.log("[Server AI] Omitiendo mediaUrl porque el cliente acaba de enviar una imagen.");
           mediaUrl = undefined;
        }
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

// ==============================================
// 🔘 BOTONES DE INTERÉS SOBRE PRODUCTO IDENTIFICADO POR IMAGEN
// ==============================================
// Cuando el cliente envía una FOTO y logramos identificar un producto real del
// inventario que coincide, en vez de dejar que la IA siga la conversación en
// texto libre (lo que generaba el loop de "¿te interesa?" -> "SI" -> "¿te
// interesa?" otra vez), mandamos botones deterministas de Sí/No. Al tocar
// "Sí", se dispara directo el flujo de checkout sin volver a pasar por la IA.
const IMG_YES_ID = "JAN_IMG_YES";
const IMG_NO_ID = "JAN_IMG_NO";

async function ensureImageProductTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.imageProductTemplateSid : null;
    if (existingSid) {
      console.log(`[WhatsApp Buttons] Usando template de producto por imagen existente: ${existingSid}`);
      return existingSid;
    }

    console.log("[WhatsApp Buttons] No hay template de producto por imagen aún. Creando uno nuevo...");
    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_image_product_${Date.now()}`,
      language: "es",
      variables: { "1": "Cargador Iniciador de Batería Para Carro" },
      types: {
        "twilio/quick-reply": {
          body: "¿Te interesa el *{{1}}*? 🤔",
          actions: [
            { title: "Sí, lo quiero ✅", id: IMG_YES_ID },
            { title: "No, gracias ❌", id: IMG_NO_ID }
          ]
        },
        "twilio/text": {
          body: "¿Te interesa el *{{1}}*? Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { imageProductTemplateSid: content.sid }, { merge: true });
    console.log(`[WhatsApp Buttons] Template de producto por imagen creado y guardado: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] No se pudo crear/obtener el template de producto por imagen:", e.message);
    return null;
  }
}

async function sendImageProductButtons(to: string, from: string, productName: string): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureImageProductTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": String(productName || "este producto").slice(0, 300) })
    });
    console.log(`[WhatsApp Buttons] Botones de producto por imagen enviados a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de producto por imagen:", e.message);
    return false;
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

// Construye y envía (o reenvía, tras una corrección puntual) el resumen del
// pedido en el flujo determinístico de checkout, guardando el
// pendingConfirmation en Firestore y adjuntando la foto del producto si la
// encontramos en el catálogo, para darle más confianza al cliente.
async function sendCheckoutSummaryAndButtons(
  customerPhone: string,
  botPhone: string,
  customerProfileId: string,
  checkoutData: any,
  activityId: string | undefined,
  assignedStoreId: string
): Promise<void> {
  if (!checkoutData.valor || checkoutData.valor <= 0) {
    const products = await loadProductsForStore(assignedStoreId);
    const checkProd = (checkoutData.producto || "").toLowerCase();
    const match = products.find((p: any) =>
      (p.name && p.name.toLowerCase().includes(checkProd)) ||
      (p.name && checkProd.includes(p.name.toLowerCase()))
    );
    if (match && match.price) checkoutData.valor = match.price;
  }

  const cantidad = checkoutData.cantidad && checkoutData.cantidad > 0 ? checkoutData.cantidad : 1;
  const totalPagar = Number(checkoutData.valor || 0) * cantidad;

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
          cantidad: cantidad,
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
      valor: totalPagar,
      direccion: checkoutData.direccion,
      ciudad: checkoutData.ciudad
    }
  };

  // Buscar imagen del producto en el catálogo para adjuntarla al resumen
  let productImageUrl: string | undefined;
  try {
    const products = await loadProductsForStore(assignedStoreId);
    const checkProd = (checkoutData.producto || "").toLowerCase();
    const match = products.find((p: any) =>
      (p.name && p.name.toLowerCase() === checkProd) ||
      (p.name && p.name.toLowerCase().includes(checkProd)) ||
      (p.name && checkProd.includes(p.name.toLowerCase()))
    );
    if (match && match.imageUrl && !String(match.imageUrl).startsWith("/")) {
      productImageUrl = match.imageUrl;
    }
  } catch (e) {
    console.error("[Checkout Summary] No se pudo buscar la imagen del producto:", e);
  }

  const summaryText = `🚨 *RESUMEN DE TU PEDIDO* 🚨\n\n📦 *Producto:* ${checkoutData.producto}\n🔢 *Cantidad:* ${cantidad}\n💵 *Total a Pagar:* $${totalPagar.toLocaleString("es-CO")} *(Pagas al recibir)*\n👤 *Nombre:* ${checkoutData.nombre}\n📞 *Teléfono:* ${checkoutData.telefono}\n🇨🇴 *Destino:* ${checkoutData.ciudad}\n🏠 *Dirección:* ${checkoutData.direccion}\n📍 *Referencia:* ${checkoutData.referencia}\n\n🔥 *¡El envío es 100% GRATIS!*`;
  await sendWhatsApp(customerPhone, summaryText, productImageUrl, activityId, botPhone);

  await new Promise(resolve => setTimeout(resolve, 1200));

  const buttonsSent = await sendOrderConfirmationButtons(customerPhone, botPhone, fakeJsonResponse);
  if (!buttonsSent) {
    await sendWhatsApp(customerPhone, `¿Confirmas que todos tus datos están correctos para proceder con el despacho? Escribe *SÍ* para confirmar o *NO* para corregir.`, undefined, activityId, botPhone);
  }
}


// Reenvía la pregunta correspondiente al paso de checkout donde el cliente
// se quedó, usado cuando retoma desde el botón "Continuar mi pedido" de un
// follow-up de carrito abandonado.
async function resendCurrentCheckoutStepPrompt(customerPhone: string, botPhone: string, customerData: any): Promise<void> {
  const step = customerData?.checkoutStep;
  const cd = customerData?.checkoutData || {};
  const prompts: Record<string, string> = {
    producto: "¡Retomemos! ¿Qué producto deseas pedir? 📦",
    cantidad: `¡Seguimos con tu pedido de *${cd.producto || "tu producto"}*! ¿Cuántas *unidades* deseas? 🔢`,
    nombre: "¡Seguimos! ¿Cuál es tu *Nombre y Apellido completo*? 📝",
    telefono: "¡Seguimos! ¿A qué *número de teléfono* te contactamos? 📞",
    ciudad: "¡Seguimos! ¿A qué *ciudad o municipio* enviamos tu pedido? 🇨🇴",
    direccion: "¡Seguimos! ¿Cuál es tu *dirección exacta de entrega*? 🏠",
    referencia: "¡Seguimos! ¿Alguna *referencia* de la dirección? 📍 (o escribe *ninguna*)",
  };
  if (step === "confirmacion") {
    await sendCheckoutSummaryAndButtons(customerPhone, botPhone, `${customerData?.storeId || "default"}_${customerPhone.replace("whatsapp:", "")}`, cd, undefined, customerData?.storeId || "default");
    return;
  }
  const msg = prompts[step] || "¡Seguimos con tu pedido! Cuéntame en qué íbamos. 😊";
  await sendWhatsApp(customerPhone, msg, undefined, undefined, botPhone);
}

async function ensureResumeCheckoutTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.resumeCheckoutTemplateSid : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_resume_checkout_${Date.now()}`,
      language: "es",
      variables: { "1": "tu pedido" },
      types: {
        "twilio/quick-reply": {
          body: "¡Hola de nuevo! 👋 Veo que quedaste a mitad de registrar {{1}}. ¿Seguimos donde quedamos?",
          actions: [
            { title: "🛒 Continuar mi pedido", id: "RESUME_CHECKOUT" },
            { title: "❌ No, gracias", id: "RESUME_CHECKOUT_NO" }
          ]
        },
        "twilio/text": {
          body: "¡Hola de nuevo! 👋 Veo que quedaste a mitad de registrar {{1}}. Responde CONTINUAR para seguir donde quedamos, o NO GRACIAS si prefieres dejarlo así."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { resumeCheckoutTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de retomar checkout:", e.message);
    return null;
  }
}

async function sendResumeCheckoutButtons(to: string, from: string, productoTexto: string): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureResumeCheckoutTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": (productoTexto || "tu pedido").slice(0, 100) })
    });
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de retomar checkout:", e.message);
    return false;
  }
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
  otherCategories2Sid: string | null;
  keepChatSid: string | null;
}> {
  const result = {
    orderConfirmSid: null as string | null,
    mainMenuSid: null as string | null,
    categoriesSid: null as string | null,
    otherCategoriesSid: null as string | null,
    otherCategories2Sid: null as string | null,
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
    // NOTA: usamos la key "otherCategoriesTemplateSidV2" (no la vieja
    // "otherCategoriesTemplateSid") a propósito. Este template ya existía en
    // producción con solo 2 acciones + "Menú Principal"; si seguíamos leyendo
    // la key vieja, Twilio habría devuelto el SID viejo cacheado en Firestore
    // y el nuevo botón "Más Secciones ➡️" nunca habría aparecido de verdad.
    if (d?.otherCategoriesTemplateSidV2) {
      result.otherCategoriesSid = d.otherCategoriesTemplateSidV2;
    } else {
      console.log("[WhatsApp Buttons] Creando template de otras categorías (v2, con Más Secciones)...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_other_cats_v2_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "También contamos con estas increíbles secciones. Selecciona una opción 👇",
            actions: [
              { title: "Autos y Herram. 🚗", id: "CAT_AUTOS" },
              { title: "Salud y Belleza 🧴", id: "CAT_BEAUTY" },
              { title: "Más Secciones ➡️", id: "CAT_OTHER2" }
            ]
          },
          "twilio/text": {
            body: "Otras secciones disponibles:\n\n- Autos y Herram. 🚗\n- Salud y Belleza 🧴\n- Más Secciones ➡️"
          }
        }
      });
      result.otherCategoriesSid = content.sid;
      await setDoc(doc(db, "config", "system"), { otherCategoriesTemplateSidV2: content.sid }, { merge: true });
    }


    // 4b. Other Categories Menu (nivel 3) — Moda, Mascotas/Bebé/Juguetería, Volver
    if (d?.otherCategories2TemplateSid) {
      result.otherCategories2Sid = d.otherCategories2TemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de otras categorías (nivel 3)...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_other_cats2_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "¡Todavía hay más! Selecciona una opción 👇",
            actions: [
              { title: "Moda 👗", id: "CAT_MODA" },
              { title: "Mascotas y Bebés 🐾", id: "CAT_PETS" },
              { title: "Menú Principal 🔙", id: "MENU_BACK" }
            ]
          },
          "twilio/text": {
            body: "Más secciones disponibles:\n\n- Moda 👗\n- Mascotas y Bebés 🐾\n- Menú Principal 🔙"
          }
        }
      });
      result.otherCategories2Sid = content.sid;
      await setDoc(doc(db, "config", "system"), { otherCategories2TemplateSid: content.sid }, { merge: true });
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

async function sendOtherCategoriesMenu2(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.otherCategories2Sid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.otherCategories2Sid
    });
    console.log(`[WhatsApp Buttons] Menú de otras categorías (nivel 3) enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú de Otras Categorías (nivel 3):", e.message);
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

const CATEGORY_PAGE_SIZE = 9; // dejamos 1 slot libre para el item "Ver más" (límite WhatsApp = 10)

function normalizeCatText(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// `category` puede ser un string (una sola palabra clave) o un array de
// palabras clave (ej: ["hogar","cocina","aseo"]) para que un solo botón de
// menú cubra varias categorías reales del catálogo sin dejar productos fuera.
async function sendCategoryFeaturedProducts(to: string, from: string, category: string | string[], categoryLabel: string, assignedStoreId: string, offset: number = 0) {
  try {
    const products = await loadProductsForStore(assignedStoreId);
    const categories = Array.isArray(category) ? category : [category];
    const searchCats = categories.map(normalizeCatText);

    const matched = products.filter((p: any) => {
      if (!p.category) return false;
      const prodCat = normalizeCatText(p.category);
      return searchCats.some(sc => prodCat.includes(sc) || sc.includes(prodCat));
    });

    const page = matched.slice(offset, offset + CATEGORY_PAGE_SIZE);
    const hasMore = matched.length > offset + CATEGORY_PAGE_SIZE;

    let responseText = ``;

    if (matched.length === 0) {
      responseText += `Actualmente estamos actualizando esta sección, pero contamos con excelentes opciones. ¡Pregúntame por lo que buscas! 🛒\n\n`;
    }

    responseText += `⚠️ *RECUERDA:* Vendemos cualquier tipo de producto que imagines. Si buscas algo específico (marca, modelo, tipo de artículo) que no ves aquí, ¡solo pregúntame por él por este chat para confirmar disponibilidad y precio de inmediato! 📲\n`;

    // Red de seguridad: por más que acortemos, nunca dejar pasar un mensaje que
    // exceda el límite de Twilio/WhatsApp (1600 caracteres).
    const TWILIO_BODY_LIMIT = 1550;
    if (responseText.length > TWILIO_BODY_LIMIT) {
      responseText = responseText.slice(0, TWILIO_BODY_LIMIT - 20).trimEnd() + "\n…(sigue en la lista 👇)";
    }

    // Enviar la lista de productos en texto
    await sendWhatsApp(to, responseText, undefined, undefined, from);

    if (matched.length === 0) return;

    const cleanClientPhone = to.replace('whatsapp:', '').trim();
    const customerProfileId = `${assignedStoreId}_${cleanClientPhone}`;

    // Guardamos la búsqueda activa (categorías + próximo offset) para poder
    // resolver el tap en "➡️ Ver más productos" sin tener que codificar todo
    // en el id del item (que tiene límite de caracteres).
    await setDoc(doc(db, "customers", customerProfileId), {
      lastCategorySearch: { categories, categoryLabel, nextOffset: offset + CATEGORY_PAGE_SIZE }
    }, { merge: true });

    const categoryKey = `${searchCats.join("_")}_p${offset}`;

    // Enviar la lista interactiva (tocable) para que elija el producto con un tap
    setTimeout(async () => {
      const sent = await sendProductListPicker(to, from, page, categoryKey, customerProfileId, hasMore);
      if (!sent) {
        // Fallback: si no se pudo crear/enviar la lista interactiva, seguimos con texto libre
        await sendWhatsApp(to, "¿Cuál de estos productos te interesó para agendar tu despacho hoy mismo con *ENVÍO GRATIS* y *PAGO CONTRA ENTREGA*? 🚛💨 ¡Escríbeme el nombre o número y te lo reservo de una! 🔥", undefined, undefined, from);
      }
    }, 1500);

  } catch (e: any) {
    console.error(`[WhatsApp Buttons] Error enviando productos destacados para categoría ${category}:`, e.message);
  }
}

// ==============================================
// 🛒 LISTA INTERACTIVA DE PRODUCTOS + CARRITO (WhatsApp List Picker)
// ==============================================
// WhatsApp/Twilio no soporta selección múltiple dentro de una sola lista, así que
// el flujo es: el cliente toca UN producto de la lista -> se agrega al carrito ->
// le mostramos botones "➕ Agregar otro" / "✅ Confirmar pedido". Así puede
// repetir cuantas veces quiera antes de cerrar el pedido.

// Crea (o reutiliza, si el catálogo no cambió) el Content Template de tipo
// twilio/list-picker para una categoría específica. Se cachea por hash del
// contenido para no crear un template nuevo en cada mensaje.
async function ensureProductListTemplate(categoryKey: string, items: any[], hasMore: boolean = false): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const hashSource = items.map((p: any) => `${p.name}|${p.price}`).join(";") + `|hasMore=${hasMore}`;
    const hash = crypto.createHash("md5").update(hashSource).digest("hex").slice(0, 12);
    const cfgKey = `productListSid_${categoryKey}`;
    const cfgHashKey = `productListHash_${categoryKey}`;

    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    if (d?.[cfgKey] && d?.[cfgHashKey] === hash) {
      return d[cfgKey];
    }

    const listItems = items.map((p: any, idx: number) => ({
      item: String(p.name || `Producto ${idx + 1}`).slice(0, 24),
      id: `PROD_${idx}`,
      description: `$${Number(p.price || 0).toLocaleString("es-CO")} COP`.slice(0, 72)
    }));

    if (hasMore) {
      listItems.push({
        item: "➡️ Ver más productos",
        id: "MORE_PAGE",
        description: "Toca aquí para ver más opciones de esta sección"
      });
    }

    const textFallback = items
      .map((p: any, idx: number) => `${idx + 1}. ${p.name} - $${Number(p.price || 0).toLocaleString("es-CO")}`)
      .join("\n") + (hasMore ? `\n\nEscribe "más" para ver más opciones.` : "");

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_prodlist_${categoryKey}_${Date.now()}`,
      language: "es",
      variables: {},
      types: {
        "twilio/list-picker": {
          body: "Toca *Ver productos* 👇 y elige el que te interesa. Después podrás agregar más o confirmar tu pedido.",
          button: "Ver productos 📦",
          items: listItems
        },
        "twilio/text": {
          body: `Escríbeme el número del producto que te interesa:\n\n${textFallback}`
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { [cfgKey]: content.sid, [cfgHashKey]: hash }, { merge: true });
    console.log(`[WhatsApp List] Template de lista creado para categoría ${categoryKey}: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error(`[WhatsApp List] Error creando lista de productos (${categoryKey}):`, e.message);
    return null;
  }
}

// Envía la lista interactiva y guarda en el perfil del cliente qué productos se
// le mostraron (índice -> producto), para poder resolver cuál tocó.
async function sendProductListPicker(to: string, from: string, products: any[], categoryKey: string, customerProfileId: string, hasMore: boolean = false): Promise<boolean> {
  if (!twilioClient) return false;
  // `products` ya viene paginado (máx 9) por sendCategoryFeaturedProducts; si se
  // llama desde otro lado con más de 9, igual respetamos el límite de 10 de WhatsApp
  // dejando espacio para el item "Ver más" cuando aplique.
  const maxItems = hasMore ? 9 : 10;
  const top = products.slice(0, maxItems);
  if (top.length === 0) return false;

  const contentSid = await ensureProductListTemplate(categoryKey, top, hasMore);
  if (!contentSid) return false;

  try {
    await setDoc(doc(db, "customers", customerProfileId), {
      lastProductList: top.map((p: any) => ({ name: p.name, price: Number(p.price || 0) }))
    }, { merge: true });

    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid
    });
    console.log(`[WhatsApp List] Lista de productos (${categoryKey}) enviada a ${to}`);
    return true;
  } catch (e: any) {
    console.error(`[WhatsApp List] Error enviando lista de productos:`, e.message);
    return false;
  }
}

// Botones "➕ Agregar otro producto" / "✅ Confirmar pedido" que aparecen justo
// después de que el cliente toca un producto de la lista.
async function ensureCartActionTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    // Versionado a V2: el template viejo (cacheado en Firestore) solo tenía 2
    // acciones (Agregar otro / Confirmar). Si seguíamos leyendo la key vieja,
    // el nuevo botón de "Quitar producto" nunca se habría mostrado de verdad.
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.cartActionTemplateSidV2 : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_cart_action_v2_${Date.now()}`,
      language: "es",
      variables: { "1": "1x Producto - $50.000" },
      types: {
        "twilio/quick-reply": {
          body: "🛒 *Tu carrito:*\n{{1}}\n\n¿Qué quieres hacer?",
          actions: [
            { title: "➕ Agregar otro", id: "CART_ADD_MORE" },
            { title: "✅ Confirmar pedido", id: "CART_CHECKOUT" },
            { title: "🗑️ Quitar producto", id: "CART_REMOVE" }
          ]
        },
        "twilio/text": {
          body: "🛒 Tu carrito:\n{{1}}\n\n¿Deseas agregar otro producto, confirmarlo o quitar algo? Responde AGREGAR, CONFIRMAR o QUITAR."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { cartActionTemplateSidV2: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de carrito:", e.message);
    return null;
  }
}

async function sendCartActionButtons(to: string, from: string, cartSummary: string, total: number): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureCartActionTemplate();
  if (!contentSid) return false;

  try {
    const line = `${cartSummary}\n💵 *Total: $${total.toLocaleString("es-CO")} COP*`.slice(0, 620);
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": line })
    });
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de carrito:", e.message);
    return false;
  }
}

// Variante de startCheckoutFlow que arranca directamente desde un carrito ya
// armado (varios productos), en vez de un solo producto suelto.
async function startCheckoutFlowFromCart(from: string, cleanFrom: string, to: string, assignedStoreId: string, productoTexto: string, valorTotal: number) {
  try {
    const customerProfileId = `${assignedStoreId}_${cleanFrom}`;
    const checkoutData = {
      producto: productoTexto,
      nombre: "",
      telefono: "",
      ciudad: "",
      direccion: "",
      referencia: "",
      valor: valorTotal
    };

    await setDoc(doc(db, "customers", customerProfileId), {
      checkoutStep: "nombre",
      checkoutData,
      etapa: "negociando",
      lastInteractionAt: serverTimestamp()
    }, { merge: true });

    await sendWhatsApp(from, `¡Excelente elección! 🛒 Tu pedido quedó así:\n\n📦 *${productoTexto}*\n💵 *Total: $${valorTotal.toLocaleString("es-CO")} COP*\n\nPor favor dime tu *Nombre y Apellido completo* para la guía de despacho: 📝`, undefined, undefined, to);
    return true;
  } catch (e: any) {
    console.error(`[startCheckoutFlowFromCart] Error:`, e.message);
    return false;
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

    let quantity = parseInt(jsonResponse.datos_pedido?.cantidad, 10);
    if (!quantity || isNaN(quantity) || quantity < 1) quantity = 1;
    if (quantity > 20) quantity = 20; // límite razonable anti-error de digitación

    const orderInfo = {
      storeId: assignedStoreId,
      customerName: jsonResponse.datos_pedido?.nombre || customerProfile?.name || fromPhone,
      customerPhone: jsonResponse.datos_pedido?.telefono || fromPhone,
      productName: jsonResponse.producto || "No especificado",
      productId: "manual",
      quantity,
      totalPrice: finalPrice * quantity,
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

/**
 * SINCRONIZACIÓN EN VIVO DE IMÁGENES/CATÁLOGO DESDE GOOGLE SHEETS (CSV PUBLICADO)
 * ---------------------------------------------------------------------------
 * José María va pegando enlaces de imágenes a medida que los consigue, y
 * necesita que el bot los tome en cuenta sin tener que redeployar. OneDrive
 * bloquea la descarga automatizada de archivos, así que la solución estable
 * es: publicar la hoja de Google Sheets como CSV (Archivo > Compartir >
 * Publicar en la web > Valores separados por comas) y poner ese link en la
 * variable de entorno GOOGLE_SHEETS_CATALOG_CSV_URL. Este bloque lee la hoja
 * cada cierto tiempo y actualiza SOLO los campos imageUrl (y opcionalmente
 * price/stock si vienen en la hoja) de los productos ya existentes en
 * Firestore, buscando por "id" y si no hay match, por "name".
 *
 * Columnas esperadas (nombres flexibles, sin importar mayúsculas/acentos):
 * id | name (o nombre) | imageUrl (o imagen/foto). Opcionales: price, stock.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

let lastCatalogSyncSummary = { lastRun: null as string | null, updated: 0, matched: 0, rows: 0, error: null as string | null };

async function syncCatalogFromSheet(): Promise<void> {
  const csvUrl = process.env.GOOGLE_SHEETS_CATALOG_CSV_URL;
  if (!csvUrl) return; // Feature apagada si no hay variable configurada

  try {
    const response = await axios.get(csvUrl, { responseType: "text", timeout: 15000 });
    const raw: string = typeof response.data === "string" ? response.data : String(response.data);
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      lastCatalogSyncSummary = { lastRun: new Date().toISOString(), updated: 0, matched: 0, rows: 0, error: "CSV vacío o sin filas de datos" };
      return;
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const idIdx = headers.findIndex(h => h === "id" || h === "sku" || h === "productid");
    const nameIdx = headers.findIndex(h => h === "name" || h === "nombre" || h === "producto");
    const imgIdx = headers.findIndex(h => h === "imageurl" || h === "imagen" || h === "imagenurl" || h === "image" || h === "foto" || h === "linkimagen" || h === "vinculoimagen" || h === "vinculo" || h === "linkfoto");
    const priceIdx = headers.findIndex(h => h === "price" || h === "precio");
    const stockIdx = headers.findIndex(h => h === "stock" || h === "existencias" || h === "inventario");

    if (imgIdx === -1 || (idIdx === -1 && nameIdx === -1)) {
      lastCatalogSyncSummary = { lastRun: new Date().toISOString(), updated: 0, matched: 0, rows: lines.length - 1, error: "No se encontraron columnas 'id'/'name' y 'imageUrl' en la hoja" };
      console.error("[Catalog Sync] Encabezados no reconocidos:", headers);
      return;
    }

    const prodSnap = await getDocs(collection(db, "products"));
    const allProducts = prodSnap.docs.map(d => ({ docId: d.id, ...(d.data() as any) }));

    let matched = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const rowId = idIdx !== -1 ? (cols[idIdx] || "").trim() : "";
      const rowName = nameIdx !== -1 ? (cols[nameIdx] || "").trim() : "";
      const rowImg = (cols[imgIdx] || "").trim();
      if (!rowImg || (!rowId && !rowName)) continue;

      // chatgpt.com/s/... son links para ABRIR una conversación de ChatGPT,
      // no imágenes reales — si se detectan, se ignora esa fila para no
      // guardar un "imageUrl" que rompería el envío de fotos por WhatsApp.
      if (/chatgpt\.com\/s\//i.test(rowImg)) {
        console.warn(`[Catalog Sync] Fila ignorada: el link no es una imagen real (chatgpt.com/s/...) para "${rowName || rowId}"`);
        continue;
      }

      let match = rowId ? allProducts.find(p => (p.id || "").toLowerCase() === rowId.toLowerCase()) : null;
      if (!match && rowName) {
        const rn = rowName.toLowerCase();
        match = allProducts.find(p => (p.name || "").toLowerCase() === rn)
          || allProducts.find(p => (p.name || "").toLowerCase().includes(rn) || rn.includes((p.name || "").toLowerCase()));
      }
      if (!match) continue;
      matched++;

      const updatePayload: any = {};
      if (rowImg && rowImg !== match.imageUrl) updatePayload.imageUrl = rowImg;
      if (priceIdx !== -1 && cols[priceIdx]) {
        const p = Number(String(cols[priceIdx]).replace(/[^0-9.]/g, ""));
        if (!isNaN(p) && p > 0 && p !== match.price) updatePayload.price = p;
      }
      if (stockIdx !== -1 && cols[stockIdx] !== undefined && cols[stockIdx] !== "") {
        const s = Number(String(cols[stockIdx]).replace(/[^0-9]/g, ""));
        if (!isNaN(s) && s !== match.stock) updatePayload.stock = s;
      }

      if (Object.keys(updatePayload).length > 0) {
        try {
          await updateDoc(doc(db, "products", match.docId), updatePayload);
          updated++;
        } catch (e: any) {
          console.error(`[Catalog Sync] Error actualizando producto ${match.docId}:`, e.message);
        }
      }
    }

    lastCatalogSyncSummary = { lastRun: new Date().toISOString(), updated, matched, rows: lines.length - 1, error: null };
    if (updated > 0) {
      console.log(`[Catalog Sync] ${updated} producto(s) actualizado(s) desde Google Sheets (${matched} coincidencias de ${lines.length - 1} filas).`);
    }
  } catch (e: any) {
    lastCatalogSyncSummary = { lastRun: new Date().toISOString(), updated: 0, matched: 0, rows: 0, error: e.message };
    console.error("[Catalog Sync] Error leyendo/procesando el CSV:", e.message);
  }
}

// Carga el catálogo de productos de una tienda (con fallback a JSON local si Supabase falla).
// Extraída para reutilizarla tanto en el flujo normal de IA como en la confirmación por botón.
async function loadProductsForStore(assignedStoreId: string): Promise<any[]> {
  let products: any[] = [];
  try {
    // UNIFIED MODE: Fetch all products across all stores
    let prodSnap = await getDocs(collection(db, "products"));
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

// ==============================================
// 🚚 AUTOMATED TRACKING SYSTEM & ANALYZER (Dropi, Servientrega, etc.)
// ==============================================

function extractGuideFromUrlOrText(url: string, text: string): string {
  try {
    const urlObj = new URL(url);
    const params = ["id", "guia", "guide", "tracking", "num", "numero", "doc", "code", "ref", "tracking_number", "tracking_id", "id_guia", "documento"];
    for (const p of params) {
      const val = urlObj.searchParams.get(p);
      if (val && /^[A-Za-z0-9-]{6,20}$/.test(val)) {
        return val;
      }
    }
    const pathSegments = urlObj.pathname.split("/");
    for (const segment of pathSegments) {
      if (/^[0-9]{8,15}$/.test(segment)) {
        return segment;
      }
    }
  } catch (e) {
    // Ignore URL parse error
  }

  const patterns = [
    /(?:guia|guía|tracking|rastreo|documento|remesa|numero|número|no\.?\s*guia|nº\s*guia)[:#\s]+([A-Za-z0-9-]{7,20})/i,
    /\b([0-9]{9,13})\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return "No detectada";
}

async function analyzeTrackingUrl(url: string): Promise<{ status: string; comment: string; carrier: string; guide: string }> {
  try {
    console.log(`[Tracking Analyzer] Fetching tracking page: ${url}`);
    
    // Simple mock check for testing
    if (url.includes("test") || url.includes("mock") || url.includes("demo")) {
      return {
        status: "en_ruta",
        comment: "El pedido está en camino a la dirección de entrega (Simulado)",
        carrier: "Servientrega",
        guide: "9876543210"
      };
    }

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      timeout: 15000
    });

    const html = response.data;
    if (!html || typeof html !== "string") {
      throw new Error("No HTML content returned or invalid content type.");
    }

    // Clean HTML to save token/regex space
    let textContent = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, '')
      .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
      .replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, '')
      .replace(/<footer[^>]*>([\s\S]*?)<\/footer>/gi, '')
      .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, ' ') // remove HTML tags
      .replace(/\s+/g, ' ') // normalize whitespace
      .trim();

    // Limit length to avoid blowing context windows
    const maxTextLength = 6000;
    if (textContent.length > maxTextLength) {
      textContent = textContent.slice(0, maxTextLength);
    }

    // Attempt AI-based extraction if API keys are available
    const apiKey = process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        const isNvidia = !!process.env.NVIDIA_API_KEY;
        const apiUrl = isNvidia
          ? "https://integrate.api.nvidia.com/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";
        const modelName = isNvidia ? "meta/llama-3.1-8b-instruct" : "google/gemini-2.5-flash";

        console.log(`[Tracking Analyzer] Asking AI (${modelName}) to analyze tracking text...`);
        const resp = await axios.post(
          apiUrl,
          {
            model: modelName,
            messages: [
              {
                role: "user",
                content: `Analiza el siguiente texto extraído de una página de seguimiento/rastreo de envío (en Colombia). Identifica cuál es el estado actual de la entrega de manera precisa.\nDebe ser exactamente uno de los siguientes estados:\n- 'preparacion' (si la guía está generada, en preparación, o en bodega)\n- 'en_ruta' (si ya fue despachado, está en tránsito, en ruta de entrega, o viajando)\n- 'entregado' (si el cliente ya lo recibió)\n- 'novedad' (si hubo un intento fallido de entrega, dirección errónea, rehusado, o necesita reprogramación)\n\nDevuelve una respuesta JSON estricta con el formato:\n{\n  "estado": "preparacion" | "en_ruta" | "entregado" | "novedad",\n  "comentario": "Breve descripción de lo que indica la página (ej: 'El envío se encuentra en camino a Medellín')",\n  "transportadora": "Servientrega" | "Interrapidisimo" | "Coordinadora" | "Envía" | "Dropi" | "Desconocida",\n  "guia": "Número de guía o número de rastreo detectado (ej: '1002345678')"\n}\n\nTexto de la página:\n${textContent}`
              }
            ],
            temperature: 0.1,
            max_tokens: 300,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 15000
          }
        );

        let aiText = resp.data?.choices?.[0]?.message?.content || "";
        if (aiText.includes("```json")) {
          aiText = aiText.split("```json")[1].split("```")[0].trim();
        } else if (aiText.includes("```")) {
          aiText = aiText.split("```")[1].split("```")[0].trim();
        }

        const parsed = JSON.parse(aiText);
        if (parsed.estado && ["preparacion", "en_ruta", "entregado", "novedad"].includes(parsed.estado)) {
          console.log(`[Tracking Analyzer] AI extracted: state=${parsed.estado}, carrier=${parsed.transportadora}, guide=${parsed.guia}`);
          return {
            status: parsed.estado,
            comment: parsed.comentario || "Actualizado por IA",
            carrier: parsed.transportadora || "Desconocida",
            guide: parsed.guia || extractGuideFromUrlOrText(url, textContent)
          };
        }
      } catch (aiErr: any) {
        console.warn("[Tracking Analyzer] AI extraction failed, falling back to regex:", aiErr.message);
      }
    }

    // REGEX FALLBACK (highly reliable fallback based on common Colombian shipping words)
    const normalizedText = textContent.toLowerCase();
    let status = "preparacion";
    let comment = "En preparación";
    let carrier = "Desconocida";

    if (normalizedText.includes("servientrega")) carrier = "Servientrega";
    else if (normalizedText.includes("interrapidisimo") || normalizedText.includes("inter rapidisimo")) carrier = "Interrapidisimo";
    else if (normalizedText.includes("coordinadora")) carrier = "Coordinadora";
    else if (normalizedText.includes("envia")) carrier = "Envía";
    else if (normalizedText.includes("dropi")) carrier = "Dropi";

    if (
      normalizedText.includes("entregado") ||
      normalizedText.includes("entrega exitosa") ||
      normalizedText.includes("recibido") ||
      normalizedText.includes("finalizado")
    ) {
      status = "entregado";
      comment = "Pedido entregado con éxito.";
    } else if (
      normalizedText.includes("novedad") ||
      normalizedText.includes("devolucion") ||
      normalizedText.includes("fallido") ||
      normalizedText.includes("reprogramado") ||
      normalizedText.includes("no entregado") ||
      normalizedText.includes("no recibido") ||
      normalizedText.includes("direccion errada") ||
      normalizedText.includes("ausente")
    ) {
      status = "novedad";
      comment = "Novedad en la entrega reportada por la transportadora.";
    } else if (
      normalizedText.includes("en ruta") ||
      normalizedText.includes("despachado") ||
      normalizedText.includes("transito") ||
      normalizedText.includes("en camino") ||
      normalizedText.includes("viaje") ||
      normalizedText.includes("reparto") ||
      normalizedText.includes("movimiento")
    ) {
      status = "en_ruta";
      comment = "El pedido se encuentra en tránsito o en ruta de reparto.";
    } else if (
      normalizedText.includes("recibido en oficina") ||
      normalizedText.includes("admision") ||
      normalizedText.includes("preparacion") ||
      normalizedText.includes("bodega") ||
      normalizedText.includes("generado") ||
      normalizedText.includes("alistamiento")
    ) {
      status = "preparacion";
      comment = "Guía generada o en proceso de alistamiento.";
    }

    const guide = extractGuideFromUrlOrText(url, textContent);

    return { status, comment, carrier, guide };
  } catch (err: any) {
    console.error(`[Tracking Analyzer] Error fetching or analyzing URL:`, err.message);
    // If it completely fails, return 'preparacion' status as safe default
    return { status: "preparacion", comment: "No se pudo consultar el estado actual en tiempo real.", carrier: "Desconocida", guide: extractGuideFromUrlOrText(url, "") };
  }
}

/**
 * Generates an intelligent, VIP post-purchase cross-sell recommendation using Gemini AI
 */
async function generatePostPurchaseUpsell(order: any, customerOrders: any[], products: any[]): Promise<{
  customerProfile: string;
  recommendedProductId: string;
  recommendedProductName: string;
  suggestedMessage: string;
  reasoning: string;
}> {
  const customerName = order.customerName || "Cliente";
  const productName = order.productName || "producto";
  const normalizedProduct = productName.toLowerCase();

  // Create list of catalog products and customer historical purchases
  const catalogStr = products.map(p => `- ID: "${p.id}", Nombre: "${p.name}", Descripción: "${p.description || 'Sin descripción'}", Categoría: "${p.category || 'Hogar'}", Precio: $${p.price || 0} COP`).join("\n");
  const purchaseHistoryStr = customerOrders.map(o => `- Producto: "${o.productName}", Cantidad: ${o.quantity}, Precio: $${o.totalPrice} COP, Fecha: ${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}`).join("\n");

  const systemInstruction = `Eres un consultor experto de E-commerce y especialista en marketing relacional VIP para "Jansel Shop".
Tu rol es analizar lo que un cliente compró anteriormente, deducir su perfil de intereses, y recomendarle de manera inteligente el MEJOR producto complementario o un COMBO espectacular del catálogo para realizar una venta cruzada (cross-sell).

Pautas:
1. Analiza el historial de compras para entender qué le gusta. Ejemplo: si compró una hidrolavadora, tiene carro y le gusta cuidar su carro; si compró cremas faciales, le gusta el cuidado personal/belleza, etc.
2. Selecciona un producto real del catálogo de productos que complemente perfectamente su compra. Si el catálogo no tiene un producto directo, selecciona el más cercano o genera una propuesta de COMBO usando productos del catálogo y nómbralo de forma llamativa (ejemplo: "Combo Limpieza Extrema", "Kit Seguridad Vial").
3. Escribe un mensaje de WhatsApp amigable, sumamente persuasivo, profesional y personalizado.
- El tono debe ser de exclusividad: "Como eres cliente VIP de Jansel Shop..." y mencionar que le notificas a él antes que a nadie debido a stock muy limitado.
- Debe iniciar con un saludo personalizado y preguntar sutilmente cómo le ha ido con su compra anterior (que ya fue entregada hace unos días).
- Debe ofrecer el producto o combo en promoción con un descuento exclusivo y envío gratis contra entrega.
- Debe incluir un llamado a la acción claro, directo y conversacional: "Dime si te lo despacho hoy mismo" o "¿Quieres que te asegure uno de los pocos disponibles?".
- Usa un formato estructurado con emojis apropiados y limpios. No abuses de los emojis.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "customerProfile": "Breve análisis de gustos e intereses del cliente.",
  "recommendedProductId": "ID del producto recomendado del catálogo (o un ID de combo inventado si creas un combo)",
  "recommendedProductName": "Nombre del producto o combo recomendado",
  "reasoning": "Explicación lógica de por qué recomendaste esto basado en su compra anterior",
  "suggestedMessage": "Mensaje de WhatsApp profesional, listo para copiar y enviar."
}`;

  const prompt = `CLIENTE:
Nombre: ${customerName}
Compra reciente entregada: ${productName} (Cantidad: ${order.quantity})

HISTORIAL DE COMPRAS DEL CLIENTE:
${purchaseHistoryStr || "Ninguna otra compra previa registrada."}

CATÁLOGO DE PRODUCTOS DISPONIBLES EN JANSEL SHOP:
${catalogStr || "No hay productos adicionales en el catálogo digital."}

Genera la recomendación en JSON respetando la estructura solicitada.`;

  // Try LLM cascade
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      let responseText = "";
      if (process.env.OPENROUTER_API_KEY) {
        const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });
        responseText = resp.data.choices[0].message.content;
      } else if (process.env.NVIDIA_API_KEY) {
        const resp = await axios.post("https://integrate.api.nvidia.com/v1/chat/completions", {
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });
        responseText = resp.data.choices[0].message.content;
      } else if (process.env.GEMINI_API_KEY) {
        const resp = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          contents: [
            { role: "user", parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000
        });
        responseText = resp.data.candidates[0].content.parts[0].text;
      }

      if (responseText) {
        const cleaned = responseText.substring(responseText.indexOf("{"), responseText.lastIndexOf("}") + 1);
        const parsed = JSON.parse(cleaned);
        if (parsed.suggestedMessage && parsed.recommendedProductName) {
          return {
            customerProfile: parsed.customerProfile || "Perfil analizado por IA",
            recommendedProductId: parsed.recommendedProductId || "custom-recommendation",
            recommendedProductName: parsed.recommendedProductName,
            suggestedMessage: parsed.suggestedMessage,
            reasoning: parsed.reasoning || "Recomendado por IA"
          };
        }
      }
    } catch (aiErr: any) {
      console.warn("[Post-Purchase AI] AI generation failed, falling back to procedural rules:", aiErr.message);
    }
  }

  // PROCEDURAL RULES FALLBACK (Master fallback if no keys or API failed)
  let customerProfile = "Interés en optimizar el tiempo, practicidad y soluciones eficientes en el hogar.";
  let recommendedProductId = "aspiradora-portatil";
  let recommendedProductName = "Aspiradora Portátil Inalámbrica de Alta Succión";
  let reasoning = "Se detectó que el cliente valora la limpieza y la practicidad por su compra anterior. La aspiradora inalámbrica ofrece excelente versatilidad tanto para el hogar como para el carro.";
  let suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. Esperamos que te haya encantado y esté facilitando tu rutina. ¡Muchas gracias por tu confianza! 🏠✨\n\nComo eres parte de nuestro selecto grupo de *Clientes VIP*, quería contarte que acabamos de recibir pocas unidades en preventa de la nueva *Aspiradora Portátil Inalámbrica de Alta Succión*. 🔋🧹\n\nEstá diseñada tanto para el hogar como para limpiar rincones difíciles del carro sin cables molestos. Por ser VIP, te la ofrecemos hoy con un *15% de descuento especial* y envío gratis con Pago Contra Entrega.\n\n¿Te gustaría que te la despachemos hoy mismo para aprovechar la promoción? ¡Avísame si te aseguro una unidad! 😉`;

  if (normalizedProduct.includes("hidro") || normalizedProduct.includes("lava") || normalizedProduct.includes("car") || normalizedProduct.includes("moto") || normalizedProduct.includes("bateria")) {
    customerProfile = "Apasionado del cuidado automotriz, le gusta mantener su carro impecable y seguro.";
    recommendedProductId = "seguro-volante-pro";
    recommendedProductName = "Seguro para Volante Pro Premium";
    reasoning = "El cliente compró un artículo para cuidado vehicular. Se deduce que tiene carro y valora su protección. El Seguro para Volante complementa perfectamente ofreciendo máxima seguridad física en sus viajes.";
    suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que dejes tu máquina impecable! 🧼🚗💨\n\nComo eres uno de nuestros *Clientes VIP*, queremos consentirte. Hoy nos llegó un lote exclusivo y muy limitado del *Seguro para Volante Antirrobo Pro Premium*.\n\nEs ultra resistente, fácil de instalar en segundos y es la mayor protección física para tu carro. Por ser cliente VIP, te lo ofrecemos hoy con un *precio preferencial de preventa* y envío gratis Contra Entrega. 🔒✨\n\n¿Dime si te lo despachamos hoy mismo para que llegue directo a tu casa? ¡Quedan muy pocas unidades en stock!`;
  } else if (normalizedProduct.includes("facial") || normalizedProduct.includes("belleza") || normalizedProduct.includes("crema") || normalizedProduct.includes("pelo") || normalizedProduct.includes("cabello") || normalizedProduct.includes("makeup") || normalizedProduct.includes("maquillaje")) {
    customerProfile = "Persona enfocada en el cuidado personal, belleza y estética de primer nivel.";
    recommendedProductId = "serum-acido-hialuronico";
    recommendedProductName = "Sérum Facial de Ácido Hialurónico Anti-Edad";
    reasoning = "El cliente muestra preferencia por productos cosméticos y de bienestar. Se sugiere complementar su rutina diaria con un Sérum de Ácido Hialurónico de rápida absorción para una hidratación profunda.";
    suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que esté transformando tu rutina diaria de cuidado! 🧴✨\n\nComo eres parte de nuestros *Clientes VIP*, hoy te escribimos con un beneficio súper especial. Acabamos de ingresar una edición limitada de nuestro *Sérum Facial de Ácido Hialurónico y Vitamina C*.\n\nEs ideal para rejuvenecer, iluminar y darle una hidratación ultra profunda a tu piel. Por ser VIP, tienes envío gratis hoy y un *descuento exclusivo del 20%*.\n\n¿Dime si te gustaría que te despachemos uno hoy mismo para sumarlo a tu kit? ¡Avísame antes de que se agote! 🌸`;
  }

  return { customerProfile, recommendedProductId, recommendedProductName, suggestedMessage, reasoning };
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

  // Railway (y la mayoría de PaaS) terminan TLS en un proxy y reenvían por HTTP
  // internamente. Sin esto, req.protocol siempre daría "http" y req.ip mostraría
  // la IP del proxy en vez de la real — ambos necesarios para validar la firma
  // de Twilio correctamente y para logging/rate-limit por IP real.
  app.set("trust proxy", true);

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

  // Sincronización manual de imágenes/catálogo desde Google Sheets (o consultar el último estado)
  app.post("/api/admin/sync-catalog-images", async (req, res) => {
    try {
      await syncCatalogFromSheet();
      res.json({ success: true, summary: lastCatalogSyncSummary });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app.get("/api/admin/sync-catalog-images", (req, res) => {
    res.json({ success: true, summary: lastCatalogSyncSummary, configured: !!process.env.GOOGLE_SHEETS_CATALOG_CSV_URL });
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

  app.get("/api/public/config", async (req, res) => {
    let metaPixelId = "";
    let tiktokPixelId = "";
    try {
      const storeSnap = await getDoc(doc(db, "stores", "default"));
      if (storeSnap.exists()) {
        const storeData = storeSnap.data();
        metaPixelId = storeData.metaPixelId || "";
        tiktokPixelId = storeData.tiktokPixelId || "";
      }
    } catch (err) {
      console.error("[Config API] Error loading store config for default:", err);
    }

    res.json({
      whatsappNumber: process.env.TWILIO_FROM_NUMBER ? process.env.TWILIO_FROM_NUMBER.replace(/\D/g, '') : null,
      metaPixelId,
      tiktokPixelId
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

      // 3b. Send automatic WhatsApp confirmation to customer
      try {
        const finalPhone = normalizePhone(orderInfo.customerPhone);
        const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
        const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
        const customerWelcomeMsg = `¡Hola *${orderInfo.customerName}*! 👋 Muchas gracias por confiar en nosotros en Jansel Shop.\n\nPor este medio te estaré notificando sobre tu pedido de *${orderInfo.productName}*. Te confirmamos que ya se encuentra en *etapa de preparación* 📦 y pronto saldrá en ruta de entrega.\n\n¡Cualquier duda que tengas me puedes escribir por aquí! ✨`;
        await sendWhatsApp(finalPhone, customerWelcomeMsg, undefined, undefined, formattedBotNum);
        console.log(`[Landing Order Welcome] Welcomed customer ${finalPhone} successfully.`);
      } catch (welcomeErr: any) {
        console.error(`[Landing Order Welcome] Failed to welcome customer:`, welcomeErr.message);
      }

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

  app.post("/api/integration/orders/:orderId/tracking", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { trackingUrl } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      const order = orderSnap.data();

      if (trackingUrl === "") {
        await updateDoc(orderRef, {
          trackingUrl: null,
          trackingStatus: null,
          trackingCarrier: null,
          trackingComment: null,
          trackingGuide: null,
          trackingPaused: null,
          trackingHistory: null
        });
        return res.json({ success: true, message: "Seguimiento de envío restablecido de manera exitosa." });
      }

      // Immediately run the analysis to get initial carrier state
      console.log(`[Tracking Setup] Triggering initial analysis for tracking URL: ${trackingUrl}`);
      const analysis = await analyzeTrackingUrl(trackingUrl);

      const updateData = {
        trackingUrl,
        trackingStatus: analysis.status || "preparacion",
        trackingCarrier: analysis.carrier || "Desconocida",
        trackingComment: analysis.comment || "Iniciando seguimiento",
        trackingGuide: analysis.guide || "No detectada",
        trackingPaused: false,
        lastTrackedAt: Date.now(),
        trackingHistory: [
          {
            status: analysis.status || "preparacion",
            comment: analysis.comment || "Iniciando seguimiento",
            timestamp: Date.now()
          }
        ]
      };

      await updateDoc(orderRef, updateData);

      // Send the immediate WhatsApp message to the customer with the official tracking link!
      try {
        const finalPhone = normalizePhone(order.customerPhone);
        const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
        const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
        
        const customerMsg = `Hola *${order.customerName}* 👋\n\nTu pedido de *${order.productName}* ya fue despachado. 🚀\n\n🚚 *Transportadora:*\n${analysis.carrier || 'Desconocida'}\n\n📦 *Guía:*\n${analysis.guide || 'No detectada'}\n\nPuedes hacer seguimiento aquí:\n${trackingUrl}\n\nTe estaremos notificando automáticamente cada cambio de estado de tu despacho. ¡Muchas gracias por tu confianza! 🚚💨`;
        
        await sendWhatsApp(finalPhone, customerMsg, undefined, undefined, formattedBotNum);
        console.log(`[Tracking Setup] Sent immediate tracking WhatsApp to ${finalPhone}`);
      } catch (wsErr: any) {
        console.error(`[Tracking Setup] Failed to send instant WhatsApp message:`, wsErr.message);
      }

      res.json({
        success: true,
        message: "Enlace de seguimiento configurado y cliente notificado.",
        order: { ...order, ...updateData }
      });
    } catch (err: any) {
      console.error("[Tracking Endpoint Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/integration/orders/:orderId/tracking/scan", async (req, res) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      const order = orderSnap.data();
      if (!order.trackingUrl) {
        return res.status(400).json({ success: false, error: "Este pedido no tiene enlace de seguimiento configurado." });
      }

      console.log(`[Manual Scan] Scanning tracking page for order ${orderId}: ${order.trackingUrl}`);
      const result = await analyzeTrackingUrl(order.trackingUrl);

      const previousStatus = order.trackingStatus || "preparacion";
      const updateData: any = {
        lastTrackedAt: Date.now(),
        trackingComment: result.comment,
        trackingCarrier: result.carrier,
        trackingStatus: result.status,
        trackingGuide: result.guide || order.trackingGuide || "No detectada"
      };

      if (result.status !== previousStatus) {
        console.log(`[Manual Scan] State changed from ${previousStatus} to ${result.status}`);
        
        // Add tracking history event
        const history = Array.isArray(order.trackingHistory) ? [...order.trackingHistory] : [];
        history.push({
          status: result.status,
          comment: result.comment,
          timestamp: Date.now()
        });
        updateData.trackingHistory = history;

        // Also sync standard order status
        if (result.status === "entregado") {
          updateData.status = "entregado";
        } else if (result.status === "en_ruta") {
          updateData.status = "despachado";
        }

        // Notify client
        try {
          const finalPhone = normalizePhone(order.customerPhone);
          const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
          const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
          let notificationText = "";

          if (result.status === "en_ruta") {
            notificationText = `📦 *¡Tu pedido de Jansel Shop está en camino!* 🚚💨\n\nHola *${order.customerName}*, te traemos excelentes noticias. Tu pedido de *${order.productName}* ya ha sido entregado a la transportadora (*${result.carrier}*) y se encuentra *En Ruta* de entrega.\n\n📍 Sigue el recorrido oficial aquí en tiempo real: ${order.trackingUrl}\n\nRecuerda tener listo el dinero en efectivo ($${(order.totalPrice || 0).toLocaleString()} COP) para tu Pago Contra Entrega. ¡Muchas gracias por tu compra! ✨`;
          } else if (result.status === "entregado") {
            notificationText = `🎉 *¡Tu pedido ha sido entregado con éxito!* 🥳\n\nHola *${order.customerName}*, confirmamos que tu pedido de *${order.productName}* ya fue entregado el día de hoy.\n\nQueremos darte las gracias por confiar en Jansel Shop. Esperamos que disfrutes al máximo de tu producto. ❤️\n\n¿Cómo estuvo tu experiencia? Si nos dejas un comentario por aquí, ¡nos ayudaría muchísimo! 🙏`;
          } else if (result.status === "novedad") {
            notificationText = `⚠️ *Actualización importante sobre tu entrega* 🚚\n\nHola *${order.customerName}*, la transportadora (*${result.carrier}*) nos reporta una *Novedad* con la entrega de tu pedido de *${order.productName}* (ej: dirección incompleta o no se encontraba nadie en casa).\n\n🔗 Puedes ver el detalle oficial de la transportadora aquí: ${order.trackingUrl}\n\nNo te preocupes, ¡queremos ayudarte a solucionarlo hoy mismo! Cuéntanos por este chat qué pasó o indícanos si quieres que reprogramemos la entrega para que no se devuelva tu paquete. ¡Quedamos muy atentos! 📲`;
          }

          if (notificationText) {
            await sendWhatsApp(finalPhone, notificationText, undefined, undefined, formattedBotNum);
            console.log(`[Manual Scan] Notified customer ${finalPhone} about state change: ${result.status}`);
          }
        } catch (notifErr: any) {
          console.error(`[Manual Scan] Failed to send WhatsApp update:`, notifErr.message);
        }
      }

      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        status: result.status,
        comment: result.comment,
        carrier: result.carrier,
        guide: result.guide,
        order: { ...order, ...updateData }
      });
    } catch (e: any) {
      console.error("[Manual Scan Error]", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/integration/orders/:orderId/tracking/toggle-monitoring", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { paused } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      await updateDoc(orderRef, {
        trackingPaused: !!paused
      });

      res.json({
        success: true,
        message: `Monitoreo ${paused ? "pausado" : "activado"} correctamente.`,
        trackingPaused: !!paused
      });
    } catch (err: any) {
      console.error("[Toggle Monitoring Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. Generate Intelligent Upsell Recommendation
  app.post("/api/integration/orders/:orderId/generate-upsell", async (req, res) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const order = orderSnap.data();

      // Fetch customer's full purchase history to "learn" from them
      const normalizedPhone = order.customerPhone ? order.customerPhone.trim() : "";
      let customerOrders: any[] = [];
      if (normalizedPhone) {
        const qHistory = query(collection(db, "orders"), where("customerPhone", "==", normalizedPhone));
        const historySnap = await getDocs(qHistory);
        historySnap.forEach((d: any) => {
          if (d.id !== orderId) {
            customerOrders.push({ id: d.id, ...d.data() });
          }
        });
      }

      // Fetch catalog products
      let prodSnap = await getDocs(collection(db, "products"));
      const productsList: any[] = [];
      prodSnap.forEach((d: any) => {
        productsList.push({ id: d.id, ...d.data() });
      });

      // Call AI to learn and recommend
      console.log(`[AI Upsell] Generating post-purchase cross-sell suggestion for ${order.customerName}...`);
      const result = await generatePostPurchaseUpsell(order, customerOrders, productsList);

      // Save suggestion into the order object so the merchant can review / edit / send
      const updateData = {
        upsellProfile: result.customerProfile,
        upsellRecommendedProductId: result.recommendedProductId,
        upsellRecommendedProductName: result.recommendedProductName,
        upsellSuggestedMsg: result.suggestedMessage,
        upsellReasoning: result.reasoning,
        upsellStatus: order.upsellStatus || "pendiente",
        upsellCreatedAt: Date.now()
      };

      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        data: {
          id: orderId,
          ...order,
          ...updateData
        }
      });
    } catch (err: any) {
      console.error("[Generate Upsell Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Send Intelligent Upsell Message
  app.post("/api/integration/orders/:orderId/send-upsell", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { customMessage } = req.body; // Optional override message from admin input

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const order = orderSnap.data();

      const messageToSend = customMessage || order.upsellSuggestedMsg;
      if (!messageToSend) {
        return res.status(400).json({ success: false, error: "No hay un mensaje sugerido generado todavía para enviar." });
      }

      // Send via Twilio/WhatsApp
      const finalPhone = normalizePhone(order.customerPhone);
      const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
      const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;

      console.log(`[AI Upsell] Sending WhatsApp cross-sell to ${order.customerName} (${finalPhone})`);
      
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID || "ACmock",
        process.env.TWILIO_AUTH_TOKEN || "mock"
      );

      let sid = "mock-sid";
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_ACCOUNT_SID.startsWith("ACmock")) {
        const twilioRes = await client.messages.create({
          from: formattedBotNum,
          to: `whatsapp:${finalPhone}`,
          body: messageToSend
        });
        sid = twilioRes.sid;
      } else {
        console.log("[AI Upsell MOCK] Twilio not fully configured. Outputting message body:");
        console.log("-----------------------------------------");
        console.log(messageToSend);
        console.log("-----------------------------------------");
      }

      // Record activity history
      await addDoc(collection(db, "activities"), {
        from: formattedBotNum,
        to: `+${finalPhone}`,
        message: messageToSend,
        status: "respondido",
        whatsappStatus: "sent",
        manualAgent: "AI Post-Purchase Followup",
        createdAt: serverTimestamp(),
        storeId: order.storeId || ""
      });

      // Update order status
      const updateData = {
        upsellSent: true,
        upsellSentAt: Date.now(),
        upsellStatus: "enviado",
        upsellSuggestedMsg: messageToSend // Keep the actual sent copy
      };
      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        message: "¡Oferta de venta cruzada enviada correctamente por WhatsApp!",
        data: updateData
      });
    } catch (err: any) {
      console.error("[Send Upsell Error]", err);
      res.status(500).json({ success: false, error: err.message });
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

      // Solo auditamos (nunca bloqueamos) — este endpoint solo actualiza estados
      // de mensajes ya enviados, no es tan sensible como el webhook principal.
      validateTwilioWebhookSignature(req);

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

    // Seguridad: validamos que este request realmente venga de Twilio (ver
    // `validateTwilioWebhookSignature` para el detalle del modo audit-only vs strict).
    const twilioSignatureValid = validateTwilioWebhookSignature(req);
    if (!twilioSignatureValid && STRICT_TWILIO_SIGNATURE_VALIDATION) {
      console.error(`[Twilio Security] Bloqueado request con firma inválida. IP: ${req.ip}`);
      return res.status(403).send("Firma inválida");
    }

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
    // Twilio a veces manda el id del item tocado en ButtonPayload y otras veces
    // en ListId (según el tipo de template/lista). Aceptamos ambos.
    const buttonPayload = req.body?.ButtonPayload || req.body?.ListId;
    if (req.body?.ButtonPayload || req.body?.ListId || req.body?.ButtonText) {
      console.log("[WhatsApp Webhook] Interacción tipo botón/lista detectada. Body completo:", JSON.stringify(req.body));
    }
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
        } else if (buttonPayload === IMG_YES_ID) {
          const pendingImg = customerData?.pendingImageOffer;
          if (pendingImg?.producto) {
            await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
            await startCheckoutFlow(from, cleanFrom, to, assignedStoreId, pendingImg.producto);
          } else {
            await sendWhatsApp(from, "¡Perfecto! Contame qué producto te interesó y seguimos. 😊", undefined, undefined, to);
          }
        } else if (buttonPayload === IMG_NO_ID) {
          await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
          await sendWhatsApp(from, "Tranqui 🙂 ¿Buscas algo más o te muestro otras opciones?", undefined, undefined, to);
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
        } else if (buttonPayload === "RESUME_CHECKOUT") {
          await resendCurrentCheckoutStepPrompt(from, to, customerData);
        } else if (buttonPayload === "RESUME_CHECKOUT_NO") {
          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: null,
            checkoutData: null,
            pendingConfirmation: null,
            etapa: "interesado"
          }, { merge: true });
          await sendWhatsApp(from, "¡Listo, sin problema! Aquí estaré si cambias de idea. 😊 ¿En qué más te puedo colaborar?", undefined, undefined, to);
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
          await sendCategoryFeaturedProducts(from, to, ["tecnologia"], "Tecnología 💻", assignedStoreId);
        } else if (buttonPayload === "CAT_HOME") {
          await sendCategoryFeaturedProducts(from, to, ["hogar", "cocina", "aseo"], "Hogar, Cocina y Aseo 🧼", assignedStoreId);
        } else if (buttonPayload === "CAT_OTHER") {
          await sendOtherCategoriesMenu(from, to);
        } else if (buttonPayload === "CAT_AUTOS") {
          await sendCategoryFeaturedProducts(from, to, ["autos", "herramientas"], "Autos y Herramientas 🚗", assignedStoreId);
        } else if (buttonPayload === "CAT_BEAUTY") {
          await sendCategoryFeaturedProducts(from, to, ["belleza", "salud"], "Salud y Belleza 🧴", assignedStoreId);
        } else if (buttonPayload === "CAT_OTHER2") {
          await sendOtherCategoriesMenu2(from, to);
        } else if (buttonPayload === "CAT_MODA") {
          await sendCategoryFeaturedProducts(from, to, ["moda"], "Moda 👗", assignedStoreId);
        } else if (buttonPayload === "CAT_PETS") {
          await sendCategoryFeaturedProducts(from, to, ["mascotas", "bebe", "jugueteria"], "Mascotas, Bebés y Juguetería 🐾🍼", assignedStoreId);
        } else if (buttonPayload === "MORE_PAGE") {
          // El cliente tocó "➡️ Ver más productos" dentro de una categoría
          const lastSearch = customerData?.lastCategorySearch;
          if (!lastSearch || !Array.isArray(lastSearch.categories)) {
            await sendWhatsApp(from, "Uy, esa búsqueda ya expiró 😅. Elige una categoría de nuevo:", undefined, undefined, to);
            await sendCategoriesMenu(from, to);
          } else {
            await sendCategoryFeaturedProducts(from, to, lastSearch.categories, lastSearch.categoryLabel || "Productos", assignedStoreId, lastSearch.nextOffset || 0);
          }
        } else if (buttonPayload === "MENU_BACK") {
          await sendMainMenu(from, to);
        } else if (buttonPayload.startsWith("PROD_")) {
          // El cliente tocó un producto de la lista interactiva
          const idx = parseInt(buttonPayload.replace("PROD_", ""), 10);
          const lastList = customerData?.lastProductList || [];
          const picked = lastList[idx];

          if (!picked) {
            await sendWhatsApp(from, "Uy, esa opción ya no está disponible 😅. Volvamos al catálogo:", undefined, undefined, to);
            await sendCategoriesMenu(from, to);
          } else {
            const currentCart: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
            const existing = currentCart.find((it: any) => it.name === picked.name);
            if (existing) {
              existing.cantidad = (existing.cantidad || 1) + 1;
            } else {
              currentCart.push({ name: picked.name, price: picked.price, cantidad: 1 });
            }
            await updateDoc(doc(db, "customers", customerProfileId), { cart: currentCart });

            const cartSummary = currentCart
              .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
              .join("\n");
            const totalCart = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);

            const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
            if (!sent) {
              await sendWhatsApp(from, `🛒 Agregado a tu carrito:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP\n\n¿Deseas agregar otro producto? Responde AGREGAR o CONFIRMAR.`, undefined, undefined, to);
            }
          }
        } else if (buttonPayload === "CART_ADD_MORE") {
          await sendCategoriesMenu(from, to);
        } else if (buttonPayload === "CART_CHECKOUT") {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            await sendWhatsApp(from, "Tu carrito está vacío todavía 🙂. Elige al menos un producto del catálogo.", undefined, undefined, to);
            await sendCategoriesMenu(from, to);
          } else {
            const productoTexto = currentCart.map((it: any) => `${it.cantidad}x ${it.name}`).join(", ");
            const valorTotal = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
            await updateDoc(doc(db, "customers", customerProfileId), { cart: null });
            await startCheckoutFlowFromCart(from, cleanFrom, to, assignedStoreId, productoTexto, valorTotal);
          }
        } else if (buttonPayload === "CART_REMOVE") {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            await sendWhatsApp(from, "Tu carrito ya está vacío 🙂.", undefined, undefined, to);
          } else if (currentCart.length === 1) {
            // Solo hay un producto: lo quitamos directo, sin preguntar cuál.
            await updateDoc(doc(db, "customers", customerProfileId), { cart: [], pendingCartAction: null });
            await sendWhatsApp(from, `🗑️ Listo, quité *${currentCart[0].name}* de tu carrito. ¿Quieres ver el catálogo de nuevo?`, undefined, undefined, to);
            await sendCategoriesMenu(from, to);
          } else {
            const listText = currentCart
              .map((it: any, idx: number) => `${idx + 1}. ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
              .join("\n");
            await updateDoc(doc(db, "customers", customerProfileId), { pendingCartAction: "remove" });
            await sendWhatsApp(from, `🗑️ ¿Cuál quieres quitar? Escríbeme el número:\n\n${listText}\n\nO escribe "todos" para vaciar el carrito completo.`, undefined, undefined, to);
          }
        } else {
          console.warn(`[WhatsApp Webhook] ButtonPayload desconocido: ${buttonPayload}`);
        }

        return res.status(200).send("");
      } catch (e: any) {
        console.error("[WhatsApp Webhook] Error procesando ButtonPayload:", e.message);
        try {
          await sendWhatsApp(from, "Uy, algo falló procesando tu selección 😅. ¿Puedes intentarlo de nuevo o decirme qué producto buscas?", undefined, undefined, to);
        } catch (sendErr: any) {
          console.error("[WhatsApp Webhook] Error enviando fallback tras fallo de ButtonPayload:", sendErr.message);
        }
        // CRÍTICO: si no retornamos aquí, la ejecución seguía cayendo al flujo
        // normal de IA usando messageBody (que puede venir vacío o ser el texto
        // crudo de la lista), generando respuestas duplicadas o genéricas.
        return res.status(200).send("");
      }
    }

    // Respaldo por texto: si Twilio NO mandó ni ButtonPayload ni ListId (por
    // ejemplo, si el cliente tocó un item pero por algún motivo llegó como
    // texto plano, o si escribió el nombre del producto/acción a mano),
    // intentamos resolverlo igual antes de caer en el flujo genérico de IA.
    if (!buttonPayload && messageBody) {
      try {
        const cleanFrom = from.replace('whatsapp:', '').trim();
        const assignedStoreId = await determineStoreId(cleanFrom, messageBody || "", to);
        const customerProfileId = `${assignedStoreId}_${cleanFrom}`;
        const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
        const customerData = cxSnap.exists() ? cxSnap.data() : null;
        const normalizedMsg = normalizeCatText(messageBody).trim();

        // 0) ¿Está en medio de un flujo de "quitar producto" que arrancó con
        //    el botón 🗑️? Si es así, resolvemos ESO primero, antes que
        //    cualquier otra interpretación del texto (evita ambigüedad).
        if (customerData?.pendingCartAction === "remove") {
          const cartNow: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
          if (/^todos?$/i.test(normalizedMsg) || /vaciar/.test(normalizedMsg)) {
            await updateDoc(doc(db, "customers", customerProfileId), { cart: [], pendingCartAction: null });
            await sendWhatsApp(from, "🗑️ Listo, vacié todo tu carrito. ¿Vemos el catálogo de nuevo?", undefined, undefined, to);
            await sendCategoriesMenu(from, to);
            return res.status(200).send("");
          }
          const removeIdx = parseInt(normalizedMsg, 10);
          if (!isNaN(removeIdx) && removeIdx >= 1 && removeIdx <= cartNow.length) {
            const removed = cartNow.splice(removeIdx - 1, 1)[0];
            await updateDoc(doc(db, "customers", customerProfileId), { cart: cartNow, pendingCartAction: null });
            if (cartNow.length === 0) {
              await sendWhatsApp(from, `🗑️ Quité *${removed.name}*. Tu carrito quedó vacío. ¿Vemos el catálogo?`, undefined, undefined, to);
              await sendCategoriesMenu(from, to);
            } else {
              const cartSummary = cartNow
                .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
                .join("\n");
              const totalCart = cartNow.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
              await sendWhatsApp(from, `🗑️ Quité *${removed.name}* de tu carrito.`, undefined, undefined, to);
              const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
              if (!sent) {
                await sendWhatsApp(from, `🛒 Tu carrito ahora:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP`, undefined, undefined, to);
              }
            }
            return res.status(200).send("");
          }
          // No entendimos la respuesta: le recordamos el formato esperado y
          // NO seguimos al resto del flujo (para no confundir más).
          await sendWhatsApp(from, `No entendí cuál 😅. Responde con el número (ej: 1) o escribe "todos" para vaciar el carrito.`, undefined, undefined, to);
          return res.status(200).send("");
        }

        const lastList: any[] = Array.isArray(customerData?.lastProductList) ? customerData.lastProductList : [];

        // 1) ¿El texto coincide (por número de la lista o por nombre) con un
        //    producto de la última lista que le mostramos?
        let matchedIdx = -1;
        const asNumber = parseInt(normalizedMsg, 10);
        if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= lastList.length) {
          matchedIdx = asNumber - 1;
        } else if (normalizedMsg.length > 2) {
          matchedIdx = lastList.findIndex((p: any) => {
            const prodName = normalizeCatText(p?.name || "");
            return prodName && (prodName.includes(normalizedMsg) || normalizedMsg.includes(prodName));
          });
        }

        if (matchedIdx >= 0 && lastList[matchedIdx]) {
          const picked = lastList[matchedIdx];
          const currentCart: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
          const existing = currentCart.find((it: any) => it.name === picked.name);
          if (existing) {
            existing.cantidad = (existing.cantidad || 1) + 1;
          } else {
            currentCart.push({ name: picked.name, price: picked.price, cantidad: 1 });
          }
          await updateDoc(doc(db, "customers", customerProfileId), { cart: currentCart });

          const cartSummary = currentCart
            .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
            .join("\n");
          const totalCart = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);

          const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
          if (!sent) {
            await sendWhatsApp(from, `🛒 Agregado a tu carrito:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP\n\n¿Deseas agregar otro producto? Responde AGREGAR o CONFIRMAR.`, undefined, undefined, to);
          }
          return res.status(200).send("");
        }

        // 2) Palabras clave de acciones de carrito por texto libre
        if (/\bagregar\b/.test(normalizedMsg)) {
          await sendCategoriesMenu(from, to);
          return res.status(200).send("");
        }
        if (/\bconfirmar\b/.test(normalizedMsg)) {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            await sendWhatsApp(from, "Tu carrito está vacío todavía 🙂. Elige al menos un producto del catálogo.", undefined, undefined, to);
            await sendCategoriesMenu(from, to);
          } else {
            const productoTexto = currentCart.map((it: any) => `${it.cantidad}x ${it.name}`).join(", ");
            const valorTotal = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
            await updateDoc(doc(db, "customers", customerProfileId), { cart: null });
            await startCheckoutFlowFromCart(from, cleanFrom, to, assignedStoreId, productoTexto, valorTotal);
          }
          return res.status(200).send("");
        }
        // Si no coincide con nada de lo anterior, seguimos normalmente hacia
        // el flujo de IA de más abajo (no hacemos return).
      } catch (e: any) {
        console.error("[WhatsApp Webhook] Error en respaldo por texto (sin ButtonPayload):", e.message);
        // No retornamos: dejamos que el flujo normal de IA intente responder.
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
      // 0.A INTERCEPTOR GLOBAL: PEDIR ASESOR HUMANO (funciona en cualquier punto)
      // ==============================================
      // Antes, "Hablar con Asesor" solo era un botón que aparecía en ciertos
      // menús. Ahora cualquier frase que claramente pida un humano dispara lo
      // mismo sin importar en qué parte del flujo esté el cliente (catálogo,
      // checkout, etc.), salvo que ya haya un asesor activo para no repetir.
      const advisorPhrases = [
        "hablar con asesor", "hablar con alguien", "hablar con una persona",
        "hablar con un humano", "quiero un asesor", "necesito un asesor",
        "atencion al cliente", "persona real", "hablar con soporte",
        "quiero hablar con una persona", "asesor humano", "un humano por favor"
      ];
      const wantsAdvisor = advisorPhrases.some(p => cleanMsg.includes(p)) ||
        (cleanMsg.includes("asesor") && !cleanMsg.includes("no quiero"));

      if (wantsAdvisor && from.startsWith("whatsapp:") && customerData?.etapa !== "asesoria_solicitada") {
        await setDoc(doc(db, "customers", customerProfileId), { etapa: "asesoria_solicitada" }, { merge: true });
        try {
          let storeConfig: any = {};
          const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
          if (storeSnap.exists()) storeConfig = storeSnap.data();
          await notifyAdmins({
            customerName: customerData?.name || cleanFrom,
            customerPhone: cleanFrom,
            productName: "Solicitud de asesor humano",
            totalPrice: 0
          }, storeConfig?.name || "Jan Vanegas", storeConfig);
        } catch (e) {
          console.error("[Advisor Interceptor] Error notificando asesoría:", e);
        }
        await sendWhatsApp(from, "¡Perfecto! Ya le he avisado a un asesor humano 🙋‍♂️. Te escribirá en un momento. Mientras tanto, si tienes otra duda, puedes escribirme por acá. 😊", undefined, activityRef.id, to);
        return res.status(200).send("");
      }

      // ==============================================
      // 0.B INTERCEPTOR GLOBAL: SEGUIMIENTO / "¿DÓNDE VA MI PEDIDO?"
      // ==============================================
      const trackingPhrases = [
        "donde va mi pedido", "donde esta mi pedido", "estado de mi pedido",
        "seguimiento de mi pedido", "seguimiento del pedido", "rastrear mi pedido",
        "numero de guia", "guia de envio", "mi pedido va", "ver mi pedido",
        "donde viene mi pedido", "cuando llega mi pedido"
      ];
      const wantsTracking = trackingPhrases.some(p => cleanMsg.includes(p));

      if (wantsTracking && from.startsWith("whatsapp:")) {
        try {
          const ordersQ = query(
            collection(db, "orders"),
            where("customerPhone", "==", cleanFrom),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const ordersSnap = await getDocs(ordersQ);
          if (ordersSnap.empty) {
            await sendWhatsApp(from, "No encuentro ningún pedido asociado a tu número todavía. 🙁 Si ya hiciste uno, cuéntame el nombre con el que lo registraste y te ayudo a buscarlo.", undefined, activityRef.id, to);
            return res.status(200).send("");
          }
          const order = ordersSnap.docs[0].data() as any;
          const statusLabel: Record<string, string> = {
            preparacion: "🟡 En preparación, aún no ha sido despachado",
            en_ruta: "🔵 En tránsito, va en camino",
            entregado: "🟢 ¡Ya fue entregado!",
            novedad: "🔴 Tiene una novedad, un asesor te contactará"
          };
          const label = statusLabel[order.trackingStatus] || "🟡 En preparación, aún no ha sido despachado";
          let msg = `📦 *Estado de tu pedido:* ${order.productName || ""}\n\n${label}`;
          if (order.trackingGuide) msg += `\n\n🚚 *Guía:* ${order.trackingGuide}`;
          if (order.trackingUrl) msg += `\n🔗 *Rastrear aquí:* ${order.trackingUrl}`;
          if (!order.trackingUrl) msg += `\n\nApenas se despache te mandaremos el número de guía automáticamente. 😊`;
          await sendWhatsApp(from, msg, undefined, activityRef.id, to);
        } catch (e) {
          console.error("[Tracking Interceptor] Error buscando pedido:", e);
          await sendWhatsApp(from, "Tuve un problema buscando tu pedido. Un asesor te va a confirmar el estado en un momento. 🙏", undefined, activityRef.id, to);
        }
        return res.status(200).send("");
      }

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

        // Retomar checkout tras un follow-up de carrito abandonado (por si el
        // botón no llegó y el cliente escribió "continuar" en texto plano)
        if (["continuar", "seguir", "continuar pedido", "seguir pedido"].some(k => cleanMsg === k || cleanMsg.startsWith(k))) {
          await resendCurrentCheckoutStepPrompt(from, to, customerData);
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

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "cantidad",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Perfecto! Vamos a registrar tu pedido para: *${checkoutData.producto}*. 📦\n\n¿Cuántas *unidades* deseas? (Escribe un número, o *1* si solo quieres una) 🔢`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "cantidad") {
          let qty = parseInt(finalMessage.replace(/[^0-9]/g, ""), 10);
          if (!qty || isNaN(qty) || qty < 1) qty = 1;
          if (qty > 20) qty = 20;
          checkoutData.cantidad = qty;

          const isEditing = checkoutData._editing === true;
          if (isEditing) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "nombre",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Listo, *${qty}* unidad${qty > 1 ? "es" : ""}! Ahora, por favor dime tu *Nombre y Apellido completo* para la guía de envío de tu pedido: 📝`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "nombre") {
          checkoutData.nombre = finalMessage;

          const isEditingNombre = checkoutData._editing === true;
          if (isEditingNombre) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

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

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "ciudad",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Listo! Quedó registrado el número *${phoneVal}*. \n\nAhora contame: ¿A qué *ciudad, municipio o corregimiento* y de qué *departamento* enviamos tu pedido? (Acuérdate de que el envío es GRATIS a toda Colombia) 🇨🇴`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "ciudad") {
          checkoutData.ciudad = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "direccion",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Entendido! ¿Cuál es tu *dirección exacta de entrega*? (Por favor incluye calle, carrera, número de casa, apartamento, torre o barrio para que no haya demoras) 🏠`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "direccion") {
          checkoutData.direccion = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "referencia",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Súper! Para que la transportadora entregue volando y sin enredos, ¿tienes alguna *indicación o referencia adicional*? \n\n📍 (Ej: "casa de rejas blancas", "frente al parque", "entregar en portería", o escribe *ninguna* si no aplica) 👇`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "referencia") {
          checkoutData.referencia = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
          }

          await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
          return res.status(200).send("");
        }

        if (currentStep === "confirmacion") {
          const normConfirm = cleanMsg.replace(/[^a-z]/g, "");

          // Si el cliente estaba corrigiendo un campo puntual y responde algo
          // que coincide con el nombre de un campo, lo mandamos directo a
          // capturar ese campo en vez de tratarlo como SI/NO.
          const fieldMap: Record<string, string> = {
            nombre: "nombre", telefono: "telefono", numero: "telefono",
            ciudad: "ciudad", direccion: "direccion", referencia: "referencia",
            producto: "producto", cantidad: "cantidad"
          };
          const fieldRequested = Object.keys(fieldMap).find(k => normConfirm === k || normConfirm.includes(k));

          if (customerData.checkoutData?._awaitingFieldChoice && fieldRequested) {
            const targetStep = fieldMap[fieldRequested];
            const cd = { ...checkoutData, _editing: true };
            delete cd._awaitingFieldChoice;
            await setDoc(doc(db, "customers", customerProfileId), {
              checkoutStep: targetStep,
              checkoutData: cd
            }, { merge: true });
            const prompts: Record<string, string> = {
              nombre: "¡Dale! ¿Cuál es el *nombre y apellido* correcto? 📝",
              telefono: "¡Dale! ¿Cuál es el *teléfono* correcto? 📞",
              ciudad: "¡Dale! ¿Cuál es la *ciudad/municipio* correcta? 🇨🇴",
              direccion: "¡Dale! ¿Cuál es la *dirección exacta* correcta? 🏠",
              referencia: "¡Dale! ¿Cuál es la *referencia* correcta? 📍",
              producto: "¡Dale! ¿Cuál es el *producto* correcto? 📦",
              cantidad: "¡Dale! ¿Cuántas *unidades* correctas quieres? 🔢"
            };
            await sendWhatsApp(from, prompts[targetStep], undefined, activityRef.id, to);
            return res.status(200).send("");
          }

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
            // Antes esto borraba TODOS los datos capturados y obligaba a
            // empezar de cero. Ahora preguntamos puntualmente qué campo
            // quiere corregir, y solo reiniciamos ese campo.
            await setDoc(doc(db, "customers", customerProfileId), {
              checkoutStep: "confirmacion",
              checkoutData: { ...checkoutData, _awaitingFieldChoice: true }
            }, { merge: true });
            await sendWhatsApp(from, `Tranqui, no he confirmado nada todavía 🙂 ¿Qué deseas corregir? Responde una de estas palabras:\n\n📦 *producto*\n🔢 *cantidad*\n👤 *nombre*\n📞 *telefono*\n🇨🇴 *ciudad*\n🏠 *direccion*\n📍 *referencia*\n\nO escribe *cancelar* si prefieres cancelar todo el pedido.`, undefined, activityRef.id, to);
            return res.status(200).send("");
          } else {
            // Antes: si la respuesta no era ni "SI" ni "NO" reconocido, el código
            // seguía de largo hacia los interceptores de más abajo (compra,
            // catálogo, saludo) sin resolver el pedido pendiente — dejando al
            // cliente atascado en "confirmacion" sin que nada se lo aclarara,
            // y con riesgo de que un nuevo "quiero comprar X" pisara los datos
            // ya capturados. Ahora reforzamos la pregunta y cortamos acá,
            // igual que en el resto de los pasos de este mismo flujo.
            await sendWhatsApp(from, "Perdón, no te entendí bien 🙏 ¿Confirmas tu pedido? Responde *SÍ* para confirmar o *NO* si quieres corregir algo.", undefined, activityRef.id, to);
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
        console.log(`[WhatsApp Interceptor] Catalog request detected from ${from}. Replying deterministically with the interactive menu (no text list)...`);

        const CATALOG_SHORT_MESSAGE = `¡Qué más parce! 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\nTenemos un catálogo gigante con *más de 360 productos espectaculares*. Cualquier cosa que busques o te imagines, ¡te la conseguimos de una! 🚀\n\n🔥 *ENVÍO GRATIS A TODA COLOMBIA* 🇨🇴\n🚛 *PAGO CONTRA ENTREGA*\n\n👇 Toca una categoría para ver los productos, o escríbeme directamente qué buscas y te confirmo disponibilidad y precio de una.`;

        await sendWhatsApp(from, CATALOG_SHORT_MESSAGE, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendCategoriesMenu(from, to);

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: CATALOG_SHORT_MESSAGE,
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

        // Saludo personalizado si es cliente recurrente con pedido anterior
        let WELCOME_MESSAGE = `¡Qué más parce! 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\n¿Cómo vas? Contame en qué te puedo colaborar hoy o qué estás buscando de nuestro catálogo. ¡Aquí abajo te dejo unas opciones rápidas para empezar de una! 👇`;

        try {
          if (customerData?.name) {
            const prevOrdersQ = query(
              collection(db, "orders"),
              where("customerPhone", "==", cleanFrom),
              orderBy("createdAt", "desc"),
              limit(1)
            );
            const prevOrdersSnap = await getDocs(prevOrdersQ);
            if (!prevOrdersSnap.empty) {
              const lastOrder = prevOrdersSnap.docs[0].data() as any;
              const firstName = String(customerData.name).split(" ")[0];
              WELCOME_MESSAGE = `¡Hola de nuevo, *${firstName}*! 👋 Qué gusto verte otra vez por *Jan Sel Shop* 💎\n\n¿Cómo te fue con tu *${lastOrder.productName || "pedido anterior"}*? Cuéntame en qué te puedo colaborar hoy. 👇`;
            }
          }
        } catch (e) {
          console.error("[Greeting Interceptor] Error buscando historial para saludo personalizado:", e);
        }

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

  // Servir imágenes locales desde src/assets para asegurar que siempre carguen en producción o dev
  app.use("/src/assets", express.static(path.join(process.cwd(), "src/assets")));

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
   * SINCRONIZACIÓN DE IMÁGENES/CATÁLOGO DESDE GOOGLE SHEETS (en vivo)
   * Corre apenas arranca el server y luego cada 90 segundos. Si no hay
   * GOOGLE_SHEETS_CATALOG_CSV_URL configurada, la función simplemente no
   * hace nada (ver syncCatalogFromSheet).
   */
  syncCatalogFromSheet();
  setInterval(() => { syncCatalogFromSheet(); }, 90 * 1000);

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
          
          // 3. Send — si el cliente quedó a mitad de un checkout, mandamos un
          // botón directo para retomar exactamente donde quedó, en vez de
          // solo un mensaje de texto que lo obligue a escribir de nuevo.
          if (profile?.checkoutStep && profile.checkoutStep !== "confirmacion") {
            const productoTexto = profile?.checkoutData?.producto || "tu pedido";
            const buttonsSent = await sendResumeCheckoutButtons(formattedPhone, TWILIO_FROM_NUMBER || "whatsapp:+14155238886", productoTexto);
            if (!buttonsSent) {
              await sendWhatsApp(formattedPhone, `¡Hola de nuevo! 👋 Quedaste a mitad de registrar *${productoTexto}*. Escribe *continuar* para seguir donde quedamos. 🛒`);
            }
          } else {
            await sendWhatsApp(formattedPhone, nudgeMsg);
          }
          
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

  // ==============================================
  // 🚚 BACKGROUND TRACKING SCANNER ENGINE
  // ==============================================
  let trackingCheckInterval: NodeJS.Timeout | null = null;

  function startBackgroundTrackingChecker() {
    if (trackingCheckInterval) return;
    
    console.log("[Tracking System] Starting background tracking status checker (every 10 minutes)...");
    
    // Run check every 10 minutes
    trackingCheckInterval = setInterval(async () => {
      try {
        console.log("[Tracking System] Checking active orders with tracking links...");
        const dbRef = db;
        
        // Fetch all active orders
        const q = query(collection(dbRef, "orders"));
        const snapshot = await getDocs(q);
        
        const now = Date.now();
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        
        for (const orderDoc of snapshot.docs) {
          const order = orderDoc.data();
          const orderId = orderDoc.id;
          
          // Skip if no trackingUrl, already entregado / cancelled, or if monitoring is paused
          if (!order.trackingUrl || order.trackingStatus === "entregado" || order.status === "entregado" || order.trackingPaused === true) {
            continue;
          }
          
          // Skip orders older than 15 days to save resources
          const createdAt = order.createdAt ? (order.createdAt.seconds * 1000 || order.createdAt) : now;
          if (now - createdAt > fifteenDaysMs) {
            continue;
          }
          
          // Throttle check: only analyze every 30 minutes in background per order
          const lastChecked = order.lastTrackedAt || 0;
          if (now - lastChecked < 30 * 60 * 1000) {
            continue;
          }
          
          console.log(`[Tracking System] Scanning order ${orderId} (${order.customerName}) tracking page: ${order.trackingUrl}`);
          const result = await analyzeTrackingUrl(order.trackingUrl);
          
          const previousStatus = order.trackingStatus || "preparacion";
          
          // Update database with latest scan info
          const updateData: any = {
            lastTrackedAt: now,
            trackingComment: result.comment,
            trackingCarrier: result.carrier,
            trackingGuide: result.guide || order.trackingGuide || "No detectada"
          };
          
          if (result.status !== previousStatus) {
            console.log(`[Tracking System] Order ${orderId} changed state: ${previousStatus} -> ${result.status}`);
            updateData.trackingStatus = result.status;
            
            // Add tracking history event
            const history = Array.isArray(order.trackingHistory) ? [...order.trackingHistory] : [];
            history.push({
              status: result.status,
              comment: result.comment,
              timestamp: now
            });
            updateData.trackingHistory = history;
            
            // Also sync with the standard order status if appropriate
            if (result.status === "entregado") {
              updateData.status = "entregado";
            } else if (result.status === "en_ruta") {
              updateData.status = "despachado";
            }
            
            // Send WhatsApp Notification to the customer!
            try {
              const finalPhone = normalizePhone(order.customerPhone);
              const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
              const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
              let notificationText = "";
              
              if (result.status === "en_ruta") {
                notificationText = `📦 *¡Tu pedido de Jansel Shop está en camino!* 🚚💨\n\nHola *${order.customerName}*, te traemos excelentes noticias. Tu pedido de *${order.productName}* ya ha sido entregado a la transportadora (*${result.carrier}*) y se encuentra *En Ruta* de entrega.\n\n📍 Sigue el recorrido oficial aquí en tiempo real: ${order.trackingUrl}\n\nRecuerda tener listo el dinero en efectivo ($${(order.totalPrice || 0).toLocaleString()} COP) para tu Pago Contra Entrega. ¡Muchas gracias por tu compra! ✨`;
              } else if (result.status === "entregado") {
                notificationText = `🎉 *¡Tu pedido ha sido entregado con éxito!* 🥳\n\nHola *${order.customerName}*, confirmamos que tu pedido de *${order.productName}* ya fue entregado el día de hoy.\n\nQueremos darte las gracias por confiar en Jansel Shop. Esperamos que disfrutes al máximo de tu producto. ❤️\n\n¿Cómo estuvo tu experiencia? Si nos dejas un comentario por aquí, ¡nos ayudaría muchísimo! 🙏`;
              } else if (result.status === "novedad") {
                notificationText = `⚠️ *Actualización importante sobre tu entrega* 🚚\n\nHola *${order.customerName}*, la transportadora (*${result.carrier}*) nos reporta una *Novedad* con la entrega de tu pedido de *${order.productName}* (ej: dirección incompleta o no se encontraba nadie en casa).\n\n🔗 Puedes ver el detalle oficial de la transportadora aquí: ${order.trackingUrl}\n\nNo te preocupes, ¡queremos ayudarte a solucionarlo hoy mismo! Cuéntanos por este chat qué pasó o indícanos si quieres que reprogramemos la entrega para que no se devuelva tu paquete. ¡Quedamos muy atentos! 📲`;
              }
              
              if (notificationText) {
                await sendWhatsApp(finalPhone, notificationText, undefined, undefined, formattedBotNum);
                console.log(`[Tracking System] Notified customer ${finalPhone} about state change: ${result.status}`);
              }
            } catch (notifErr: any) {
              console.error(`[Tracking System] Failed to send WhatsApp update for order ${orderId}: ${notifErr.message}`);
            }
          }
          
          await updateDoc(doc(dbRef, "orders", orderId), updateData);
        }

        // ==============================================
        // 🛍️ AUTOMATIC POST-PURCHASE AI UPSELL CHECKER
        // ==============================================
        console.log("[AI Upsell System] Checking delivered orders for automatic post-purchase recommendations...");
        for (const orderDoc of snapshot.docs) {
          const order = orderDoc.data();
          const orderId = orderDoc.id;

          // Only process orders that are delivered ('entregado')
          if (order.status !== "entregado" && order.trackingStatus !== "entregado") {
            continue;
          }

          // Skip if already sent or if upsell is paused/ignored
          if (order.upsellSent === true || order.upsellPaused === true) {
            continue;
          }

          // Trigger condition: Delivered at least 7 days ago.
          // To make it friendly for testing, we also support "triggerUpsellImmediately" flag
          const deliveredAt = order.lastTrackedAt || order.createdAt || now;
          const ageInDays = (now - deliveredAt) / (24 * 60 * 60 * 1000);

          // We'll auto-trigger if it has been 7 days, OR if they have manual test flags
          if (ageInDays >= 7 || order.triggerUpsellImmediately === true) {
            console.log(`[AI Upsell System] Order ${orderId} (${order.customerName}) is eligible for auto-upsell (Age: ${ageInDays.toFixed(2)} days). Triggering AI...`);
            
            try {
              // 1. Fetch other customer orders
              const normalizedPhone = order.customerPhone ? order.customerPhone.trim() : "";
              let customerOrders: any[] = [];
              if (normalizedPhone) {
                const qHistory = query(collection(dbRef, "orders"), where("customerPhone", "==", normalizedPhone));
                const historySnap = await getDocs(qHistory);
                historySnap.forEach((d: any) => {
                  if (d.id !== orderId) customerOrders.push({ id: d.id, ...d.data() });
                });
              }

              // 2. Fetch products
              let prodSnap = await getDocs(collection(dbRef, "products"));
              const productsList: any[] = [];
              prodSnap.forEach((d: any) => {
                productsList.push({ id: d.id, ...d.data() });
              });

              // 3. Generate suggestion
              const result = await generatePostPurchaseUpsell(order, customerOrders, productsList);

              // 4. Send via Twilio/WhatsApp automatically!
              const finalPhone = normalizePhone(order.customerPhone);
              const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
              const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;

              console.log(`[AI Upsell System] AUTO-SENDING WhatsApp cross-sell to ${order.customerName} (${finalPhone}): ${result.recommendedProductName}`);
              
              const client = twilio(
                process.env.TWILIO_ACCOUNT_SID || "ACmock",
                process.env.TWILIO_AUTH_TOKEN || "mock"
              );

              if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_ACCOUNT_SID.startsWith("ACmock")) {
                await client.messages.create({
                  from: formattedBotNum,
                  to: `whatsapp:${finalPhone}`,
                  body: result.suggestedMessage
                });
              }

              // Record activity history
              await addDoc(collection(dbRef, "activities"), {
                from: formattedBotNum,
                to: `+${finalPhone}`,
                message: result.suggestedMessage,
                status: "respondido",
                whatsappStatus: "sent",
                manualAgent: "AI Post-Purchase Automatic Followup",
                createdAt: serverTimestamp(),
                storeId: order.storeId || ""
              });

              // Save into Firestore
              await updateDoc(doc(dbRef, "orders", orderId), {
                upsellProfile: result.customerProfile,
                upsellRecommendedProductId: result.recommendedProductId,
                upsellRecommendedProductName: result.recommendedProductName,
                upsellSuggestedMsg: result.suggestedMessage,
                upsellReasoning: result.reasoning,
                upsellSent: true,
                upsellSentAt: Date.now(),
                upsellStatus: "enviado",
                triggerUpsellImmediately: false // Reset flag
              });

            } catch (upsellErr: any) {
              console.error(`[AI Upsell System] Failed automatic upsell for order ${orderId}:`, upsellErr.message);
            }
          }
        }
      } catch (err: any) {
        console.error("[Tracking System] Error in background scanner interval:", err.message);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  // Launch background tracking scanner
  startBackgroundTrackingChecker();

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

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const originalMapPath = path.join(process.cwd(), 'src', 'original-images-map.json');

// Load Catalog
if (!fs.existsSync(catalogPath)) {
  console.error("catalog.json not found!");
  process.exit(1);
}
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

// Load Original Map
let originalMap: Record<string, string> = {};
if (fs.existsSync(originalMapPath)) {
  originalMap = JSON.parse(fs.readFileSync(originalMapPath, 'utf-8'));
}

// 1. Map for the 16 Automotive Products (with beautiful, 100% relevant and premium Unsplash URLs)
const automotiveImages: Record<string, string> = {
  "cables-inicio-100": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800", // Jumper cables on car battery
  "camara-dvr-25": "https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&q=80&w=800", // Dashcam
  "cera-m1-cojineria": "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&q=80&w=800", // Car leather detailing polish
  "compresor-aire-2cil": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=800", // Heavy duty mechanical compressor
  "compresor-portatil-digital": "https://images.unsplash.com/photo-1622146115937-be49cc053e8a?auto=format&fit=crop&q=80&w=800", // Handheld tire pump / compressor
  "convertidor-veh-carga": "https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&q=80&w=800", // Power adapter plug
  "hidro-lavadora-48v": "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=800", // Pressure car washing
  "holder-cargador-inalambr": "https://images.unsplash.com/photo-1620054707682-1ced56da59d9?auto=format&fit=crop&q=80&w=800", // Wireless phone holder inside car
  "kit-renovacion-veh": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800", // Car detailing bottles and microfiber
  "maletin-kit-carretera": "https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=800", // Car first aid/safety kit
  "mini-aspiradora-port": "https://images.unsplash.com/photo-1563161402-8b11e247b654?auto=format&fit=crop&q=80&w=800", // Car handheld vacuum cleaner
  "parasol-vehiculo": "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80&w=800", // Sunny car windshield cover
  "saca-golpes-herramie": "https://images.unsplash.com/photo-1617400325113-ac054363daeb?auto=format&fit=crop&q=80&w=800", // Auto dent repair tool
  "sistema-antirrobo-veh": "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800", // Alarm remote controller fob
  "soporte-silicona-veh": "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=800", // Silicone dash holder
  "ventilador-doble-360": "https://images.unsplash.com/photo-1618944847023-38aa001235f0?auto=format&fit=crop&q=80&w=800" // Portable air fan for car dashboard
};

// 2. Map for the 11 cloudfront products (high-quality Dropi CDN originals)
const cloudfrontImages: Record<string, string> = {
  "maquina-donas-x7": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2025957/1766178012IMG_7506.jpeg",
  "limpiadora-vapor": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2109535/1776611984D_NQ_NP_772290-MCO101261817599_122025-O.webp",
  "candado-alarma-grande": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2012644/1764617070CANDADO%20ALARMA.png",
  "destornillador-atornillador-electrico": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1523617/17364886701.jpg",
  "inter-comunicador-y10": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2144351/17786277011001247160.webp",
  "religioso-w-213": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/845654/RELIGIOSO-W-213-jpg.jpg",
  "modem-wifi-portatil": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2118726/1774718497Photoroom_20260328_121845.JPG",
  "potenmax-gomas": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1805565/1746404603POTENMAX%20X%2060%20GOMAS.jpeg",
  "lampara-led-sensor": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/562913/17801683841711227232LAMPARA%20INDUCCION.%20MARCA_%20EVER%20BRITE,%20PANEL%20SOLAR%20.44W,%20%20BATERIA%20DE%20LITIUM%20600%20mAH,%20LED%204X6000K%200.8W%20FK23D-48.7-dropicup.png",
  "pistola-paint-zoom": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2018112/1765293903OIP%20(1).webp",
  "pistola-pintura": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2018112/1765293903OIP%20(1).webp", // alias
  "combo-compresor-linterna": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1747538/1744056531Post%20de%20Instagram%20nuevo%20producto%20Minimalista%20Beige%20Marr%C3%B3n%20Blanco%20%20(27).png"
};

// 3. Fallback High-Quality keyword-based Unsplash search terms to make sure "all other products" have fully relevant images
function getPremiumUnsplashUrl(name: string, category: string, id: string): string {
  const norm = name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s-]/g, ""); // strip special characters

  // Handcrafted keyword map with beautiful high-resolution product photos
  if (norm.includes("glucosamina") || norm.includes("chondroitin")) {
    return "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=800"; // supplements
  }
  if (norm.includes("shilajit")) {
    return "https://images.unsplash.com/photo-1611070973770-b1a6726104e9?auto=format&fit=crop&q=80&w=800"; // black mineral resin
  }
  if (norm.includes("ashwagandha")) {
    return "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=800";
  }
  if (norm.includes("parlante") || norm.includes("altavoz") || norm.includes("bocina")) {
    return "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=800"; // bluetooth speaker
  }
  if (norm.includes("audifono") || norm.includes("audifonos") || norm.includes("diadema") || norm.includes("earbuds")) {
    return "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800"; // modern earbuds
  }
  if (norm.includes("reloj") || norm.includes("smartwatch") || norm.includes("cronometro")) {
    return "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&q=80&w=800"; // smartwatch
  }
  if (norm.includes("drone") || norm.includes("dron")) {
    return "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80&w=800"; // flying drone
  }
  if (norm.includes("camara") || norm.includes("cámara") || norm.includes("dvr")) {
    return "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800"; // action camera
  }
  if (norm.includes("depilador") || norm.includes("afeitar") || norm.includes("depiladora") || norm.includes("barbera") || norm.includes("patillera")) {
    return "https://images.unsplash.com/photo-1626015569429-23e98031d99e?auto=format&fit=crop&q=80&w=800"; // shaver trimmer
  }
  if (norm.includes("cepillo") || norm.includes("plancha") || norm.includes("secador")) {
    return "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800"; // hair salon tools
  }
  if (norm.includes("organizador") && norm.includes("zapatos")) {
    return "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&q=80&w=800"; // shoe rack
  }
  if (norm.includes("organizador") && norm.includes("ropa")) {
    return "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&q=80&w=800"; // closet storage
  }
  if (norm.includes("organizador")) {
    return "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=800"; // aesthetic organizer
  }
  if (norm.includes("linterna")) {
    return "https://images.unsplash.com/photo-1558244661-d248897f7bc4?auto=format&fit=crop&q=80&w=800"; // flashlight in hand
  }
  if (norm.includes("juguete") || norm.includes("muñeca") || norm.includes("muneca") || norm.includes("pista") || norm.includes("carritos")) {
    return "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&q=80&w=800"; // kids toy
  }
  if (norm.includes("sarten") || norm.includes("sartén") || norm.includes("olla") || norm.includes("cacerola") || norm.includes("wok")) {
    return "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800"; // frying pan cooking
  }
  if (norm.includes("cuchillo") || norm.includes("cuchillos")) {
    return "https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&q=80&w=800"; // stainless steel chef knife
  }
  if (norm.includes("luces") || norm.includes("led") || norm.includes("proyector") || norm.includes("manguera led")) {
    return "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?auto=format&fit=crop&q=80&w=800"; // colored led strips / room lighting
  }
  if (norm.includes("faja") || norm.includes("corset") || norm.includes("moldeadora")) {
    return "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&q=80&w=800"; // slim belt / corset
  }
  if (norm.includes("tensiometro") || norm.includes("oximetro") || norm.includes("pulso") || norm.includes("termometro")) {
    return "https://images.unsplash.com/photo-1584515901187-601007a827e5?auto=format&fit=crop&q=80&w=800"; // clinical measurement devices
  }
  if (norm.includes("maquillaje") || norm.includes("cosmetiquera") || norm.includes("sombras") || norm.includes("brochas")) {
    return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=800"; // high quality makeup kit
  }
  if (norm.includes("termo") || norm.includes("vaso") || norm.includes("botella")) {
    return "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800"; // metal thermos water bottle
  }
  if (norm.includes("maca") || norm.includes("citrato") || norm.includes("magnesio") || norm.includes("gomas") || norm.includes("suplemento") || norm.includes("colageno") || norm.includes("collagen")) {
    return "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=800"; // wellness vitamin bottle
  }
  if (norm.includes("bolso") || norm.includes("mochila") || norm.includes("maleta") || norm.includes("maletin") || norm.includes("morral")) {
    return "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800"; // leather or canvas bag
  }
  if (norm.includes("mopa") || norm.includes("trapero") || norm.includes("limpiador") || norm.includes("lavadora") || norm.includes("aspiradora")) {
    return "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800"; // cleaning gear
  }
  if (norm.includes("gimnasio") || norm.includes("banda") || norm.includes("pesa") || norm.includes("ejercicio") || norm.includes("mancuerna") || norm.includes("rodillera")) {
    return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=800"; // premium home workout gear
  }

  // Category based smart defaults (to bypass low-res loremflickr with highly refined Unsplash category hero photos)
  const cat = category.toLowerCase();
  if (cat.includes("tecnologia") || cat.includes("electronics")) {
    return "https://images.unsplash.com/photo-1468436139062-f60a71c5c892?auto=format&fit=crop&q=80&w=800"; // sleek gadgets
  }
  if (cat.includes("hogar") || cat.includes("home")) {
    return "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800"; // neat room / home decor
  }
  if (cat.includes("cocina") || cat.includes("kitchen") || cat.includes("cocinar")) {
    return "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800"; // modern kitchenware
  }
  if (cat.includes("salud") || cat.includes("wellness") || cat.includes("health")) {
    return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800"; // organic green wellness
  }
  if (cat.includes("belleza") || cat.includes("beauty") || cat.includes("cosmeticos")) {
    return "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=800"; // gorgeous cosmetic bottles
  }
  if (cat.includes("mascotas") || cat.includes("pets") || cat.includes("perros") || cat.includes("gatos")) {
    return "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800"; // cute dog looking up
  }
  if (cat.includes("herramientas") || cat.includes("tools") || cat.includes("ferreteria")) {
    return "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=800"; // high quality steel tools
  }
  if (cat.includes("moda") || cat.includes("fashion") || cat.includes("ropa")) {
    return "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800"; // elegant shopping fashion bag
  }

  // Fallback
  return "https://images.unsplash.com/photo-1472851294608-062f824d296e?auto=format&fit=crop&q=80&w=800"; // Premium store fallback
}

// 4. Update the catalog array
let totalUpdated = 0;
let preservedOriginals = 0;
let restoredAutomotive = 0;
let restoredCloudfront = 0;
let optimizedFallbacks = 0;

catalog.products = catalog.products.map((p: any) => {
  let targetUrl = p.imageUrl;

  if (originalMap[p.id]) {
    // Priority 1: Original map verified MercadoLibre image
    targetUrl = originalMap[p.id];
    preservedOriginals++;
  } else if (automotiveImages[p.id]) {
    // Priority 2: Automotive specialized premium Unsplash shot
    targetUrl = automotiveImages[p.id];
    restoredAutomotive++;
  } else if (cloudfrontImages[p.id]) {
    // Priority 3: Original Dropi Cloudfront image
    targetUrl = cloudfrontImages[p.id];
    restoredCloudfront++;
  } else {
    // Priority 4: Dynamic high-quality Unsplash image to avoid loremflickr
    targetUrl = getPremiumUnsplashUrl(p.name, p.category || '', p.id);
    optimizedFallbacks++;
  }

  p.imageUrl = targetUrl;
  totalUpdated++;
  return p;
});

// Save updated catalog
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
console.log(`\n=== CATALOG IMAGE RESTORATION REPORT ===`);
console.log(`- Total products in catalog: ${totalUpdated}`);
console.log(`- Preserved original MercadoLibre images: ${preservedOriginals}`);
console.log(`- Restored premium automotive products: ${restoredAutomotive}`);
console.log(`- Restored Dropi cloudfront originals: ${restoredCloudfront}`);
console.log(`- Optimized other generic products (high-res Unsplash): ${optimizedFallbacks}`);
console.log(`=========================================\n`);

// 5. Run seed-all.ts to push all changes directly to Firestore databases of all active stores
console.log("Seeding all stores in Firestore to apply correct images...");
try {
  const seedOutput = execSync("npx tsx seed-all.ts", { encoding: 'utf-8' });
  console.log("Firestore Seeding Output:\n", seedOutput);
  console.log("\n✅ SUCCESS: All product images are beautifully restored in both catalog.json and Firestore!");
} catch (err: any) {
  console.error("❌ Seeding error:", err.message);
  process.exit(1);
}

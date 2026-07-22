import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

// Existing products with updated images and metadata
const updatedExistingProducts = [
  {
    "id": "maquina-donas-x7",
    "name": "Máquina De Donas X7",
    "description": "Prepara deliciosas donas caseras en minutos con esta máquina de diseño compacto y placas antiadherentes.",
    "category": "cocina",
    "cost": 43000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2025957/1766178012IMG_7506.jpeg",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "limpiadora-vapor",
    "name": "Limpiadora A Vapor",
    "description": "Limpiador a vapor portátil de alta presión con múltiples accesorios para desinfectar y limpiar azulejos, ventanas y cocinas.",
    "category": "cocina",
    "cost": 85000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2109535/1776611984D_NQ_NP_772290-MCO101261817599_122025-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "candado-alarma-grande",
    "name": "Candado Alarma Grande",
    "description": "Candado de alta seguridad con alarma integrada de 110dB que se activa ante golpes o forcejeos. Incluye 3 llaves.",
    "category": "hogar",
    "cost": 17200,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2012644/1764617070CANDADO%20ALARMA.png",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "destornillador-atornillador-electrico",
    "name": "Destornillador Atornillador Eléctrico",
    "description": "Destornillador eléctrico recargable inalámbrico de diseño compacto con juego completo de puntas y cable de carga USB.",
    "category": "tecnologia",
    "cost": 22900,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1523617/17364886701.jpg",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "inter-comunicador-y10",
    "name": "Inter Comunicador Y10",
    "description": "Intercomunicador Bluetooth Y10 para cascos de moto con luces RGB, reducción de ruido y manos libres impermeable.",
    "category": "tecnologia",
    "cost": 40000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2144351/17786277011001247160.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "religioso-w-213",
    "name": "Religioso W 213",
    "description": "Cuadro decorativo políptico religioso de 5 paneles de alta calidad con diseño del Sagrado Corazón de Jesús.",
    "category": "hogar",
    "cost": 84000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/845654/RELIGIOSO-W-213-jpg.jpg",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "modem-wifi-portatil",
    "name": "Módem Wifi Portátil Pro",
    "description": "Módem router wifi portátil 4G/5G LTE recargable de alta velocidad. Conecta hasta 10 dispositivos simultáneamente.",
    "category": "tecnologia",
    "cost": 135000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2118726/1774718497Photoroom_20260328_121845.JPG",
    "currency": "COP",
    "provider": "Dropi"
  }
];

// 4 New products to add to catalog
const newProducts = [
  {
    "id": "potenmax-gomas",
    "name": "Potenmax X 60 Gomas",
    "description": "Potenmax gomas masticables con borojó y chontaduro. Estimulante natural, energético, ayuda a aumentar las defensas y reforzar el organismo.",
    "category": "salud",
    "cost": 35000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1805565/1746404603POTENMAX%20X%2060%20GOMAS.jpeg",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "lampara-led-sensor",
    "name": "Lámpara Led Sensor Ever Brite",
    "description": "Lámpara solar Ever Brite con sensor de movimiento, panel de 0.44W, batería de litio de 600 mAh y luces LED de alta luminosidad. Ideal para exteriores, jardín y fachadas.",
    "category": "hogar",
    "cost": 29000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/562913/17801683841711227232LAMPARA%20INDUCCION.%20MARCA_%20EVER%20BRITE,%20PANEL%20SOLAR%20.44W,%20%20BATERIA%20DE%20LITIUM%20600%20mAH,%20LED%204X6000K%200.8W%20FK23D-48.7-dropicup.png",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "pistola-pintura",
    "name": "Pistola De Pintura Eléctrica",
    "description": "Pistola pulverizadora Wap de pintura eléctrica portátil de alto rendimiento. Permite pintar de forma rápida, uniforme y profesional con diseño ultra ergonómico.",
    "category": "hogar",
    "cost": 75000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/2018112/1765293903OIP%20(1).webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "combo-compresor-linterna",
    "name": "Combo Compresor Multifuncional + Linterna",
    "description": "Combo inteligente de compresor de aire digital inalámbrico recargable de alta presión y linterna de alta potencia para emergencias y mantenimiento vial.",
    "category": "herramientas",
    "cost": 112000,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1747538/1744056531Post%20de%20Instagram%20nuevo%20producto%20Minimalista%20Beige%20Marr%C3%B3n%20Blanco%20%20(27).png",
    "currency": "COP",
    "provider": "Dropi"
  }
];

// Apply edits to existing products in catalog and combine with the new ones
const allProductsToRecalculate = [...catalog.products];

// 1. First, apply any image updates to existing products
for (const item of updatedExistingProducts) {
  const idx = allProductsToRecalculate.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    allProductsToRecalculate[idx] = { ...allProductsToRecalculate[idx], ...item };
  } else {
    allProductsToRecalculate.push(item);
  }
}

// 2. Second, add new products if they don't exist yet (or update them if they do)
for (const item of newProducts) {
  const idx = allProductsToRecalculate.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    allProductsToRecalculate[idx] = { ...allProductsToRecalculate[idx], ...item };
  } else {
    allProductsToRecalculate.push(item);
  }
}

// Pricing Formula constants
const FLETE = 15000;
const PUBLICIDAD = 15000;
const DEVOLUCIONES = 3000; // Provision base for ~10-15% return rate
const GANANCIA_DESEADA = 20000;
const COMISION_DROPI_PCT = 0.06; // 6% Commission

// Recalculate prices
catalog.products = allProductsToRecalculate.map((p: any) => {
  const cost = p.cost || 0;
  // Formula: (Cost + Flete + Publicidad + Devoluciones + Profit) / (1 - DropiCommission)
  const baseCostSum = cost + FLETE + PUBLICIDAD + DEVOLUCIONES + GANANCIA_DESEADA;
  const targetPrice = baseCostSum / (1 - COMISION_DROPI_PCT);
  
  // Format psychological price (ends in 900)
  // E.g., if 103,723 -> Math.ceil(103,723 / 1000) * 1000 - 100 = 103,900
  const thousands = Math.ceil(targetPrice / 1000);
  const finalPrice = (thousands * 1000) - 100;
  
  console.log(`[Recalc] ${p.name}: Cost=${cost} | RawTarget=${Math.round(targetPrice)} | FinalPrice=${finalPrice}`);
  p.price = finalPrice;
  p.freight = FLETE; // Ensure flete is set to 15000
  return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`Updated catalog.json successfully with ${catalog.products.length} products.`);

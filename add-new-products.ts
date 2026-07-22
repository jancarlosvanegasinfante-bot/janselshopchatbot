import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const newImagesAndProducts = [
  {
    "id": "tina-plegable",
    "name": "Tina Plegable",
    "description": "Práctica tina plegable portátil de alta calidad para bebés o mascotas, ultra compacta, segura, ergonómica y fácil de guardar.",
    "category": "hogar",
    "cost": 42500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908472-MCO72754605178_112023-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "glucosamina-chondroitin",
    "name": "Glucosamin Chondroitin Msm",
    "description": "Suplemento alimenticio avanzado de Glucosamina, Condroitina y MSM para el fortalecimiento de articulaciones, cartílagos y ligamentos.",
    "category": "salud",
    "cost": 34500,
    "stock": 999,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_660995-MCO48325838520_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "pista-de-carros",
    "name": "Pista De Carros",
    "description": "Pista de carros interactiva de alta velocidad con giros extremos de 360 grados, propulsor y luces. Diversión garantizada.",
    "category": "hogar",
    "cost": 74500,
    "stock": 300,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_895393-MLA50901235122_072022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "masajeador-gun-8820",
    "name": "Masajeador Gun 8820",
    "description": "Pistola de masaje muscular profunda con 6 velocidades y múltiples cabezales ajustables para aliviar tensión, fatiga y dolor.",
    "category": "salud",
    "cost": 50000,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_934149-MCO46182181513_052021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "mini-gun-lanzador-hidrogel",
    "name": "Mini Gun Lanzador De Dardos E Hidrogel",
    "description": "Divertido lanzador semiautomático con dardos suaves de espuma y balines de hidrogel ecológicos para batallas seguras en exteriores.",
    "category": "hogar",
    "cost": 64500,
    "stock": 300,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_632349-MCO51123498112_082022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "fbmax-1000ml",
    "name": "Fbmax 1000 Ml",
    "description": "Bebida energizante premium y suplemento natural concentrado FBMAX para potenciar el rendimiento físico, mental y la quema de grasa.",
    "category": "salud",
    "cost": 29900,
    "stock": 1000,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603845-MCO74491959345_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "cepillo-secador-plancha-aguacate",
    "name": "Cepillo Secador Y Plancha De Aguacate",
    "description": "Kit profesional de belleza compuesto por cepillo secador giratorio y plancha alisadora con placas infundidas en aceite de aguacate y macadamia.",
    "category": "belleza",
    "cost": 69500,
    "stock": 291,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_825835-MCO74100913554_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "probador-de-corriente",
    "name": "Probador De Corriente",
    "description": "Lápiz detector y probador de corriente digital sin contacto, seguro, con alerta sonora y pantalla retroiluminada.",
    "category": "herramientas",
    "cost": 23000,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_753139-MCO48100913123_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "sopladora-larga-inalambrica-2bat",
    "name": "Sopladora Larga Inalambrica 2 Baterias",
    "description": "Sopladora inalámbrica ultra potente de largo alcance, ideal para jardinería, talleres y limpieza de hojas. Incluye 2 baterías de alto rendimiento.",
    "category": "herramientas",
    "cost": 74500,
    "stock": 496,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908123-MCO74512938123_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "shilajit-1000ml",
    "name": "Shilajit 1000 Ml",
    "description": "Extracto líquido purificado de Shilajit del Himalaya de 1000 ml. Rico en ácido fúlvico y 84+ minerales para maximizar tu energía y enfoque.",
    "category": "salud",
    "cost": 25000,
    "stock": 930,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_723491-MCO74291849182_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "mini-martillo-8oz",
    "name": "Mini Martillo 8 Oz",
    "description": "Martillo de uña mini de 8 oz con mango ergonómico antideslizante de goma. Compacto y sumamente resistente para el hogar.",
    "category": "herramientas",
    "cost": 30000,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918239-MCO49102931293_022022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "calostrum-calostro-500g",
    "name": "Calostrum Calostro Bovino 500g",
    "description": "Polvo de Calostro Bovino 100% puro y liofilizado de 500g. Potencia el sistema inmune, mejora la digestión y regeneración celular.",
    "category": "salud",
    "cost": 31500,
    "stock": 499,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_834912-MCO74910293812_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "bichota-500ml",
    "name": "Bichota 500 Ml",
    "description": "Suplemento alimenticio líquido Bichota de 500 ml formulado con colágeno, biotina y antioxidantes para resaltar la belleza y vitalidad de la mujer.",
    "category": "salud",
    "cost": 30000,
    "stock": 1000,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603912-MCO74910293910_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "cargador-carro-sky-dolphin",
    "name": "Cargador Carro Sky Dolphin Usb 3a",
    "description": "Cargador vehicular rápido Sky Dolphin de 3 amperios con puerto USB inteligente y protección contra sobrecargas.",
    "category": "autos",
    "cost": 20500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819234-MCO50102931293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "triturador-de-pollo",
    "name": "Triturador De Pollo",
    "description": "Práctico y rápido triturador de carne y pollo manual con asas ergonómicas y base de silicona antideslizante para tu cocina.",
    "category": "cocina",
    "cost": 30500,
    "stock": 499,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_728391-MCO74102931923_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "maquina-barbera-patillera",
    "name": "Maquina Barbera Patillera",
    "description": "Máquina patillera y delineadora profesional inalámbrica con cuchillas ultra afiladas y pantalla LCD de carga. Ideal para contornos.",
    "category": "belleza",
    "cost": 31500,
    "stock": 20,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_923849-MCO48102931234_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "porta-vaso-carro-multifuncional",
    "name": "Porta Vaso Para Carro Multifuncional",
    "description": "Expansor multifuncional de portavasos para automóvil con rotación ajustable 360 grados, soporte para celular y compartimento extra.",
    "category": "autos",
    "cost": 44500,
    "stock": 300,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918231-MCO74192839123_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "herramienta-recoger-fruta",
    "name": "Herramienta Para Recoger Fruta Pequeña",
    "description": "Dispositivo para recolectar fruta desde el suelo o altura de manera segura, sin dañar la planta ni la fruta.",
    "category": "hogar",
    "cost": 39500,
    "stock": 499,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821923-MCO74291829312_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "juego-candados",
    "name": "Juego Candados",
    "description": "Kit de candados blindados de alta resistencia fabricados en aleación de alta dureza con juego de llaves de seguridad.",
    "category": "hogar",
    "cost": 69500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_721839-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "desengrasante-lava-motor",
    "name": "Desengrasante Lava Motor",
    "description": "Poderoso limpiador desengrasante biodegradable de acción rápida para eliminar aceite pesado y suciedad en motores y autopartes.",
    "category": "autos",
    "cost": 54500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_912839-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "parlante-para-ducha",
    "name": "Parlante Para Ducha",
    "description": "Mini altavoz Bluetooth impermeable IPX4 con ventosa, micrófono integrado para llamadas y excelente calidad de audio.",
    "category": "tecnologia",
    "cost": 24500,
    "stock": 1000,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821920-MCO49102931293_022022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "candida-cleanse",
    "name": "Candida Cleanse",
    "description": "Suplemento natural de limpieza y desintoxicación intestinal para combatir el exceso de levaduras de Candida y mejorar la digestión.",
    "category": "salud",
    "cost": 36900,
    "stock": 998,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_718293-MCO74102931293_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "resveratrol-nath-1000ml",
    "name": "Resveratrol Nath X 1000 Ml Nh",
    "description": "Antioxidante natural líquido a base de extracto concentrado de uva Resveratrol de 1000 ml para el cuidado cardiovascular.",
    "category": "salud",
    "cost": 25900,
    "stock": 1000,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_601928-MCO74291829312_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "audifonos-sound15-power",
    "name": "Audifonos Sound 15 Power Bluetooth",
    "description": "Auriculares inalámbricos de diadema de alta fidelidad, con cancelación pasiva de ruido, graves profundos y almohadillas acolchadas.",
    "category": "tecnologia",
    "cost": 56500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_812931-MCO74291823912_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "molino-de-verduras",
    "name": "Molino De Verduras",
    "description": "Molino manual premium giratorio de cocina para rallar, rebanar y triturar todo tipo de verduras en segundos con total seguridad.",
    "category": "cocina",
    "cost": 34500,
    "stock": 299,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_901239-MCO74192831293_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "bombillo-solar-emergencia",
    "name": "Bombillo Solar Emergencia",
    "description": "Bombillo solar portátil LED de emergencia recargable con panel solar incorporado, puerto USB de carga y gancho para colgar.",
    "category": "hogar",
    "cost": 34500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819231-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "cepillo-secador-aguacate-solo",
    "name": "Cepillo Secador Aguacate",
    "description": "Cepillo alisador y secador 3 en 1 con revestimiento de cerámica enriquecido con aceite de aguacate para un secado rápido y sin frizz.",
    "category": "belleza",
    "cost": 34500,
    "stock": 149,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819321-MCO51293812938_082022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "aceite-post-afeitador-acido",
    "name": "Aceite Post Afeitador Acido Hialuronico",
    "description": "Aceite reparador post-afeitado ultra hidratante formulado con Ácido Hialurónico para prevenir irritaciones y calmar la piel.",
    "category": "belleza",
    "cost": 39500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_923812-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "juguete-perro-grande",
    "name": "Juguete Perro Grande",
    "description": "Mordedor ultra duradero y súper resistente de caucho no tóxico para perros medianos y grandes. Ideal para masticadores fuertes.",
    "category": "hogar",
    "cost": 74500,
    "stock": 1,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821938-MCO50293812938_062022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "camara-exterior-doble-lente",
    "name": "Camara De Exterior Doble Lente",
    "description": "Cámara de seguridad para exteriores de doble lente de alta definición con rotación PTZ, visión nocturna infrarroja y a color con app móvil.",
    "category": "tecnologia",
    "cost": 89500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918239-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "jabonera-transparente-doble",
    "name": "Jabonera Transparente Doble",
    "description": "Soporte de doble bandeja transparente autoadhesivo para jabones. Diseño elegante que drena de manera eficiente en baños y duchas.",
    "category": "hogar",
    "cost": 27500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_812938-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "pistola-hidrogel-sr079b",
    "name": "Pistola Hidrogel SR079B",
    "description": "Lanzador de juguete automático de balines de hidrogel ecológicos modelo SR079B. Incluye batería de larga duración, mira telescópica y accesorios de combate.",
    "category": "hogar",
    "cost": 89500,
    "stock": 500,
    "freight": 15000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918231-MCO74102931293_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  }
];

// Append or update products
for (const p of newImagesAndProducts) {
  const existingIdx = catalog.products.findIndex((prod: any) => prod.id === p.id);
  if (existingIdx >= 0) {
    catalog.products[existingIdx] = { ...catalog.products[existingIdx], ...p };
  } else {
    catalog.products.push(p);
  }
}

// Pricing constants
const FLETE = 15000;
const PUBLICIDAD = 15000;
const DEVOLUCIONES = 3000;
const GANANCIA_DESEADA = 20000;
const COMISION_DROPI_PCT = 0.06;

// Recalculate
catalog.products = catalog.products.map((p: any) => {
  const cost = p.cost || 0;
  const baseCostSum = cost + FLETE + PUBLICIDAD + DEVOLUCIONES + GANANCIA_DESEADA;
  const targetPrice = baseCostSum / (1 - COMISION_DROPI_PCT);
  const thousands = Math.ceil(targetPrice / 1000);
  const finalPrice = (thousands * 1000) - 100;
  p.price = finalPrice;
  p.freight = FLETE;
  return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`Successfully updated catalog with ${catalog.products.length} products total.`);

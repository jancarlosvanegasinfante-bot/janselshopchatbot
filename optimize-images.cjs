/**
 * ============================================================
 *  📸 OPTIMIZE & ASSIGN IMAGES - JANSEL SHOP v2
 *  ============================================================
 *  Este script:
 *  1. Lee imágenes de C:\Users\tatia\Downloads\ima\ima\
 *  2. Las optimiza (reduce tamaño, comprime con sharp)
 *  3. Asigna a productos EXISTENTES del catálogo
 *  4. AGREGA productos NUEVOS al catálogo para imágenes sin mapeo
 *  5. Actualiza catalog.json con todas las rutas
 *
 *  CÓMO EJECUTAR:
 *    cd "C:\Users\tatia\Downloads\jansel-shop (1)"
 *    npm install sharp
 *    node optimize-images.cjs
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════

const SOURCE_DIR = "C:\\Users\\tatia\\Downloads\\ima\\ima";
const PROJECT_DIR = __dirname;
const CATALOG_PATH = path.join(PROJECT_DIR, "src", "catalog.json");
const IMAGES_DIR = path.join(PROJECT_DIR, "src", "assets", "images");

const MAX_WIDTH = 800;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;

const DEFAULT_COST = 0;
const DEFAULT_STOCK = 20;
const DEFAULT_FREIGHT = 15000;
const DEFAULT_CURRENCY = "COP";
const DEFAULT_PROVIDER = "Dropi";
const DEFAULT_PRICE = 0;

// ═══════════════════════════════════════════════════════════════
//  IMAGE FILENAME → EXISTING PRODUCT ID MAPPING
// ═══════════════════════════════════════════════════════════════

const IMAGE_TO_PRODUCT = {
  "ACEITE AFEITADOR.png": "aceite-post-afeitador-acido",
  "ATORNILLADOR INALAMBRICO.png": "destornillador-atornillador-electrico",
  "BOLSOKIT DE CARRETERA.png": "maletin-kit-carretera",
  "BROCHA MAGICA.png": "brocha-magica-maquillaje",
  "CABLES DE BATERIA.png": "cables-inicio-100",
  "CANDADO ALARMA.jpeg": "candado-alarma-grande",
  "CARGADORCARRO USB.png": "cargador-carro-sky-dolphin",
  "CARGADOR DE BEBES.png": "cargador-bebes",
  "CARGADOR PARA BEBES.png": "cinturon-para-bebes",
  "CARPLAYMOTO.png": "carplay-para-moto",
  "CEPILLO ALIZADOR.png": "cepillo-alisador",
  "CEPILLO CECADOR.png": "cepillo-secador-aguacate-solo",
  "CEPILLO PLANCHA.png": "cepillo-secador-plancha-aguacate",
  "CERA M10.png": "cera-m1-cojineria",
  "CINTA ANTIDEZLIZANTE.png": "cinta-reflectiva-antideslizante",
  "COMPRESOR CICLON.png": "compresor-aire-2cil",
  "COMPRESOR.jpeg": "compresor-portatil-digital",
  "cuchillo vikingo.png": "cuchillo-vikingo",
  "DOBLE VENTILADOR.png": "ventilador-doble-360",
  "espejo retovisor camara.png": "camara-dvr-25",
  "espumador batidora.png": "espumador-batidora-electrica-4-en-1",
  "EXTRACTOR DE LECHE.png": "extractor-de-leche-recargable",
  "funda moto.png": "funda-protectora-para-moto",
  "HIDROLAVADORA INALAMBRICA.jpeg": "hidro-lavadora-48v",
  "INICIADOR DE VEHICULOS.png": "cargador-bateria-inteligente",
  "intercomunicador.png": "inter-comunicador-y10",
  "INVERSOR DE CORRIENTE.png": "convertidor-veh-carga",
  "KIT RENOVACION VEHICULO .png": "kit-renovacion-veh",
  "KIT SACAGOLPES.png": "saca-golpes-herramie",
  "LAMPARA LED.png": "lampara-led-sensor",
  "LAVAMOTOR.png": "desengrasante-lava-motor",
  "LIMPIADOR ELECTRICO.png": "limpiador-electrico-de-biberones",
  "maquina de donas.png": "maquina-donas-x7",
  "maquina patillera.png": "maquina-barbera-patillera",
  "maquillaje capibara.png": "maquillaje-capibara",
  "MINIASPIRADORA.jpeg": "mini-aspiradora-port",
  "modem wifi portatil.png": "modem-wifi-portatil",
  "molino de verduras.png": "molino-de-verduras",
  "MOPA LAVAAUTOS.png": "mopa-lavado-de-coche-microfibra",
  "PARASOL.png": "parasol-vehiculo",
  "parches acne.png": "parches-acne",
  "PORTAVASO.png": "porta-vaso-carro-multifuncional",
  "quita callos.png": "quita-callos",
  "RAYADOR ELECTRICO.png": "rayador-de-verdura-electrico",
  "SEGURO PARA VOLANTE.png": "volante-seguro-pro",
  "SISTEMA DE ALARMA UNIVERSAL.png": "sistema-antirrobo-veh",
  "soporte de carga.png": "holder-cargador-inalambr",
  "soporte de silicona vehiculo.png": "soporte-silicona-veh",
  "limpiador a vapor.png": "limpiadora-vapor",
  "porta comida.png": "lonchera-porta-comida-2-en-1",
};

// ═══════════════════════════════════════════════════════════════
//  NEW PRODUCT DEFINITIONS (imágenes sin producto en catálogo)
// ═══════════════════════════════════════════════════════════════

const NEW_PRODUCTS = [
  {
    imageFile: "bascula alta presicion.png",
    id: "bascula-alta-presicion",
    name: "Báscula Alta Precisión",
    category: "hogar",
    description: "Báscula de alta precisión para pesaje de alimentos y objetos pequeños. Ideal para cocina y uso doméstico.",
  },
  {
    imageFile: "caja de cosmeticos.png",
    id: "caja-cosmeticos",
    name: "Caja de Cosméticos",
    category: "belleza",
    description: "Estuche organizador de cosméticos con múltiples compartimentos. Perfecto para guardar y transportar tu maquillaje.",
  },
  {
    imageFile: "carpa de camping.png",
    id: "carpa-camping",
    name: "Carpa de Camping",
    category: "hogar",
    description: "Carpa plegable tipo paraguas para camping, playa y exteriores. Fácil de armar, resistente y portátil.",
  },
  {
    imageFile: "casco para bb.png",
    id: "casco-bebe-proteccion",
    name: "Casco Protector para Bebé",
    category: "hogar",
    description: "Casco de protección para bebés que están aprendiendo a caminar. Suave, transpirable y ajustable.",
  },
  {
    imageFile: "cortador de papas.png",
    id: "cortador-papas-fritas",
    name: "Cortador de Papas",
    category: "cocina",
    description: "Cortador de papas en tiras y en cubos. Práctico utensilio de cocina para preparar papas fritas caseras.",
  },
  {
    imageFile: "cortador de verduras en espiral.png",
    id: "cortador-verduras-espiral",
    name: "Cortador de Verduras en Espiral",
    category: "cocina",
    description: "Espiralizador de verduras para crear vegetales en forma de espiral. Perfecto para ensaladas y platos saludables.",
  },
  {
    imageFile: "escurridor gabinete.png",
    id: "escurridor-gabinete",
    name: "Escurridor para Gabinete",
    category: "cocina",
    description: "Organizador escurridor plegable para gabinete de cocina. Ideal para secar platos, cubiertos y vasos.",
  },
  {
    imageFile: "extractor polvo.png",
    id: "extractor-polvo-taladro",
    name: "Extractor de Polvo para Taladro",
    category: "herramientas",
    description: "Colector de polvo y suciedad para taladro. Evita que el polvo y los escombros caigan al suelo mientras perforas.",
  },
  {
    imageFile: "irrigador dental.png",
    id: "irrigador-dental",
    name: "Irrigador Dental",
    category: "salud",
    description: "Irrigador bucal eléctrico recargable con múltiples modos de presión. Limpieza profunda entre dientes y encías.",
  },
  {
    imageFile: "juego de cubiertos.png",
    id: "juego-cubiertos",
    name: "Juego de Cubiertos",
    category: "cocina",
    description: "Set completo de cubiertos de acero inoxidable. Incluye cuchillos, tenedores y cucharas para toda la familia.",
  },
  {
    imageFile: "lavadora de brochas.png",
    id: "lavadora-brochas-maquillaje",
    name: "Lavadora de Brochas de Maquillaje",
    category: "belleza",
    description: "Limpiador eléctrico giratorio para brochas y pinceles de maquillaje. Limpia y seca tus brochas de forma rápida.",
  },
  {
    imageFile: "lonchera de acero.png",
    id: "lonchera-acero-inoxidable",
    name: "Lonchera de Acero Inoxidable",
    category: "cocina",
    description: "Lonchera térmica de acero inoxidable con compartimentos. Mantiene los alimentos calientes por horas.",
  },
  {
    imageFile: "machacador de ajos.png",
    id: "machacador-ajos",
    name: "Machacador de Ajos",
    category: "cocina",
    description: "Triturador de ajos manual de acero inoxidable. Pica y machaca ajos de forma rápida y sin esfuerzo.",
  },
  {
    imageFile: "maquina corte profesional.png",
    id: "maquina-corte-profesional",
    name: "Máquina de Corte Profesional",
    category: "belleza",
    description: "Máquina cortapelo profesional recargable con cuchillas de titanio y múltiples guías de corte.",
  },
  {
    imageFile: "mauillaje kuromi.png",
    id: "maquillaje-kuromi",
    name: "Maquillaje Kuromi",
    category: "belleza",
    description: "Set de maquillaje infantil temático de Kuromi. Incluye sombras, labiales y esmaltes no tóxicos.",
  },
  {
    imageFile: "molinillo electrico.png",
    id: "molinillo-electrico",
    name: "Molinillo Eléctrico",
    category: "cocina",
    description: "Molinillo eléctrico para especias, café y granos. Cuchillas de acero inoxidable y fácil de limpiar.",
  },
  {
    imageFile: "olla de cera.png",
    id: "olla-cera-depilacion",
    name: "Olla de Cera para Depilación",
    category: "belleza",
    description: "Calentador de cera para depilación con control de temperatura. Incluye espátulas y cera vegetal.",
  },
  {
    imageFile: "olla de chocolate.png",
    id: "olla-chocolate-fondue",
    name: "Olla de Chocolate Fondue",
    category: "cocina",
    description: "Olla eléctrica para fondue de chocolate con temperatura regulable. Perfecta para postres y ocasiones especiales.",
  },
  {
    imageFile: "olla de vidrio.png",
    id: "olla-vidrio",
    name: "Olla de Vidrio",
    category: "cocina",
    description: "Olla de vidrio templado apta para cocina, horno y microondas. Resistente al calor y fácil de limpiar.",
  },
  {
    imageFile: "organizador de condimentos.png",
    id: "organizador-condimentos",
    name: "Organizador de Condimentos",
    category: "cocina",
    description: "Estante organizador para condimentos y especias con múltiples niveles. Ahorra espacio en la cocina.",
  },
  {
    imageFile: "organizador de loza.png",
    id: "organizador-loza",
    name: "Organizador de Loza",
    category: "hogar",
    description: "Organizador de platos y loza con separadores ajustables. Mantiene tu vajilla ordenada y protegida.",
  },
  {
    imageFile: "ORGANIZADOR DE UTENCILIOS.png",
    id: "organizador-utensilios-cocina",
    name: "Organizador de Utensilios de Cocina",
    category: "cocina",
    description: "Soporte organizador para utensilios de cocina con múltiples compartimentos. Mantén tus herramientas ordenadas.",
  },
  {
    imageFile: "organizador esquinero de condimentos.png",
    id: "organizador-esquinero-condimentos",
    name: "Organizador Esquinero de Condimentos",
    category: "cocina",
    description: "Organizador de esquina para condimentos y especias con base giratoria. Aprovecha el espacio de las esquinas.",
  },
  {
    imageFile: "PAPEL DE COCINA ADESIVO.png",
    id: "papel-cocina-adhesivo",
    name: "Papel de Cocina Adhesivo",
    category: "cocina",
    description: "Papel protector adhesivo para cocina antigrasa y resistente al agua. Fácil de instalar y limpiar.",
  },
  {
    imageFile: "pinza tres tubos sirena.png",
    id: "pinza-tres-tubos-sirena",
    name: "Pinza Tres Tubos Sirena",
    category: "hogar",
    description: "Pinza multifuncional de tres tubos con diseño sirena. Ideal para manualidades y uso doméstico.",
  },
  {
    imageFile: "plancha cabello avocado.png",
    id: "plancha-cabello-aguacate",
    name: "Plancha de Cabello con Aceite de Aguacate",
    category: "belleza",
    description: "Plancha alisadora de cabello con placas infundidas en aceite de aguacate. Deja el cabello suave y brillante.",
  },
  {
    imageFile: "plancha pro nova.png",
    id: "plancha-pro-nova",
    name: "Plancha Pro Nova",
    category: "belleza",
    description: "Plancha alisadora profesional de titanio con temperatura regulable hasta 230°C. Resultados de salón en casa.",
  },
  {
    imageFile: "RAYADOR Y CORTADOR DE FRUTA.png",
    id: "rayador-cortador-fruta",
    name: "Rayador y Cortador de Fruta",
    category: "cocina",
    description: "Herramienta 2 en 1 para rallar y cortar frutas. Diseño ergonómico y cuchillas de acero inoxidable.",
  },
  {
    imageFile: "REBANADOR DE CARNE.png",
    id: "rebanador-carne",
    name: "Rebanador de Carne",
    category: "cocina",
    description: "Cortador y rebanador de carne ajustable. Permite rebanar carnes frías, quesos y verduras con espesor regulable.",
  },
  {
    imageFile: "SANWICHERA FIGURAS.png",
    id: "sandwichera-figuras",
    name: "Sandwichera de Figuras",
    category: "cocina",
    description: "Sandwichera eléctrica con moldes intercambiables de figuras divertidas. Prepara sándwiches con formas para niños.",
  },
  {
    imageFile: "SARTEN ELECTRICO.png",
    id: "sarten-electrico",
    name: "Sartén Eléctrico",
    category: "cocina",
    description: "Sartén eléctrico antiadherente con temperatura regulable. Perfecto para cocinar sin necesidad de estufa.",
  },
  {
    imageFile: "SARTEN MULTIFUNCIONAL.png",
    id: "sarten-multifuncional",
    name: "Sartén Multifuncional",
    category: "cocina",
    description: "Sartén multifuncional con tapa de vidrio y múltiples usos. Antiadherente y apta para todo tipo de cocinas.",
  },
  {
    imageFile: "shampoo 3-1.png",
    id: "shampoo-3-en-1",
    name: "Shampoo 3 en 1",
    category: "belleza",
    description: "Champú, acondicionador y body wash 3 en 1 para hombre. Fórmula completa para el cuidado diario.",
  },
  {
    imageFile: "ventosa para masajes.png",
    id: "ventosa-masajes",
    name: "Ventosa para Masajes",
    category: "salud",
    description: "Set de ventosas de silicona para masajes terapéuticos. Ayuda a aliviar dolores musculares y mejorar la circulación.",
  },
];

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║    📸 OPTIMIZACIÓN Y ASIGNACIÓN DE IMÁGENES v2     ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  // ── 1. Check source dir ────────────────────────────────────
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ No se encuentra la carpeta: ${SOURCE_DIR}`);
    console.error("   Asegúrate de que las imágenes estén en Downloads\\ima\\ima");
    process.exit(1);
  }

  // ── 2. Ensure images dir ───────────────────────────────────
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // ── 3. Read catalog ────────────────────────────────────────
  let catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  const existingIds = new Set(catalog.products.map((p) => p.id));

  console.log(`📦 Catálogo actual: ${catalog.products.length} productos`);
  console.log(`📁 Imágenes fuente: ${SOURCE_DIR}`);
  console.log(`📁 Destino: ${IMAGES_DIR}`);
  console.log("");

  // ── 4. Install / load sharp ────────────────────────────────
  let sharp;
  try {
    sharp = require("sharp");
    console.log("✅ Sharp: disponible");
  } catch (_e) {
    console.log("⚠️  Sharp no instalado. Instalando...");
    try {
      execSync("npm install sharp", { cwd: PROJECT_DIR, stdio: "inherit" });
      sharp = require("sharp");
      console.log("✅ Sharp instalado correctamente");
    } catch (_err) {
      console.log("❌ No se pudo instalar sharp. Las imágenes se copiarán sin optimizar.");
      console.log("   Para optimizar, ejecuta: npm install sharp");
      console.log("");
    }
  }

  // ── 5. Get source image files ──────────────────────────────
  const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  const sourceFiles = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()));

  console.log(`🖼️  Imágenes encontradas: ${sourceFiles.length}`);
  console.log("");

  // ── 6. Build a quick-lookup for new product imageFiles ─────
  const newProductByImage = {};
  for (const np of NEW_PRODUCTS) {
    newProductByImage[np.imageFile] = np;
  }

  // ── 7. Process each image ──────────────────────────────────
  let mappedCount = 0;
  let newProductCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const updatedExisting = [];
  const addedNew = [];

  for (const file of sourceFiles) {
    const sourcePath = path.join(SOURCE_DIR, file);
    const ext = path.extname(file).toLowerCase();

    // Generate a safe output filename
    const baseName = path.basename(file, ext);
    const safeName = sanitizeFilename(baseName) || "image";

    // Decide target extension (sharp may change PNG→JPG later)
    let targetExt = ext;
    let outputName = `${safeName}${targetExt}`;
    let outputPath = path.join(IMAGES_DIR, outputName);

    // ── Check if this image maps to an existing product ──
    const productId = IMAGE_TO_PRODUCT[file];

    // ── Check if it's a new product ──
    const newProductDef = newProductByImage[file];

    // ── Skip if file already exists in images dir ──
    if (fs.existsSync(outputPath)) {
      console.log(`   📁 ${file} → ya existe, se omite`);
      skippedCount++;

      // Even when skipping, update the catalog ref if mapped
      if (productId && existingIds.has(productId)) {
        const prod = catalog.products.find((p) => p.id === productId);
        if (prod) {
          prod.imageUrl = `/src/assets/images/${outputName}`;
          updatedExisting.push({ id: productId, name: prod.name, img: outputName });
          mappedCount++;
        }
      } else if (newProductDef && !existingIds.has(newProductDef.id)) {
        // Create the new product entry even if image already exists
        newProductDef.imageUrl = `/src/assets/images/${outputName}`;
        catalog.products.push({
          id: newProductDef.id,
          name: newProductDef.name,
          category: newProductDef.category,
          cost: DEFAULT_COST,
          stock: DEFAULT_STOCK,
          freight: DEFAULT_FREIGHT,
          imageUrl: newProductDef.imageUrl,
          currency: DEFAULT_CURRENCY,
          provider: DEFAULT_PROVIDER,
          description: newProductDef.description,
          price: DEFAULT_PRICE,
          videoUrl: "",
        });
        existingIds.add(newProductDef.id);
        addedNew.push(newProductDef);
        newProductCount++;
      }
      continue;
    }

    // ── PROCESS: optimize & copy ──
    try {
      const sourceStat = fs.statSync(sourcePath);
      const srcKB = (sourceStat.size / 1024).toFixed(1);

      if (sharp) {
        let pipeline = sharp(sourcePath);
        const meta = await pipeline.metadata();

        // Resize if needed
        if (meta.width && meta.width > MAX_WIDTH) {
          pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        } else if (meta.height && meta.height > MAX_WIDTH) {
          pipeline = pipeline.resize({ height: MAX_WIDTH, withoutEnlargement: true });
        }

        // Compress
        if (ext === ".png") {
          if (meta.hasAlpha) {
            // Keep PNG but compress
            pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
          } else {
            // Convert to JPEG for smaller size
            targetExt = ".jpg";
            outputName = `${safeName}${targetExt}`;
            outputPath = path.join(IMAGES_DIR, outputName);
            pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
          }
        } else if (ext === ".jpg" || ext === ".jpeg") {
          pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
        } else if (ext === ".webp") {
          pipeline = pipeline.webp({ quality: JPEG_QUALITY });
        }

        await pipeline.toFile(outputPath);
      } else {
        // No sharp → plain copy
        fs.copyFileSync(sourcePath, outputPath);
      }

      const outStat = fs.statSync(outputPath);
      const outKB = (outStat.size / 1024).toFixed(1);
      const reduction = ((1 - outStat.size / sourceStat.size) * 100).toFixed(1);

      if (productId && existingIds.has(productId)) {
        // ─── UPDATE EXISTING PRODUCT ──────────────────────
        const prod = catalog.products.find((p) => p.id === productId);
        if (prod) {
          prod.imageUrl = `/src/assets/images/${outputName}`;
          updatedExisting.push({ id: productId, name: prod.name, img: outputName });
          mappedCount++;
          console.log(`   ✅ ${file}`);
          console.log(`      → ${prod.name}`);
          console.log(`      📦 ${srcKB}KB → ${outKB}KB  (${reduction}% menos 🎉)`);
        }
      } else if (newProductDef && !existingIds.has(newProductDef.id)) {
        // ─── CREATE NEW PRODUCT ───────────────────────────
        newProductDef.imageUrl = `/src/assets/images/${outputName}`;
        catalog.products.push({
          id: newProductDef.id,
          name: newProductDef.name,
          category: newProductDef.category,
          cost: DEFAULT_COST,
          stock: DEFAULT_STOCK,
          freight: DEFAULT_FREIGHT,
          imageUrl: newProductDef.imageUrl,
          currency: DEFAULT_CURRENCY,
          provider: DEFAULT_PROVIDER,
          description: newProductDef.description,
          price: DEFAULT_PRICE,
          videoUrl: "",
        });
        existingIds.add(newProductDef.id);
        addedNew.push(newProductDef);
        newProductCount++;
        console.log(`   🆕 ${file}`);
        console.log(`      → ${newProductDef.name} (PRODUCTO NUEVO)`);
        console.log(`      📦 ${srcKB}KB → ${outKB}KB  (${reduction}% menos 🎉)`);
      } else {
        skippedCount++;
        console.log(`   ⏭️  ${file} → sin mapeo, copiada a images/`);
      }
    } catch (err) {
      errorCount++;
      console.error(`   ❌ Error con ${file}: ${err.message}`);
    }
  }

  // ── 8. Save catalog ────────────────────────────────────────
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
  console.log("");
  console.log("✅ catalog.json guardado");

  // ── 9. Report ──────────────────────────────────────────────
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║              📊  REPORTE FINAL                      ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`   ✅ Productos EXISTENTES actualizados:  ${mappedCount}`);
  console.log(`   🆕 Productos NUEVOS agregados:         ${newProductCount}`);
  console.log(`   ⏭️  Omitidos (ya existían):             ${skippedCount}`);
  console.log(`   ❌ Errores:                             ${errorCount}`);
  console.log(`   📦 Total en catálogo ahora:             ${catalog.products.length}`);
  console.log("");

  if (updatedExisting.length > 0) {
    console.log("📋 Productos existentes con nueva imagen:");
    for (const p of updatedExisting) {
      console.log(`   • ${p.name} → ${p.img}`);
    }
    console.log("");
  }

  if (addedNew.length > 0) {
    console.log("📋 PRODUCTOS NUEVOS AGREGADOS:");
    for (const p of addedNew) {
      console.log(`   🆕 ${p.name} (${p.id})`);
      console.log(`      Categoría: ${p.category}`);
      console.log(`      Imagen: ${p.imageUrl}`);
      console.log(`      ⚠️  PRECIO y COSTO en 0 — debes actualizarlos!`);
      console.log("");
    }
    console.log("   ⚠️  IMPORTANTE: Los nuevos productos tienen PRECIO=0 y COSTO=0.");
    console.log("       Debes actualizar esos valores en catalog.json.");
    console.log("       Puedes pedirme que te ayude a actualizarlos.");
  }

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║      🚀  PROCESO COMPLETADO                         ║");
  console.log("║   Ejecuta 'npm run dev' para ver los cambios        ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

/**
 * ============================================================
 *  📥 DOWNLOAD ALL PRODUCT IMAGES - JANSEL SHOP
 *  ============================================================
 *  This script downloads EVERY remote product image from
 *  catalog.json into src/assets/images/ so each product has
 *  its own local image file.
 *
 *  HOW TO RUN:
 *    node download-all-images.cjs
 *
 *  WHAT IT DOES:
 *  1. Reads catalog.json
 *  2. For each product with a remote image URL, downloads it
 *  3. Saves to src/assets/images/ with a clean filename
 *  4. Updates catalog.json to point to the local file
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const CATALOG_PATH = path.join(__dirname, "src", "catalog.json");
const IMAGES_DIR = path.join(__dirname, "src", "assets", "images");

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Read catalog
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const products = catalog.products;

console.log(`📦 Catálogo cargado: ${products.length} productos\n`);

// Track results
let downloaded = 0;
let skipped = 0;
let failed = 0;
let notFound = 0;

/**
 * Sanitize a product name to use as a filename
 */
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

/**
 * Determine file extension from URL or default to .jpg
 */
function getExtension(url) {
  const clean = url.split("?")[0].split("#")[0];
  const ext = path.extname(clean).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
    return ext;
  }
  return ".jpg";
}

/**
 * Download a file from url and save to destPath
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        const contentType = response.headers["content-type"] || "";
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);

          // Determine actual extension from content-type if needed
          let finalPath = destPath;
          if (contentType.includes("png") && !finalPath.endsWith(".png")) {
            finalPath = finalPath.replace(/\.\w+$/, ".png");
          } else if (contentType.includes("webp") && !finalPath.endsWith(".webp")) {
            finalPath = finalPath.replace(/\.\w+$/, ".webp");
          } else if (contentType.includes("gif") && !finalPath.endsWith(".gif")) {
            finalPath = finalPath.replace(/\.\w+$/, ".gif");
          } else if (
            (contentType.includes("jpeg") || contentType.includes("jpg")) &&
            !finalPath.endsWith(".jpg") &&
            !finalPath.endsWith(".jpeg")
          ) {
            finalPath = finalPath.replace(/\.\w+$/, ".jpg");
          }

          // Only write if we got actual image data (> 1KB)
          if (buffer.length < 1024) {
            return reject(new Error(`File too small: ${buffer.length} bytes`));
          }

          fs.writeFileSync(finalPath, buffer);
          resolve(finalPath);
        });
      })
      .on("error", reject)
      .on("timeout", function () {
        this.destroy();
        reject(new Error("Timeout"));
      });
  });
}

/**
 * Process all products sequentially
 */
async function processAll() {
  // First, get list of existing files to avoid re-downloading
  const existingFiles = new Set(fs.readdirSync(IMAGES_DIR).map((f) => f.toLowerCase()));

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const imageUrl = product.imageUrl;

    // Skip if no image
    if (!imageUrl) {
      console.log(`  ⚠️  [${i + 1}/${products.length}] ${product.name} — SIN IMAGEN`);
      notFound++;
      continue;
    }

    // Skip if already local path
    if (imageUrl.startsWith("/") || imageUrl.startsWith("data:")) {
      console.log(`  ✅ [${i + 1}/${products.length}] ${product.name} — ${imageUrl.startsWith("/") ? "Ya es local" : "Es data URI"}`);
      skipped++;
      continue;
    }

    // Generate a clean filename from product ID or name
    const ext = getExtension(imageUrl);
    const safeName = sanitizeFilename(product.name) || product.id;
    let fileName = `${safeName}${ext}`;

    // Check if file already exists
    if (existingFiles.has(fileName.toLowerCase())) {
      console.log(`  📁 [${i + 1}/${products.length}] ${product.name} — Ya existe en disco`);
      product.imageUrl = `/src/assets/images/${fileName}`;
      skipped++;
      continue;
    }

    const destPath = path.join(IMAGES_DIR, fileName);

    try {
      console.log(`  📥 [${i + 1}/${products.length}] Descargando: ${product.name}...`);
      console.log(`     URL: ${imageUrl.substring(0, 80)}...`);
      
      const finalPath = await downloadFile(imageUrl, destPath);
      const finalName = path.basename(finalPath);

      // Update catalog to point to local file
      product.imageUrl = `/src/assets/images/${finalName}`;
      downloaded++;

      console.log(`     ✅ Guardado como: ${finalName}`);

      // Add to existing files set
      existingFiles.add(finalName.toLowerCase());

      // Small delay to be nice to servers
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.log(`     ❌ Error: ${err.message}`);
      failed++;
    }
  }

  // Save updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
  console.log("\n✅ Catálogo actualizado con rutas locales");
}

processAll()
  .then(() => {
    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMEN FINAL");
    console.log("=".repeat(50));
    console.log(`  ✅ Descargadas:    ${downloaded}`);
    console.log(`  📁 Ya existían:    ${skipped}`);
    console.log(`  ❌ Fallaron:       ${failed}`);
    console.log(`  ⚠️  Sin imagen:     ${notFound}`);
    console.log(`  📦 Total productos: ${products.length}`);
    console.log("=".repeat(50));
    console.log("\n🚀 ¡Listo! Ahora cada producto tiene su propia imagen local.");
    console.log("   Ejecuta 'npm run dev' para ver los cambios.\n");
  })
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });

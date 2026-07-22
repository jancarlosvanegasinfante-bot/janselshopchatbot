import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

async function seedAllStores() {
  console.log("--- SEEDING ALL STORES ---");
  
  // 1. Get all stores from Firestore
  const storesSnap = await getDocs(collection(db, "stores"));
  const storeIds = new Set<string>(["default", "jan-vanegas-hq"]);
  for (const doc of storesSnap.docs) {
    storeIds.add(doc.id);
  }
  
  console.log(`Found active stores to seed:`, Array.from(storeIds));

  const productsColl = collection(db, "products");

  for (const storeId of storeIds) {
    console.log(`\n--- Seeding store: ${storeId} ---`);
    
    // 2. Clear existing products for this store
    const qDelete = query(productsColl, where("storeId", "==", storeId));
    const snap = await getDocs(qDelete);
    if (!snap.empty) {
      console.log(`Clearing ${snap.size} old products...`);
      const deleteBatch = writeBatch(db);
      snap.docs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }
    
    // 3. Write new products
    console.log(`Inserting ${catalog.products.length} products...`);
    const insertBatch = writeBatch(db);
    for (const product of catalog.products) {
      const finalDocId = `${storeId}_${product.id}`;
      const docRef = doc(db, "products", finalDocId);
      insertBatch.set(docRef, {
        ...product,
        storeId,
        stock: product.stock !== undefined ? product.stock : 20,
        updatedAt: serverTimestamp()
      });
    }
    await insertBatch.commit();
    console.log(`Store ${storeId} seeded successfully.`);
  }

  console.log("\nAll stores seeded successfully with updated prices!");
}

seedAllStores().catch(console.error);

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkDb() {
  console.log("Checking Firestore database collections...");
  const storesSnap = await getDocs(collection(db, "stores"));
  console.log("Active stores in DB:");
  storesSnap.docs.forEach(d => {
    console.log(` - ID: ${d.id} | Name: ${d.data().name} | Slug: ${d.data().slug}`);
  });

  const productsSnap = await getDocs(collection(db, "products"));
  console.log(`\nTotal products in products collection: ${productsSnap.size}`);
  
  const sampleProducts = productsSnap.docs.slice(0, 10).map(d => ({
    docId: d.id,
    id: d.data().id,
    name: d.data().name,
    imageUrl: d.data().imageUrl,
    storeId: d.data().storeId
  }));
  
  console.log("Sample products stored in DB:", JSON.stringify(sampleProducts, null, 2));
}

checkDb().catch(console.error);

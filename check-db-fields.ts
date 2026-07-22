import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

async function checkDbFields() {
  console.log("Checking Firestore product documents for invalid fields...");
  const snap = await getDocs(collection(db, "products"));
  let badCount = 0;
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.name || typeof data.name !== 'string' || !data.description || typeof data.description !== 'string') {
      console.log(`❌ Invalid product document: ID=${doc.id}, Name=${data.name}, Description=${data.description}`);
      badCount++;
    }
  });
  
  console.log(`Check complete. Found ${badCount} invalid product documents.`);
}

checkDbFields().catch(console.error);

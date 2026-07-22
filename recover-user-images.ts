import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function recoverImages() {
  console.log("Searching other collections for any custom image URLs...");

  const foundUrls: Record<string, string[]> = {};

  const collections = ["orders", "activities", "conversations", "customers"];
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Scanning collection "${colName}" (${snap.size} documents)...`);
      snap.docs.forEach(doc => {
        const data = JSON.stringify(doc.data());
        // Find URLs starting with firebase storage or other custom domains
        const matches = data.match(/https:\/\/(firebasestorage\.googleapis\.com|http2\.mlstatic\.com)[^\s"'}]+/g);
        if (matches) {
          matches.forEach(url => {
            const cleanUrl = url.replace(/\\/g, '');
            if (!foundUrls[colName]) foundUrls[colName] = [];
            if (!foundUrls[colName].includes(cleanUrl)) {
              foundUrls[colName].push(cleanUrl);
            }
          });
        }
      });
    } catch (e) {
      console.error(`Error scanning ${colName}:`, e);
    }
  }

  console.log("\nFound URLs in other collections:", JSON.stringify(foundUrls, null, 2));
}

recoverImages().catch(console.error);

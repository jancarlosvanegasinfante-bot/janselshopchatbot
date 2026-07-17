import axios from "axios";
import { writeFileSync } from "fs";

const redirectedUrl = "https://onedrive.live.com/:x:/g/personal/D8AEC7050EA1DCAB/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY?resid=D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f&ithint=file%2cxlsx&e=C1X3qi&migratedtospo=true";

async function tryDownload(urlToEncode, label) {
  try {
    console.log(`\n--- Trying: ${label} ---`);
    console.log("URL to encode:", urlToEncode);
    const base64Value = Buffer.from(urlToEncode, "utf8")
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-");
      
    const downloadUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Value}/root/content`;
    console.log("Download URL:", downloadUrl);
    
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 10000
    });
    
    console.log("Success! Status:", response.status, "Length:", response.data.length);
    writeFileSync("test_download.xlsx", Buffer.from(response.data));
    console.log("Saved file test_download.xlsx successfully!");
    return true;
  } catch (error) {
    console.log("Failed:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
    }
    return false;
  }
}

async function run() {
  // Variation 1: Redirected URL without the massive 'redeem' parameter
  const var1 = redirectedUrl;
  await tryDownload(var1, "Redirected URL without 'redeem'");

  // Variation 2: Just the clean personal share path without any query params
  const var2 = "https://onedrive.live.com/:x:/g/personal/D8AEC7050EA1DCAB/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY";
  await tryDownload(var2, "Clean share path");

  // Variation 3: Original link without '?e=...' query param
  const var3 = "https://1drv.ms/x/c/d8aec7050ea1dcab/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY";
  await tryDownload(var3, "Original short URL without query params");
}

run();

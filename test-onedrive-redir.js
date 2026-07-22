import axios from "axios";
import { writeFileSync } from "fs";

const resid = "D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f";
const authkey = "IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY";

const urls = [
  // 1. Redir format with authkey
  `https://onedrive.live.com/redir?resid=${resid}&authkey=${authkey}&ithint=file%2cxlsx`,
  // 2. Redir format without authkey
  `https://onedrive.live.com/redir?resid=${resid}&ithint=file%2cxlsx`,
];

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
      try {
        console.log("Response data:", error.response.data ? Buffer.from(error.response.data).toString() : "empty");
      } catch (e) {}
    }
    return false;
  }
}

async function run() {
  for (let i = 0; i < urls.length; i++) {
    await tryDownload(urls[i], `Redir variation ${i + 1}`);
  }
}

run();

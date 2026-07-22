import axios from "axios";
import { writeFileSync } from "fs";

const shortUrl = "https://1drv.ms/x/c/d8aec7050ea1dcab/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY?e=C1X3qi";

async function run() {
  try {
    console.log("1. Following redirect to get redirected URL...");
    let redirectedUrl = "";
    try {
      const response = await axios.get(shortUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      redirectedUrl = response.headers.location;
    } catch (err) {
      if (err.response && err.response.headers.location) {
        redirectedUrl = err.response.headers.location;
      } else {
        throw err;
      }
    }
    
    console.log("Redirected URL:", redirectedUrl);
    
    if (!redirectedUrl) {
      throw new Error("No redirect location found!");
    }
    
    console.log("2. Base64 encoding the redirected URL...");
    const base64Value = Buffer.from(redirectedUrl, "utf8")
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-");
      
    const downloadUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Value}/root/content`;
    console.log("Trying API download URL:", downloadUrl);
    
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 15000
    });
    
    console.log("Download successful! Status:", response.status);
    writeFileSync("test_download.xlsx", Buffer.from(response.data));
    console.log("Saved file test_download.xlsx");
    
  } catch (error) {
    console.error("Failed:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
      try {
        console.log("Response data:", error.response.data ? Buffer.from(error.response.data).toString() : "empty");
      } catch (e) {}
    }
  }
}

run();

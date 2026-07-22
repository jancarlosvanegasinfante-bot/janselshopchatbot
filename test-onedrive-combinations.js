import axios from "axios";
import { writeFileSync } from "fs";

const resid = "D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f";
const token = "IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY";
const e = "C1X3qi";

const urls = [
  // 1. Using token as authkey
  `https://onedrive.live.com/download?resid=${resid}&authkey=${token}`,
  // 2. Using 'e' parameter as authkey
  `https://onedrive.live.com/download?resid=${resid}&authkey=${e}`,
  // 3. Using both
  `https://onedrive.live.com/download?resid=${resid}&authkey=${token}&e=${e}`,
  // 4. Using just 'e' as query param
  `https://onedrive.live.com/download?resid=${resid}&e=${e}`,
  // 5. Using download.aspx with token
  `https://onedrive.live.com/download.aspx?resid=${resid}&authkey=${token}`,
  // 6. Using download.aspx with 'e'
  `https://onedrive.live.com/download.aspx?resid=${resid}&authkey=${e}`,
  // 7. Using download.aspx with both
  `https://onedrive.live.com/download.aspx?resid=${resid}&authkey=${token}&e=${e}`,
  // 8. Using download.aspx with just 'e'
  `https://onedrive.live.com/download.aspx?resid=${resid}&e=${e}`,
];

async function run() {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n--- Test ${i + 1} ---`);
    console.log("URL:", url);
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      console.log("Success! Status:", response.status, "Length:", response.data.length);
      writeFileSync("test_download.xlsx", Buffer.from(response.data));
      console.log("Saved file test_download.xlsx");
      return; // Stop on first success
    } catch (error) {
      console.log("Failed:", error.message);
      if (error.response) {
        console.log("Status:", error.response.status);
      }
    }
  }
}

run();

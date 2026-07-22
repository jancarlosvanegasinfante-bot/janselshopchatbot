import axios from "axios";
import { writeFileSync } from "fs";

const resid = "D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f";
const authkey = "IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY";
const downloadUrl = `https://onedrive.live.com/download?resid=${resid}&authkey=${authkey}`;

async function run() {
  try {
    console.log("Trying download URL:", downloadUrl);
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    console.log("Response status:", response.status);
    console.log("Content-Length:", response.headers["content-length"]);
    console.log("Content-Type:", response.headers["content-type"]);
    
    writeFileSync("test_download.xlsx", Buffer.from(response.data));
    console.log("File saved successfully!");
  } catch (error) {
    console.error("Download failed:", error.message);
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Headers:", error.response.headers);
    }
  }
}

run();

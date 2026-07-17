import axios from "axios";
import { writeFileSync } from "fs";
import * as XLSX from "xlsx";

const url = "https://1drv.ms/x/c/d8aec7050ea1dcab/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY?e=C1X3qi";

async function run() {
  try {
    console.log("Converting OneDrive URL to direct API path...");
    const base64Value = Buffer.from(url, "utf8")
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-");
    
    const downloadUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Value}/root/content`;
    console.log("Direct download URL:", downloadUrl);

    console.log("Downloading file...");
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    console.log("Saving Excel file locally as current_catalog.xlsx...");
    writeFileSync("current_catalog.xlsx", Buffer.from(response.data));
    console.log("File saved successfully.");

    // Parse with SheetJS
    console.log("Parsing Excel file...");
    const workbook = XLSX.read(response.data, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Successfully parsed ${data.length} rows from sheet "${firstSheetName}".`);
    console.log("First 3 rows:", JSON.stringify(data.slice(0, 3), null, 2));
    
  } catch (error) {
    console.error("Error occurred:", error.message || error);
    if (error.response) {
      console.error("Response data:", error.response.data ? error.response.data.toString() : "No data");
    }
  }
}

run();

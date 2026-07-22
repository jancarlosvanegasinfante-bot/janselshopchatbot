import * as XLSX from "xlsx";
import { readFileSync } from "fs";

try {
  console.log("Reading test_download.xlsx as buffer...");
  const buffer = readFileSync("test_download.xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;
  console.log("Sheet names in file:", sheetNames);
  
  const worksheet = workbook.Sheets[sheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log(`Parsed ${data.length} rows.`);
  
  if (data.length > 0) {
    console.log("Columns:", Object.keys(data[0] || {}));
    console.log("First 15 rows of data:");
    console.log(JSON.stringify(data.slice(0, 15), null, 2));
  } else {
    console.log("Sheet is empty!");
  }
} catch (error) {
  console.error("Failed to parse:", error);
}

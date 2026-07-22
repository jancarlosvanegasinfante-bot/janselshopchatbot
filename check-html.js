import { readFileSync } from "fs";

try {
  const content = readFileSync("test_download.xlsx", "utf8");
  console.log("File content length:", content.length);
  console.log("First 1000 characters of content:\n");
  console.log(content.slice(0, 1000));
} catch (err) {
  console.error("Error reading file:", err.message);
}

import * as fs from "fs";

const products = JSON.parse(fs.readFileSync("src/catalog.json", "utf8")).products;

console.log("ALL PRODUCTS IN CATALOG:");
products.forEach((p: any) => {
  console.log(`- ID: ${p.id} | Name: ${p.name}`);
});

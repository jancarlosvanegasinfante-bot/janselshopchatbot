import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const FLETE = 17000;
const DEVOLUCIONES = 10000;
const PUBLICIDAD = 10000;
const GANANCIA = 15000;
const COMISION_DROPI = 0.05;

catalog.products = catalog.products.map((p: any) => {
  const sum = p.cost + FLETE + DEVOLUCIONES + PUBLICIDAD + GANANCIA;
  const exactPrice = sum / (1 - COMISION_DROPI);
  // Round to nearest 900 for marketing
  const rounded = Math.floor(exactPrice / 1000) * 1000 + 900;
  p.price = rounded;
  return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`Updated prices for ${catalog.products.length} products using strict formula.`);

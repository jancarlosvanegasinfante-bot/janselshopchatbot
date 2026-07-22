import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const rawProducts = [
  ["Patineta Hidrahulica", "jugueteria", 81500, 299],
  ["Reloj Despertador Con Carga Inalambrica", "tecnologia", 48500, 300],
  ["Citrato De Magnesio Natural", "salud", 29900, 998],
  ["Reloj Smartwatch T800 Ultra", "tecnologia", 44500, 4],
  ["Pelota Para Mascota", "mascotas", 19500, 200],
  ["Dvd Niaduvan", "tecnologia", 74500, 500],
  ["Tgreen", "salud", 31500, 500],
  ["Telescopio F36050", "hogar", 84500, 299],
  ["Carpa Castillo Con Luces Led", "otro", 64500, 95],
  ["Combo Pinza Cepillo Aguacate", "tecnologia", 74500, 500],
  ["Espejo Decorativo Pared Hexagonal 18cm", "hogar", 36500, 500],
  ["Diadema Major Iv", "moda", 51500, 200],
  ["Radio Para Ninos", "tecnologia", 104500, 593],
  ["Pistola Mini 3", "otro", 84500, 100],
  ["Limpiador Electrico De Biberones", "bebe", 43500, 443],
  ["Olla De Cera Calentador Depilar", "belleza", 39500, 97],

  ["Mini Ventilador Clip Usb Portatil", "hogar", 29500, 500],
  ["Espejo Retrovisor Camara Dual Carro", "tecnologia", 52500, 281],
  ["Soporte De Carga Magnetica", "tecnologia", 62500, 499],
  ["Car Blook", "moda", 70000, 500],
  ["Audifonos Bt Tour Pro 60", "moda", 60500, 19],
  ["Caja Registradora Pantalla", "otro", 36500, 100],
  ["Gancho Pequeno", "hogar", 15500, 500],
  ["Organizador De Cubiertos En Acero", "moda", 52500, 199],
  ["Olla De Chocolate", "cocina", 42500, 500],
  ["Mary Ruth Oregano", "salud", 30500, 999],
  ["Audifonos Para Discapacitados", "tecnologia", 39500, 293],
  ["Limpiadora De Vapor 12 En 1", "hogar", 104500, 495],
  ["Set De Maquillaje Diy Besds", "otro", 38500, 100],
  ["Humificador Nube", "hogar", 84500, 500],
  ["Llavero Linterna", "herramientas", 31500, 500],
  ["Sanduchera Figuras Doble Puesto", "cocina", 69500, 500],

  ["Organizador Cosmeticos Caja", "belleza", 49500, 500],
  ["Airi", "salud", 32700, 954],
  ["Pulpo Cuerda Elastica", "herramientas", 22000, 500],
  ["Extractor De Jugo", "hogar", 41500, 499],
  ["Multi Collagen Peptides", "salud", 30000, 494],
  ["Microscopio Nfantil", "hogar", 69500, 500],
  ["Dispensador De Crema Dental", "hogar", 34500, 300],
  ["Gimnasio De Chanclas", "tecnologia", 52500, 298],
  ["Olla De Vidrio Oreja Izquierda", "cocina", 36500, 500],
  ["Picacador Y Costador De Fruta", "cocina", 20500, 500],
  ["Carpa Camping 200x150 Cm", "camping", 56500, 500],
  ["Caja Fuerte Sencilla", "moda", 59500, 199],
  ["Combo Nano Titanium", "moda", 49500, 300],
  ["Set De Arte 208 Pcs De Personajes", "moda", 44500, 300],
  ["Parlante Pantalla Tactil", "tecnologia", 76500, 494],
  ["Luz Rgb Con Sensor", "hogar", 24500, 500],

  ["Set De Maquillaje Maleta Grande", "moda", 185000, 500],
  ["Combo Reloj Audifonos Bala Game Boy", "tecnologia", 84500, 500],
  ["Bombillo 4 Aspas Led", "tecnologia", 43500, 497],
  ["Organizador Cajones", "hogar", 20500, 500],
  ["Maleta Morral Deportiva Escolar", "moda", 64500, 500],
  ["Organizador De Tocador Jm701", "moda", 50500, 500],
  ["Juego De Memoria Electrico", "moda", 29500, 300],
  ["Peluche Muneco Para Pintar", "jugueteria", 36500, 600],
  ["Patillera Km2293", "moda", 74500, 200],
  ["Mary Ruth Fresa", "salud", 30000, 999],
  ["Proyector Lentes Intercambiables", "tecnologia", 86500, 22],
  ["Kit Boxeo Musical Grande", "tecnologia", 104500, 470],
  ["Cuello Ventilaador", "salud", 32500, 500],
  ["Cepillo De Dientes Para Ninos Electrico", "salud", 23500, 299],
  ["Bombillo Para Camping Regargable", "tecnologia", 24500, 300],
  ["Lintera Multi Proposito", "tecnologia", 29500, 300],

  ["Humidificador Chimenea Negro", "hogar", 69500, 499],
  ["La Bubu Coca Cola", "otro", 34500, 300],
  ["Tazon Para Mascota Fresh Cold", "mascotas", 37500, 200],
  ["Combo Reloj Audifonos Y Consola", "hogar", 71500, 297],
  ["Ventosa Para Masajes Prla871", "belleza", 39500, 1000],
  ["Extractor De Leche Recargable", "bebe", 79500, 390],
  ["Tendedero Doble Tubular", "moda", 74500, 80],
  ["Audifono Traductor", "moda", 39500, 559],
  ["Sopladora Speed High", "hogar", 74500, 500],
  ["Parlante Portatil Alaxe Super Bass", "moda", 47500, 440],
  ["Mini Linterna Led Recargable Transparent", "tecnologia", 30500, 100],
  ["Kit Manicure Pedicure X16 Piezas", "moda", 29500, 500],
  ["Combo Reloj Jl19 Ultra 2", "moda", 62500, 198],
  ["Maleta Kawai 5 En 1", "hogar", 44500, 500],
  ["Organizador Cajon Pequeno", "moda", 26500, 200],
  ["Set De Bombillos Inalambricos X3", "hogar", 27500, 500],

  ["Liver Detox", "salud", 33500, 1000],
  ["Proyector Robot", "tecnologia", 60500, 500],
  ["Lavadora De Brochas", "belleza", 28500, 500],
  ["Organizador Para Lavadora", "hogar", 53500, 297],
  ["Organizador De Condimentos Esquinero 3", "cocina", 38500, 200],
  ["Parlante Boobox X4", "tecnologia", 99500, 500],
  ["Combo Teclado Y Mouse Inalambrico Mac", "tecnologia", 53500, 500],
  ["Mini Pulidora Inalambrica", "herramientas", 65000, 500],
  ["Cinta Reflectiva Antideslizante", "belleza", 69500, 500],
  ["Humificador Bola 130 Ml", "hogar", 24500, 499],
  ["Sarten Electrico Multifuncional", "cocina", 79500, 199],
  ["Full Cql Bayas De Goji X 500g", "salud", 31000, 500],
  ["Humificador De Flama", "hogar", 34500, 198],
  ["Cortador De Verduras En Espiral", "cocina", 67500, 198],
  ["Lubricante De Guayas", "hogar", 44500, 500],
  ["Mopa Lavado De Coche Microfibra", "aseo", 24500, 200]
];

const newProducts = rawProducts.map(rp => {
  return {
    id: rp[0].toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name: rp[0],
    description: `Excelente producto: ${rp[0]}. Calidad garantizada.`,
    category: rp[1],
    cost: rp[2],
    stock: rp[3],
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_908472-MCO72754605178_112023-O.webp",
    currency: "COP",
    provider: "Dropi"
  };
});

// Append or update products
for (const p of newProducts) {
  const existingIdx = catalog.products.findIndex((prod: any) => prod.id === p.id);
  if (existingIdx >= 0) {
    catalog.products[existingIdx] = { ...catalog.products[existingIdx], ...p };
  } else {
    catalog.products.push(p);
  }
}

// Pricing constants
const FLETE = 15000;
const PUBLICIDAD = 15000;
const DEVOLUCIONES = 3000;
const GANANCIA_DESEADA = 20000;
const COMISION_DROPI_PCT = 0.06;

// Recalculate
catalog.products = catalog.products.map((p: any) => {
  const cost = p.cost || 0;
  const baseCostSum = cost + FLETE + PUBLICIDAD + DEVOLUCIONES + GANANCIA_DESEADA;
  const targetPrice = baseCostSum / (1 - COMISION_DROPI_PCT);
  const thousands = Math.ceil(targetPrice / 1000);
  const finalPrice = (thousands * 1000) - 100;
  p.price = finalPrice;
  p.freight = FLETE;
  return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`Successfully updated catalog with ${catalog.products.length} products total.`);

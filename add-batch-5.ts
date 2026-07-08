import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const rawProducts = [
  // Image 1
  ["Casco Bebe", "cocina", 50500, 200],
  ["Shaver Vgr 331", "moda", 44500, 199],
  ["Shake Take", "hogar", 44500, 500],
  ["Yerba Magic X 60 Capsulas", "salud", 30750, 1000],
  ["Tapon Protector Bajo Puerta Antiinsectos", "hogar", 24500, 500],
  ["Mugs 480 Ml", "hogar", 36500, 500],
  ["Irrigador Dental A18", "belleza", 36500, 499],
  ["Zapatero Plastico 5 Niveles", "moda", 40500, 500],
  ["Luz Led Para Celular O Laptop Recargable", "tecnologia", 39500, 497],
  ["Maleta Para Mascotas", "mascotas", 49500, 500],
  ["Diadema Inside Out", "moda", 44500, 200],
  ["Velas 24 Pcs", "tecnologia", 40500, 500],
  ["Perchero Pegable", "hogar", 39500, 198],
  ["Luz Magnetica Dormitorio", "tecnologia", 25500, 300],
  ["Bubuzela Tricolor", "hogar", 17000, 499],
  ["Ejercitador Multi", "salud", 28000, 298],

  // Image 2
  ["Shaver Vgr 399", "moda", 82500, 200],
  ["Carro Inflador", "moda", 49500, 200],
  ["Set Juego De Bingo Familiar", "tecnologia", 56500, 500],
  ["Bolsa De Colicos Capibara Muneco", "moda", 39500, 300],
  ["Compresor Inalambrico Carsun", "moda", 66500, 497],
  ["Dispensador De Agua Y Comida Mascota", "mascotas", 35500, 500],
  ["Cortador De Papa", "cocina", 34500, 199],
  ["Pistola De Clavos", "herramientas", 60500, 398],
  ["Machacador De Ajos", "cocina", 19500, 500],
  ["Medias Pantalon Termicos", "otro", 24000, 496],
  ["Molinillo Electrico Multifuncional 150w", "cocina", 49500, 499],
  ["Carrito De Mercado Plegable", "hogar", 90500, 500],
  ["Organizador De Bano 3 Niveles", "hogar", 37500, 498],
  ["Organizador Utensilios Y Cuchillos", "cocina", 29500, 199],
  ["Altavoz Parlante Bocina Bluetooth Luces", "moda", 48500, 500],
  ["Mesa Madera Portatil Para Cama", "moda", 42500, 500],

  // Image 3
  ["Carro F1 Stunt Control Remoto", "otro", 44500, 150],
  ["Jeringa Dosificadora", "mascotas", 22000, 499],
  ["Compresor Portatilref 201", "tecnologia", 39500, 5],
  ["Tensor De Mano Grip", "salud", 26500, 500],
  ["Perchero Yh99185a", "hogar", 53500, 200],
  ["Cepillo Dental Electrico", "salud", 24500, 195],
  ["Ducha Portatil Recargable", "hogar", 47500, 500],
  ["Colageno Hidrolizado Marino", "salud", 29500, 488],
  ["Juego De Cubiertos Eco X 24 Plateado", "cocina", 59500, 500],
  ["Aspesor Electrico Recargable", "hogar", 36500, 500],
  ["Masajeador Cojin Carro", "salud", 42500, 500],
  ["Plancha Pro Nova Keratina", "belleza", 42500, 500],
  ["Antena Tdt Oice 5 Mt", "tecnologia", 23500, 500],
  ["Combo De Audifonos Y Atari", "tecnologia", 44500, 300],
  ["Reloj 135 Suit", "tecnologia", 92500, 499],
  ["Cepillo Alisador", "belleza", 28500, 500],

  // Image 4
  ["Cepillo Desenredador", "moda", 19500, 200],
  ["Colagenvit", "salud", 30750, 1000],
  ["Accesorio Pulidora", "herramientas", 55000, 482],
  ["Organizador Herramientas", "herramientas", 104500, 500],
  ["Speaker Bocina Soporte Tg129c", "moda", 39500, 500],
  ["Bichota X16 Sachets", "salud", 30000, 1000],
  ["Mini Maquina Donera X 3", "moda", 34500, 300],
  ["Lemme Colostrum", "salud", 32000, 1000],
  ["Camisetas Mundial", "ropa deportiva", 44500, 0],
  ["Walkie Talki Kits Pilas", "moda", 27500, 500],
  ["Rebanador De Carne", "cocina", 64500, 334],
  ["Set De Marcadores X 60 Piezas", "otro", 27500, 500],
  ["Comedero De Mascotas Elevado", "mascotas", 52500, 499],
  ["Magnesium Complex 8 Elementos", "salud", 34000, 976],
  ["Rascador De Sofa", "mascotas", 34500, 299],
  ["Maleta Infantil Diseno Animales", "moda", 49500, 500]
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

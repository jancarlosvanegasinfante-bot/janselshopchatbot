import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const rawProducts = [
  // Image 1
  ["Candado De Huella", "tecnologia", 54500, 500],
  ["Comedor Interactivo Mascota", "mascotas", 36500, 500],
  ["Tapete De Agua Bebe 65 X 65", "hogar", 24500, 299],
  ["Sarten Electrico 3 Puestos", "cocina", 72500, 500],
  ["Reloj Tk9", "moda", 99500, 200],
  ["Sarten Animalitos 7 Compartimientos", "hogar", 46500, 500],
  ["Luces Led Para Piso", "hogar", 44500, 500],
  ["Humdificador Led 7", "hogar", 21500, 500],
  ["Ashwagandha Relaxing Mental Physical", "salud", 36900, 999],
  ["Linterna Solar", "moda", 25500, 199],
  ["Conectores Electricos", "herramientas", 33000, 500],
  ["Lonchera En Acero Color Blanco", "cocina", 58500, 500],
  ["Maleta Escolar 812", "moda", 34500, 200],
  ["Multimetro Jctop", "herramientas", 65000, 500],
  ["Pistola Mini 1", "otro", 84500, 100],
  ["Intimate Rose", "salud", 36900, 1000],

  // Image 2
  ["Organizador De Tocador Cy079", "moda", 40500, 500],
  ["Baston Trusky Pegable", "salud", 36500, 500],
  ["Muneca Fail Fix", "otro", 38500, 100],
  ["Lions Mane", "salud", 33350, 500],
  ["Rizadora Para El Cabello Keratina", "moda", 42500, 300],
  ["Organizador Sanitario 2 Niveles", "moda", 28500, 400],
  ["Tensiometro Manual", "salud", 39500, 500],
  ["Citramag Sachet X 15 Und", "salud", 30125, 1000],
  ["Extreme Detox", "salud", 34500, 1494],
  ["Set De Cucharas Medidoras", "cocina", 28500, 500],
  ["Deos", "salud", 29500, 1000],
  ["Rebanador 3 En 1 Manual", "tecnologia", 21500, 400],
  ["Cosmetiquera 24216", "moda", 24000, 200],
  ["Bolso Stich", "moda", 34500, 300],
  ["Biotina", "salud", 35500, 997],
  ["Tendedero Retractil Cuerda", "hogar", 27500, 499],

  // Image 3
  ["Diadema Rizadora De Cabello", "tecnologia", 22500, 400],
  ["Lentes De Contacto Halloween", "moda", 26500, 493],
  ["Juego De Atrapar Palos Para Ninos Y Adul", "moda", 49500, 300],
  ["Pistola Para Pintar", "herramientas", 109500, 500],
  ["Bascula Electronica Balanza Digital", "cocina", 99500, 196],
  ["Shilajit Jalea X 125 Ml", "salud", 41900, 1000],
  ["Te Matcha", "salud", 32000, 500],
  ["Lonchera Termica 2 Niveles Contenedor", "hogar", 36500, 499],
  ["Secador Bp5500", "moda", 59500, 200],
  ["Pop It Astronauta", "moda", 28000, 200],
  ["Tripode K07", "tecnologia", 26500, 298],
  ["Audifonoss Db6 Disney", "moda", 36500, 300],
  ["Soporte Cargador Celular Automovil", "tecnologia", 21500, 300],
  ["Lampara Electrica", "tecnologia", 49500, 500],
  ["Pinza 3 Tubos Sirena", "belleza", 35500, 500],
  ["Juguete Set De Ballesta", "moda", 35500, 200],

  // Image 4
  ["Parlante Remax", "tecnologia", 91500, 500],
  ["Juguete Para Gatos", "mascotas", 52500, 500],
  ["Capa Impermeable Xxxl", "moda", 64500, 500],
  ["Pop It Iron Man", "tecnologia", 24500, 300],
  ["Trapero De Palo Autoexprimible", "hogar", 32500, 300],
  ["Base Televisor 2f", "hogar", 32500, 500],
  ["Purificador De Ambiente", "moda", 54500, 200],
  ["Ventosa 12060", "herramientas", 69500, 67],
  ["Combo Relojaudifonosbalacagam Boyk13", "moda", 84500, 101],
  ["Organizador De Loza Doble Tapa 65 Cm", "cocina", 114500, 499],
  ["Teclado Numerico Andowl", "tecnologia", 29500, 500],
  ["Peine Capilar", "moda", 82500, 598],
  ["Combo 3 En 1 Aguacate", "moda", 94500, 295],
  ["Extractor Porlvo Sencillo", "belleza", 56500, 500],
  ["Audifonos M60", "moda", 60500, 500],
  ["Escurridor Gabinete Doble", "cocina", 134500, 495],

  // Image 5
  ["Cinturon Para Bebes", "tecnologia", 29500, 1],
  ["Parlante Go4", "moda", 36500, 500],
  ["Dispensador Magnetico 5 En 1 Para Never", "hogar", 44500, 199],
  ["Cable Magneto Sky Dolphin 2.4a Universal", "tecnologia", 21500, 500],
  ["Juego Set De Cuchillos Lujo 6 Piezas", "hogar", 26500, 499],
  ["Parlante Y Microfono Inalambrico Xmx66", "moda", 53000, 50],
  ["Energy Focus", "salud", 32900, 1360],
  ["Papel De Cocina Adhesivo", "cocina", 29500, 500],
  ["Cortador Manual Portatil Azulejos", "hogar", 44500, 500],
  ["Cargador Bebes", "bebe", 24500, 150],
  ["Intercomunicador Krm5", "moda", 94500, 200],
  ["Citrato De Magnesio 500g", "salud", 31000, 492],
  ["Cabina Parlante 6.5 Pulgadas Nxy7", "moda", 72500, 500],
  ["Oximetro Para Dedo Con Pantalla Led", "salud", 33500, 500],
  ["Emoji Block", "moda", 30000, 500],
  ["Cubo", "otro", 18500, 300],

  // Image 6
  ["Lector Interactivo Educativo Ingleespan", "bebe", 38500, 300],
  ["Organizador De Cocina Condimentero", "cocina", 23500, 500],
  ["Maleta Amazon Con Organizador Zapatos", "hogar", 56500, 500],
  ["Luces Navidad Estrellas 3 Metros", "hogar", 43500, 300],
  ["Inflador Portatil Llz668", "herramientas", 99500, 198],
  ["Plastilina Moldeable", "moda", 24500, 200],
  ["Termo St Flores", "moda", 54500, 500],
  ["Kit Llave Con T Con Capas", "herramientas", 40000, 500],
  ["Brocha Magica Maquillaje", "belleza", 20500, 500],
  ["Kit De Accesorios De Bano", "hogar", 79500, 200],
  ["Compresor De Aire Ciclone", "tecnologia", 54500, 499],
  ["Plancha Cabello Avocado 3d", "belleza", 40500, 500],
  ["Calentador De Ambiente", "hogar", 38500, 200],
  ["Repuestos De Impresora Termica Mini", "tecnologia", 22500, 200],
  ["Carro Control", "otro", 64500, 300],
  ["Mopas Trapero", "hogar", 19500, 500]
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

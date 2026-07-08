import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

const originalMapPath = path.join(process.cwd(), 'src', 'original-images-map.json');
let originalMap: Record<string, string> = {};
if (fs.existsSync(originalMapPath)) {
  originalMap = JSON.parse(fs.readFileSync(originalMapPath, 'utf-8'));
}

function getSpecificKeyword(name: string, category: string): string {
  const norm = name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s-]/g, ""); // strip special characters

  if (norm.includes("donas")) return "donut-maker";
  if (norm.includes("compresor")) return "portable-air-compressor";
  if (norm.includes("inversor")) return "car-power-inverter";
  if (norm.includes("aspiradora") && norm.includes("mascota")) return "pet-hair-vacuum";
  if (norm.includes("aspiradora")) return "handheld-car-vacuum";
  if (norm.includes("parasol")) return "car-sunshade";
  if (norm.includes("alarma") && norm.includes("candado")) return "padlock-alarm";
  if (norm.includes("alarma")) return "car-alarm-security";
  if (norm.includes("candado")) return "heavy-duty-padlock";
  if (norm.includes("modem") || norm.includes("wifi")) return "portable-wifi-router";
  if (norm.includes("shilajit")) return "shilajit-resin";
  if (norm.includes("ashwagandha")) return "ashwagandha-capsules";
  if (norm.includes("lions mane") || norm.includes("lions-mane")) return "lions-mane-mushroom-supplement";
  if (norm.includes("curcumin") || norm.includes("turmeric")) return "turmeric-supplement";
  if (norm.includes("citrato") && norm.includes("magnesio")) return "magnesium-citrate-powder";
  if (norm.includes("citrato") || norm.includes("magnesio") || norm.includes("citramag")) return "magnesium-supplement";
  if (norm.includes("maca")) return "maca-root-powder";
  if (norm.includes("gomas") || norm.includes("gummies")) return "vitamin-gummies";
  if (norm.includes("detox")) return "detox-supplement-bottle";
  if (norm.includes("barbera") || norm.includes("patillera") || norm.includes("shaver") || norm.includes("vgr") || norm.includes("afeitar") || norm.includes("depilar")) return "electric-hair-clipper-shaver";
  if (norm.includes("plancha") || norm.includes("secador") || norm.includes("rizadora")) return "hair-straightener-dryer";
  if (norm.includes("maquillaje") || norm.includes("cosmetiquera") || norm.includes("brocha") || norm.includes("espejo")) return "makeup-cosmetics-set";
  if (norm.includes("parlante") || norm.includes("altavoz") || norm.includes("cabina") || norm.includes("bocina")) return "portable-bluetooth-speaker";
  if (norm.includes("audifono") || norm.includes("audifonos") || norm.includes("earbuds")) return "wireless-earbuds-headphones";
  if (norm.includes("reloj") || norm.includes("smartwatch") || norm.includes("despertador")) return "smartwatch-digital-clock";
  if (norm.includes("intercomunicador") || norm.includes("inter comunicador")) return "motorcycle-bluetooth-intercom";
  if (norm.includes("dron") || norm.includes("drone")) return "camera-drone-quadcopter";
  if (norm.includes("lavadora") || norm.includes("hidrolavadora")) return "pressure-washer-car";
  if (norm.includes("sopladora")) return "electric-leaf-blower";
  if (norm.includes("martillo")) return "claw-hammer-tool";
  if (norm.includes("destornillador") || norm.includes("atornillador") || norm.includes("taladro") || norm.includes("destprnillador")) return "cordless-drill-driver";
  if (norm.includes("pulidora")) return "electric-angle-grinder";
  if (norm.includes("multimetro") || norm.includes("probador")) return "digital-multimeter";
  if (norm.includes("llave")) return "socket-wrench-set";
  if (norm.includes("cinta")) return "heavy-duty-tape";
  
  if (norm.includes("jabonera")) return "bathroom-soap-dispenser";
  if (norm.includes("tina") && norm.includes("plegable")) return "folding-bathtub";
  if (norm.includes("cepillo de dientes")) return "electric-toothbrush";
  if (norm.includes("sarten") || norm.includes("sartenera") || norm.includes("sartén")) return "nonstick-frying-pan";
  if (norm.includes("olla")) return "cooking-pot";
  if (norm.includes("cuchillo") || norm.includes("cuchillos")) return "kitchen-knife-set";
  if (norm.includes("rallador") || norm.includes("rayador") || norm.includes("cortador de verdura") || norm.includes("molino de verdura")) return "vegetable-slicer-grater";
  if (norm.includes("exprimidor")) return "electric-citrus-juicer";
  if (norm.includes("licuadora") || norm.includes("batidora")) return "kitchen-blender-mixer";
  if (norm.includes("sushi")) return "sushi-making-kit";
  if (norm.includes("lonchera")) return "insulated-lunch-box";
  if (norm.includes("termo") || norm.includes("vaso")) return "stainless-steel-thermos-tumbler";
  if (norm.includes("condimentero") || norm.includes("especias")) return "rotating-spice-rack";
  if (norm.includes("cubiertos")) return "stainless-steel-flatware-set";
  if (norm.includes("sanduchera")) return "sandwich-maker-grill";
  if (norm.includes("cafetera")) return "coffee-maker-machine";
  
  if (norm.includes("organizador") && norm.includes("zapatos")) return "shoe-rack-organizer";
  if (norm.includes("organizador") && norm.includes("ropa")) return "laundry-sorter-basket";
  if (norm.includes("organizador")) return "home-storage-organizer";
  if (norm.includes("estante") || norm.includes("estanteria") || norm.includes("repisa")) return "storage-shelves-rack";
  if (norm.includes("zapatero")) return "multi-tier-shoe-rack";
  if (norm.includes("perchero")) return "garment-coat-rack";
  if (norm.includes("tendedero")) return "folding-clothes-drying-rack";
  if (norm.includes("funda") && norm.includes("moto")) return "motorcycle-waterproof-cover";
  if (norm.includes("maleta") || norm.includes("morral") || norm.includes("bolso")) return "travel-backpack-luggage";
  
  if (norm.includes("mascota") || norm.includes("perro") || norm.includes("gato") || norm.includes("pet")) return "dog-cat-pet-accessory";
  if (norm.includes("juguete") || norm.includes("muñeca") || norm.includes("muneca") || norm.includes("peluche") || norm.includes("pop it") || norm.includes("pop-it") || norm.includes("pista de carro") || norm.includes("pista de auto")) return "kids-toy-play";
  if (norm.includes("rompecabezas") || norm.includes("puzzle")) return "wooden-puzzle-toy";
  if (norm.includes("plastilina") || norm.includes("dibujo") || norm.includes("arte") || norm.includes("pintar")) return "kids-art-craft-supplies";
  if (norm.includes("patineta")) return "skateboard-scooter";
  
  if (norm.includes("faja") || norm.includes("corrector de postura") || norm.includes("corrector")) return "posture-corrector-brace";
  if (norm.includes("rodillera")) return "knee-compression-sleeve";
  if (norm.includes("tensiometro") || norm.includes("oximetro") || norm.includes("pulso")) return "digital-blood-pressure-monitor";
  if (norm.includes("parche") || norm.includes("parches")) return "medical-relief-patch";
  if (norm.includes("plantillas") && norm.includes("silicona")) return "silicone-shoe-insoles";
  if (norm.includes("masajeador") || norm.includes("ventosa")) return "electric-body-massager";
  
  if (norm.includes("tapete") || norm.includes("mat")) return "door-mat-carpet";
  if (norm.includes("cojin") || norm.includes("almohada")) return "ergonomic-pillow-cushion";
  if (norm.includes("cobija") || norm.includes("manta")) return "warm-fleece-blanket";
  if (norm.includes("sofa") || norm.includes("sofá") || norm.includes("colchon") || norm.includes("colchón")) return "inflatable-mattress-sofa";
  
  if (norm.includes("gimnasio") || norm.includes("banda") || norm.includes("ejercicio") || norm.includes("pesa")) return "fitness-workout-equipment";
  if (norm.includes("papel adhesivo") || norm.includes("adhesivo")) return "adhesive-contact-paper";
  if (norm.includes("limpiador") || norm.includes("mopa") || norm.includes("trapero") || norm.includes("aseo") || norm.includes("escurridor")) return "home-cleaning-mop-brush";

  if (norm.includes("luces") && norm.includes("navidad")) return "christmas-lights";
  if (norm.includes("luces") || norm.includes("led") || norm.includes("proyector")) return "led-night-light-lamp";
  if (norm.includes("manguera")) return "expandable-garden-hose";

  const cat = category.toLowerCase();
  if (cat.includes("tecnologia")) return "electronics-gadget";
  if (cat.includes("hogar")) return "home-improvement-product";
  if (cat.includes("cocina")) return "kitchenware-cookware";
  if (cat.includes("salud")) return "wellness-supplement-bottle";
  if (cat.includes("belleza")) return "cosmetics-beauty-product";
  if (cat.includes("aseo")) return "cleaning-product";
  if (cat.includes("mascotas")) return "pet-supplies";
  if (cat.includes("herramientas")) return "hand-tools-hardware";
  if (cat.includes("moda")) return "fashion-apparel-accessory";

  return "consumer-product";
}

catalog.products = catalog.products.map((p: any) => {
  if (originalMap[p.id]) {
    p.imageUrl = originalMap[p.id];
  } else {
    const keyword = getSpecificKeyword(p.name, p.category || '');
    const seed = Array.from(p.id).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    p.imageUrl = `https://loremflickr.com/400/400/${encodeURIComponent(keyword)}?lock=${seed}`;
  }
  return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
console.log(`Successfully recalculated images for all ${catalog.products.length} products with expert preserving logic.`);

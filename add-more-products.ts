import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const raw = fs.readFileSync(catalogPath, 'utf-8');
const catalog = JSON.parse(raw);

const newImagesAndProducts = [
  {
    "id": "tablero-futbol",
    "name": "Tablero Futbol",
    "description": "Divertido tablero de fútbol de mesa interactivo para niños y adultos. Ideal para jugar en familia y desarrollar la coordinación.",
    "category": "hogar",
    "cost": 64500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908472-MCO72754605178_112023-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "organizador-giratorio-360-especies",
    "name": "Organizador Giratorio 360 Especies",
    "description": "Práctico organizador de especias y condimentos con base giratoria 360 grados. Ahorra espacio y mantén tu cocina ordenada.",
    "category": "hogar",
    "cost": 34500,
    "stock": 499,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_660995-MCO48325838520_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "organizador-de-toallas",
    "name": "Organizador De Toallas",
    "description": "Soporte organizador de toallas para baño, diseño elegante y moderno. Fácil de instalar y muy resistente.",
    "category": "hogar",
    "cost": 25000,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_895393-MLA50901235122_072022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "maca",
    "name": "Maca",
    "description": "Suplemento natural de Maca en polvo. Excelente fuente de energía y vitalidad, ideal para mejorar el rendimiento físico y mental.",
    "category": "salud",
    "cost": 31000,
    "stock": 498,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_934149-MCO46182181513_052021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "linterna-led-potente-tactica",
    "name": "Linterna Led Potente Tactica",
    "description": "Linterna táctica LED de alta potencia con zoom ajustable y batería recargable. Perfecta para camping, seguridad y emergencias.",
    "category": "hogar",
    "cost": 54500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_632349-MCO51123498112_082022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "set-de-marcadores-x-48-piezas",
    "name": "Set De Marcadores X 48 Piezas",
    "description": "Estuche con 48 marcadores de colores vibrantes y doble punta. Ideal para diseño, ilustración, lettering y coloreado.",
    "category": "hogar",
    "cost": 33500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603845-MCO74491959345_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "quita-callos",
    "name": "Quita Callos",
    "description": "Removedor de callos eléctrico recargable. Suaviza la piel de tus pies de forma rápida, segura y sin dolor en la comodidad de tu hogar.",
    "category": "belleza",
    "cost": 24500,
    "stock": 196,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_825835-MCO74100913554_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "termometro-para-alimentos",
    "name": "Termometro Para Alimentos",
    "description": "Termómetro digital de cocina tipo sonda para carnes, líquidos y repostería. Lectura rápida y precisa para resultados profesionales.",
    "category": "cocina",
    "cost": 18000,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_753139-MCO48100913123_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "llavero-sorpresa-la-bubu-y-capibara",
    "name": "Llavero Sorpresa La Bubu Y Capibara",
    "description": "Llaveros coleccionables sorpresa con adorables diseños de La Bubu y Capibara. Perfectos para regalar o decorar tu mochila.",
    "category": "moda",
    "cost": 16000,
    "stock": 200,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908123-MCO74512938123_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "zapatero-plegable-6-niveles-en-acrilico",
    "name": "Zapatero Plegable 6 Niveles En Acrilico",
    "description": "Organizador de zapatos plegable de 6 niveles fabricado en acrílico transparente. Diseño elegante, resistente y apilable.",
    "category": "hogar",
    "cost": 89500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_723491-MCO74291849182_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "rayador-de-verdura-electrico",
    "name": "Rayador De Verdura Electrico",
    "description": "Rallador y cortador eléctrico de verduras con múltiples cuchillas intercambiables. Ahorra tiempo en la cocina con cortes perfectos.",
    "category": "cocina",
    "cost": 57500,
    "stock": 498,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918239-MCO49102931293_022022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "pistola-lanzadora-de-hidrogel",
    "name": "Pistola Lanzadora De Hidrogel",
    "description": "Pistola de juguete que dispara seguras bolas de hidrogel ecológicas. Batería recargable y diseño futurista para máxima diversión.",
    "category": "hogar",
    "cost": 29500,
    "stock": 4,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_834912-MCO74910293812_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "perchero-doble-con-ruedas-de-160-cm",
    "name": "Perchero Doble Con Ruedas De 160 Cm",
    "description": "Práctico perchero metálico de doble barra ajustable con ruedas para fácil movilidad. Ideal para organizar ropa y zapatos.",
    "category": "hogar",
    "cost": 56500,
    "stock": 199,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603912-MCO74910293910_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "parches-acne",
    "name": "Parches Acne",
    "description": "Parches hidrocoloides invisibles para el tratamiento de granos y acné. Absorben impurezas, reducen la inflamación y protegen la piel.",
    "category": "belleza",
    "cost": 18500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819234-MCO50102931293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "espumador-batidora-electrica-4-en-1",
    "name": "Espumador Batidora Electrica 4 En 1",
    "description": "Batidora de mano y espumador eléctrico multifuncional 4 en 1. Prepara deliciosos capuchinos, bate huevos y mezcla con facilidad.",
    "category": "cocina",
    "cost": 69500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_728391-MCO74102931923_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "convertidor-de-pilas-aaa-en-aa-x2",
    "name": "Convertidor De Pilas Aaa En Aa X2",
    "description": "Adaptador práctico para convertir pilas AAA a tamaño AA. Solución económica y ecológica para tus dispositivos electrónicos.",
    "category": "tecnologia",
    "cost": 15500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_923849-MCO48102931234_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "lonchera-porta-comida-2-en-1",
    "name": "Lonchera Porta Comida 2 En 1",
    "description": "Lonchera eléctrica y porta comidas térmico 2 en 1. Calienta tu almuerzo en la oficina o el auto sin necesidad de microondas.",
    "category": "cocina",
    "cost": 34500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918231-MCO74192839123_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "chlorum-x-6",
    "name": "Chlorum X 6",
    "description": "Suplemento natural líquido a base de clorofila. Potente desintoxicante, oxigena la sangre y ayuda a neutralizar los malos olores corporales.",
    "category": "salud",
    "cost": 29500,
    "stock": 1000,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821923-MCO74291829312_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "tope-de-puerta-con-sistema-de-alarma",
    "name": "Tope De Puerta Con Sistema De Alarma",
    "description": "Tope de puerta de seguridad con alarma sirena de 120dB integrada. Se activa al intentar abrir la puerta, ideal para viajes o vivir solo.",
    "category": "hogar",
    "cost": 24500,
    "stock": 298,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_721839-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "yerba-magic-peach-mango",
    "name": "Yerba Magic Peach Mango",
    "description": "Bebida energizante natural a base de Yerba Mate sabor Durazno y Mango. Energía limpia y prolongada sin el bajón del café.",
    "category": "salud",
    "cost": 33000,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_912839-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "funda-protectora-para-moto",
    "name": "Funda Protectora Para Moto",
    "description": "Pijama carpa impermeable para motocicleta con protección UV. Protege tu moto de la lluvia, el sol, el polvo y los rayones.",
    "category": "autos",
    "cost": 24500,
    "stock": 496,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821920-MCO49102931293_022022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "set-de-utensilios-x-19-pequeno",
    "name": "Set De Utensilios X 19 Pequeno",
    "description": "Completo set de 19 utensilios de cocina en silicona antiadherente de grado alimenticio con mango de madera. Resistentes al calor.",
    "category": "cocina",
    "cost": 52500,
    "stock": 199,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_718293-MCO74102931293_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "linterna-frontal",
    "name": "Linterna Frontal",
    "description": "Linterna de cabeza manos libres con luz LED COB súper brillante, sensor de movimiento y batería recargable vía USB.",
    "category": "herramientas",
    "cost": 34500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_601928-MCO74291829312_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "maquillaje-capibara",
    "name": "Maquillaje Capibara",
    "description": "Set de maquillaje infantil con temática del adorable Capibara. Seguro, no tóxico y fácil de lavar, perfecto para las más pequeñas.",
    "category": "belleza",
    "cost": 30500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_812931-MCO74291823912_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "limpiadora-a-vapor-multifuncional",
    "name": "Limpiadora A Vapor Multifuncional",
    "description": "Máquina de limpieza a vapor de alta presión con múltiples boquillas. Limpia, desinfecta y quita la grasa sin usar químicos.",
    "category": "hogar",
    "cost": 99500,
    "stock": 493,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_901239-MCO74192831293_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "lector-interactivo-educativo-ingles",
    "name": "Lector Interactivo Educativo Ingles",
    "description": "Juguete educativo bilingüe con tarjetas interactivas para que los niños aprendan vocabulario, pronunciación y sonidos en inglés de forma divertida.",
    "category": "hogar",
    "cost": 38500,
    "stock": 510,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819231-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "silla-de-camping-portatil",
    "name": "Silla De Camping Portatil",
    "description": "Silla plegable ultraligera y resistente para acampar, pescar o ir a la playa. Incluye bolsa de transporte, fácil de armar.",
    "category": "hogar",
    "cost": 80500,
    "stock": 186,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819321-MCO51293812938_082022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "lampara-reloj-astronauta-en-la-luna-led",
    "name": "Lampara Reloj Astronauta En La Luna Led",
    "description": "Innovadora lámpara de noche con diseño de astronauta, proyector de galaxias, reloj digital y cargador inalámbrico incorporado.",
    "category": "hogar",
    "cost": 94500,
    "stock": 299,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_923812-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "humificador-gotas-bluetooth",
    "name": "Humificador Gotas Bluetooth",
    "description": "Humidificador y difusor de aromaterapia con efecto visual de gotas antigravedad, luz LED y parlante Bluetooth integrado.",
    "category": "hogar",
    "cost": 99500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_821938-MCO50293812938_062022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "plantillas-en-silicona",
    "name": "Plantillas En Silicona",
    "description": "Plantillas ortopédicas de gel de silicona para amortiguar el impacto. Alivian el dolor de pies, talones y fascitis plantar.",
    "category": "salud",
    "cost": 24500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918239-MCO74910293129_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "carro-control-remoto-sin-limites",
    "name": "Carro Control Remoto Sin Limites",
    "description": "Auto acrobático a control remoto 4x4 con luces LED, giro 360 grados y sensor de gestos con la mano para controlarlo.",
    "category": "hogar",
    "cost": 58500,
    "stock": 21,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_812938-MCO50192831293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "organizador-ropa-sucia",
    "name": "Organizador Ropa Sucia",
    "description": "Cesto plegable organizador para ropa sucia con estructura de aluminio. Diseño moderno, duradero y ahorrador de espacio.",
    "category": "hogar",
    "cost": 37500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918231-MCO74102931293_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "gafas-bt",
    "name": "Gafas Bt",
    "description": "Gafas de sol deportivas inteligentes con conectividad Bluetooth, auriculares integrados y micrófono para llamadas y música manos libres.",
    "category": "tecnologia",
    "cost": 29500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908472-MCO72754605178_112023-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "bombillo-inteligente-tuya-app",
    "name": "Bombillo Inteligente Tuya App",
    "description": "Foco LED WiFi RGB+W compatible con Tuya Smart, Alexa y Google Home. Controla color, brillo y horarios desde tu celular.",
    "category": "hogar",
    "cost": 34500,
    "stock": 294,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_660995-MCO48325838520_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "sofa-inflable-banana",
    "name": "Sofa Inflable Banana",
    "description": "Puff sofá perezoso inflable portátil y ultra ligero. Se infla con el viento en segundos, ideal para camping, playa o jardín.",
    "category": "hogar",
    "cost": 32500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_895393-MLA50901235122_072022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "rueda-abdominal",
    "name": "Rueda Abdominal",
    "description": "Rodillo para ejercicios abdominales de doble rueda antideslizante con rodillera incluida. Tonifica tu core desde casa.",
    "category": "salud",
    "cost": 28500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_934149-MCO46182181513_052021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "destprnillador-taladro",
    "name": "Destprnillador Taladro",
    "description": "Taladro atornillador inalámbrico de 12V a 24V con kit de accesorios y baterías. Potente, ergonómico y multiusos para el hogar.",
    "category": "herramientas",
    "cost": 84500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_632349-MCO51123498112_082022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "multi-collagen-microingredients",
    "name": "Multi Collagen Microingredients",
    "description": "Péptidos de Colágeno Multi tipo I, II, III, V y X hidrolizado. Mejora la salud de la piel, cabello, uñas y articulaciones.",
    "category": "salud",
    "cost": 30500,
    "stock": 1083,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603845-MCO74491959345_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "maquina-htc",
    "name": "Maquina Htc",
    "description": "Máquina cortapelo profesional HTC recargable. Cuchillas de acero de precisión, diseño ergonómico y guías de corte incluidas.",
    "category": "belleza",
    "cost": 44500,
    "stock": 294,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_825835-MCO74100913554_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "casco-proteccion",
    "name": "Casco Proteccion",
    "description": "Casco de seguridad industrial de alta resistencia certificado para construcción y trabajos de obra. Cómodo y ajustable.",
    "category": "herramientas",
    "cost": 28000,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_753139-MCO48100913123_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "termo-termico-stainless",
    "name": "Termo Termico Stainless",
    "description": "Termo de acero inoxidable con aislamiento al vacío de doble pared. Mantiene bebidas calientes o frías por hasta 12 horas.",
    "category": "hogar",
    "cost": 33500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_908123-MCO74512938123_022024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "combo-3-en-1-keratina",
    "name": "Combo 3 En 1 Keratina",
    "description": "Tratamiento completo capilar alisador con keratina. Incluye shampoo preparador, tratamiento alisante y mascarilla selladora.",
    "category": "belleza",
    "cost": 94500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_723491-MCO74291849182_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "juego-set-de-maquillaje-para-ninas-cute",
    "name": "Juego Set De Maquillaje Para Ninas Cute",
    "description": "Maletín completo de maquillaje de fantasía para niñas. Cosméticos reales lavables, seguros y con hermosos colores y accesorios.",
    "category": "hogar",
    "cost": 49500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_918239-MCO49102931293_022022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "maquillaje-kuromi-bolso",
    "name": "Maquillaje Kuromi Bolso",
    "description": "Set de brochas y maquillaje inspirado en Kuromi, viene en un lindo bolso cosmetiquero kawaii. Perfecto para fans de Sanrio.",
    "category": "belleza",
    "cost": 36500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_834912-MCO74910293812_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "cuchillo-vikingo",
    "name": "Cuchillo Vikingo",
    "description": "Cuchillo hacha de chef estilo artesanal serbio forjado a mano en acero al carbono. Filo extremo para carnes y vegetales.",
    "category": "cocina",
    "cost": 36500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_603912-MCO74910293910_032024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "humificador-base-de-madera",
    "name": "Humificador Base De Madera",
    "description": "Difusor de aceites esenciales ultrasónico con elegante base diseño madera y luces LED tenues. Crea un ambiente relajante.",
    "category": "hogar",
    "cost": 51500,
    "stock": 500,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_819234-MCO50102931293_052022-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "muneco-sonny-angel-hippers",
    "name": "Muneco Sonny Angel Hippers",
    "description": "Figuras coleccionables Sonny Angel Hippers. Diseñados para asomarse desde la parte superior de tu celular o monitor.",
    "category": "moda",
    "cost": 17500,
    "stock": 300,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_728391-MCO74102931923_012024-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  },
  {
    "id": "rueda-abdominal-rebote-automatico",
    "name": "Rueda Abdominal Rebote Automatico",
    "description": "Rodillo abdominal inteligente con sistema de asistencia de rebote automático para proteger tu espalda y maximizar el esfuerzo.",
    "category": "salud",
    "cost": 57500,
    "stock": 198,
    "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_923849-MCO48102931234_112021-O.webp",
    "currency": "COP",
    "provider": "Dropi"
  }
];

// Append or update products
for (const p of newImagesAndProducts) {
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

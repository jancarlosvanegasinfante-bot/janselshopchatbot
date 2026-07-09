import React, { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  CheckCircle, 
  Truck, 
  ShieldCheck, 
  Clock, 
  ChevronRight, 
  Star, 
  MessageCircle, 
  ArrowRight,
  Phone,
  MapPin,
  Lock,
  Sparkles,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getProxiedImageUrl } from "../lib/utils";
import toast from "react-hot-toast";

// 15 trending products with real images and standard values
const TRENDING_PRODUCTS = [
  {
    id: "modem-wifi-portatil",
    name: "Módem Wifi Portátil Pro",
    category: "tecnología",
    description: "Módem router wifi portátil 4G/5G LTE recargable de alta velocidad. Conecta hasta 10 dispositivos simultáneamente sin enredos en cualquier parte de Colombia.",
    price: 196900,
    originalPrice: 280000,
    imageUrl: "/src/assets/images/WIFIPORTATIL.png",
    rating: 4.9,
    reviews: 142,
    stock: 12
  },
  {
    id: "camara-dvr-25",
    name: "Cámara Grabación Vehículo DVR 2.5",
    category: "autos",
    description: "Cámara de seguridad para vehículos con grabación continua en resolución HD. Registra todo tu camino de forma continua protegiendo tus recorridos.",
    price: 123900,
    originalPrice: 199000,
    imageUrl: "/src/assets/images/CAMARA DUAL.png",
    rating: 4.9,
    reviews: 97,
    stock: 16
  },
  {
    id: "inter-comunicador-y10",
    name: "Inter Comunicador Y10",
    category: "motos",
    description: "Intercomunicador Bluetooth Y10 para cascos de moto con luces RGB, reducción de ruido de alta fidelidad y manos libres totalmente impermeable.",
    price: 139900,
    originalPrice: 199000,
    imageUrl: "/src/assets/images/INTERCOMUNICADOR.png",
    rating: 4.8,
    reviews: 98,
    stock: 15
  },
  {
    id: "holder-cargador-inalambr",
    name: "Holder Cargador Vehicular Carga Inalámbrica",
    category: "autos",
    description: "Soporte inteligente de alta velocidad para rejilla del auto que carga tu celular por inducción magnética mientras conduces de forma segura.",
    price: 118900,
    originalPrice: 160000,
    imageUrl: "/src/assets/images/CARGADOR MAGNETICO.png",
    rating: 4.8,
    reviews: 83,
    stock: 14
  },
  {
    id: "funda-protectora-para-moto",
    name: "Funda Protectora para Moto",
    category: "motos",
    description: "Pijama carpa de alta calidad e impermeable para motocicleta con protección UV. Protege contra la lluvia ácida, sol inclemente, polvo y rayones.",
    price: 80900,
    originalPrice: 110000,
    imageUrl: "/src/assets/images/FUNDA PARA MOTO.png",
    rating: 4.8,
    reviews: 109,
    stock: 19
  },
  {
    id: "destornillador-atornillador-electrico",
    name: "Destornillador Atornillador Eléctrico",
    category: "herramientas",
    description: "Destornillador eléctrico recargable inalámbrico de diseño compacto con juego completo de puntas de acero y cable de carga USB.",
    price: 78900,
    originalPrice: 149000,
    imageUrl: "/src/assets/images/ATORNILLADOR INALAMBRICO.png",
    rating: 4.4,
    reviews: 86,
    stock: 9
  },
  {
    id: "volante-seguro-pro",
    name: "Volante Seguro Pro",
    category: "autos",
    description: "Traba de alta seguridad para el volante de tu vehículo que se ancla directamente al broche del cinturón de seguridad. Fabricado con cable de acero trenzado ultra resistente y forro de lona protectora que evita rayones.",
    price: 79900,
    originalPrice: 99000,
    imageUrl: "/src/assets/images/SEGURO PARA VOLANTE.png",
    rating: 4.3,
    reviews: 118,
    stock: 7
  },
  {
    id: "cargador-bateria-inteligente",
    name: "Cargador Iniciador De Bateria Para Carro",
    category: "autos",
    description: "Cargador inteligente de batería de 12V con reparación de pulso para autos y motos. Cuenta con pantalla LCD que muestra voltaje, corriente y nivel de carga. Sistema inteligente de parada automática para evitar sobrecargas.",
    price: 94900,
    originalPrice: 120000,
    imageUrl: "/src/assets/images/INICIADOR DE VEHICULOS.png",
    rating: 4.2,
    reviews: 94,
    stock: 499
  },
  {
    id: "kit-renovacion-veh",
    name: "Kit de Renovación Lubristone 3 Pasos",
    category: "autos",
    description: "Incluye Quita rayones, Acondicionador de partes negras y Renovador de farolas de alta potencia. Recupera la estética original de tu vehículo en solo 3 pasos.",
    price: 89900,
    originalPrice: 130000,
    imageUrl: "/src/assets/images/KIT RENOVACION VEHICULO .png",
    rating: 4.2,
    reviews: 112,
    stock: 20
  },
  {
    id: "lampara-led-sensor",
    name: "Lámpara LED Sensor Ever Brite",
    category: "hogar",
    description: "Lámpara solar Ever Brite con sensor inteligente de movimiento, panel de 0.44W de alta eficiencia, batería de litio de 600 mAh y luces LED ultra brillantes.",
    price: 85900,
    originalPrice: 110000,
    imageUrl: "/src/assets/images/LAMPARA LED.png",
    rating: 4.1,
    reviews: 112,
    stock: 24
  },
  {
    id: "candado-alarma-grande",
    name: "Candado Alarma Grande",
    category: "hogar",
    description: "Candado de seguridad antirrobo ultra resistente con alarma integrada de 110dB que se activa ante el primer intento de golpe, vibración o forcejeo.",
    price: 72900,
    originalPrice: 95000,
    imageUrl: "/src/assets/images/CANDADO ALARMA.jpeg",
    rating: 4.1,
    reviews: 73,
    stock: 18
  },
  {
    id: "compresor-portatil-digital",
    name: "Compresor Portátil Vehículos Digital Car",
    category: "autos",
    description: "Compresor inteligente inalámbrico con pantalla digital and apagado automático inteligente al llegar a la presión programada. Ideal para llantas y balones.",
    price: 159900,
    originalPrice: 250000,
    imageUrl: "/src/assets/images/COMPRESOR.jpeg",
    rating: 4.9,
    reviews: 155,
    stock: 6
  },
  {
    id: "hidro-lavadora-48v",
    name: "Hidro Lavadora Inalámbrica 48v Vehículos",
    category: "autos",
    description: "Potente hidrolavadora de agua inalámbrica de alta presión ideal para lavar vehículos, motocicletas y ventanas de forma portátil sin enchufe eléctrico.",
    price: 112900,
    originalPrice: 180000,
    imageUrl: "/src/assets/images/HIDROLAVADORA INALAMBRICA.jpeg",
    rating: 4.9,
    reviews: 134,
    stock: 11
  },
  {
    id: "mini-aspiradora-port",
    name: "Mini Aspiradora Portátil Gold Edition",
    category: "autos",
    description: "Aspiradora de mano premium con diseño compacto y succión de alta potencia para remover suciedad de cojinería, rejillas y esquinas difíciles.",
    price: 75900,
    originalPrice: 120000,
    imageUrl: "/src/assets/images/MINIASPIRADORA.jpeg",
    rating: 4.8,
    reviews: 55,
    stock: 20
  },
  {
    id: "saca-golpes-herramie",
    name: "Kit Saca Golpes Pops-a-Dent DIY",
    category: "herramientas",
    description: "Kit completo de reparación casera para remover abolladuras y golpes en la lámina del auto sin comprometer la pintura original.",
    price: 80900,
    originalPrice: 120000,
    imageUrl: "/src/assets/images/KIT SACAGOLPES.png",
    rating: 4.4,
    reviews: 121,
    stock: 20
  }
];

export default function LandingPage() {
  const [selectedProduct, setSelectedProduct] = useState(TRENDING_PRODUCTS[0]);
  const [quantity, setQuantity] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    city: "",
    address: "",
    addressIndicator: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<any>(null);
  const [officialBotNumber, setOfficialBotNumber] = useState("");
  const [activeTab, setActiveTab] = useState<string>("Todos");

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/config")
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
      })
      .catch(err => console.error("Error fetching bot config", err));
  }, []);

  const handleSelectProduct = (product: typeof TRENDING_PRODUCTS[0]) => {
    setSelectedProduct(product);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateTotal = () => {
    const unitPrice = selectedProduct.price;
    if (quantity === 1) return unitPrice;
    if (quantity === 2) return Math.round(unitPrice * 2 * 0.9); // 10% discount for 2
    return Math.round(unitPrice * quantity * 0.85); // 15% discount for 3+
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) return toast.error("Por favor dinos tu nombre");
    if (!formData.customerPhone.trim() || formData.customerPhone.length < 7) return toast.error("Ingresa un número de celular válido");
    if (!formData.city.trim()) return toast.error("Escribe tu Ciudad o Municipio de destino");
    if (!formData.address.trim()) return toast.error("Escribe tu dirección de entrega exacta");

    setSubmitting(true);
    try {
      const payload = {
        storeId: "default",
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        address: formData.address,
        addressIndicator: formData.addressIndicator,
        city: formData.city,
        productName: selectedProduct.name,
        productId: selectedProduct.id,
        quantity: quantity,
        totalPrice: calculateTotal(),
        notes: formData.notes || "Pedido de la Landing Page"
      };

      const res = await fetch("/api/public/landing-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setOrderCompleted(data.order);
        toast.success("¡Pedido creado con éxito! 🎉");
      } else {
        toast.error("Error al procesar el pedido: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Ocurrió un error de red: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppHelp = (order?: any) => {
    let msg = "";
    if (order) {
      msg = `¡Hola Jan Sel Shop! 👋 Acabo de realizar un pedido desde la Landing Page y quiero acelerar mi despacho:\n\n` +
            `*ID Pedido:* #${order.id}\n` +
            `*Cliente:* ${order.customerName}\n` +
            `*Producto:* ${order.productName} (x${order.quantity})\n` +
            `*Total:* $${order.totalPrice?.toLocaleString()} COP *(Pagar contraentrega)*\n\n` +
            `¡Por favor confírmame que todo esté correcto para despachar hoy! 🚀`;
    } else {
      msg = `¡Hola Jan! 👋 Vengo de ver la Landing Page y me interesa conocer más sobre sus 15 productos en tendencia. ¿Me puedes asesorar?`;
    }
    const phone = officialBotNumber || "14155238886";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Filter products by tab category
  const categories = ["Todos", "Tecnología", "Motos", "Hogar", "Autos", "Herramientas"];
  const filteredProducts = activeTab === "Todos" 
    ? TRENDING_PRODUCTS 
    : TRENDING_PRODUCTS.filter(p => p.category.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden selection:bg-amber-400 selection:text-black">
      {/* Dynamic Promotion Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 text-center text-xs font-black uppercase tracking-wider py-2.5 px-4 animate-pulse flex items-center justify-center gap-2 text-black shadow-lg">
        <Sparkles size={14} className="animate-spin text-black" />
        <span>⚡ SÚPER PROMO: ENVÍO GRATIS A TODA COLOMBIA + PAGO CONTRAENTREGA 🚚📦</span>
      </div>

      {/* Modern Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900/80">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-2xl shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              J
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight leading-none bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">Jan Sel Shop</h1>
              <span className="text-[10px] text-slate-500 tracking-widest uppercase font-mono">Tendencias de Colombia</span>
            </div>
          </div>
          
          <button 
            onClick={() => handleWhatsAppHelp()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-amber-400 hover:text-black font-extrabold text-xs tracking-wider uppercase transition-all duration-300 border border-slate-800 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <MessageCircle size={14} fill="currentColor" />
            Asesoría WhatsApp
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        {/* Abstract background graphics */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest"
          >
            <Sparkles size={12} className="animate-pulse" />
            Ventas de Confianza en Toda Colombia
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] font-serif italic"
          >
            Los 15 Productos <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent font-sans uppercase not-italic">Más Vendidos de Colombia</span>
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            Comprar por internet nunca fue tan fácil y seguro. Revisa nuestro top 15 más vendido, ordena el tuyo en segundos rellenando tus datos de despacho, y <span className="text-white font-bold underline decoration-amber-400">pagas en efectivo solo cuando llegue a la puerta de tu casa</span>. ¡Sin tarjetas de crédito, sin demoras!
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-300 font-bold bg-slate-900/50 backdrop-blur-md border border-slate-900 p-6 rounded-3xl max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Truck size={14} />
              </div>
              <span>Envío Gratis Total</span>
            </div>
            <div className="w-1 h-1 bg-slate-800 rounded-full hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck size={14} />
              </div>
              <span>Pago Contraentrega (CODI)</span>
            </div>
            <div className="w-1 h-1 bg-slate-800 rounded-full hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock size={14} />
              </div>
              <span>Garantía de Satisfacción</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Catalog Grid */}
      <section className="py-12 px-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 border-b border-slate-900 pb-6">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase">Selección Exclusiva</span>
            <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-amber-400" />
              Catálogo de Tendencias Hoy
            </h3>
          </div>
          
          {/* Categories Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all ${
                  activeTab === cat 
                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105" 
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-850"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((p, idx) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              className="bg-slate-900/40 rounded-3xl border border-slate-900 overflow-hidden flex flex-col group hover:border-slate-800 hover:shadow-2xl hover:shadow-amber-400/[0.02] transition-all duration-300 relative"
            >
              {/* Product Badge */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                <span className="bg-amber-400 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-md">
                  MÁS VENDIDO 🔥
                </span>
                <span className="bg-slate-950/80 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded-md border border-white/5 uppercase font-mono">
                  Stock: {p.stock} unid.
                </span>
              </div>

              {/* Product Image Area */}
              <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
                <img 
                  src={getProxiedImageUrl(p.imageUrl)} 
                  alt={p.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
              </div>

              {/* Product Details */}
              <div className="p-6 flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono uppercase">
                  <span>{p.category}</span>
                  <div className="flex items-center gap-1 text-amber-400 font-sans font-bold">
                    <Star size={12} fill="currentColor" />
                    <span>{p.rating}</span>
                    <span className="text-slate-600">({p.reviews})</span>
                  </div>
                </div>

                <div className="space-y-1 grow">
                  <h4 className="font-extrabold text-lg text-white leading-tight line-clamp-1 group-hover:text-amber-300 transition-colors">{p.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>
                </div>

                {/* Pricing Block */}
                <div className="flex items-end justify-between border-t border-slate-900 pt-4">
                  <div>
                    <span className="block text-[9px] text-slate-500 font-mono uppercase leading-none mb-1">Precio Promocional</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-2xl text-amber-400">${p.price.toLocaleString()} COP</span>
                      <span className="text-xs text-slate-500 line-through">${p.originalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">
                    Ahorras {Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                  </span>
                </div>

                {/* Call To Action */}
                <button 
                  onClick={() => handleSelectProduct(p)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 group-hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <span>Ordenar Contraentrega</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Form and Selection Section */}
      <section className="py-20 px-4 bg-slate-950 border-t border-slate-900" ref={formRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle size={10} />
              Registro Rápido de Pedidos
            </div>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight font-serif italic">
              📝 Formulario de Despacho Inmediato
            </h3>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Llenar este formulario te toma menos de 1 minuto. Registraremos tu pedido de inmediato y te enviaremos la guía de envío. Recuerda: <span className="text-white font-bold">¡Envío gratis y pagas al recibir!</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Form Steps */}
            <form onSubmit={handleSubmit} className="md:col-span-7 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-lg">
              
              {/* Product Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400">1. Selecciona tu Producto:</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  value={selectedProduct.id}
                  onChange={(e) => {
                    const prod = TRENDING_PRODUCTS.find(p => p.id === e.target.value);
                    if (prod) setSelectedProduct(prod);
                  }}
                >
                  {TRENDING_PRODUCTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ${p.price.toLocaleString()} COP
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Picker */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400">2. Cantidad & Promociones de Unidades:</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuantity(num)}
                      className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center border text-xs transition-all ${
                        quantity === num 
                          ? "bg-amber-400 text-black border-amber-400 font-black shadow-lg shadow-amber-400/10 scale-105" 
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      <span className="text-base font-black">{num} {num === 1 ? 'Unidad' : 'Unidades'}</span>
                      {num === 2 && <span className="text-[9px] text-slate-900 bg-amber-300 px-1.5 py-0.5 rounded-md mt-1 uppercase font-bold font-mono">Lleva 2 (-10%)</span>}
                      {num === 3 && <span className="text-[9px] text-slate-900 bg-amber-300 px-1.5 py-0.5 rounded-md mt-1 uppercase font-bold font-mono">Lleva 3 (-15%)</span>}
                      {num === 1 && <span className="text-[9px] text-slate-500 mt-1">Precio normal</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-900" />

              {/* Customer Contact Info */}
              <div className="space-y-4">
                <label className="block text-xs font-black uppercase tracking-widest text-amber-400">3. Datos de Envío del Cliente:</label>
                
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1">Nombre Completo:</span>
                  <input 
                    type="text" 
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    placeholder="Ej. Juan Carlos Vanegas"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold flex items-center gap-1">Número de Celular:</span>
                    <input 
                      type="tel" 
                      name="customerPhone"
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      placeholder="Ej. 3123456789"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold flex items-center gap-1">Ciudad / Municipio (Colombia):</span>
                    <input 
                      type="text" 
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Ej. Bogotá D.C. o Medellín"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1">Dirección de Entrega Exacta:</span>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Ej. Calle 10 # 5-20, Apto 402, Barrio Las Flores"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1">Indicaciones / Referencia Adicional:</span>
                  <input 
                    type="text" 
                    name="addressIndicator"
                    value={formData.addressIndicator}
                    onChange={handleInputChange}
                    placeholder="Ej. Frente al parque, portería blanca, rejas negras"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Big Pulsing Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500 font-black text-base uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-wait font-sans"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Enviando Pedido...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Confirmar Pedido Contraentrega 🛒</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                <ShieldCheck size={12} className="text-amber-400" />
                <span>Tus datos están protegidos. Despachamos de forma inmediata y pagas al recibir.</span>
              </p>
            </form>

            {/* Sidebar Summary */}
            <div className="md:col-span-5 space-y-6">
              {/* Product preview card */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Resumen de tu selección:</h4>
                
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-slate-950 rounded-2xl overflow-hidden shrink-0 border border-slate-800">
                    <img 
                      src={getProxiedImageUrl(selectedProduct.imageUrl)} 
                      alt={selectedProduct.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">{selectedProduct.category}</span>
                    <h5 className="font-extrabold text-sm text-white leading-tight">{selectedProduct.name}</h5>
                    <p className="text-xs text-slate-500 font-mono">${selectedProduct.price.toLocaleString()} COP c/u</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-900 pt-4 text-xs font-semibold text-slate-300">
                  <div className="flex justify-between">
                    <span>Producto seleccionado:</span>
                    <span className="text-white font-extrabold">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cantidad:</span>
                    <span className="text-white font-extrabold">{quantity} {quantity === 1 ? 'unidad' : 'unidades'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío a Colombia:</span>
                    <span className="text-emerald-400 font-black uppercase tracking-wider">¡COMPLETAMENTE GRATIS! 🚚</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Método de pago:</span>
                    <span className="text-amber-400 font-black">Contraentrega (Pagas al recibir)</span>
                  </div>
                  
                  {quantity > 1 && (
                    <div className="flex justify-between text-emerald-400 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                      <span>Descuento Especial:</span>
                      <span className="font-black">-{quantity === 2 ? "10%" : "15%"}</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-900 my-2" />
                  
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="text-sm font-bold text-white uppercase">Total a Pagar:</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400 font-mono">${calculateTotal().toLocaleString()} COP</span>
                      <span className="block text-[9px] text-slate-500 font-mono mt-1">Pagas al mensajero en la entrega</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security badges */}
              <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-3xl space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-400" />
                  Garantía de Satisfacción Total
                </h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Todos nuestros despachos se realizan bajo estrictas normas de seguridad con las principales transportadoras nacionales (Servientrega, Envía, Interrapidisimo, Coordinadora). Si el producto llega en mal estado, te lo cambiamos sin ningún costo adicional.
                </p>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400 flex flex-col items-center flex-1">
                    <Truck size={16} className="text-amber-400 mb-1" />
                    <span>Entrega 2-4 días</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400 flex flex-col items-center flex-1">
                    <ShieldCheck size={16} className="text-amber-400 mb-1" />
                    <span>Garantía de 30 días</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Review Banner */}
      <section className="py-16 px-4 bg-slate-900/20 border-t border-slate-900">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h4 className="text-2xl font-black font-serif italic uppercase tracking-tight">🗣️ Lo que dicen nuestros clientes en Colombia</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-900 space-y-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">"Pedí el módem portátil y me llegó súper rápido a Cali. Pagué contraentrega cuando lo recibí en mi casa. Espectacular el servicio de Jan."</p>
              <span className="block text-[10px] font-bold text-white font-mono">— Carlos M., Cali</span>
            </div>
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-900 space-y-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">"Increíble la máquina de donas, la uso para hacer los desayunos de mis hijos y quedan perfectas. Muy contenta con el servicio, 100% recomendados."</p>
              <span className="block text-[10px] font-bold text-white font-mono">— Diana P., Bogotá</span>
            </div>
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-900 space-y-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">"El intercomunicador funciona de maravilla en carretera, se escucha súper claro incluso a alta velocidad. Es una compra excelente para viajar seguro."</p>
              <span className="block text-[10px] font-bold text-white font-mono">— Mateo R., Medellín</span>
            </div>
          </div>
        </div>
      </section>

      {/* Success Modal / Confetti Animation */}
      <AnimatePresence>
        {orderCompleted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-amber-500/20 max-w-lg w-full rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl relative"
            >
              {/* Confetti Accent */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle size={36} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-black">¡Pedido Registrado Correctamente!</span>
                <h4 className="text-2xl font-black text-white font-serif italic">¡Muchas Gracias por tu Compra! 🎉</h4>
                <p className="text-xs text-slate-400">
                  Hemos agendado tu despacho para hoy mismo. Tu pedido con ID <span className="font-mono text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">#{orderCompleted.id}</span> ya está listo para despacho.
                </p>
              </div>

              {/* Order details block */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-900 text-left text-xs font-semibold text-slate-400 space-y-2.5">
                <div className="flex justify-between">
                  <span>Producto:</span>
                  <span className="text-white font-black">{orderCompleted.productName} (x{orderCompleted.quantity})</span>
                </div>
                <div className="flex justify-between">
                  <span>Cliente:</span>
                  <span className="text-white font-bold">{orderCompleted.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Destino de despacho:</span>
                  <span className="text-white font-bold capitalize">{orderCompleted.city}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dirección exacta:</span>
                  <span className="text-white">{orderCompleted.address}</span>
                </div>
                <div className="h-px bg-slate-900 my-1" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-white uppercase">Total a pagar al recibir:</span>
                  <span className="text-lg font-black text-amber-400 font-mono">${orderCompleted.totalPrice?.toLocaleString()} COP</span>
                </div>
              </div>

              {/* Secondary CTA - Massive booster in Colombia */}
              <div className="space-y-3">
                <button
                  onClick={() => handleWhatsAppHelp(orderCompleted)}
                  className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-98"
                >
                  <MessageCircle size={18} fill="currentColor" />
                  <span>Acelerar Despacho por WhatsApp 🚀</span>
                </button>
                
                <button
                  onClick={() => setOrderCompleted(null)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-900 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Regresar al Catálogo
                </button>
              </div>

              <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                <Truck size={12} className="text-emerald-400" />
                <span>Envío express garantizado. Pagas al mensajero en efectivo.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Footer */}
      <footer className="bg-slate-950 border-t border-slate-900/80 py-12 px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-lg">
              J
            </div>
            <h4 className="font-extrabold text-white tracking-tight">Jan Sel Shop</h4>
          </div>
          <p className="text-slate-500 text-xs max-w-lg mx-auto">
            Jan Sel Shop es una tienda de confianza registrada en Colombia, líder en la distribución de productos de consumo masivo, tecnología y hogar con el método de pago contraentrega nacional.
          </p>
          <div className="text-slate-600 text-[10px] font-mono space-y-1">
            <p>© 2026 Jan Sel Shop. Todos los derechos reservados.</p>
            <p>Despachado con amor desde Colombia 🇨🇴</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
  HelpCircle,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard
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
  // Pre-populate with first product (Módem Wifi) to keep the initial form looking complete, but customizable!
  const [cart, setCart] = useState<{ product: typeof TRENDING_PRODUCTS[0]; quantity: number }[]>([
    { product: TRENDING_PRODUCTS[0], quantity: 1 }
  ]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"contraentrega" | "anticipado">("contraentrega");
  const [checkoutMode, setCheckoutMode] = useState<"formulario" | "whatsapp">("formulario");
  
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

  // Gatillos mentales: Countdown timer for urgency
  const [timeLeft, setTimeLeft] = useState(582); // 9 minutes 42 seconds in seconds
  // Gatillos mentales: Live purchase popup for social proof
  const [livePurchase, setLivePurchase] = useState<any>(null);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch twilio/whatsapp config
    fetch("/api/public/config")
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
      })
      .catch(err => console.error("Error fetching bot config", err));

    // Urgency countdown interval
    const timerInterval = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 600 : prev - 1));
    }, 1000);

    // Social proof: purchase alert triggers
    const purchases = [
      { name: "Juan Carlos V.", city: "Cali", product: "Módem Wifi Portátil Pro", time: "hace 2 min" },
      { name: "Diana Patricia P.", city: "Bogotá", product: "Mini Aspiradora Portátil", time: "hace 5 min" },
      { name: "Mateo R.", city: "Medellín", product: "Inter Comunicador Y10", time: "hace 1 min", method: "pago anticipado" },
      { name: "Andrés Felipe G.", city: "Barranquilla", product: "Cargador Iniciador De Bateria", time: "hace 4 min" },
      { name: "Yolanda S.", city: "Bucaramanga", product: "Compresor Portátil Vehículos Digital", time: "hace 3 min" },
      { name: "Carlos Arturo T.", city: "Pereira", product: "Volante Seguro Pro", time: "hace 6 min" },
      { name: "Laura M.", city: "Cartagena", product: "Hidro Lavadora Inalámbrica 48v", time: "hace 8 min" }
    ];

    const showNextNotification = () => {
      const rand = purchases[Math.floor(Math.random() * purchases.length)];
      setLivePurchase(rand);
      setTimeout(() => {
        setLivePurchase(null);
      }, 5500);
    };

    const initialTimeout = setTimeout(showNextNotification, 3000);
    const notificationInterval = setInterval(showNextNotification, 18000);

    return () => {
      clearInterval(timerInterval);
      clearTimeout(initialTimeout);
      clearInterval(notificationInterval);
    };
  }, []);

  // Cart operations
  const addToCart = (product: typeof TRENDING_PRODUCTS[0], silent = false) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const nextCart = [...prev];
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: nextCart[existingIndex].quantity + 1
        };
        if (!silent) toast.success(`¡Cantidad aumentada para ${product.name}! 🛒`);
        return nextCart;
      }
      if (!silent) toast.success(`¡${product.name} agregado al carrito! 🛒`);
      return [...prev, { product, quantity: 1 }];
    });
    if (!silent) {
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    toast.success("Producto removido del carrito");
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: newQty } : item));
  };

  // Convert seconds to mm:ss format
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Advanced calculation based on total items in cart
  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const originalSubtotal = cart.reduce((sum, item) => sum + (item.product.originalPrice * item.quantity), 0);
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Quantity discounts
    let quantityDiscount = 0;
    if (totalQty === 2) {
      quantityDiscount = Math.round(subtotal * 0.10); // 10% discount on total cart
    } else if (totalQty >= 3) {
      quantityDiscount = Math.round(subtotal * 0.15); // 15% discount on total cart
    }

    const intermediateTotal = subtotal - quantityDiscount;

    // Prepayment discount (8% off the intermediate total)
    let prepaymentDiscount = 0;
    if (paymentMethod === "anticipado") {
      prepaymentDiscount = Math.round(intermediateTotal * 0.08);
    }

    const finalTotal = intermediateTotal - prepaymentDiscount;

    return {
      subtotal,
      originalSubtotal,
      totalQty,
      quantityDiscount,
      prepaymentDiscount,
      finalTotal,
      savings: (originalSubtotal - finalTotal)
    };
  };

  const { subtotal, totalQty, quantityDiscount, prepaymentDiscount, finalTotal, savings } = calculateTotals();

  // Scroll to checkout form smoothly
  const handleProceedToForm = () => {
    setIsCartOpen(false);
    setCheckoutMode("formulario");
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  // Catalog item direct checkout: adds to cart and scrolls to form instantly
  const handleInstantBuy = (product: typeof TRENDING_PRODUCTS[0]) => {
    // Ensure the product is in the cart
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev;
      return [...prev, { product, quantity: 1 }];
    });
    setCheckoutMode("formulario");
    toast.success(`Configurando tu despacho para ${product.name} 📦`, { icon: "⚡" });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // WhatsApp Order formulation
  const handleWhatsAppOrder = (directPaymentMode?: "contraentrega" | "anticipado") => {
    if (cart.length === 0) {
      return toast.error("El carrito está vacío. Agrega algún producto para pedir.");
    }
    const selectedMode = directPaymentMode || paymentMethod;
    const itemsText = cart.map(item => `• *${item.product.name}* (x${item.quantity}) - $${item.product.price.toLocaleString()} COP c/u`).join("\n");
    
    const discountText = quantityDiscount > 0 ? `\n🎁 *Descuento Especial (${totalQty === 2 ? "10%" : "15%"}):* -$${quantityDiscount.toLocaleString()} COP` : "";
    const prepayText = selectedMode === "anticipado" ? `\n🌟 *Descuento Pago Anticipado (8%):* -$${prepaymentDiscount.toLocaleString()} COP` : "";
    
    const modeLabel = selectedMode === "anticipado" 
      ? "🔴 *Pago Anticipado (Nequi / Daviplata / Bancolombia) - ¡Descuento de 8% aplicado!*" 
      : "🟢 *Pago Contraentrega (Pagas al recibir en efectivo)*";

    const msg = `¡Hola Jan Sel Shop! 👋 Quiero realizar el siguiente pedido directo desde la Landing Page:\n\n` +
                `🛒 *RESUMEN DEL CARRITO:*\n${itemsText}\n\n` +
                `⚙️ *DESGLOSE DE COSTO:*\n` +
                `• *Subtotal:* $${subtotal.toLocaleString()} COP` +
                `${discountText}` +
                `${prepayText}\n` +
                `🚚 *Envío:* ¡COMPLETAMENTE GRATIS! 🇨🇴\n` +
                `💰 *TOTAL NETO A PAGAR:* $${finalTotal.toLocaleString()} COP\n\n` +
                `💳 *MÉTODO DE PAGO:* ${modeLabel}\n\n` +
                `👤 *DATOS DE DESPACHO INMEDIATO:*\n` +
                `• *Nombre:* ${formData.customerName || "Aún no especificado"}\n` +
                `• *Celular:* ${formData.customerPhone || "Aún no especificado"}\n` +
                `• *Ciudad/Municipio:* ${formData.city || "Aún no especificado"}\n` +
                `• *Dirección Exacta:* ${formData.address || "Aún no especificado"}\n` +
                `• *Indicaciones:* ${formData.addressIndicator || "Ninguna"}\n\n` +
                `¡Por favor agendar mi despacho hoy mismo! Quedo muy atento. 🚀`;

    const phone = officialBotNumber || "14155238886";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Form submission (Database saving + Twilio Admin notify)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      return toast.error("El carrito está vacío. Por favor agrega algún artículo arriba.");
    }
    if (!formData.customerName.trim()) return toast.error("Por favor dinos tu nombre");
    if (!formData.customerPhone.trim() || formData.customerPhone.length < 7) return toast.error("Ingresa un número de celular válido");
    if (!formData.city.trim()) return toast.error("Escribe tu Ciudad o Municipio de destino");
    if (!formData.address.trim()) return toast.error("Escribe tu dirección de entrega exacta");

    setSubmitting(true);
    try {
      // Build scannable unified representation for Shopify / Dropi and Database
      const unifiedProductName = cart.map(item => `${item.product.name} (x${item.quantity})`).join(" + ");
      const firstProductId = cart[0]?.product.id || "multi-cart";
      const totalQuantities = cart.reduce((sum, item) => sum + item.quantity, 0);

      const itemsDetailStr = cart.map(item => `- ${item.product.name} x${item.quantity} ($${item.product.price.toLocaleString()} c/u)`).join("\n");
      const paymentLabel = paymentMethod === "anticipado" ? "Pago Anticipado con 8% de Descuento Extra" : "Pago Contraentrega al Recibir";
      
      const payload = {
        storeId: "default",
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        address: formData.address,
        addressIndicator: formData.addressIndicator,
        city: formData.city,
        productName: unifiedProductName,
        productId: firstProductId,
        quantity: totalQuantities,
        totalPrice: finalTotal,
        notes: `Método de Pago: ${paymentLabel}\n\nPRODUCTOS:\n${itemsDetailStr}\n\nNotas adicionales: ${formData.notes || "Pedido de la Landing Page"}`
      };

      const res = await fetch("/api/public/landing-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setOrderCompleted({
          ...data.order,
          cartItems: [...cart],
          paymentMethodMode: paymentMethod
        });
        toast.success("¡Pedido registrado de inmediato! 🎉");
        setCart([]); // Clear cart upon success
      } else {
        toast.error("Error al procesar: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error de red: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["Todos", "Tecnología", "Motos", "Hogar", "Autos", "Herramientas"];
  const filteredProducts = activeTab === "Todos" 
    ? TRENDING_PRODUCTS 
    : TRENDING_PRODUCTS.filter(p => p.category.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden selection:bg-amber-400 selection:text-black pb-12">
      
      {/* Gatillo Mental 1: Urgency Timer top bar */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 text-center text-xs font-black uppercase tracking-wider py-2.5 px-4 flex items-center justify-center gap-2 text-black shadow-lg">
        <Sparkles size={14} className="animate-spin text-black" />
        <span>⚡ SÚPER PROMO: ¡Últimas unidades con ENVÍO GRATIS a Colombia! Oferta especial vence en:</span>
        <span className="bg-black text-amber-400 font-mono px-2 py-0.5 rounded text-xs font-black tracking-widest">{formatTime(timeLeft)}</span>
      </div>

      {/* Modern Header */}
      <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-900/80 z-40 relative">
        <div className="max-w-6xl mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/src/assets/images/logo.jpg" 
              alt="Jansel Shop Logo" 
              className="w-16 h-16 object-contain rounded-xl shadow-[0_0_20px_rgba(0,180,255,0.4)] hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.src = "/src/assets/images/logo.png";
                e.currentTarget.onerror = null; // Prevent infinite loop if both fail
              }}
            />
            <div className="hidden sm:block">
              <h1 className="font-black text-xl tracking-tight leading-none bg-gradient-to-r from-white via-blue-200 to-blue-400 bg-clip-text text-transparent">JANSEL SHOP</h1>
              <span className="text-[10px] text-blue-500 tracking-widest uppercase font-mono">Tendencias de Colombia</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Header Shopping Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-white hover:text-amber-400 transition-all cursor-pointer flex items-center gap-2 group"
            >
              <ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold hidden sm:inline">Mi Carrito</span>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center animate-bounce">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            <button 
              onClick={() => handleWhatsAppOrder()}
              className="hidden md:flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-xs tracking-wider uppercase transition-all duration-300 shadow-md cursor-pointer"
            >
              <MessageCircle size={14} fill="currentColor" />
              Preguntar en WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 px-4">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Sparkles size={12} className="animate-pulse" />
            COMPRAS 100% SEGURAS EN TODA COLOMBIA
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] font-serif italic">
            Los 15 Productos <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent font-sans uppercase not-italic">Más Deseados de Colombia</span>
          </h2>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Compra en un solo clic y paga contraentrega. Agrega todos los productos que desees a tu carrito para disfrutar de <span className="text-white font-black underline decoration-amber-400">envío totalmente gratuito y súper descuentos automáticos</span> por cantidad. ¡Despachamos hoy!
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300 font-bold bg-slate-900/40 backdrop-blur-md border border-slate-900 p-6 rounded-3xl max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-2">
              <Truck className="text-amber-400" size={20} />
              <span>Envío Gratis Nacional</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-2 border-l border-slate-900">
              <ShieldCheck className="text-amber-400" size={20} />
              <span>Pago Contraentrega</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-2 border-l border-slate-900">
              <Sparkles className="text-amber-400" size={20} />
              <span>8% Pago Anticipado</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-2 border-l border-slate-900">
              <Clock className="text-amber-400" size={20} />
              <span>Garantía Inmediata</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Grid */}
      <section className="py-8 px-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 border-b border-slate-900 pb-6">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase">Selección Premium de Tendencias</span>
            <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-amber-400" />
              Nuestros 15 Más Vendidos
            </h3>
          </div>
          
          {/* Categories Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === cat 
                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105" 
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-850 hover:bg-slate-850"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((p, idx) => {
            // Static random values for dynamic scarcity look
            const remainingUnits = (idx * 3 + 4) % 9 + 3;
            const liveViewers = (idx * 7 + 12) % 18 + 14;
            const cartItem = cart.find(item => item.product.id === p.id);

            return (
              <motion.div 
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                className="bg-slate-900/30 rounded-3xl border border-slate-900 overflow-hidden flex flex-col group hover:border-slate-800 hover:shadow-2xl transition-all duration-300 relative"
              >
                {/* Image and Badges */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                  <span className="bg-amber-400 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                    MÁS VENDIDO 🔥
                  </span>
                  <span className="bg-slate-950/90 backdrop-blur-md text-emerald-400 text-[8.5px] font-bold px-2 py-1 rounded-md border border-white/5 uppercase font-mono flex items-center gap-1">
                    <Clock size={10} /> Solo quedan {remainingUnits} unidades
                  </span>
                </div>

                <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
                  <img 
                    src={getProxiedImageUrl(p.imageUrl)} 
                    alt={p.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono uppercase">
                    <span>{p.category}</span>
                    <div className="flex items-center gap-1 text-amber-400 font-sans font-bold">
                      <Star size={12} fill="currentColor" />
                      <span>{p.rating}</span>
                      <span className="text-slate-600">({p.reviews})</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 grow">
                    <h4 className="font-extrabold text-lg text-white leading-tight line-clamp-1 group-hover:text-amber-300 transition-colors">
                      {p.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                    <div className="text-[10px] text-amber-400/80 font-bold flex items-center gap-1 bg-amber-400/5 py-1 px-2.5 rounded-lg border border-amber-400/10 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      {liveViewers} personas están viendo este artículo
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-end justify-between border-t border-slate-900 pt-4">
                    <div>
                      <span className="block text-[9px] text-slate-500 font-mono uppercase leading-none mb-1">Precio Promocional</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-2xl text-amber-400">${p.price.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 line-through">${p.originalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">
                      Ahorras {Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                    </span>
                  </div>

                  {/* Actions Block: Dynamic picker if already in cart */}
                  <div>
                    {cartItem ? (
                      <div className="flex items-center gap-2 w-full pt-1">
                        <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex-1 justify-between h-11 px-2">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(p.id, cartItem.quantity - 1)}
                            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer rounded-lg"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black font-mono text-white text-center flex-1">
                            {cartItem.quantity} en carrito
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(p.id, cartItem.quantity + 1)}
                            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer rounded-lg"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsCartOpen(true);
                            setTimeout(() => {
                              formRef.current?.scrollIntoView({ behavior: "smooth" });
                            }, 150);
                          }}
                          className="h-11 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          <span>Pagar 🚀</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button 
                          type="button"
                          onClick={() => addToCart(p)}
                          className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <ShoppingCart size={13} className="text-amber-400" />
                          <span>Al Carrito</span>
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => handleInstantBuy(p)}
                          className="py-3 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-lg shadow-amber-400/5 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        >
                          <span>Comprar Ya ⚡</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Main Checkout Section */}
      <section className="py-20 px-4 bg-slate-950 border-t border-slate-900" ref={formRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle size={10} />
              PROCESADOR DE ORDEN SEGURO
            </div>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight font-serif italic">
              📝 Formulario de Pedido Inmediato
            </h3>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Sencillo, rápido y seguro. Revisa tus artículos abajo, ingresa tus datos de entrega y recibe en la puerta de tu casa. <span className="text-amber-400 font-bold">¡Envío gratis nacional!</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Left side: Checkout Form and Cart review list */}
            <div className="md:col-span-7 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl backdrop-blur-lg">
              
              {/* Cart List Inside Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <ShoppingCart size={14} className="text-amber-400" />
                    1. Revisa tus Productos agregados:
                  </h4>
                  <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded-lg text-slate-400 font-mono border border-slate-900">
                    Artículos: {totalQty}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="bg-slate-950/60 p-8 rounded-2xl border border-dashed border-slate-900 text-center space-y-3">
                    <ShoppingBag className="mx-auto text-slate-600 animate-pulse" size={32} />
                    <p className="text-xs text-slate-400">Tu carrito de compras está vacío.</p>
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 400, behavior: "smooth" });
                        toast.success("¡Selecciona cualquiera de nuestros 15 artículos de arriba! 🎉");
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-widest cursor-pointer hover:bg-amber-300"
                    >
                      Explorar el Catálogo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-900 gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                            <img 
                              src={getProxiedImageUrl(item.product.imageUrl)} 
                              alt={item.product.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-extrabold text-xs text-white truncate max-w-[150px] sm:max-w-[200px]">{item.product.name}</h5>
                            <span className="text-[10px] text-amber-400 font-mono font-bold">${item.product.price.toLocaleString()} COP</span>
                          </div>
                        </div>

                        {/* Quantity picker + delete */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="px-2 text-xs font-black font-mono text-white">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Promotion Prompt (Gatillos Mentales) */}
              {cart.length > 0 && totalQty < 2 && (
                <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl flex items-start gap-2.5">
                  <Sparkles size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10.5px] text-slate-300 leading-normal">
                    💡 <span className="text-indigo-300 font-black">¡Añade 1 producto más de cualquier categoría</span> y recibe un <span className="text-white font-extrabold underline">10% de descuento en TODA tu compra</span> de forma automática!
                  </p>
                </div>
              )}

              {/* Payment Methods selector with 8% Prepayment discount (Mental trigger!) */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-amber-400" />
                  2. Método de Pago Preferido:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Contraentrega */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("contraentrega")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                      paymentMethod === "contraentrega"
                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/20"
                        : "bg-slate-950/60 border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1 text-white">
                        <Truck size={14} className="text-amber-400" />
                        Pagas al Recibir
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === "contraentrega" ? "border-amber-400 bg-amber-400" : "border-slate-800 bg-transparent"
                      }`}>
                        {paymentMethod === "contraentrega" && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Recibes tu paquete mediante Servientrega o Envía, y le pagas en efectivo al mensajero. Súper seguro.
                    </p>
                  </button>

                  {/* Option 2: Pago Anticipado con 8% extra discount */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("anticipado")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                      paymentMethod === "anticipado"
                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/20"
                        : "bg-slate-950/60 border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    {/* Discount badge */}
                    <span className="absolute -top-1 -right-3 bg-gradient-to-r from-red-500 to-amber-500 text-black font-black text-[7.5px] uppercase tracking-widest px-4 py-1.5 rotate-12">
                      ¡AHORRAS 8%! 🔥
                    </span>

                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1 text-white">
                        <Sparkles size={14} className="text-amber-400" />
                        Pago Anticipado
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === "anticipado" ? "border-amber-400 bg-amber-400" : "border-slate-800 bg-transparent"
                      }`}>
                        {paymentMethod === "anticipado" && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Pagas mediante Nequi, Daviplata o Transferencia Bancaria y te aplicamos un <span className="text-emerald-400 font-extrabold font-mono">8% DE DESCUENTO EXTRA</span> directo en tu total.
                    </p>
                  </button>
                </div>

                {paymentMethod === "anticipado" && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/25 rounded-2xl space-y-3.5 mt-3"
                  >
                    <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs">
                      <Sparkles size={14} className="animate-pulse text-amber-400" />
                      <span>¡EXCELENTE ELECCIÓN! AHORRAS UN 8% EN TU COMPRA</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed">
                      Realiza tu transferencia por cualquiera de estos canales oficiales y adjunta el comprobante para habilitar tu <span className="text-white font-black">Despacho Prioritario 🚀</span>:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase text-[#E52F86] tracking-wider mb-1">📱 NEQUI</span>
                        <span className="text-xs font-mono font-black text-white select-all">312 345 6789</span>
                        <span className="text-[8px] text-slate-500 mt-1">A nombre de: Jan S. Shop</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase text-[#421D83] tracking-wider mb-1">💳 DAVIPLATA</span>
                        <span className="text-xs font-mono font-black text-white select-all">312 345 6789</span>
                        <span className="text-[8px] text-slate-500 mt-1">A nombre de: Jan S. Shop</span>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-slate-500 leading-normal flex items-start gap-1.5 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/40">
                      <Lock size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <span>Una vez registres tu pedido por formulario o WhatsApp, nuestro asesor te contactará de inmediato para recibir tu comprobante. ¡Súper ágil!</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Checkout Method Tab Switcher inside checkout form */}
              <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-900 mt-4">
                <button
                  type="button"
                  onClick={() => setCheckoutMode("formulario")}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    checkoutMode === "formulario"
                      ? "bg-amber-400 text-black shadow-lg shadow-amber-400/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <Lock size={14} />
                  <span>Pedido por Formulario 📝</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutMode("whatsapp")}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    checkoutMode === "whatsapp"
                      ? "bg-[#25D366] text-white shadow-lg shadow-emerald-500/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <MessageCircle size={14} fill="currentColor" />
                  <span>Pedido por WhatsApp 🚀</span>
                </button>
              </div>

              {checkoutMode === "formulario" ? (
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <MapPin size={14} />
                    3. Datos de Envío del Cliente:
                  </label>
                  
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold">Nombre Completo:</span>
                    <input 
                      type="text" 
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Ej. Juan Carlos Vanegas"
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400 font-bold">Número de Celular:</span>
                      <input 
                        type="tel" 
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        placeholder="Ej. 3123456789"
                        required
                        className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400 font-bold">Ciudad / Municipio (Colombia):</span>
                      <input 
                        type="text" 
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Ej. Bogotá D.C. o Medellín"
                        required
                        className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold">Dirección de Entrega Exacta:</span>
                    <input 
                      type="text" 
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Ej. Calle 10 # 5-20, Apto 402, Barrio Las Flores"
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold">Indicaciones / Referencia Adicional (Opcional):</span>
                    <input 
                      type="text" 
                      name="addressIndicator"
                      value={formData.addressIndicator}
                      onChange={handleInputChange}
                      placeholder="Ej. Frente al parque principal, portería blanca"
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-700"
                    />
                  </div>

                  {/* Submission CTAs */}
                  <div className="pt-4 space-y-3">
                    <button
                      type="submit"
                      disabled={submitting || cart.length === 0}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500 font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Guardando Pedido Seguro...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={16} />
                          <span>Confirmar Pedido por Formulario 📝</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => handleWhatsAppOrder()}
                      className="w-full py-4 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-3 shadow-xl active:scale-98 cursor-pointer disabled:opacity-40"
                    >
                      <MessageCircle size={16} fill="currentColor" />
                      <span>O Prefiero Pedir por WhatsApp 🚀</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5 pt-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#25D366] flex items-center gap-1.5">
                    <MessageCircle size={14} fill="currentColor" />
                    3. Datos de tu Pedido WhatsApp:
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400 font-bold">Tu Nombre (Opcional):</span>
                    <input 
                      type="text" 
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Ej. Juan Carlos Vanegas"
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400 font-bold">Número de Celular (Opcional):</span>
                      <input 
                        type="tel" 
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        placeholder="Ej. 3123456789"
                        className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400 font-bold">Ciudad / Municipio (Opcional):</span>
                      <input 
                        type="text" 
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Ej. Bogotá o Medellín"
                        className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-700"
                      />
                    </div>
                  </div>

                  {/* WhatsApp preview box */}
                  <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-2.5">
                    <span className="text-[10px] font-mono tracking-widest text-[#25D366] uppercase font-bold flex items-center gap-1.5">
                      <MessageCircle size={12} fill="currentColor" />
                      Vista previa de tu Mensaje Express:
                    </span>
                    <div className="bg-slate-900/50 p-3 rounded-xl text-[11.5px] text-slate-300 font-mono leading-relaxed max-h-[160px] overflow-y-auto border border-slate-900">
                      <p className="whitespace-pre-line text-slate-300">
                        {`¡Hola Jan Sel Shop! 👋 Quiero realizar un pedido directo por WhatsApp:\n\n`}
                        {cart.map(item => `• *${item.product.name}* (x${item.quantity}) - $${item.product.price.toLocaleString()} COP`).join("\n")}
                        {`\n\n💰 *Total Neto a Pagar:* $${finalTotal.toLocaleString()} COP`}
                        {`\n🚚 *Envío:* ¡COMPLETAMENTE GRATIS! 🇨🇴`}
                        {`\n💳 *Método de Pago:* ${paymentMethod === "anticipado" ? "Pago Anticipado con 8% de Descuento Especial" : "Pago Contraentrega (Pagas al recibir)"}`}
                        {formData.customerName && `\n\n👤 *Nombre:* ${formData.customerName}`}
                        {formData.customerPhone && `\n📱 *Celular:* ${formData.customerPhone}`}
                        {formData.city && `\n📍 *Ciudad:* ${formData.city}`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => handleWhatsAppOrder()}
                    className="w-full py-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={18} fill="currentColor" />
                    <span>Confirmar Pedido Directo en WhatsApp 🚀</span>
                  </button>
                </div>
              )}

              <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 mt-2">
                <ShieldCheck size={12} className="text-amber-400" />
                <span>Tus datos están protegidos. Despachamos el mismo día y pagas al recibir.</span>
              </p>
            </div>

            {/* Right side: Detailed Sidebar Summary */}
            <div className="md:col-span-5 space-y-6 sticky top-28">
              
              <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-900 pb-3">Resumen de Cuenta:</h4>
                
                <div className="space-y-4">
                  {cart.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No hay productos seleccionados.</p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex gap-3 justify-between items-center text-xs">
                          <span className="text-slate-300 font-semibold truncate max-w-[160px]">{item.product.name} <span className="text-amber-400 font-black">x{item.quantity}</span></span>
                          <span className="text-white font-mono">${(item.product.price * item.quantity).toLocaleString()} COP</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-slate-900 pt-4 text-xs font-semibold text-slate-300">
                  <div className="flex justify-between">
                    <span>Subtotal de Productos:</span>
                    <span className="text-white font-mono">${subtotal.toLocaleString()} COP</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Envío a Colombia:</span>
                    <span className="text-emerald-400 font-black uppercase tracking-wider">¡TOTALMENTE GRATIS! 🚚</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Método de despacho:</span>
                    <span className="text-white font-bold">EntregaPrioritaria 📦</span>
                  </div>

                  {quantityDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                      <span>Descuento de Cantidad ({totalQty >= 3 ? "15%" : "10%"}):</span>
                      <span className="font-black font-mono">-${quantityDiscount.toLocaleString()} COP</span>
                    </div>
                  )}

                  {prepaymentDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 bg-amber-400/5 p-2 rounded-xl border border-amber-400/10">
                      <span>Descuento Pago Anticipado (8%):</span>
                      <span className="font-black font-mono">-${prepaymentDiscount.toLocaleString()} COP</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-900 my-2" />
                  
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="text-sm font-bold text-white uppercase">Total a Pagar:</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400 font-mono">${finalTotal.toLocaleString()} COP</span>
                      <span className="block text-[9px] text-slate-500 mt-1">
                        {paymentMethod === "anticipado" ? "Confirmas con transferencia bancaria" : "Pagas al recibir tu orden"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security banners */}
              <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-3xl space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-400" />
                  Sello de Garantía Colombiana
                </h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Todos tus despachos viajan asegurados al 100%. Trabajamos de la mano con las mejores agencias logísticas (Servientrega, Envía, Coordinadora, Interrapidisimo) para asegurar entregas rápidas de 2 a 4 días hábiles.
                </p>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400 flex flex-col items-center flex-1">
                    <Truck size={16} className="text-amber-400 mb-1" />
                    <span>Entrega 2-4 días</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400 flex flex-col items-center flex-1">
                    <ShieldCheck size={16} className="text-amber-400 mb-1" />
                    <span>Garantía de 30 días</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Review Section */}
      <section className="py-16 px-4 bg-slate-900/20 border-t border-slate-900">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h4 className="text-2xl font-black font-serif italic uppercase tracking-tight">🗣️ Lo que opinan nuestros clientes felices</h4>
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
              <p className="text-xs text-slate-400 leading-relaxed italic">"Aproveché el 8% de descuento por pagar anticipado con Nequi. El despacho fue prioritario y me ahorré un buen dinero. Todo original y bien empacado."</p>
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

      {/* Floating Shopping Cart Drawer Component */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Sliding Panel */}
            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.35 }}
                className="w-screen max-w-md bg-slate-950 border-l border-slate-900 flex flex-col h-full shadow-2xl relative"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-amber-400" />
                    <h3 className="font-extrabold text-white text-base">Tu Carrito de Compra</h3>
                  </div>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 text-xs font-black cursor-pointer"
                  >
                    Cerrar ✕
                  </button>
                </div>

                {/* Cart list content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 border border-slate-800">
                        <ShoppingCart size={28} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Tu carrito está vacío</h4>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-1">Explora nuestro catálogo y agrega los productos de tu interés.</p>
                      </div>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-amber-300 transition-colors cursor-pointer"
                      >
                        Ver Catálogo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-900 relative group">
                          {/* Item image */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                            <img 
                              src={getProxiedImageUrl(item.product.imageUrl)} 
                              alt={item.product.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-extrabold text-sm text-white truncate pr-6">{item.product.name}</h4>
                            <p className="text-xs text-slate-500 font-mono">${item.product.price.toLocaleString()} COP c/u</p>
                            
                            <div className="flex items-center justify-between pt-1">
                              {/* Quantity triggers */}
                              <div className="flex items-center bg-slate-950 rounded-lg border border-slate-850 overflow-hidden">
                                <button
                                  onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                  className="p-1 hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="px-2 text-xs font-mono font-black text-white">{item.quantity}</span>
                                <button
                                  onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                  className="p-1 hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Trash2 size={10} /> Quitar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer calculations and checkout buttons */}
                {cart.length > 0 && (
                  <div className="p-6 bg-slate-950 border-t border-slate-900 space-y-4">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal ({totalQty} unidades):</span>
                        <span className="text-white font-mono font-bold">${subtotal.toLocaleString()} COP</span>
                      </div>
                      
                      {quantityDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Descuento de Cantidad ({totalQty >= 3 ? "15%" : "10%"}):</span>
                          <span className="font-bold font-mono">-${quantityDiscount.toLocaleString()} COP</span>
                        </div>
                      )}

                      {paymentMethod === "anticipado" && prepaymentDiscount > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span>Ahorro por Pago Anticipado (8%):</span>
                          <span className="font-bold font-mono">-${prepaymentDiscount.toLocaleString()} COP</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-400">
                        <span>Envío Express Colombia:</span>
                        <span className="text-emerald-400 font-black">¡COMPLETAMENTE GRATIS! 🚚</span>
                      </div>
                      
                      <div className="h-px bg-slate-900 my-2" />
                      
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-sm font-bold text-white uppercase">Total Estimado:</span>
                        <span className="text-2xl font-black text-amber-400 font-mono">${finalTotal.toLocaleString()} COP</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleProceedToForm}
                        className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 cursor-pointer"
                      >
                        <span>Completar Pedido por Formulario 📝</span>
                        <ArrowRight size={14} />
                      </button>

                      <button
                        onClick={() => handleWhatsAppOrder()}
                        className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        <MessageCircle size={14} fill="currentColor" />
                        <span>Hacer Pedido por WhatsApp 🚀</span>
                      </button>
                    </div>

                    <p className="text-[9px] text-slate-600 text-center flex items-center justify-center gap-1">
                      <Lock size={10} className="text-amber-400" />
                      <span>Pago 100% seguro contra entrega o transferencia bancaria directa.</span>
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Cart Bubble for "más movible" and interactive feel */}
      <AnimatePresence>
        {cart.length > 0 && !isCartOpen && (
          <motion.button
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-amber-400 text-black shadow-2xl hover:scale-110 active:scale-95 transition-transform flex items-center gap-2 cursor-pointer group"
          >
            <ShoppingCart size={22} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wide pr-1 hidden md:inline">Ver Carrito ({totalQty})</span>
            <span className="w-6 h-6 rounded-full bg-black text-amber-400 text-[10px] font-black flex items-center justify-center">
              {totalQty}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Social Proof Live Sales Alert slide-in notification */}
      <AnimatePresence>
        {livePurchase && (
          <motion.div
            initial={{ opacity: 0, x: -100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed bottom-6 left-6 z-40 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl max-w-sm shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-lg shrink-0">
              🛒
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs text-slate-300 leading-normal">
                <span className="text-white font-extrabold">{livePurchase.name}</span> de <span className="text-amber-400 font-bold capitalize">{livePurchase.city}</span> compró un:
              </p>
              <h5 className="font-extrabold text-xs text-white truncate max-w-[200px] mt-0.5">{livePurchase.product}</h5>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-slate-500 font-mono">{livePurchase.time}</span>
                {livePurchase.method && (
                  <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest font-mono">
                    8% Desc. Directo
                  </span>
                )}
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                  <CheckCircle size={8} /> Envío gratis
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal / Confirmation screen */}
      <AnimatePresence>
        {orderCompleted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-amber-500/20 max-w-lg w-full rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl relative my-8"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle size={36} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-black">¡Pedido Registrado Correctamente!</span>
                <h4 className="text-2xl font-black text-white font-serif italic">¡Muchas Gracias por tu Compra! 🎉</h4>
                <p className="text-xs text-slate-400">
                  Hemos agendado tu despacho prioritario. Tu pedido con ID <span className="font-mono text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">#{orderCompleted.id}</span> ya ingresó a la cola de embalaje.
                </p>
              </div>

              {/* Order details block */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-900 text-left text-xs font-semibold text-slate-400 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Artículos Solicitados:</span>
                  {orderCompleted.cartItems ? (
                    <div className="space-y-1 pl-1.5">
                      {orderCompleted.cartItems.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-white font-black">
                          <span>{item.product.name} (x{item.quantity})</span>
                          <span className="text-amber-400 font-mono">${(item.product.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white font-black">{orderCompleted.productName} (x{orderCompleted.quantity})</div>
                  )}
                </div>

                <div className="h-px bg-slate-900 my-1" />

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
                <div className="flex justify-between">
                  <span>Método de Pago:</span>
                  <span className="text-amber-400 font-black">
                    {orderCompleted.paymentMethodMode === "anticipado" ? "Pago Anticipado (8% Descuento Aplicado)" : "Pago Contraentrega (Al mensajero)"}
                  </span>
                </div>
                <div className="h-px bg-slate-900 my-1" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-white uppercase">Total Neto de Orden:</span>
                  <span className="text-xl font-black text-amber-400 font-mono">${orderCompleted.totalPrice?.toLocaleString()} COP</span>
                </div>
              </div>

              {/* Secondary CTA - Massive booster in Colombia */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const itemsText = orderCompleted.cartItems ? orderCompleted.cartItems.map((item: any) => `• *${item.product.name}* (x${item.quantity})`).join("\n") : `• *${orderCompleted.productName}* (x${orderCompleted.quantity})`;
                    const msg = `¡Hola Jan Sel Shop! 👋 Acabo de realizar mi pedido por formulario y quiero acelerar el despacho:\n\n` +
                                `*ID Pedido:* #${orderCompleted.id}\n` +
                                `*Cliente:* ${orderCompleted.customerName}\n` +
                                `*Productos:* \n${itemsText}\n` +
                                `*Total:* $${orderCompleted.totalPrice?.toLocaleString()} COP\n` +
                                `*Método:* ${orderCompleted.paymentMethodMode === "anticipado" ? "Pago Anticipado (Recibí 8% Desc)" : "Pago Contraentrega"}\n\n` +
                                `¡Por favor confírmame que todo esté correcto para despachar de inmediato hoy! 🚀`;
                    const phone = officialBotNumber || "14155238886";
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98"
                >
                  <MessageCircle size={18} fill="currentColor" />
                  <span>Acelerar Despacho por WhatsApp 🚀</span>
                </button>
                
                <button
                  onClick={() => setOrderCompleted(null)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-850 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Regresar al Catálogo
                </button>
              </div>

              <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                <Truck size={12} className="text-emerald-400" />
                <span>Envío express garantizado. Recibes en la puerta de tu casa.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Footer */}
      <footer className="bg-slate-950 border-t border-slate-900/80 py-12 px-4 text-center mt-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-lg">
              J
            </div>
            <h4 className="font-extrabold text-white tracking-tight">Jan Sel Shop</h4>
          </div>
          <p className="text-slate-500 text-xs max-w-lg mx-auto leading-relaxed">
            Jan Sel Shop es una tienda de absoluta confianza registrada en Colombia, líder en la distribución de productos de consumo masivo, tecnología y artículos del hogar con el método de pago contraentrega nacional.
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
import * as React from "react";
import { useState, useEffect } from "react";
import { db, collection, onSnapshot, query, orderBy, getDocs } from "../supabase";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, 
  ChevronRight, 
  Star, 
  ShieldCheck, 
  Truck, 
  MessageCircle,
  Zap,
  Info,
  CheckCircle2,
  Phone,
  Video
} from "lucide-react";
import toast from "react-hot-toast";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";
import type { PromotionCombo } from "../lib/promotions";
import catalogData from "../catalog.json";
import { getProxiedImageUrl } from "../lib/utils";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  videoUrl?: string;
  category?: string;
  stock?: number;
  storeId?: string;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storesMap, setStoresMap] = useState<Record<string, {name: string, slug: string}>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [officialBotNumber, setOfficialBotNumber] = useState("");

  useEffect(() => {
    fetch("/api/public/config")
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
      })
      .catch(err => console.error("Error fetching bot config", err));
  }, []);

  useEffect(() => {
    // Fetch stores to map IDs to slugs
    const fetchStores = async () => {
      const snap = await getDocs(collection(db, "stores"));
      const map: Record<string, {name: string, slug: string}> = {};
      snap.docs.forEach(d => {
        map[d.id] = { name: d.data().name, slug: d.data().slug };
      });
      setStoresMap(map);
    };
    fetchStores();

    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(prods.length > 0 ? prods : (catalogData.products as Product[]));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products from Firestore, falling back to local JSON:", error);
      setProducts(catalogData.products as Product[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category || "Otros").filter(Boolean)))];

  const filteredProducts = selectedCategory === "Todos" 
    ? products 
    : products.filter(p => (p.category || "Otros") === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(price);
  };

  const currentWhatsApp = officialBotNumber || "15072233213"; // Jan Bot Phone

  const getWhatsAppLink = (product: Product) => {
    const storeInfo = product.storeId ? storesMap[product.storeId] : null;
    const storeSlug = storeInfo?.slug || "jansel-shop";
    const storeName = storeInfo?.name || "Jan Sel Shop";
    const msg = `¡Hola Jan! 👋 Vengo de la tienda *${storeName}* ref: #${storeSlug}. Me interesó mucho el ${product.name}, vi que está en promo. ¿Todavía te quedan disponibles?`;
    return `https://wa.me/${currentWhatsApp}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-dark-accent selection:text-white">
      {/* Header / Hero */}
      <header className="relative py-12 px-6 border-b border-white/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-dark-accent rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -right-24 w-96 h-96 bg-dark-green rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-6xl mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <img 
              src="/images/logo.jpg" 
              alt="Jansel Shop Logo" 
              className="w-24 h-24 object-contain rounded-2xl shadow-[0_0_30px_rgba(0,180,255,0.4)] mx-auto hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.src = "/images/logo.png";
                e.currentTarget.onerror = null;
              }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Zap size={14} className="text-dark-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest">Jan Sel Shop - Catálogo Oficial</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black mb-6 tracking-tighter leading-none italic uppercase"
          >
            Dale <span className="text-dark-accent">Vida</span> a tu <span className="text-dark-green">Bólido</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
          >
            Seleccionamos solo lo mejor para que tu vehículo resalte en la calle. 
            Productos premium con despacho hoy mismo y pago al recibir. 📦🚀
          </motion.p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Categories Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-8 mb-12 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                selectedCategory === cat 
                  ? "bg-white text-black border-white" 
                  : "bg-white/5 text-neutral-500 border-white/10 hover:border-white/30"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Combos Especiales Section */}
        {selectedCategory === "Todos" && (
          <div className="mb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-red-400">Promociones de Locura 🔥</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none italic">
                  Combos <span className="text-dark-accent">Cross-Selling</span> Especiales
                </h2>
                <p className="text-neutral-400 text-xs mt-2 max-w-xl">
                  Lleva productos complementarios de un mismo proveedor con descuentos masivos de hasta el 20%. ¡Envío GRATIS y pago contraentrega! 📦🚀
                </p>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                {ACTIVE_PROMOTIONS.length} COMBOS ACTIVOS ⚡
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ACTIVE_PROMOTIONS.map((combo) => {
                return (
                  <div 
                    key={combo.id}
                    className="relative group bg-neutral-900/60 rounded-[2.5rem] border border-red-500/10 hover:border-dark-accent/40 transition-all p-6 flex flex-col justify-between overflow-hidden shadow-2xl animate-fade-in"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-dark-accent/10 rounded-full blur-2xl group-hover:bg-dark-accent/20 transition-all" />

                    <div>
                      {/* Badge and Discount tag */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="text-[9px] font-black uppercase bg-dark-accent/20 text-dark-accent px-3 py-1 rounded-full border border-dark-accent/20">
                          {combo.badge}
                        </span>
                        <span className="text-[10px] font-black uppercase bg-red-600 text-white px-2.5 py-1 rounded-lg animate-pulse">
                          AHORRA {combo.discountPercentage}% 💰
                        </span>
                      </div>

                      {/* Images overlap block */}
                      <div className="flex items-center justify-center gap-2 mb-6 bg-black/30 p-4 rounded-3xl border border-white/5 h-36">
                        {combo.productIds.map((pId, idx) => {
                          const prod = products.find(p => p.id === pId);
                          return (
                            <div key={pId} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/10 bg-neutral-800 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                              {prod?.imageUrl ? (
                                <img 
                                  src={getProxiedImageUrl(prod.imageUrl)} 
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag size={20} className="text-white/20" />
                                </div>
                              )}
                              {/* Product tag/badge */}
                              <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-extrabold text-neutral-300">
                                #{idx + 1}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <h3 className="text-lg font-black uppercase tracking-tight mb-1 text-white group-hover:text-dark-accent transition-colors leading-tight">
                        {combo.name}
                      </h3>
                      <p className="text-dark-green text-[10px] font-black uppercase tracking-widest mb-3 italic">
                        {combo.tagline}
                      </p>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3 mb-6 font-medium">
                        {combo.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-500 line-through font-bold block decoration-red-500">
                            {formatPrice(combo.originalPrice)}
                          </span>
                          <span className="text-2xl font-black text-white tracking-tighter block">
                            {formatPrice(combo.promoPrice)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black text-dark-green bg-dark-green/10 px-2.5 py-1 rounded-full uppercase block">
                            Envío Gratis 🚛💨
                          </span>
                        </div>
                      </div>

                      <a 
                        href={`https://wa.me/${currentWhatsApp}?text=${encodeURIComponent(
                          `¡Hola Jan! 👋 Vengo del catálogo. Me interesó la súper promo de combo: *${combo.name}* (*${combo.tagline}*) por solo *${formatPrice(combo.promoPrice)}* (ahorro del ${combo.discountPercentage}%). ¿Tienes disponibilidad para envío inmediato?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-dark-green text-black font-black text-[10px] uppercase tracking-widest py-3.5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-dark-green/10"
                      >
                        Pedir Combo en WhatsApp <Phone size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-96 rounded-3xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  className="group bg-neutral-900/40 rounded-[2rem] border border-white/5 overflow-hidden hover:border-dark-accent/40 transition-all flex flex-col h-full"
                >
                  {/* Image Area */}
                  <div className="aspect-square relative overflow-hidden bg-black/40">
                    {product.imageUrl ? (
                      <img 
                        src={getProxiedImageUrl(product.imageUrl)} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Simply hide the broken image - React handles the rest
                          e.currentTarget.style.display = 'none';
                          // Show a simple product icon fallback next to it
                          const fallback = document.createElement('div');
                          fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-900';
                          fallback.textContent = '📦';
                          fallback.style.fontSize = '2rem';
                          e.currentTarget.parentElement?.appendChild(fallback);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                        <ShoppingBag className="text-white/10" size={48} />
                      </div>
                    )}
                    
                    {/* Badge Promo */}
                    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                      <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-xl animate-pulse">
                        -30% HOY 🔥
                      </div>
                      <div className="bg-white/10 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded-full border border-white/20">
                        ÚLTIMAS UNIDADES 📦
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-dark-accent uppercase tracking-widest">Garantizado ✅</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 tracking-tight group-hover:text-dark-accent transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3 mb-4 font-medium">
                        {product.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-4 mt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[12px] text-neutral-500 line-through font-bold decoration-red-500/50">
                            {formatPrice(product.price * 1.4)}
                          </p>
                          <p className="text-3xl font-black text-white tracking-tighter">
                            {formatPrice(product.price)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 text-dark-green bg-dark-green/10 px-2 py-1 rounded-lg mb-1">
                            <Truck size={12} />
                            <span className="text-[9px] font-black uppercase">Envío Grátis</span>
                          </div>
                          <span className="text-[8px] text-dark-accent font-black uppercase">Ahorras {formatPrice(product.price * 0.4)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a 
                          href={getWhatsAppLink(product)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-dark-green text-black font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-dark-green/10"
                        >
                          Lo quiero <Phone size={14} />
                        </a>
                        <button 
                          onClick={() => {
                            if (product.videoUrl) window.open(product.videoUrl, '_blank');
                            else toast("¡Pronto tendremos video de este producto! ✨");
                          }}
                          className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/30 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl transition-all"
                        >
                          Ver Video <Video size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer Features */}
      <footer className="bg-black/40 border-t border-white/5 mt-20 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-dark-accent/10 flex items-center justify-center text-dark-accent mx-auto md:mx-0">
                <Truck size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Pago Contraentrega</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Pides hoy y pagas solamente cuando el producto llegue a la puerta de tu casa. Sin riesgos.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-dark-green/10 flex items-center justify-center text-dark-green mx-auto md:mx-0">
                <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Garantía de Calidad</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Todos nuestros productos son probados y certificados. Si no te sirve, te lo cambiamos.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto md:mx-0">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Soporte VIP</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Atención personalizada por WhatsApp antes, durante y después de tu compra.
              </p>
            </div>
          </div>
          
          <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
              © 2026 JANSEL SHOP - MEDELLÍN, COLOMBIA
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-neutral-600 hover:text-white transition-colors"><Star size={18} /></a>
              <a href="#" className="text-neutral-600 hover:text-white transition-colors"><MessageCircle size={18} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Utility for tailwind classes if not imported
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

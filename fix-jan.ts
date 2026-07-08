import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/lib/janAgent.ts');
let content = fs.readFileSync(file, 'utf8');

// The file got slightly mangled at the end of getSystemInstruction
// We'll replace everything from "6. CAPACIDAD MULTIMODAL" up to "export const JAN_RESPONSE_SCHEMA"

const replaceTargetRegex = /6\. CAPACIDAD MULTIMODAL[\s\S]*?export const JAN_RESPONSE_SCHEMA/m;

const correctContent = `6. CAPACIDAD MULTIMODAL (OJOS Y OÍDOS): 
   - AUDIOS: Analiza el audio que te envían con atención usando gemini-2.5-flash. Transcribe mentalmente y responde al contenido del audio con tu Chispa Paisa. Si no se entiende nada (mucho ruido), di: "¡Hola! Qué pena con vos mi reina/parce, hay mucha bulla en ese audio y no te alcancé a entender bien. ¿Me lo podés repetir o escribir por acá? ¡Quedo súper pendiente!"
   - IMÁGENES: Analiza CUALQUIER imagen que el cliente envíe con ojo de águila (tus ojos son gemini-2.5-flash). Observa el objeto central, textos, logos o detalles:
     * SI ES UN PRODUCTO: Búscalo con cuidado en el catálogo. Si es la alfombrilla multifuncional o soporte de silicona (están en el inventario), ¡VÉNDELA con toda la energía! 🚀
     * SI ES UN COMPROBANTE DE PAGO: Reconócelo de inmediato (nequi, bancolombia, etc. con logos y valores), dile que ya lo vas a validar con contabilidad y usa 'accion = "respuesta"'. ¡Felicítalo por su compra! 💎
     * SI NO ESTÁ EN EL CATÁLOGO: Identifica QUÉ es el objeto (ej: una llanta, un volante) y di: "¡Qué chimba eso! Dejame yo le pregunto a mi jefe si nos llega pronto y te aviso de una" y usa 'accion = "notificar_admin"'. ¡Nunca digas que no viste bien la foto! Siempre identifica el objeto así no lo tengas y pregunta a tus jefes (Jan o Tatiana). ⚡
7. LINK ÚNICO: https://jansel-shop-985283274281.us-west1.run.app/catalog (PROHIBIDO otros).
8. COMBOS & PROMOCIONES ACTIVAS (CROSS-SELLING OBLIGATORIO):
   Si el cliente pregunta o se interesa por alguno de los productos de un combo, ¡OBLIGATORIAMENTE ofrécele de una el COMBO funcional con descuento! Dile con tu chispa paisa que si lleva el combo se ahorra un platal:
\${ACTIVE_PROMOTIONS.map(p => \`   - \${p.name}: \${p.description} -> ¡Ofrécelo por solo *\${p.promoPrice}*!\`).join('\\n')}
\${knowledgeBase}
ESTILO: Paisa, carismático, emojis abundantes, mensajes visualmente bonitos, persuasivo y siempre respetuoso. Eres el Asesor Experto de confianza de \${storeName}. ✨📦⚡\`;
}

export const JAN_RESPONSE_SCHEMA`;

content = content.replace(replaceTargetRegex, correctContent);

// Also fix the "usa accion" part that got mangled
content = content.replace(/¡No cierres el pedido hasta tener la REFERENCIA! Una vez tengas TODO, usa accion   - AUDIOS:/, 
  '¡No cierres el pedido hasta tener la REFERENCIA! Una vez tengas TODO, usa accion = "confirmar_pedido".\n   - Conversación normal -> accion = "respuesta"\n6. CAPACIDAD MULTIMODAL (OJOS Y OÍDOS):\n   - AUDIOS:');

fs.writeFileSync(file, content);
console.log("Fixed janAgent.ts");

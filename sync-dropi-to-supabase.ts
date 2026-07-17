/**
 * sync-dropi-to-supabase.ts
 *
 * Sincroniza SOLO los cambios detectados entre el catalog.json anterior y el nuevo
 * (generado a partir del Excel de Dropi) hacia la tabla "products" de Supabase.
 *
 * - Actualiza (merge, no reemplaza) precio/costo/envío/proveedor/dropiId en productos existentes.
 *   NO toca stock, imágenes, descripciones, ni nada más que se haya editado en vivo.
 * - Inserta los productos nuevos.
 * - ELIMINA los productos descontinuados (confirmados por José María).
 *
 * Uso:
 *   1. Asegúrate de tener SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env
 *      (las mismas que usa server.ts en producción).
 *   2. npx tsx sync-dropi-to-supabase.ts            -> corre en modo DRY RUN (no escribe nada, solo imprime)
 *   3. npx tsx sync-dropi-to-supabase.ts --apply     -> aplica los cambios de verdad
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const cwd = process.cwd();

let SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (SUPABASE_URL.endsWith("/rest/v1/")) {
  SUPABASE_URL = SUPABASE_URL.replace("/rest/v1/", "");
} else if (SUPABASE_URL.endsWith("/rest/v1")) {
  SUPABASE_URL = SUPABASE_URL.replace("/rest/v1", "");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en tu .env. Abortando.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes("--apply");

type DiffFile = {
  updates: { id: string; fields: Record<string, any> }[];
  new_products: any[];
  deleted_ids: string[];
};

async function main() {
  const diffPath = path.join(cwd, "sync_diff.json");
  const diff: DiffFile = JSON.parse(readFileSync(diffPath, "utf-8"));

  console.log(`\n=== SYNC DROPI -> SUPABASE (${APPLY ? "MODO REAL" : "DRY RUN, no se escribe nada"}) ===`);
  console.log(`Actualizaciones: ${diff.updates.length} | Nuevos: ${diff.new_products.length} | Eliminaciones: ${diff.deleted_ids.length}\n`);

  let okUpdates = 0, failUpdates = 0;
  for (const u of diff.updates) {
    const { data: existing, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();

    if (fetchErr) {
      console.error(`  ⚠️  Error leyendo ${u.id}:`, fetchErr.message);
      failUpdates++;
      continue;
    }
    if (!existing) {
      console.warn(`  ⚠️  ${u.id} no existe en Supabase (se esperaba que sí) — se salta.`);
      failUpdates++;
      continue;
    }

    const mergedData = { ...(existing.data || {}), ...u.fields };
    console.log(`  ${APPLY ? "✅" : "🔍"} ${u.id} ->`, u.fields);

    if (APPLY) {
      const { error: upErr } = await supabase
        .from("products")
        .update({ data: mergedData, updatedAt: new Date().toISOString() })
        .eq("id", u.id);
      if (upErr) {
        console.error(`     ❌ Falló update de ${u.id}:`, upErr.message);
        failUpdates++;
        continue;
      }
    }
    okUpdates++;
  }

  let okNew = 0, failNew = 0;
  for (const p of diff.new_products) {
    console.log(`  ${APPLY ? "✅" : "🔍"} NUEVO ${p.id} (${p.name})`);
    if (APPLY) {
      const { error: insErr } = await supabase
        .from("products")
        .insert({ id: p.id, data: p, updatedAt: new Date().toISOString() });
      if (insErr) {
        console.error(`     ❌ Falló insert de ${p.id}:`, insErr.message);
        failNew++;
        continue;
      }
    }
    okNew++;
  }

  let okDel = 0, failDel = 0;
  for (const id of diff.deleted_ids) {
    console.log(`  ${APPLY ? "🗑️ " : "🔍"} ELIMINAR ${id}`);
    if (APPLY) {
      const { error: delErr } = await supabase.from("products").delete().eq("id", id);
      if (delErr) {
        console.error(`     ❌ Falló delete de ${id}:`, delErr.message);
        failDel++;
        continue;
      }
    }
    okDel++;
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Actualizados: ${okUpdates} ok, ${failUpdates} fallidos`);
  console.log(`Nuevos: ${okNew} ok, ${failNew} fallidos`);
  console.log(`Eliminados: ${okDel} ok, ${failDel} fallidos`);
  if (!APPLY) {
    console.log(`\n👉 Esto fue un DRY RUN. Si todo se ve bien, corre de nuevo con --apply para aplicar de verdad.`);
  }
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});

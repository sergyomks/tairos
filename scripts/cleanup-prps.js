require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "public" } }
);

async function main() {
  // Borrar PRPs pending sin votos
  const { data: pendingPrps, error: fetchError } = await supabase
    .from("prps")
    .select("id, prp_votes(count)")
    .eq("status", "pending");

  if (fetchError) {
    console.error("Error buscando PRPs:", fetchError.message);
    process.exit(1);
  }

  const toDelete = (pendingPrps || [])
    .filter((p) => Number(p.prp_votes?.[0]?.count || 0) === 0)
    .map((p) => p.id);

  if (toDelete.length === 0) {
    console.log("No hay PRPs pending sin votos para borrar.");
    return;
  }

  const { error: deleteError } = await supabase.from("prps").delete().in("id", toDelete);

  if (deleteError) {
    console.error("Error borrando PRPs:", deleteError.message);
    process.exit(1);
  }

  console.log(`Borradas ${toDelete.length} PRPs pending sin votos.`);
}

main().catch(console.error);

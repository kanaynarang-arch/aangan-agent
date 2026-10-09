import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  await sql.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await sql.query("select name from schema_migrations")).map((r) => r.name as string));
  const dir = join(process.cwd(), "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const statements = readFileSync(join(dir, file), "utf8")
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const st of statements) await sql.query(st);
    await sql.query("insert into schema_migrations (name) values ($1)", [file]);
    console.log("applied", file);
  }
  console.log("migrations up to date");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

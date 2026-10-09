// Generate Supabase-compatible types from the actual migrated PostgreSQL catalog.
// Hosted deployments can replace this with `supabase gen types typescript --linked`.
import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "./database.ts";
const db = await createTestDatabase();
const cols = await db.query<{
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}>(
  `select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
);
function typeOf(t: string) {
  return [
    "integer",
    "bigint",
    "numeric",
    "smallint",
    "double precision",
  ].includes(t)
    ? "number"
    : t === "boolean"
      ? "boolean"
      : t === "jsonb"
        ? "Json"
        : "string";
}
const tables = [...new Set(cols.rows.map((c) => c.table_name))];
const tableTypes = tables
  .map((name) => {
    const fields = cols.rows.filter((c) => c.table_name === name);
    const body = (mode: string) =>
      fields
        .map(
          (c) =>
            `${c.column_name}${mode === "Update" || (mode === "Insert" && (c.column_default !== null || c.is_nullable === "YES" || (name === "cases" && c.column_name === "serial_number"))) ? "?" : ""}: ${typeOf(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""}`,
        )
        .join("; ");
    return `${name}: { Row: {${body("Row")}}; Insert: {${body("Insert")}}; Update: {${body("Update")}}; Relationships: [] }`;
  })
  .join("\n");
await writeFile(
  new URL("../src/lib/database.generated.ts", import.meta.url),
  `// Generated from the migrated PostgreSQL catalog by scripts/generate-types.ts. Do not edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\nexport type Database={public:{Tables:{\n${tableTypes}\n};Views:Record<string,never>;Enums:Record<string,never>;CompositeTypes:Record<string,never>;Functions:{\ncreate_chamber:{Args:{chamber_name:string;member_name:string};Returns:string};\ninvite_member:{Args:{org:string;recipient_email:string;member_role:string};Returns:string};\naccept_invitation:{Args:{invite_token:string;member_name:string};Returns:string};\nset_member_role:{Args:{org:string;member:string;new_role:string};Returns:undefined};\nget_case:{Args:{org:string;case_id:string};Returns:Database['public']['Tables']['cases']['Row'][]};\nsearch_cases:{Args:{org:string;query?:string;type_filter?:string;status_filter?:string;court_filter?:string;lawyer_filter?:string;date_from?:string;date_to?:string;hearing_from?:string;hearing_to?:string;page_number?:number;sort_order?:string};Returns:Database['public']['Tables']['cases']['Row'][]};\nchamber_report:{Args:{org:string;date_from?:string;date_to?:string};Returns:Json};\n}}}\n`,
);
await db.close();
console.log("Generated Supabase-compatible types from the applied migration.");

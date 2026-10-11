import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const pattern =
  /(?:AIza[0-9A-Za-z_-]{30,}|sb_(?:secret|publishable)_[0-9A-Za-z_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[0-9A-Za-z]{25,})/;
const failures = [];
for (const file of new Set(files)) {
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  if (pattern.test(bytes.toString("utf8"))) failures.push(file);
}
if (failures.length) {
  console.error(
    "Credential-like literals detected (values withheld):\n" +
      failures.join("\n"),
  );
  process.exit(1);
}
console.log(
  "No credential-like literals found in tracked/nonignored text files.",
);

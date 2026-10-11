import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const staticSrc = path.join(rootDir, ".next", "static");
const staticDest = path.join(rootDir, ".next", "standalone", ".next", "static");
const publicSrc = path.join(rootDir, "public");
const publicDest = path.join(rootDir, ".next", "standalone", "public");

if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log("[build] Copied .next/static to .next/standalone/.next/static");
}

if (fs.existsSync(publicSrc)) {
  fs.mkdirSync(publicDest, { recursive: true });
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log("[build] Copied public to .next/standalone/public");
}

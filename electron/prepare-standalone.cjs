const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

if (!fs.existsSync(standalone)) {
  throw new Error("Execute 'npm run build' antes de preparar o aplicativo desktop.");
}

copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
if (fs.existsSync(path.join(root, "public"))) {
  copy(path.join(root, "public"), path.join(standalone, "public"));
}

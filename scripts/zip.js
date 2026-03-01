const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist");
const zipName = `erp-serralheria-${Date.now()}.zip`;
const outPath = path.join(outDir, zipName);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Lista de pastas/arquivos a excluir do zip
const excludeList = [
  "node_modules/*",
  ".next/*",
  ".git/*",
  "dist/*",
  ".env",
  ".env.local",
  "*.zip",
];
const listPath = path.join(outDir, "exclude-list.txt");
fs.writeFileSync(listPath, excludeList.join("\n"), "utf8");

console.log("Arquivo de exclusão gerado em", listPath);
console.log("Para criar o zip (Git Bash / WSL):");
console.log('  cd "' + root + '" && zip -r "' + outPath + '" . -x "' + excludeList.join('" -x "') + '"');

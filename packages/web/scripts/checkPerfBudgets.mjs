import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST_ASSETS_DIR = path.resolve("dist/assets");
const STRICT_MODE = process.argv.includes("--strict");

const BUDGETS = {
  jsGzipBytes: 150 * 1024,
  cssGzipBytes: 30 * 1024,
  imageBytes: 1100 * 1024,
};

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} kB`;
  }
  return `${bytes} B`;
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(resolved);
    }
    return [resolved];
  });
}

function gzipSize(filePath) {
  return zlib.gzipSync(fs.readFileSync(filePath)).byteLength;
}

function selectLargest(files) {
  if (files.length === 0) {
    return null;
  }
  return files
    .map((filePath) => ({
      file: path.relative(process.cwd(), filePath),
      rawBytes: fs.statSync(filePath).size,
      gzipBytes: gzipSize(filePath),
    }))
    .sort((a, b) => b.rawBytes - a.rawBytes)[0];
}

if (!fs.existsSync(DIST_ASSETS_DIR)) {
  console.error(`[perf-budgets] Missing build output at ${DIST_ASSETS_DIR}. Run \`npm run build -w @datacenter-tycoon/web\` first.`);
  process.exit(1);
}

const files = listFiles(DIST_ASSETS_DIR);
const jsAsset = selectLargest(files.filter((file) => file.endsWith(".js")));
const cssAsset = selectLargest(files.filter((file) => file.endsWith(".css")));
const imageAsset = selectLargest(files.filter((file) => /\.(png|jpe?g|webp|gif|svg)$/i.test(file)));

const checks = [
  jsAsset && {
    label: "Largest JS asset (gzip)",
    file: jsAsset.file,
    actualBytes: jsAsset.gzipBytes,
    budgetBytes: BUDGETS.jsGzipBytes,
  },
  cssAsset && {
    label: "Largest CSS asset (gzip)",
    file: cssAsset.file,
    actualBytes: cssAsset.gzipBytes,
    budgetBytes: BUDGETS.cssGzipBytes,
  },
  imageAsset && {
    label: "Largest image asset (raw)",
    file: imageAsset.file,
    actualBytes: imageAsset.rawBytes,
    budgetBytes: BUDGETS.imageBytes,
  },
].filter(Boolean);

if (checks.length === 0) {
  console.error("[perf-budgets] No JS/CSS/image assets found in dist/assets.");
  process.exit(1);
}

const rows = checks.map((check) => ({
  budget: check.label,
  file: check.file,
  actual: formatBytes(check.actualBytes),
  target: formatBytes(check.budgetBytes),
  status: check.actualBytes <= check.budgetBytes ? "PASS" : STRICT_MODE ? "FAIL" : "WARN",
}));

console.table(rows);

const failures = checks.filter((check) => check.actualBytes > check.budgetBytes);
if (failures.length > 0) {
  const prefix = STRICT_MODE ? "[perf-budgets] Failing budget(s):" : "[perf-budgets] Warning budget(s) exceeded:";
  console.warn(prefix);
  for (const failure of failures) {
    console.warn(`- ${failure.label}: ${formatBytes(failure.actualBytes)} > ${formatBytes(failure.budgetBytes)} (${failure.file})`);
  }
}

if (STRICT_MODE && failures.length > 0) {
  process.exit(1);
}

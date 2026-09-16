/**
 * Minimal secret scanner — fails (exit 1) if a likely credential is committed
 * in tracked source files. Deliberately crude: tuned for this repo's known
 * secret shapes (Supabase service keys, Gemini keys, private keys, SMTP creds)
 * to keep false positives near zero. Run in CI and before commits.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "JWT"],
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, "private key block"],
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/sk-(live|test)-[0-9a-zA-Z]{16,}/, "Stripe secret key"],
  [/re_[0-9a-zA-Z]{20,}/, "Resend API key"],
  [/\b(NODE|NEXT|SUPABASE)_[A-Z_]*SERVICE_ROLE[A-Z_]*\s*[:=]\s*["'][^"']{20,}["']/, "service-role key assignment"],
  [/\bSMTP_PASS\s*[:=]\s*["'](?!your|change|example|placeholder|<)[^"']{6,}["']/i, "SMTP password"],
  [/postgres(ql)?:\/\/[^\s"']*:[^\s"'@]{8,}@/, "database URL with password"],
];

// Files that never hold real secrets (examples, generated bundles, lockfiles).
// .gbrain/ is external tooling whose own test suites contain deliberate
// placeholder credentials for its redaction engine — not LifeBook secrets.
const ALLOW_PATHS = /(^|\/)(\.env\.example|package-lock\.json|node_modules|dist|uploads|\.maven|\.gbrain)/;

function trackedFiles() {
  try {
    return execSync("git ls-files -z --cached --others --exclude-standard", {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    // Not a git repo (or git missing) — scan the working tree instead
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (ALLOW_PATHS.test(p)) continue;
        if (entry.isDirectory()) walk(p);
        else out.push(path.relative(process.cwd(), p));
      }
    };
    walk(process.cwd());
    return out;
  }
}

const files = trackedFiles().filter((f) => fs.existsSync(f) && fs.statSync(f).isFile() && !ALLOW_PATHS.test(f));

const hits = [];
for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue; // binary or unreadable
  }
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) {
        hits.push(`${file}:${i + 1} — ${label}`);
      }
    }
  });
}

if (hits.length) {
  console.error("POTENTIAL SECRETS FOUND (rotate + remove before committing):");
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log(`Secret scan clean (${files.length} files).`);

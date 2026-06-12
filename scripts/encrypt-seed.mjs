import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [sourcePath, outputPath, passphrasePath] = process.argv.slice(2);

if (!sourcePath || !outputPath || !passphrasePath) {
  throw new Error(
    "Usage: node scripts/encrypt-seed.mjs <source.json> <output.json> <passphrase.txt>",
  );
}

const plaintext = await fs.readFile(sourcePath);
JSON.parse(plaintext.toString("utf8"));

const passphrase = crypto.randomBytes(32).toString("base64url");
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const iterations = 310_000;
const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

const bundle = {
  version: 1,
  algorithm: "AES-GCM",
  keyDerivation: "PBKDF2-SHA-256",
  iterations,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  ciphertext: ciphertext.toString("base64"),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
await fs.writeFile(passphrasePath, `${passphrase}\n`, { encoding: "utf8", mode: 0o600 });

console.log(`Encrypted ${plaintext.length} bytes to ${outputPath}`);
console.log(`Passphrase written separately to ${passphrasePath}`);

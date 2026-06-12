import { Contact } from "@/lib/types";

export type EncryptedContactBundle = {
  version: 1;
  algorithm: "AES-GCM";
  keyDerivation: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function fromBase64(value: string): ArrayBuffer {
  const binary = window.atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function decryptContactBundle(
  bundle: EncryptedContactBundle,
  passphrase: string,
): Promise<Contact[]> {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(bundle.salt),
      iterations: bundle.iterations,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(bundle.iv) },
    key,
    fromBase64(bundle.ciphertext),
  );
  const contacts = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(contacts)) throw new Error("Invalid contact bundle.");
  return contacts as Contact[];
}

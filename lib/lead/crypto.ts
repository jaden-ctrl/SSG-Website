import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { CipherPayload } from "./types";

export function decodeStoreKey(keyB64: string | undefined): Buffer | null {
  if (!keyB64) return null;
  try {
    const key = Buffer.from(keyB64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptJson(value: unknown, keyB64: string): CipherPayload {
  const key = decodeStoreKey(keyB64);
  if (!key) throw new Error("store_key_invalid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptJson<T>(payload: CipherPayload, keyB64: string): T {
  const key = decodeStoreKey(keyB64);
  if (!key) throw new Error("store_key_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const json = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(json) as T;
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

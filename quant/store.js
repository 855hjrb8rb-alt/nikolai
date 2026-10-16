// Persistencia en data/quant.json. Las claves API de los exchanges se guardan
// cifradas (AES-256-GCM) con una clave derivada de QUANT_SECRET (o, si no hay,
// de QUANT_PASSWORD). Nunca se devuelven al navegador.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.QUANT_DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "quant.json");

const empty = () => ({ salt: randomBytes(16).toString("hex"), bots: [], keys: {}, miners: [], seeded: false });

let db;
export function data() {
  if (db) return db;
  try { db = { ...empty(), ...JSON.parse(readFileSync(FILE, "utf8")) }; } catch { db = empty(); }
  return db;
}

let timer = 0;
export function save(now = false) {
  clearTimeout(timer);
  const write = () => {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(db, null, 1), { mode: 0o600 });
    renameSync(tmp, FILE);
  };
  if (now) write(); else timer = setTimeout(write, 500);
}

let cryptoKey;
function key() {
  if (cryptoKey) return cryptoKey;
  const secret = process.env.QUANT_SECRET || process.env.QUANT_PASSWORD;
  if (!secret) throw new Error("Falta QUANT_SECRET o QUANT_PASSWORD");
  cryptoKey = scryptSync(secret, Buffer.from(data().salt, "hex"), 32);
  return cryptoKey;
}

export function encrypt(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(str) {
  try {
    const [iv, tag, enc] = str.split(".").map((s) => Buffer.from(s, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8"));
  } catch {
    return null; // cambió la contraseña/secreto: hay que volver a guardar la clave
  }
}

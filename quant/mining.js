// Minería: calculadora de rentabilidad con datos EN VIVO de la red Bitcoin
// y monitor de tus mineros en el pool (2Miners, API pública por cartera).
// Ojo: una web/servidor no "mina" por sí sola de forma rentable; la minería real
// la hace tu hardware (ASIC/GPU) apuntando al pool. Aquí lo controlas y lo mides.

const cache = new Map();
async function getJson(url, ttl = 600e3) {
  const hit = cache.get(url);
  if (hit && hit.t > Date.now() - ttl) return hit.v;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "nikolai-quant" } });
  if (!res.ok) throw new Error(`${new URL(url).host} respondió ${res.status}`);
  const v = await res.json();
  cache.set(url, { t: Date.now(), v });
  return v;
}

export const BLOCK_SUBSIDY = 3.125; // BTC por bloque desde el halving de 2024

export async function btcNetwork() {
  const [hr, prices, fees] = await Promise.all([
    getJson("https://mempool.space/api/v1/mining/hashrate/3d"),
    getJson("https://mempool.space/api/v1/prices", 120e3),
    getJson("https://mempool.space/api/v1/mining/reward-stats/144").catch(() => null),
  ]);
  const avgFees = fees ? Number(fees.totalFee) / 1e8 / 144 : 0.02;
  return {
    difficulty: hr.currentDifficulty,
    networkHashrate: hr.currentHashrate, // H/s
    priceUSD: prices.USD,
    priceMXN: prices.MXN ?? null,
    blockReward: BLOCK_SUBSIDY + avgFees,
  };
}

// Estimación diaria para un minero SHA-256 (BTC).
export function btcProfit(net, { hashrateTH = 0, powerW = 0, costKwh = 0, poolFee = 2 }) {
  const hs = hashrateTH * 1e12;
  const btcDay = (hs * 86400 * net.blockReward) / (net.difficulty * 2 ** 32) * (1 - poolFee / 100);
  const revenue = btcDay * net.priceUSD;
  const power = (powerW / 1000) * 24 * costKwh;
  return { btcDay, revenueUSD: revenue, powerUSD: power, profitUSD: revenue - power, profitMonthUSD: (revenue - power) * 30, breakEvenKwh: powerW ? revenue / ((powerW / 1000) * 24) : null };
}

// Monitor de 2Miners: https://{coin}.2miners.com/api/accounts/{wallet}
export async function poolStatus({ pool, coin, wallet }) {
  if (pool !== "2miners") throw new Error("Monitor disponible para 2Miners");
  if (!/^[a-z0-9-]{2,15}$/.test(coin) || !/^[A-Za-z0-9:._-]{10,120}$/.test(wallet)) throw new Error("Moneda o cartera no válidas");
  const d = await getJson(`https://${coin}.2miners.com/api/accounts/${encodeURIComponent(wallet)}`, 60e3);
  return {
    hashrate: d.currentHashrate ?? d.hashrate ?? 0,
    hashrate24h: d.hashrate ?? 0,
    workersOnline: d.workersOnline ?? 0,
    workersOffline: d.workersOffline ?? 0,
    balance: (d.stats?.balance ?? 0) / 1e9,
    paid: (d.stats?.paid ?? 0) / 1e9,
    lastShare: d.stats?.lastShare ? d.stats.lastShare * 1000 : null,
  };
}

// Pools y software reales para empezar a minar.
export const MINING_GUIDE = [
  { name: "NiceHash", url: "https://www.nicehash.com", what: "Vende tu hashrate (GPU/ASIC) y cobra en BTC. QuickMiner para Windows en 1 clic." },
  { name: "Braiins Pool", url: "https://braiins.com/pool", what: "Pool de Bitcoin para ASIC (Antminer, Whatsminer). Braiins OS optimiza consumo." },
  { name: "ViaBTC", url: "https://www.viabtc.com", what: "Pool BTC/LTC/BCH con pagos PPS+." },
  { name: "F2Pool", url: "https://www.f2pool.com", what: "Pool global multi-moneda para ASIC y GPU." },
  { name: "2Miners", url: "https://2miners.com", what: "Pools GPU (ETC, RVN, KAS, ERG…). Se monitoriza aquí con tu cartera." },
  { name: "unMineable", url: "https://unmineable.com", what: "Mina con CPU/GPU (XMRig, lolMiner) y cobra en la cripto que elijas." },
  { name: "Kryptex", url: "https://www.kryptex.org", what: "Programa sencillo para PC con GPU; pagos en BTC o tarjeta." },
];

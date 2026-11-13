import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, defineChain, formatUnits, http, type Abi, type Address } from "viem";

const RPC_URL = process.env.RPC_URL ?? "https://rpc.test.mezo.org";
const REFRESH_MS = Number(process.env.REFRESH_MS ?? 30_000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
const DIR = join(
  process.cwd(),
  "node_modules", "@mezo-org", "musd-contracts", "deployments", "matsnet",
);

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const client = createPublicClient({ chain: mezoTestnet, transport: http(RPC_URL) });

type Contract = { address: Address; abi: Abi };
function load(name: string): Contract {
  const j = JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"));
  return { address: j.address as Address, abi: j.abi as Abi };
}
const troveManager = load("TroveManager");
const sortedTroves = load("SortedTroves");
const priceFeed = load("PriceFeed");

async function read<T>(c: Contract, functionName: string, args: unknown[] = []): Promise<T> {
  return (await client.readContract({ address: c.address, abi: c.abi, functionName, args } as any)) as T;
}

const MCR = 1_100_000_000_000_000_000n; // 110%, 18 decimals
const f = (v: bigint) => formatUnits(v, 18);

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

type TroveRow = { address: Address; icr: bigint; debt: bigint; coll: bigint; debtAhead: bigint; rank: number };
type Snapshot = {
  takenAt: number;
  price: bigint;
  tcr: bigint;
  size: bigint;
  totalDebt: bigint;
  totalColl: bigint;
  troves: TroveRow[];
  byAddress: Map<string, TroveRow>;
};

let snapshot: Snapshot | null = null;
let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  const t0 = Date.now();
  try {
    const price = await read<bigint>(priceFeed, "fetchPrice");
    const [tcr, size, totalDebt, totalColl, count] = await Promise.all([
      read<bigint>(troveManager, "getTCR", [price]),
      read<bigint>(sortedTroves, "getSize"),
      read<bigint>(troveManager, "getEntireSystemDebt"),
      read<bigint>(troveManager, "getEntireSystemColl"),
      read<bigint>(troveManager, "getTroveOwnersCount"),
    ]);

    const indexes = Array.from({ length: Number(count) }, (_, i) => i);
    const rows = await mapLimit(indexes, CONCURRENCY, async (i) => {
      try {
        const address = await read<Address>(troveManager, "getTroveFromTroveOwnersArray", [BigInt(i)]);
        const [icr, debt, coll] = await Promise.all([
          read<bigint>(troveManager, "getCurrentICR", [address, price]),
          read<bigint>(troveManager, "getTroveDebt", [address]),
          read<bigint>(troveManager, "getTroveColl", [address]),
        ]);
        return { address, icr, debt, coll };
      } catch {
        return null;
      }
    });

    const good = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    // Lowest ratio first = front of the redemption queue.
    good.sort((a, b) => (a.icr < b.icr ? -1 : a.icr > b.icr ? 1 : 0));

    let ahead = 0n;
    const troves: TroveRow[] = good.map((r, rank) => {
      const row = { ...r, debtAhead: ahead, rank };
      ahead += r.debt;
      return row;
    });

    snapshot = {
      takenAt: Date.now(),
      price, tcr, size, totalDebt, totalColl,
      troves,
      byAddress: new Map(troves.map((t) => [t.address.toLowerCase(), t])),
    };
    console.log(
      `snapshot ready: ${troves.length} troves (list size ${size}, failed ${rows.length - good.length}) in ${Date.now() - t0} ms`,
    );
  } catch (e) {
    console.error("snapshot refresh failed:", (e as Error).message);
  } finally {
    refreshing = false;
  }
}

export function startSnapshot() {
  void refresh();
  setInterval(() => void refresh(), REFRESH_MS);
}

function need(): Snapshot {
  if (!snapshot) throw new Error("snapshot not ready yet, retry in a few seconds");
  return snapshot;
}
const age = (s: Snapshot) => Math.round((Date.now() - s.takenAt) / 1000);

export async function getSystem() {
  const s = need();
  return {
    btcPriceUsd: f(s.price),
    tcr: f(s.tcr),
    activeTroves: s.size.toString(),
    totalDebtMusd: f(s.totalDebt),
    totalCollBtc: f(s.totalColl),
    lowestTroves: s.troves.slice(0, 5).map((t) => ({
      address: t.address, icr: f(t.icr), debtMusd: f(t.debt),
    })),
    snapshotAgeSeconds: age(s),
  };
}

export async function getTroveRisk(address: string) {
  const s = need();
  const t = s.byAddress.get(address.toLowerCase());
  if (!t) return { address, exists: false, note: "no active trove for this address", snapshotAgeSeconds: age(s) };
  const above = t.icr > MCR;
  return {
    address,
    exists: true,
    btcPriceUsd: f(s.price),
    icr: f(t.icr),
    collateralBtc: f(t.coll),
    debtMusd: f(t.debt),
    liquidationPriceUsd: f((s.price * MCR) / t.icr),
    bufferToLiquidationPct: f(above ? (t.icr - MCR) * 100n : 0n), // ratio points above 110%
    priceDropToLiquidationPct: f(above ? ((t.icr - MCR) * 100n * 10n ** 18n) / t.icr : 0n),
    redemptionBuffer: {
      queuePosition: t.rank + 1,
      of: s.troves.length,
      debtAheadMusd: f(t.debtAhead),
    },
    snapshotAgeSeconds: age(s),
  };
}

export async function getLiquidationCandidates() {
  const s = need();
  const liquidatable = s.troves
    .filter((t) => t.icr < MCR)
    .map((t) => ({ address: t.address, icr: f(t.icr), debtMusd: f(t.debt), collateralBtc: f(t.coll) }));
  const safe = s.troves.find((t) => t.icr >= MCR);
  return {
    btcPriceUsd: f(s.price),
    liquidatable,
    closestSafe: safe ? { address: safe.address, icr: f(safe.icr) } : null,
    snapshotAgeSeconds: age(s),
  };
}
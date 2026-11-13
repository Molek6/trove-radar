import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { getSystem, getTroveRisk, getLiquidationCandidates, startSnapshot } from "./radar";

const PORT = Number(process.env.PORT ?? 4021);
const NETWORK = "eip155:31611"; // Mezo testnet
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://facilitator.vativ.io";
const PRICE = process.env.PRICE ?? "$0.001";
const LIQ_PRICE = process.env.LIQ_PRICE ?? "$0.005";
const PAY_TO = process.env.PAY_TO;

if (!PAY_TO || !/^0x[0-9a-fA-F]{40}$/.test(PAY_TO)) {
  console.error("PAY_TO must be set to a valid 0x address (your Account B).");
  process.exit(1);
}

const app = express();

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactEvmScheme(),
);
const paywall = createPaywall().withNetwork(evmPaywall).build();

const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

async function riskHandler(req: express.Request, res: express.Response) {
  const address = String(req.query.address ?? "");
  if (!isAddress(address)) {
    res.status(400).json({ error: "address query param must be a 0x address" });
    return;
  }
  try {
    res.json(await getTroveRisk(address));
  } catch (e) {
    res.status(502).json({ error: "chain read failed", detail: (e as Error).message });
  }
}

async function liquidationsHandler(_req: express.Request, res: express.Response) {
  try {
    res.json(await getLiquidationCandidates());
  } catch (e) {
    res.status(502).json({ error: "chain read failed", detail: (e as Error).message });
  }
}

// Free routes
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "trove-radar", network: NETWORK });
});

app.get("/system", async (_req, res) => {
  try {
    res.json(await getSystem());
  } catch (e) {
    res.status(502).json({ error: "chain read failed", detail: (e as Error).message });
  }
});

// Development-only free copies of the paid routes: set DEV_ROUTES=1 to enable.
if (process.env.DEV_ROUTES === "1") {
  app.get("/dev/risk", riskHandler);
  app.get("/dev/liquidations", liquidationsHandler);
}

// Paid routes (x402, MUSD)
app.use(
  paymentMiddleware(
    {
      "GET /risk": {
        accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO },
        description: `Trove Radar risk report, pay ${PRICE} in MUSD`,
      },
      "GET /liquidations": {
        accepts: { scheme: "exact", price: LIQ_PRICE, network: NETWORK, payTo: PAY_TO },
        description: `Trove Radar liquidation candidates, pay ${LIQ_PRICE} in MUSD`,
      },
    },
    resourceServer,
    { appName: "Trove Radar", testnet: true },
    paywall,
  ),
);

app.get("/risk", riskHandler);
app.get("/liquidations", liquidationsHandler);
startSnapshot();

app.listen(PORT, () => {
  console.log(`Trove Radar listening on http://localhost:${PORT}/`);
});
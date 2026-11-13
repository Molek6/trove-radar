# Trove Radar

**x402-paid MUSD trove risk API for AI agents and bots.** Built for the Mezo Buildathon (Wave 2).

Borrowers on Mezo can lose a position to liquidation or redemption, and nothing lets an AI agent or bot check that risk programmatically and pay per query. Trove Radar reads MUSD trove data live from the chain and sells it over HTTP, one request at a time, settled in MUSD through x402.

## What it does

- **Risk report per trove:** collateral ratio, liquidation price, how far BTC can fall before liquidation, and the trove's position in the redemption queue.
- **Redemption queue position:** MUSD redemptions hit the lowest-ratio trove first. Trove Radar shows how much debt sits ahead of a given trove.
- **Liquidation scan:** lists troves under the 110% line and the closest safe one.
- **Pay per call:** paid routes use x402 on Mezo, so an agent only needs MUSD and a signing key. No account or API key.

## Endpoints (Mezo testnet, chain 31611)

| Route | Cost | Returns |
|---|---|---|
| `GET /health` | free | service status |
| `GET /system` | free | BTC price, system ratio (TCR), trove count, five lowest-ratio troves |
| `GET /risk?address=0x...` | $0.001 in MUSD | full risk report for one trove |
| `GET /liquidations` | $0.005 in MUSD | liquidatable troves and the closest safe one |

Unpaid requests to paid routes return `402 Payment Required`.

## How MUSD and Mezo are used

- **Data:** reads Mezo's MUSD contracts (`TroveManager`, `SortedTroves`, `PriceFeed`) using the official `@mezo-org/musd-contracts` deployment files for testnet.
- **Payments:** paid routes are settled in MUSD with x402 through the Mezo facilitator.
- **Metric:** the redemption queue position uses the on-chain ordering of troves by collateral ratio.

## Run it

Requires Node 20+ and pnpm 9+.

```
pnpm install
```

PowerShell:
```
$env:PAY_TO="0xYOUR_MERCHANT_ADDRESS"
pnpm exec tsx server.ts
```

Mac/Linux:
```
PAY_TO=0xYOUR_MERCHANT_ADDRESS pnpm exec tsx server.ts
```

`PAY_TO` is the address that receives payments. The server refuses to start without it.

Optional settings: `PORT` (default 4021), `PRICE`, `LIQ_PRICE`, `REFRESH_MS` (snapshot refresh, default 30000), `CONCURRENCY` (parallel reads, default 8), `RPC_URL`, and `DEV_ROUTES=1` to enable free `/dev/risk` and `/dev/liquidations` copies for local testing.

## Design notes

- The server reads every trove into a snapshot every 30 seconds, so paid calls are fast and each response includes `snapshotAgeSeconds`.
- Queue position is computed by sorting troves by current collateral ratio. The contract orders by stored nominal ratio, so treat the position as a close approximation. Interest accrual and redemption edge cases are not modeled.
- This is testnet software and is not financial advice.

## Roadmap

1. Demo AI agent that pays for and reads a risk report.
2. Telegram alerts when a watched trove nears liquidation or reaches the front of the redemption queue.
3. MCP server so agents can discover and call the tools directly.
4. Mainnet deployment once the facilitator supports it.

## Team

MAVERICK, solo builder. x.com/@olamhi006 # trove-radar

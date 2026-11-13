export const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trove Radar · MUSD trove risk for agents</title>
<style>
  :root { --bg:#f7f7f5; --card:#ffffff; --text:#1a1a1a; --muted:#6b6b66; --line:#e3e3de; --accent:#f7931a; --ok:#1a7f4b; --warn:#b26a00; --bad:#b3261e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#111214; --card:#1a1c1f; --text:#ececea; --muted:#9a9a94; --line:#2b2e33; --accent:#f7931a; --ok:#4ec38a; --warn:#e0a03a; --bad:#ff6b61; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:960px; margin:0 auto; padding:24px 16px 64px; }
  header { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; margin-bottom:8px; }
  h1 { margin:0; font-size:28px; letter-spacing:-0.02em; }
  h1 span { color:var(--accent); }
  .badge { font-size:12px; border:1px solid var(--line); border-radius:999px; padding:4px 10px; color:var(--muted); background:var(--card); }
  p.lead { color:var(--muted); margin:4px 0 24px; max-width:680px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:28px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .card .k { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .card .v { font-size:24px; font-weight:650; margin-top:2px; }
  h2 { font-size:18px; margin:28px 0 4px; }
  .sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
  .scroll { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--line); font-size:14px; white-space:nowrap; }
  th { color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
  tr:last-child td { border-bottom:0; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .icr { font-weight:650; }
  .ok { color:var(--ok); } .warn { color:var(--warn); } .bad { color:var(--bad); }
  a.btn, button { display:inline-block; background:var(--accent); color:#1a1a1a; border:0; border-radius:8px; padding:7px 12px; font-size:13px; font-weight:600; text-decoration:none; cursor:pointer; }
  a.btn:hover, button:hover { filter:brightness(1.07); }
  form { display:flex; flex-wrap:wrap; gap:8px; }
  input { flex:1 1 320px; min-width:0; padding:10px 12px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--text); font:inherit; }
  .err { color:var(--bad); font-size:14px; min-height:20px; margin-top:6px; }
  table.ep td:first-child { font-family:ui-monospace,Menlo,Consolas,monospace; }
  footer { margin-top:36px; color:var(--muted); font-size:13px; }
  footer a { color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Trove <span>Radar</span></h1>
    <span class="badge">Mezo testnet · chain 31611</span>
  </header>
  <p class="lead">Live risk data for MUSD troves, sold per request to AI agents and bots. Paid calls settle in MUSD through x402, so a buyer needs no account or API key.</p>

  <div class="stats">
    <div class="card"><div class="k">BTC price</div><div class="v" id="s-price">…</div></div>
    <div class="card"><div class="k">System ratio</div><div class="v" id="s-tcr">…</div></div>
    <div class="card"><div class="k">Active troves</div><div class="v" id="s-troves">…</div></div>
    <div class="card"><div class="k">Total debt (MUSD)</div><div class="v" id="s-debt">…</div></div>
  </div>

  <h2>Front of the redemption queue</h2>
  <p class="sub">Redemptions hit the lowest-ratio trove first, so these five are the most exposed. Liquidation happens below 110%.</p>
  <div class="scroll">
    <table>
      <thead><tr><th>#</th><th>Trove</th><th>Ratio</th><th>Debt (MUSD)</th><th></th></tr></thead>
      <tbody id="rows"><tr><td colspan="5">Loading live data…</td></tr></tbody>
    </table>
  </div>

  <h2>Check any trove</h2>
  <p class="sub">Paste a trove address. You will be asked to pay 0.001 MUSD to see the full risk report.</p>
  <form id="lookup">
    <input id="addr" placeholder="0x… trove address" autocomplete="off" spellcheck="false">
    <button type="submit">Get risk report</button>
  </form>
  <div class="err" id="err"></div>

  <h2>For agents</h2>
  <p class="sub">A request without payment returns HTTP 402 with payment instructions. An x402 client pays and retries automatically.</p>
  <div class="scroll">
    <table class="ep">
      <thead><tr><th>Route</th><th>Cost</th><th>Returns</th></tr></thead>
      <tbody>
        <tr><td>GET /system</td><td>free</td><td>BTC price, system ratio, lowest-ratio troves</td></tr>
        <tr><td>GET /risk?address=0x…</td><td>$0.001 in MUSD</td><td>ratio, liquidation price, price drop to liquidation, queue position</td></tr>
        <tr><td>GET /liquidations</td><td>$0.005 in MUSD</td><td>troves under 110% and the closest safe one</td></tr>
      </tbody>
    </table>
  </div>

  <footer>
    <span id="age"></span>
    <a href="https://github.com/Molek6/trove-radar">Source on GitHub</a> · Testnet software, not financial advice.
  </footer>
</div>

<script>
function $(id) { return document.getElementById(id); }
function fmtUsd(n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
function cell(text, cls) { var td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; return td; }

function load() {
  fetch('/system').then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { $('rows').innerHTML = '<tr><td colspan="5">Data is warming up. Retry in a few seconds.</td></tr>'; return; }
    $('s-price').textContent = fmtUsd(d.btcPriceUsd);
    $('s-tcr').textContent = (parseFloat(d.tcr) * 100).toFixed(1) + '%';
    $('s-troves').textContent = d.activeTroves;
    $('s-debt').textContent = Number(d.totalDebtMusd).toLocaleString('en-US', { maximumFractionDigits: 0 });
    $('age').textContent = 'Data refreshed ' + d.snapshotAgeSeconds + 's ago · ';
    var tbody = $('rows');
    tbody.innerHTML = '';
    d.lowestTroves.forEach(function (t, i) {
      var tr = document.createElement('tr');
      var icr = parseFloat(t.icr);
      var cls = icr < 1.15 ? 'icr bad' : icr < 1.3 ? 'icr warn' : 'icr ok';
      tr.appendChild(cell(String(i + 1)));
      tr.appendChild(cell(short(t.address), 'mono'));
      tr.appendChild(cell((icr * 100).toFixed(1) + '%', cls));
      tr.appendChild(cell(Number(t.debtMusd).toLocaleString('en-US', { maximumFractionDigits: 0 })));
      var td = document.createElement('td');
      var a = document.createElement('a');
      a.className = 'btn';
      a.href = '/risk?address=' + t.address;
      a.textContent = 'Risk report · $0.001';
      td.appendChild(a);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }).catch(function () {
    $('rows').innerHTML = '<tr><td colspan="5">Could not load live data.</td></tr>';
  });
}

$('lookup').addEventListener('submit', function (e) {
  e.preventDefault();
  var v = $('addr').value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) { $('err').textContent = 'Enter a valid address: 0x followed by 40 characters.'; return; }
  $('err').textContent = '';
  window.location.href = '/risk?address=' + v;
});

load();
setInterval(load, 30000);
</script>
</body>
</html>`;
const fs   = require('fs');
const path = require('path');
const https = require('https');

const outputFile = path.join(__dirname, '..', 'data', 'stock.json');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; signify-tools/1.0)',
        'Accept': 'application/json'
      },
      timeout: 10000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  const { status, body } = await get(
    'https://query1.finance.yahoo.com/v8/finance/chart/LIGHT.AS?interval=1d&range=1d'
  );
  if (status !== 200) throw new Error(`HTTP ${status}`);

  const data = JSON.parse(body);
  const meta = data.chart.result[0].meta;

  const price      = meta.regularMarketPrice;
  const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change     = parseFloat((price - prevClose).toFixed(2));
  const changePct  = parseFloat(((change / prevClose) * 100).toFixed(2));

  const out = {
    symbol:      'LIGHT.AS',
    exchange:    'AMS',
    currency:    meta.currency || 'EUR',
    price,
    change,
    changePct,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(outputFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Saved: €${price} (${changePct > 0 ? '+' : ''}${changePct}%) → ${outputFile}`);
}

main().catch(err => {
  console.error('fetch-stock failed:', err.message);
  process.exit(1);
});

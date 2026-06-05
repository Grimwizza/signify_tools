/**
 * Fetches Google Trends data using a real Playwright browser session.
 * Uses network interception to capture the internal multiline API responses
 * that Google Trends loads when you visit the explore page.
 *
 * Usage: node scripts/fetch-trends.js
 *        npm run fetch-trends
 *
 * If Google rate-limits (429), wait an hour and retry.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outputDir = path.join(__dirname, '..', 'data');
const outputFile = path.join(outputDir, 'trends.json');

const CONFIG = {
  groups: [
    { name: 'defaults',     keywords: ['Philips Hue', 'Philips LED', 'Philips Smart Lighting', 'Philips Wifi', 'WiZ'] },
    { name: 'connected1',   keywords: ['Philips Hue', 'Govee', 'Lutron', 'Nanoleaf', 'Sengled'] },
    { name: 'connected2',   keywords: ['Philips Hue', 'Wyze', 'LIFX', 'TP-Link Kasa'] },
    { name: 'traditional1', keywords: ['Philips Hue', 'GE Lighting', 'Sylvania', 'Cree Lighting', 'Great Value'] },
    { name: 'traditional2', keywords: ['Philips Hue', 'Feit Electric', 'EcoSmart', 'Commercial Electric'] },
    { name: 'regional',     keywords: ['Philips Hue', 'NOMA', 'Globe Electric', 'Tecnolite', 'Steren'] }
  ],
  allBrands: [
    'Philips Hue', 'Philips LED', 'Philips Smart Lighting', 'Philips Wifi', 'WiZ',
    'Govee', 'Lutron', 'Nanoleaf', 'Sengled', 'Wyze', 'LIFX', 'TP-Link Kasa',
    'GE Lighting', 'Sylvania', 'Cree Lighting', 'Great Value', 'Feit Electric', 'EcoSmart', 'Commercial Electric',
    'NOMA', 'Globe Electric', 'Tecnolite', 'Steren'
  ],
  categories: ['Smart Lighting', 'LED Bulbs', 'Smart Home'],
  // gprop values: '' = web, 'froogle' = shopping, 'news' = news, 'youtube' = youtube
  channels: [
    { key: 'web',      gprop: '' },
    { key: 'shopping', gprop: 'froogle' },
    { key: 'news',     gprop: 'news' },
    { key: 'youtube',  gprop: 'youtube' }
  ],
  timePeriod: 'today 12-m',
  geo: 'US',
  // Delay between fetches to avoid rate limiting (ms)
  fetchDelay: 8000
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Synthetic fallback generators ---
// Derived from manual Google Trends observations (Jun 2026):
// Web: Govee > Philips Hue > Lutron > Wyze > Philips LED
// YouTube: Govee >> Nanoleaf > Philips Hue (creator content-heavy)
// Shopping: GE Lighting, Great Value, Feit Electric strong; Philips Hue moderate
// News: Philips Hue leads PR; Govee second; low overall volume

function generateFallbackBrands(channel = 'web') {
  const data = [];
  const start = Date.now() - (365 * 24 * 60 * 60 * 1000);

  const brandCurves = {
    'Philips Hue':          (i, ch) => base(ch === 'news' ? 14 : ch === 'shopping' ? 38 : 44, 14, i, 30),
    'Philips LED':          (i, ch) => base(ch === 'shopping' ? 32 : 22, 8, i, 40),
    'Philips Smart Lighting':(i, _ch) => base(4, 2, i, 50),
    'Philips Wifi':         (i, _ch) => base(5, 2, i, 45),
    'WiZ':                  (i, ch) => base(ch === 'youtube' ? 22 : 16, 5, i, 35),
    'Govee':                (i, ch) => base(ch === 'youtube' ? 72 : ch === 'news' ? 8 : ch === 'shopping' ? 42 : 58, 12, i, 25),
    'Lutron':               (i, ch) => base(ch === 'shopping' ? 18 : 32, 7, i, 35),
    'Nanoleaf':             (i, ch) => base(ch === 'youtube' ? 38 : 18, 6, i, 20),
    'Sengled':              (i, ch) => base(ch === 'shopping' ? 18 : 12, 4, i, 30),
    'Wyze':                 (i, _ch) => base(32, 7, i, 40),
    'LIFX':                 (i, ch) => base(ch === 'youtube' ? 16 : 10, 3, i, 30),
    'TP-Link Kasa':         (i, _ch) => base(22, 5, i, 35),
    'GE Lighting':          (i, ch) => base(ch === 'shopping' ? 44 : 26, 5, i, 40),
    'Sylvania':             (i, ch) => base(ch === 'shopping' ? 34 : 20, 5, i, 30),
    'Cree Lighting':        (i, ch) => base(ch === 'shopping' ? 28 : 15, 4, i, 25),
    'Great Value':          (i, ch) => base(ch === 'shopping' ? 52 : 18, 5, i, 20),
    'Feit Electric':        (i, ch) => base(ch === 'shopping' ? 40 : 26, 6, i, 35),
    'EcoSmart':             (i, ch) => base(ch === 'shopping' ? 24 : 14, 3, i, 45),
    'Commercial Electric':  (i, _ch) => base(6, 2, i, 50),
    'NOMA':                 (i, ch) => base(ch === 'shopping' ? 22 : 15, 4, i, 35),
    'Globe Electric':       (i, ch) => base(ch === 'shopping' ? 26 : 18, 5, i, 30),
    'Tecnolite':            (i, ch) => base(ch === 'shopping' ? 18 : 12, 3, i, 40),
    'Steren':               (i, ch) => base(ch === 'youtube' ? 24 : 20, 5, i, 25)
  };

  function base(center, amp, i, period) {
    return Math.min(100, Math.max(0, Math.round(center + Math.sin(i / period) * amp + (Math.random() - 0.5) * amp * 0.6)));
  }

  // News channel has much lower overall volume
  const newsMult = channel === 'news' ? 0.18 : 1;

  for (let i = 0; i <= 365; i += 7) {
    const time = new Date(start + i * 24 * 60 * 60 * 1000);
    const values = CONFIG.allBrands.map(brand => {
      const fn = brandCurves[brand];
      const v = fn ? fn(i, channel) : 10;
      return Math.round(v * newsMult);
    });
    data.push({
      date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: Math.floor(time.getTime() / 1000),
      values
    });
  }
  return data;
}

function generateFallbackCategories(channel = 'web') {
  const data = [];
  const start = Date.now() - (365 * 24 * 60 * 60 * 1000);
  const newsMult = channel === 'news' ? 0.18 : channel === 'shopping' ? 0.7 : channel === 'youtube' ? 0.5 : 1;

  for (let i = 0; i <= 365; i += 7) {
    const time = new Date(start + i * 24 * 60 * 60 * 1000);
    const smartLighting = Math.round((45 + Math.sin(i / 45) * 12 + (Math.random() - 0.5) * 6) * newsMult);
    const ledBulbs = Math.round((75 + Math.cos(i / 50) * 10 + (Math.random() - 0.5) * 5) * newsMult);
    const smartHome = Math.round((85 + Math.sin(i / 35) * 8 + (Math.random() - 0.5) * 7) * newsMult);
    data.push({
      date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: Math.floor(time.getTime() / 1000),
      values: [
        Math.min(100, Math.max(0, smartLighting)),
        Math.min(100, Math.max(0, ledBulbs)),
        Math.min(100, Math.max(0, smartHome))
      ]
    });
  }
  return data;
}

// --- Playwright-based fetcher ---

async function fetchGroupWithBrowser(page, keywords, gprop) {
  const q = keywords.map(k => encodeURIComponent(k)).join('%2C');
  const prop = gprop ? `&gprop=${gprop}` : '';
  const url = `https://trends.google.com/trends/explore?date=${encodeURIComponent(CONFIG.timePeriod)}&geo=${CONFIG.geo}&q=${q}${prop}&hl=en-US`;

  const captured = [];

  const handler = async (resp) => {
    if (resp.url().includes('/trends/api/widgetdata/multiline')) {
      try {
        const text = await resp.text();
        // Google prepends ")]}',\n" to all JSON responses to prevent hijacking
        const json = JSON.parse(text.replace(/^\)\]\}[',]\n?/, '').trim());
        if (json.default && json.default.timelineData) {
          captured.push(json.default.timelineData);
        }
      } catch (_) {}
    }
  };

  page.on('response', handler);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 });
  // Wait for async chart data loads
  await delay(4000);

  page.off('response', handler);

  if (captured.length === 0) {
    const title = await page.title();
    if (title.includes('429') || title.includes('Too Many')) {
      throw new Error('RATE_LIMITED: Google returned 429. Wait an hour and retry.');
    }
    throw new Error(`No timeline data captured for: ${keywords.join(', ')} (page: "${title}")`);
  }

  // Use the first captured multiline dataset
  return captured[0].map(item => ({
    date: item.formattedTime,
    timestamp: parseInt(item.time),
    values: item.value
  }));
}

function normalizeGroups(groupTimelines) {
  // Compute scale factors using Philips Hue (index 0 in each group) as the anchor
  const sumHue = (gl) => gl.reduce((s, item) => s + (item.values[0] || 0), 0);

  const sums = groupTimelines.map(sumHue);
  const scales = sums.map(s => (sums[0] > 0 && s > 0) ? sums[0] / s : 1);

  console.log('  Normalization scales:', scales.map((s, i) => `G${i + 1}=${s.toFixed(3)}`).join(', '));

  return groupTimelines[0].map((item, i) => {
    const g1 = item.values; // [Hue, LED, SmartL, Wifi, WiZ]
    const g2 = (groupTimelines[1][i] || { values: [0, 0, 0, 0, 0] }).values;
    const g3 = (groupTimelines[2][i] || { values: [0, 0, 0, 0] }).values;
    const g4 = (groupTimelines[3][i] || { values: [0, 0, 0, 0, 0] }).values;
    const g5 = (groupTimelines[4][i] || { values: [0, 0, 0, 0] }).values;
    const g6 = (groupTimelines[5][i] || { values: [0, 0, 0, 0, 0] }).values; // regional: [Hue, NOMA, Globe Electric, Tecnolite, Steren]

    const scale = (vals, groupIdx) => vals.slice(1).map(v => Math.min(100, Math.round(v * scales[groupIdx])));

    return {
      date: item.date,
      timestamp: item.timestamp,
      values: [
        ...g1,
        ...scale(g2, 1), ...scale(g3, 2),
        ...scale(g4, 3), ...scale(g5, 4),
        ...scale(g6, 5)
      ]
    };
  });
}

// Fetches state-level interest data for a single keyword on a given channel.
// Google Trends loads /trends/api/widgetdata/comparedgeo when viewing the
// "Interest by subregion" section of the explore page.
async function fetchGeoData(page, keyword, gprop) {
  const prop = gprop ? `&gprop=${gprop}` : '';
  const url = `https://trends.google.com/trends/explore?date=${encodeURIComponent(CONFIG.timePeriod)}&geo=${CONFIG.geo}&q=${encodeURIComponent(keyword)}${prop}&hl=en-US`;

  const captured = [];
  const handler = async (resp) => {
    if (resp.url().includes('/trends/api/widgetdata/comparedgeo')) {
      try {
        const text = await resp.text();
        const json = JSON.parse(text.replace(/^\)\]\}[',]\n?/, '').trim());
        if (json.default && json.default.geoMapData) {
          captured.push(json.default.geoMapData);
        }
      } catch (_) {}
    }
  };

  page.on('response', handler);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 });
  await delay(4000);
  page.off('response', handler);

  if (captured.length === 0) {
    const title = await page.title();
    if (title.includes('429') || title.includes('Too Many')) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error(`No geo data captured for: ${keyword}`);
  }

  // Convert to { stateCode: value } map
  const result = {};
  captured[0].forEach(item => {
    if (item.geoCode && item.value && item.value[0] !== undefined) {
      // geoCode is e.g. "US-CA" → strip prefix
      const code = item.geoCode.replace(/^US-/, '');
      result[code] = item.value[0];
    }
  });
  return result;
}

async function main() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let existingData = {};
  if (fs.existsSync(outputFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      console.log('Loaded existing trends.json for fallback recovery.');
    } catch (_) {}
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    brands: { keywords: CONFIG.allBrands, timeline: [] },
    categories: { keywords: CONFIG.categories, timeline: [] }
  };
  for (const chan of CONFIG.channels) {
    output[chan.key] = { brands: { timeline: [] }, categories: { timeline: [] } };
  }

  const forceSynthetic = process.argv.includes('--synthetic');

  console.log(forceSynthetic ? 'Starting in synthetic mode...' : 'Launching browser...');
  const browser = forceSynthetic ? null : await chromium.launch({ headless: false }); // visible so you can solve CAPTCHAs if needed
  const context = forceSynthetic ? null : await browser.newContext({ locale: 'en-US', timezoneId: 'America/New_York' });
  const page = forceSynthetic ? null : await context.newPage();

  for (let cIdx = 0; cIdx < CONFIG.channels.length; cIdx++) {
    const chan = CONFIG.channels[cIdx];
    console.log(`\n=== Channel: ${chan.key.toUpperCase()} (gprop: "${chan.gprop}") ===`);

    let brandTimeline = [];
    let categoryTimeline = [];
    let success = !forceSynthetic;

    if (success) {
      for (let gIdx = 0; gIdx < CONFIG.groups.length; gIdx++) {
        const grp = CONFIG.groups[gIdx];
        try {
          console.log(`  Fetching group "${grp.name}": ${grp.keywords.join(', ')}`);
          const tl = await fetchGroupWithBrowser(page, grp.keywords, chan.gprop);
          brandTimeline.push(tl);
          console.log(`  ✓ Got ${tl.length} data points`);
        } catch (err) {
          console.error(`  ... Failed: ${err.message}`);
          success = false;
          break;
        }
        if (gIdx < CONFIG.groups.length - 1) {
          console.log(`  Waiting ${CONFIG.fetchDelay / 1000}s before next group...`);
          await delay(CONFIG.fetchDelay);
        }
      }
    }

    if (success && brandTimeline.length === CONFIG.groups.length) {
      console.log(`  Normalizing brand groups...`);
      const normalizedBrands = normalizeGroups(brandTimeline);

      console.log(`  Fetching categories...`);
      await delay(CONFIG.fetchDelay);
      try {
        categoryTimeline = await fetchGroupWithBrowser(page, CONFIG.categories, chan.gprop);
        console.log(`  ✓ Categories: ${categoryTimeline.length} points`);
        output[chan.key].brands.timeline = normalizedBrands;
        output[chan.key].categories.timeline = categoryTimeline;
        if (chan.key === 'web') {
          output.brands.timeline = normalizedBrands;
          output.categories.timeline = categoryTimeline;
        }
        console.log(`  ✓ Channel ${chan.key} complete.`);
      } catch (err) {
        console.error(`  ✗ Category fetch failed: ${err.message}`);
        success = false;
      }
    }

    if (!success) {
      console.log(`  Falling back for channel ${chan.key}...`);
      const recovered = existingData[chan.key];
      if (recovered && recovered.brands && recovered.brands.timeline.length > 0) {
        console.log(`  Using existing trends.json data for ${chan.key}.`);
        output[chan.key].brands.timeline = recovered.brands.timeline;
        output[chan.key].categories.timeline = recovered.categories.timeline;
      } else {
        console.log(`  Generating synthetic fallback for ${chan.key}.`);
        output[chan.key].brands.timeline = generateFallbackBrands(chan.key);
        output[chan.key].categories.timeline = generateFallbackCategories(chan.key);
      }
      if (chan.key === 'web') {
        output.brands.timeline = output[chan.key].brands.timeline;
        output.categories.timeline = output[chan.key].categories.timeline;
      }
    }

    if (cIdx < CONFIG.channels.length - 1) {
      console.log(`  Waiting ${CONFIG.fetchDelay / 1000}s before next channel...`);
      await delay(CONFIG.fetchDelay);
    }
  }

  // --- Geo data: state-level interest for each brand × channel ---
  console.log('\n=== Fetching Geographic Data ===');
  // Only fetch web channel geo for a representative brand set to limit API calls;
  // other channels use proportional scaling from the synthetic fallback.
  const GEO_BRANDS_TO_FETCH = [
    'Philips Hue', 'WiZ', 'Govee', 'Lutron', 'Nanoleaf',
    'GE Lighting', 'Great Value', 'Feit Electric'
  ];

  output.geo = existingData.geo || {};

  if (!forceSynthetic) {
    for (const chan of CONFIG.channels) {
      if (!output.geo[chan.key]) output.geo[chan.key] = { brands: {}, categories: {} };
      for (const brand of GEO_BRANDS_TO_FETCH) {
        await delay(CONFIG.fetchDelay);
        try {
          console.log(`  Geo: ${brand} (${chan.key})`);
          const stateScores = await fetchGeoData(page, brand, chan.gprop);
          output.geo[chan.key].brands[brand] = stateScores;
          console.log(`  ✓ Got ${Object.keys(stateScores).length} states`);
        } catch (err) {
          console.error(`  ✗ Geo failed for ${brand}/${chan.key}: ${err.message}`);
          // Keep existing data if available
          if (existingData.geo && existingData.geo[chan.key] && existingData.geo[chan.key].brands[brand]) {
            output.geo[chan.key].brands[brand] = existingData.geo[chan.key].brands[brand];
          }
        }
      }
      // Carry over remaining brands from existing data / synthetic
      for (const brand of CONFIG.allBrands) {
        if (!output.geo[chan.key].brands[brand]) {
          if (existingData.geo && existingData.geo[chan.key] && existingData.geo[chan.key].brands[brand]) {
            output.geo[chan.key].brands[brand] = existingData.geo[chan.key].brands[brand];
          }
        }
      }
      // Categories geo
      for (const cat of CONFIG.categories) {
        await delay(CONFIG.fetchDelay);
        try {
          console.log(`  Geo: ${cat} (${chan.key})`);
          output.geo[chan.key].categories[cat] = await fetchGeoData(page, cat, chan.gprop);
        } catch (err) {
          console.error(`  ✗ Geo category failed for ${cat}/${chan.key}: ${err.message}`);
          if (existingData.geo && existingData.geo[chan.key] && existingData.geo[chan.key].categories[cat]) {
            output.geo[chan.key].categories[cat] = existingData.geo[chan.key].categories[cat];
          }
        }
      }
    }
  } else {
    console.log('  Bypassing live geo fetching in synthetic mode.');
  }

  backfillGeoData(output);

  if (browser) await browser.close();

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nSaved to: ${outputFile}`);
}

function backfillGeoData(output) {
  if (!output.geo) output.geo = {};
  if (!output.geo.canada) output.geo.canada = {};
  if (!output.geo.nola) output.geo.nola = {};

  const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY'
  ];
  const CANADA_PROVINCES = ['BC','AB','ON','QC','MB','SK','NS','NB','PE','NL','YT','NT','NU'];
  const NOLA_COUNTRIES = ['MX','GT','BZ','SV','HN','NI','CR','PA','CU','HT','DO','JM','PR'];

  const getSyntheticGeoData = (region, brand) => {
    const isCanadaBrand = ['NOMA', 'Globe Electric'].includes(brand);
    const isNolaBrand = ['Tecnolite', 'Steren'].includes(brand);

    let min = 10, max = 80;
    let keys = [];

    if (region === 'canada') {
      keys = CANADA_PROVINCES;
      if (isCanadaBrand) { min = 55; max = 98; }
      else if (isNolaBrand) { min = 0; max = 15; }
      else { min = 35; max = 85; }
    } else if (region === 'nola') {
      keys = NOLA_COUNTRIES;
      if (isNolaBrand) { min = 55; max = 98; }
      else if (isCanadaBrand) { min = 0; max = 15; }
      else { min = 25; max = 75; }
    } else {
      keys = US_STATES;
      if (isCanadaBrand || isNolaBrand) { min = 0; max = 15; }
      else { min = 35; max = 95; }
    }

    const scores = {};
    keys.forEach((k, idx) => {
      const factor = (keys.length - idx) / keys.length;
      scores[k] = Math.round(min + factor * (max - min) + (Math.random() - 0.5) * 10);
      scores[k] = Math.min(100, Math.max(0, scores[k]));
    });
    return scores;
  };

  for (const chan of CONFIG.channels) {
    const chanKey = chan.key;
    if (!output.geo[chanKey]) output.geo[chanKey] = { brands: {}, categories: {} };
    if (!output.geo.canada[chanKey]) output.geo.canada[chanKey] = { brands: {}, categories: {} };
    if (!output.geo.nola[chanKey]) output.geo.nola[chanKey] = { brands: {}, categories: {} };

    // Brands Geo Backfill
    for (const brand of CONFIG.allBrands) {
      if (!output.geo[chanKey].brands[brand]) {
        output.geo[chanKey].brands[brand] = getSyntheticGeoData('us', brand);
      }
      if (!output.geo.canada[chanKey].brands[brand]) {
        output.geo.canada[chanKey].brands[brand] = getSyntheticGeoData('canada', brand);
      }
      if (!output.geo.nola[chanKey].brands[brand]) {
        output.geo.nola[chanKey].brands[brand] = getSyntheticGeoData('nola', brand);
      }
    }

    // Categories Geo Backfill
    for (const cat of CONFIG.categories) {
      if (!output.geo[chanKey].categories[cat]) {
        output.geo[chanKey].categories[cat] = getSyntheticGeoData('us', cat);
      }
      if (!output.geo.canada[chanKey].categories[cat]) {
        output.geo.canada[chanKey].categories[cat] = getSyntheticGeoData('canada', cat);
      }
      if (!output.geo.nola[chanKey].categories[cat]) {
        output.geo.nola[chanKey].categories[cat] = getSyntheticGeoData('nola', cat);
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

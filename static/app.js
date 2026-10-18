'use strict';
const $ = id => document.getElementById(id);
const aliases = { 'Yonge-St.Clair': 'Yonge-St. Clair', 'Danforth East York': 'Danforth-East York', 'Taylor-Massey': 'Taylor Massey', 'East End-Danforth': 'East End Danforth', "O'Connor-Parkview": 'O`Connor Parkview', 'Cabbagetown-South St.James Town': 'Cabbagetown-South St. James Town', 'North St.James Town': 'North St. James Town' };
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[’‘`]/g, "'").replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\bst\.\s*/g, 'st. ').replace(/\s+/g, ' ').trim();
const colors = { burden: ['#fff4da', '#f2cd80', '#dda346', '#a96c25', '#70401f'], rent: ['#fce8e6', '#f5bbb0', '#e78878', '#bf5348', '#792b31'], income: ['#e8f1f4', '#b3d4dc', '#75afbf', '#367e96', '#19495f'], subsidized: ['#edf1e7', '#c9d6b5', '#9caf7d', '#617c4f', '#344b36'] };
const config = { burden: { key: 'tenant_cost_burden_pct', name: 'Tenant housing cost burden', desc: 'Share of tenant households spending at least 30% of income on shelter (2021 Census).', steps: [0, 25, 35, 45, 55], labels: ['Below 25%', '25% to <35%', '35% to <45%', '45% to <55%', '55% and above'], format: 'pct' }, rent: { key: 'median_monthly_rent', name: 'Median monthly shelter cost', desc: '2021 Census monthly shelter costs for rented dwellings. Not today’s asking rent.', steps: [0, 1000, 1300, 1600, 2000], labels: ['Below $1,000', '$1,000 to <$1,300', '$1,300 to <$1,600', '$1,600 to <$2,000', '$2,000 and above'], format: 'money' }, income: { key: 'median_household_income', name: 'Median annual household income', desc: '2020 income reported in 2021 Census; not necessarily tenant-only income.', steps: [0, 60000, 80000, 100000, 130000], labels: ['Below $60k', '$60k to <$80k', '$80k to <$100k', '$100k to <$130k', '$130k and above'], format: 'money' }, subsidized: { key: 'subsidized_tenant_pct', name: 'Subsidized tenant households', desc: 'Share of tenant households in subsidized housing; a higher share is not inherently bad.', steps: [0, 5, 10, 20, 35], labels: ['Below 5%', '5% to <10%', '10% to <20%', '20% to <35%', '35% and above'], format: 'pct' } };
const money = n => Number.isFinite(Number(n)) && n != null ? '$' + Math.round(Number(n)).toLocaleString('en-CA') : 'No data';
const pct = n => Number.isFinite(Number(n)) && n != null ? Number(n).toFixed(1) + '%' : 'No data';
const format = (n, type) => type === 'money' ? money(n) : pct(n);
let rows = [], selected = null, choices = [], mode = 'resident', map = null, features = [], marketRows = [], marketSource = ''; 
const getRecord = name => rows.find(r => norm(r.neighbourhood_name) === norm(aliases[name] || name));
const currentPreferences = () => ({ monthly_rental_budget_cad: Number($('budget').value) || 0, monthly_takehome_income_cad: Number($('income').value) || 0, housing_type: $('bedrooms').value, commute_destination: $('destination').value, priority: $('priority').value });
function ratio() { const p = currentPreferences(); $('ratio').textContent = p.monthly_takehome_income_cad > 0 ? (100 * p.monthly_rental_budget_cad / p.monthly_takehome_income_cad).toFixed(1) + '%' : '—'; forecast(); }
function mapStyle(ind) { if (!map || !map.getLayer('fill')) return; const c = config[ind]; const expr = ['step', ['coalesce', ['to-number', ['get', c.key]], -1], '#d1d5db']; c.steps.forEach((s, i) => expr.push(s, colors[ind][i])); map.setPaintProperty('fill', 'fill-color', expr); $('legend-title').textContent = c.name; $('legend-desc').textContent = c.desc; $('legend-items').replaceChildren();[...c.labels, 'No data'].forEach((label, i) => { const line = document.createElement('div'); line.className = 'legend-row'; const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.backgroundColor = i === 5 ? '#d1d5db' : colors[ind][i]; const txt = document.createElement('span'); txt.textContent = label; line.append(sw, txt); $('legend-items').append(line); }); }
function selectFeature(props) { selected = props; const r = getRecord(props.AREA_NAME) || {}; $('selected-name').textContent = props.AREA_NAME; $('selected-metrics').replaceChildren();[['Tenant cost burden', r.tenant_cost_burden_pct, 'pct'], ['Median monthly shelter cost', r.median_monthly_rent, 'money'], ['Median household income', r.median_household_income, 'money'], ['Subsidized tenant households', r.subsidized_tenant_pct, 'pct']].forEach(([label, num, type]) => { const d = document.createElement('div'); d.className = 'metric'; const left = document.createElement('span'); left.textContent = label; const right = document.createElement('strong'); right.textContent = format(num, type); d.append(left, right); $('selected-metrics').append(d) }); $('add-compare').disabled = false; }
function renderComparison() { const a = getRecord($('compare-a').value), b = getRecord($('compare-b').value); if (!a || !b) { $('compare-table').textContent = 'Choose two neighbourhoods to compare.'; return } if (a === b) { $('compare-table').textContent = 'Choose two different neighbourhoods.'; return } const fields = [['Tenant cost burden', 'tenant_cost_burden_pct', 'pct'], ['Median shelter cost, monthly', 'median_monthly_rent', 'money'], ['Median household income, annual', 'median_household_income', 'money'], ['Subsidized tenant households', 'subsidized_tenant_pct', 'pct']]; const grid = document.createElement('div'); grid.className = 'compare-grid'; const add = (val, bold = false) => { const d = document.createElement('div'); d.textContent = val; if (bold) d.style.fontWeight = '750'; grid.append(d) }; add('2021 Census indicator', true); add(a.neighbourhood_name, true); add(b.neighbourhood_name, true); fields.forEach(([name, key, type]) => { add(name); add(format(a[key], type)); add(format(b[key], type)) }); $('compare-table').replaceChildren(grid); }
function assignComparison(name) { const r = getRecord(name); if (!r) return; const a = $('compare-a'), b = $('compare-b'); if (a.value === name || b.value === name) return; if (!a.value) a.value = r.neighbourhood_name; else if (!b.value) b.value = r.neighbourhood_name; else b.value = r.neighbourhood_name; renderComparison(); $('compare-table').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function populateOptions() { for (const id of ['compare-a', 'compare-b']) { const sel = $(id); for (const r of rows.slice().sort((a, b) => a.neighbourhood_name.localeCompare(b.neighbourhood_name))) { const o = document.createElement('option'); o.value = r.neighbourhood_name; o.textContent = r.neighbourhood_name; sel.append(o) } } }
function recommendations() { if (!rows.length) { $('ai-result').textContent = 'Housing dataset missing. Copy housing_indicators.json to data/ and restart.'; return [] } const priority = $('priority').value; const key = config[priority === 'cost' ? 'rent' : priority === 'burden' ? 'burden' : priority === 'income' ? 'income' : 'subsidized'].key; const candidates = rows.filter(r => r[key] != null).slice().sort((a, b) => Number(a[key]) - Number(b[key])).slice(0, 8); const message = 'Exploratory community-context shortlist (2021 Census, NOT 2026 available rentals):\n' + candidates.map((r, i) => `${i + 1}. ${r.neighbourhood_name} — ${format(r[key], priority === 'cost' || priority === 'income' ? 'money' : 'pct')}`).join('\n') + '\n\nThese are historical context comparisons only. Bedroom preference, commute and present-day rent could not be verified from this dataset. You may select two below for comparison.'; $('ai-result').textContent = message; return candidates; }
function forecast() { const rent = Number($('budget').value), income = Number($('income').value), g = Number($('rent-growth').value) / 100, h = Number($('income-growth').value) / 100, yrs = Number($('forecast-years').value); if (!Number.isFinite(rent) || !Number.isFinite(income) || income <= 0) { $('forecast-output').textContent = 'Enter a positive monthly income to calculate an illustrative scenario.'; return; } const fr = rent * (1 + g) ** yrs, fi = income * (1 + h) ** yrs; $('forecast-output').textContent = `In ${yrs} year(s), if your starting housing cost is ${money(rent)} and it grows by ${(100 * g).toFixed(1)}% annually, its hypothetical value is ${money(fr)}. If income grows ${(100 * h).toFixed(1)}% annually, hypothetical income is ${money(fi)} per month. Ratio: ${(100 * fr / fi).toFixed(1)}%. This is a scenario, NOT a market prediction.`; }
function policy() { const amount = Number($('policy-amount').value), n = Number($('policy-households').value), type = $('policy-type').value; const msg = type === 'assistance' ? `Illustration: ${money(amount)} monthly assistance × ${n} hypothetical eligible households × 12 = ${money(amount * n * 12)} annually. This does not estimate programme take-up, funding eligibility or market-price effects.` : `Illustration: ${Math.round(amount)} hypothetical affordable units allocated across a proposed project or region for ${n} illustrative eligible households. Units ÷ households = ${n ? ((amount / n) * 100).toFixed(1) : '—'}%. This does not forecast actual construction, allocation or eligibility.`; $('policy-output').textContent = msg; $('policy-main-summary').textContent = msg; return msg; }


// Match CMHC indicators only when year, category, metric and bedroom type agree.
const marketMetric = (year, metric, bedroom = 'all_bedrooms') => marketRows.find(r => Number(r.reference_year) === year && r.metric === metric && r.bedroom_type === bedroom && r.housing_category === 'purpose_built_apartment');
function marketNumber(n, unit) { return unit === 'percent' ? pct(n) : money(n); }
function renderMarket() {
    const cards = $('market-cards'); cards.replaceChildren();
    const specs = [
        ['2025 vacancy rate', 'vacancy_rate', 'all_bedrooms', 'percent', 'Purpose-built apartments'],
        ['2025 two-bedroom average rent', 'average_monthly_rent', '2_bedroom', 'CAD_per_month', 'All occupied units sampled'],
        ['2025 turnover rate', 'turnover_rate', 'all_bedrooms', 'percent', 'Purpose-built apartments']
    ];
    for (const [label, metric, bedroom, unit, note] of specs) {
        const r = marketMetric(2025, metric, bedroom);
        const card = document.createElement('article'); card.className = 'market-card';
        const eyebrow = document.createElement('div'); eyebrow.className = 'market-card-label'; eyebrow.textContent = label;
        const val = document.createElement('strong'); val.textContent = r ? marketNumber(r.metric_value, unit) : 'Not available';
        const subtitle = document.createElement('div'); subtitle.className = 'market-card-note'; subtitle.textContent = note;
        card.append(eyebrow, val, subtitle); cards.append(card);
    }
    $('market-source-tag').textContent = marketRows.length ? 'CMHC · Oct 2025' : 'Data unavailable';
    renderTrend();
}
function renderTrend() {
    const chart = $('trend-chart'); chart.replaceChildren();
    const option = $('trend-metric').value;
    const specs = {rent: ['average_monthly_rent', '2_bedroom', 'CAD_per_month', 'Average monthly two-bedroom rent'], vacancy: ['vacancy_rate', 'all_bedrooms', 'percent', 'Vacancy rate'], turnover: ['turnover_rate', 'all_bedrooms', 'percent', 'Turnover rate']};
    const [metric, bedroom, unit, label] = specs[option];
    const old = marketMetric(2024, metric, bedroom), recent = marketMetric(2025, metric, bedroom);
    if (!old || !recent) { chart.textContent = 'Comparable 2024–2025 observations unavailable.'; $('trend-caption').textContent = ''; return; }
    const a = Number(old.metric_value), b = Number(recent.metric_value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) { chart.textContent = 'Invalid market values.'; return; }
    // SVG nodes created with DOM APIs (safe, with no HTML injection).
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 740 280'); svg.setAttribute('role','img'); svg.setAttribute('aria-label', `${label}: ${marketNumber(a, unit)} in 2024, ${marketNumber(b, unit)} in 2025`);
    const add = (tag, attrs, content) => { const el = document.createElementNS(NS,tag); for (const [key,val] of Object.entries(attrs)) el.setAttribute(key,String(val)); if (content != null) el.textContent = content; svg.append(el); return el; };
    const low = Math.min(a,b), high = Math.max(a,b), padding = Math.max((high-low)*0.65,high*0.07,unit === 'percent' ? 0.25 : 25);
    const min = Math.max(0,low-padding), max = high+padding;
    const y = v => 210 - (v-min)/(max-min)*145;
    for (let i=0;i<4;i++) { const gy=65+i*48; add('line',{x1:85,y1:gy,x2:660,y2:gy,stroke:'#ebe2d5','stroke-dasharray':'4 7'}); }
    add('line',{x1:190,y1:y(a),x2:555,y2:y(b),stroke:'#a97737','stroke-width':4,'stroke-linecap':'round'});
    [[190,a,'2024'],[555,b,'2025']].forEach(([x,value,year]) => {add('circle',{cx:x,cy:y(value),r:8,fill:'#a97737',stroke:'#fff','stroke-width':3}); add('text',{x,y:y(value)-22,'text-anchor':'middle',fill:'#45362a','font-size':21,'font-weight':700},marketNumber(value,unit)); add('text',{x,y:245,'text-anchor':'middle',fill:'#897762','font-size':16,'font-weight':650},year);});
    chart.append(svg);
    const diff = b-a; $('trend-caption').textContent = `${label}: ${marketNumber(a, unit)} (2024) → ${marketNumber(b, unit)} (2025). ${unit === 'percent' ? `Change: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} percentage points.` : `Change: ${diff >= 0 ? '+' : '−'}$${Math.abs(Math.round(diff)).toLocaleString('en-CA')} per month.`} Toronto CMA, purpose-built rental market; not an estimate for any specific neighbourhood.`;
}

// Render Gemini's limited Markdown safely as DOM text (never inject untrusted HTML).
function addInlineMarkdown(parent, value) {
    const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
    let last = 0;
    for (const match of value.matchAll(pattern)) {
        const index = match.index;
        if (index > last) parent.append(document.createTextNode(value.slice(last, index)));
        const token = match[0];
        const el = document.createElement(token.startsWith('**') ? 'strong' : 'em');
        el.textContent = token.slice(token.startsWith('**') ? 2 : 1, token.startsWith('**') ? -2 : -1);
        parent.append(el);
        last = index + token.length;
    }
    if (last < value.length) parent.append(document.createTextNode(value.slice(last)));
}
function renderGeminiMarkdown(markdown) {
    const target = $('ai-result');
    target.replaceChildren();
    let list = null, paragraph = [];
    const flushParagraph = () => {
        if (!paragraph.length) return;
        const el = document.createElement('p');
        addInlineMarkdown(el, paragraph.join(' '));
        target.append(el);
        paragraph = [];
    };
    for (const sourceLine of String(markdown || '').split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (!line) { flushParagraph(); list = null; continue; }
        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
            flushParagraph(); list = null;
            const el = document.createElement(heading[0].startsWith('####') ? 'h4' : 'h3');
            addInlineMarkdown(el, heading[1]); target.append(el); continue;
        }
        const bullet = line.match(/^[-*]\s+(.+)$/);
        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (bullet || numbered) {
            flushParagraph();
            const tag = bullet ? 'ul' : 'ol';
            if (!list || list.tagName.toLowerCase() !== tag) {
                list = document.createElement(tag); target.append(list);
            }
            const li = document.createElement('li');
            addInlineMarkdown(li, (bullet || numbered)[1]); list.append(li); continue;
        }
        list = null; paragraph.push(line);
    }
    flushParagraph();
}
function scrollToInsights() {
    $('ai-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setGeminiLoading(loading, activeButton) {
    for (const id of ['gemini-recommend', 'gemini-compare', 'gemini-policy']) {
        const button = $(id);
        if (!button) continue;
        if (!button.dataset.normalLabel) button.dataset.normalLabel = button.textContent;
        button.disabled = loading;
        button.textContent = loading && button === activeButton ? 'Generating insights…' : button.dataset.normalLabel;
    }
}
async function askGemini(task) {
    const a = getRecord($('compare-a').value), b = getRecord($('compare-b').value);
    const context = {
        source_year: 2021,
        cmhc_market_scope: 'Toronto CMA, October 2024 and October 2025; purpose-built rentals, not local 2026 asking rents',
        cmhc_market_metrics: marketRows.map(r => ({ year: Number(r.reference_year), metric: r.metric, bedroom_type: r.bedroom_type, housing_category: r.housing_category, value: Number(r.metric_value), unit: r.unit })),
        source: 'City of Toronto 2021 Census Neighbourhood Profiles',
        preferences: currentPreferences(),
        selected_neighbourhood: selected?.AREA_NAME || null,
        selected_record: selected ? getRecord(selected.AREA_NAME) : null,
        comparison: [a, b].filter(Boolean),
        scenario: {
            rent_growth_assumption_pct: Number($('rent-growth').value),
            income_growth_assumption_pct: Number($('income-growth').value),
            years: Number($('forecast-years').value)
        },
        policy_arithmetic: task === 'policy' ? policy() : null,
        notes: 'Historic neighbourhood medians, no listings, no verified commute. Values are aggregated and not individual household predictions.'
    };
    const button = task === 'policy' ? $('gemini-policy') : task === 'compare' ? $('gemini-compare') : $('gemini-recommend');
    $('ai-result').classList.remove('ai-error');
    setGeminiLoading(true, button);
    $('ai-result').textContent = task === 'policy' ? 'Gemini is analyzing your policy scenario…' : 'Gemini is preparing a grounded explanation…';
    scrollToInsights();
    try {
        const resp = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, context })
        });
        const data = await resp.json();
        if (resp.ok && data.text) renderGeminiMarkdown(data.text);
        else {
            $('ai-result').textContent = data.error || 'Gemini did not return a response.';
            $('ai-result').classList.add('ai-error');
        }
    } catch (e) {
        $('ai-result').textContent = 'Gemini connection failed. Ensure Flask is running and your API key is configured.';
        $('ai-result').classList.add('ai-error');
    } finally {
        setGeminiLoading(false, button);
        scrollToInsights();
    }
}
function setMode(v) { mode = v; $('policy-trend').hidden = v !== 'policy'; $('resident-forecast').hidden = v !== 'resident'; $('resident-ai-actions').hidden = v !== 'resident'; $('policy-ai-actions').hidden = v !== 'policy'; $('ai-heading').textContent = v === 'policy' ? 'Policy insights' : 'Housing insights'; $('resident-controls').hidden = v !== 'resident'; $('policy-controls').hidden = v !== 'policy'; $('tab-resident').classList.toggle('active', v === 'resident'); $('tab-policy').classList.toggle('active', v === 'policy'); }
async function init() {
    for (const id of ['budget', 'income', 'rent-growth', 'income-growth', 'forecast-years']) $(id).addEventListener('input', ratio); for (const id of ['compare-a', 'compare-b']) $(id).addEventListener('change', renderComparison); $('tab-resident').onclick = () => setMode('resident'); $('tab-policy').onclick = () => setMode('policy'); $('indicator').onchange = () => mapStyle($('indicator').value); $('add-compare').onclick = () => selected && assignComparison(selected.AREA_NAME); $('clear-compare').onclick = () => { $('compare-a').value = ''; $('compare-b').value = ''; renderComparison(); }; $('recommend').onclick = recommendations; $('gemini-recommend').onclick = () => askGemini('recommend'); $('gemini-compare').onclick = () => askGemini('compare'); $('gemini-policy').onclick = () => askGemini('policy'); $('policy-run').onclick = policy; $('policy-type').onchange = policy; ratio(); policy(); $('trend-metric').addEventListener('change', renderTrend);
    try { const stat = await (await fetch('/api/status')).json(); $('ai-state').textContent = stat.gemini_configured ? 'Gemini configured' : 'Needs GEMINI_API_KEY'; } catch (e) { $('ai-state').textContent = 'Backend offline'; }
    try { const res = await fetch('/api/market'); if (res.ok) { const data = await res.json(); marketRows = data.records || []; marketSource = data.source || ''; } } catch (err) { console.warn('CMHC market data unavailable', err); } renderMarket();
    let housing; try { const r = await fetch('/api/housing'); housing = await r.json(); rows = housing.records || []; populateOptions(); } catch (e) { $('status').textContent = 'Cannot fetch housing data. Start the Python Flask server.'; return; }
    if (typeof maplibregl === 'undefined') { $('status').textContent = 'MapLibre library could not load.'; return; }
    map = new maplibregl.Map({ container: 'map', style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', center: [-79.3832, 43.72], zoom: 10 }); map.addControl(new maplibregl.NavigationControl(), 'top-right'); map.on('load', async () => { try { const url = 'https://gis.toronto.ca/arcgis/rest/services/cot_geospatial26/FeatureServer/9/query?where=1%3D1&outFields=AREA_ID%2CAREA_NAME&returnGeometry=true&outSR=4326&f=geojson'; const res = await fetch(url); if (!res.ok) throw Error('Boundaries unavailable'); const gj = await res.json(); if (!gj.features?.length) throw Error('No boundaries'); const lookup = new Map(rows.map(r => [norm(r.neighbourhood_name), r])); let matched = 0; gj.features.forEach(f => { const r = lookup.get(norm(aliases[f.properties.AREA_NAME] || f.properties.AREA_NAME)); if (r) { matched++; for (const key of Object.values(config).map(v => v.key)) f.properties[key] = r[key]; } }); features = gj.features; map.addSource('toronto', { type: 'geojson', data: gj }); map.addLayer({ id: 'fill', type: 'fill', source: 'toronto', paint: { 'fill-color': '#c8b08c', 'fill-opacity': 0.84 } }); map.addLayer({ id: 'line', type: 'line', source: 'toronto', paint: { 'line-color': '#756249', 'line-width': 0.7, 'line-opacity': 0.7 } }); map.on('mouseenter', 'fill', () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', 'fill', () => map.getCanvas().style.cursor = ''); map.on('click', 'fill', e => { const f = e.features?.[0]; if (!f) return; selectFeature(f.properties); const node = document.createElement('div'); const t = document.createElement('strong'); t.textContent = f.properties.AREA_NAME; node.append(t); new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(node).addTo(map); }); mapStyle($('indicator').value); $('status').textContent = `Loaded ${gj.features.length} boundaries; matched ${matched} neighbourhood records. ${rows.length ? '2021 neighbourhood Census + 2024–2025 CMA rental market context' : 'Missing neighbourhood records.'}`; } catch (e) { $('status').textContent = 'Boundary request failed: ' + e.message; console.error(e); } });
}
document.addEventListener('DOMContentLoaded', init);

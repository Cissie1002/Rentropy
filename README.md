# Rentropy — Full interactive Hackathon prototype

**School of Cities-inspired MapLibre GL JS civic map** + Toronto 2021 Census neighbourhood data, two user modes, budget inputs, exploration shortlist, two-neighbourhood comparisons, transparent future housing-cost scenarios, non-causal policy arithmetic, optional Gemini AI interpretations and optional TigerData persistence.

## Quick start (macOS, VS Code)

1. Open this entire folder in VS Code.
2. **Important:** copy your previously generated `webmap-demo-main/data/housing_indicators.json` into **this project's** `data/housing_indicators.json`. This ZIP cannot include that private local file, since it was not uploaded to this conversation. The app will show missing data until you copy it. Your earlier file contains 158 2021 Census neighbourhoods.
3. In VS Code Terminal:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -r requirements.txt
   cp .env.example .env
   python app.py
   ```

4. Visit **http://localhost:5000** in Safari. Do **not** open `index.html` with `file:///` and do **not** use `python -m http.server`; those methods cannot serve the Gemini API endpoint.
5. Open `.env` and set `GEMINI_API_KEY=...` to activate live Gemini; restart Flask. Obtain the key from Google AI Studio. Keep `.env` out of GitHub.
6. Optional: create a TigerData database and put `DATABASE_URL=postgresql://...?...sslmode=require` in `.env`; restart Flask. To write your local neighbourhood data into a `rentropy_neighbourhood_snapshot` table, run:

   ```bash
   curl -X POST http://localhost:5000/api/snapshot
   ```

   The app works without TigerData. This endpoint saves **only public area-level indicators**, never personal budget entries. TigerData persistence is optional and not used as the default map source.

## Delivered features

- Two working modes: **For Residents** and **For Policymakers**.
- Resident budget and housing-type preferences; locally calculated budget ratio.
- Historical-data-based shortlist sorted by a clearly described indicator (not true listing availability nor personalized bedroom/rent matches).
- MapLibre Toronto neighbourhood polygons, four choropleths and accessible color legends.
- Add area from map to compare, plus dropdowns to select **two different neighbourhoods**, side-by-side stats.
- Future household-cost scenario with editable rent/income assumptions (not a trained market forecasting model).
- Policy assistance/allocation arithmetic scenarios (not validated policy impacts).
- Live **Gemini API** context-grounded explanation endpoints when a real API key is supplied.
- Optional TigerData PostgreSQL import and status endpoint.

## Not included / clearly separated

- The uploaded CMHC national 2025 workbook was not automatically joined to the 158-neighbourhood file: its geographic unit differs. Do not mislabel Toronto CMA rents as 158 community listing prices.
- No verified live housing listings, commute ETA, unit eligibility, zoning causality, statistically trained rent forecast or measured policy impact. Those require additional authoritative data and validation.
- Spatial geography is loaded from Toronto's public ArcGIS FeatureServer at runtime; internet access is needed. The base map uses CARTO. MapLibre library loads from UNPKG.

## Sources and attribution

- [Toronto Neighbourhood Profiles](https://www.toronto.ca/city-government/data-research-maps/neighbourhoods-communities/neighbourhood-profiles/)
- [Toronto Open Data](https://open.toronto.ca/)
- [CMHC housing data](https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data)
- MapLibre: [maplibre.org](https://maplibre.org/)
- Tutorial inspiration: University of Toronto School of Cities `webmap-demo`. Check that example repository's reuse permissions before copying its files. This prototype's code was authored separately.

For Devpost: state the features you demonstrated and the data/source limitations. Do not claim AI forecasting or TigerData live integration if not configured.

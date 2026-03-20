# river-ice-detection - Google Earth Engine

Sentinel-1 SAR + Sentinel-2 optical river ice classification script.

## What it does
Detects and classifies river ice conditions (open water, sheet ice,
rubble ice / ice jams) using radar backscatter intensity, GLCM texture
analysis, and optical spectral indices.

## How to use
1. Open Google Earth Engine at https://code.earthengine.google.com
2. Copy the contents of `ice_classification.js`
3. Paste it into the GEE Code Editor
4. Draw your river polygon in the map panel and name the import **roi**
5. Add this line near the top of the script:
   `var imageVisParam = {bands: ['B4','B3','B2'], min: 0, max: 3000};`
6. Set your startDate and endDate
7. Click Run

## Parameters to adjust
| Parameter | Default | Description |
|---|---|---|
| startDate | 2026-02-01 | Start of analysis period |
| endDate | 2026-03-30 | End of analysis period |
| GLCM_SHEET_THRESHOLD | 60 | Texture threshold for sheet ice |
| GLCM_RUBBLE_THRESHOLD | 120 | Texture threshold for rubble/jam ice |

## Data sources
- Sentinel-1 IW GRD (VV + VH polarisation) — ESA Copernicus, free
- Sentinel-2 multispectral — ESA Copernicus, free
- Platform: Google Earth Engine (free for research)

## Scientific basis
- de Roda Husman et al. (2021) — GLCM texture classification
- Stonevicius et al. (2022) — VV backscatter thresholds
- Saal (2023) — Narrow river SAR classification
```

Scroll down and click **Commit changes**.

---

### Step 5 — Share with colleagues

Send colleagues the URL of your repository, which will look like:
```
https://github.com/YOURUSERNAME/river-ice-detection
```

They can read the README, copy the script, and paste it directly into GEE — no GitHub account needed on their end.

---

### Step 6 — Update the script in future

Whenever you improve the script:

1. Go to your repository on GitHub
2. Click on `ice_classification.js`
3. Click the **pencil icon** (Edit this file) in the top right
4. Make your changes directly in the browser
5. Scroll down and click **Commit changes**

That is it — no Git, no installation, no admin rights needed at any point. Everything lives in the browser.

---

### One important note about GEE vs GitHub

GitHub is purely for **storing and sharing** the code. Your colleagues still need to **copy and paste** the script into the GEE Code Editor to actually run it — GitHub cannot run GEE scripts directly. If you also want a one-click link that opens the script directly inside GEE, you can combine both: store the code on GitHub for documentation and version history, and separately share the GEE repository accept link for colleagues who want to run it immediately:
```
https://code.earthengine.google.com/?accept_repo=users/YOURUSERNAME/river-ice-detection

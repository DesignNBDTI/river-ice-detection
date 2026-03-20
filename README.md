# river-ice-detection - Google Earth Engine

Sentinel-1 SAR + Sentinel-2 optical river ice classification script.

## What it does

This script detects and classifies river ice conditions using two satellite 
data sources — Sentinel-1 SAR (radar) and Sentinel-2 (optical) — processed 
entirely within Google Earth Engine. It is designed for monitoring ice cover 
during the freeze-up and breakup seasons, with a particular focus on 
identifying ice jams that pose flood risk.

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
- Sentinel-1 IW GRD (VV + VH polarisation) — ESA Copernicus, free:
A free European Space Agency radar satellite that sees through
clouds and darkness. It measures how strongly the river surface
scatters microwave energy back to the sensor — rough surfaces
like rubble ice scatter strongly (bright), smooth surfaces like
open water scatter weakly (dark), and sheet ice falls in between.
The script uses both the VV (vertical-vertical) and VH
(vertical-horizontal) polarisation bands in Interferometric
Wide swath mode.
  
- Sentinel-2 multispectral — ESA Copernicus, free:
A free multispectral satellite used alongside SAR
to provide visual confirmation and spectral ice indices.
Only images with less than 60% cloud cover are used.
The script computes two indices from the optical bands:
NDWI (Normalized Difference Water Index) to distinguish
water from ice, and NDSI (Normalized Difference Snow and Ice Index)
to identify snow and ice cover.

- Platform: Google Earth Engine (free for research)

## Scientific basis
The SAR classification approach is based on three peer-reviewed studies. 
Stonevicius et al. (2022) established the VV backscatter thresholds that 
optimally separate ice from open water in C-band data. De Roda Husman et al. (2021) 
demonstrated that adding GLCM texture to intensity-only classifiers significantly 
improves breakup classification accuracy — particularly for distinguishing sheet ice 
from open water when meltwater lowers the backscatter of ice into the same range as calm water. 
Saal (2023) provided guidance on applying these methods to narrow rivers where spatial 
filtering options are limited.

- de Roda Husman et al. (2021) — GLCM texture classification
- Stonevicius et al. (2022) — VV backscatter thresholds
- Saal (2023) — Narrow river SAR classification

##Processing Steps
Step 1 — Speckle filtering (SAR only)
Radar imagery has inherent salt-and-pepper noise called speckle. A 3×3 neighbourhood mean filter is applied to both VV and VH bands before any classification, smoothing out random pixel-level noise so that the threshold comparisons that follow are more reliable.

Step 2 — GLCM texture analysis (SAR only)
The filtered VV band is used to compute a Grey Level Co-occurrence Matrix (GLCM) texture feature using an 11×11 pixel window. This captures how spatially uniform or variable the backscatter is across a neighbourhood rather than just the value of a single pixel. Rubble ice and ice jams produce high, homogeneous texture. Open water produces low, uniform texture. Sheet ice falls in between. This texture feature is the key addition that allows the ambiguous zone — where meltwater-covered sheet ice and calm open water have similar backscatter intensity — to be resolved.

Step 3 — SAR ice classification (two approaches displayed side by side)
Original VV classification (4 classes):
Uses VV backscatter intensity ranges to bin pixels into four categories — open water, ambiguous/transitional, smooth ice, and rough ice — displayed in blue, yellow, orange, and red.
GLCM-assisted classification (3 classes):
Combines VV backscatter thresholds with the GLCM texture feature to produce a scientifically grounded three-class map:

Open water (blue) — VV below −16.7 dB
Sheet ice (grey) — VV above −13.7 dB, or ambiguous VV with ice-like texture
Rubble / jam ice (orange-red) — VV above −13.7 dB and high texture value

The two layers are displayed alongside each other so you can directly compare where texture changes the classification result relative to intensity alone.
Step 4 — Sentinel-2 optical classification
For each cloud-filtered Sentinel-2 image in the date range, the script displays a true-colour RGB image and a five-category NDWI mask ranging from thick ice (red) through mixed ice-water (cyan/blue). The NDSI mask and combined ice mask are also computed and available but commented out by default.

## Map Layers Produced

### For each Sentinel-1 SAR image in the date range

| Layer | Description |
|---|---|
| VV filtered (dB) | Greyscale raw filtered backscatter — bright = rough/ice, dark = smooth/water |
| GLCM texture | Texture map — yellow/bright = rubble ice, purple/dark = open water |
| SAR VV Ice | Original 4-class VV threshold classification |
| GLCM class | GLCM-assisted 3-class classification (water / sheet ice / rubble ice) |

### For each Sentinel-2 image

| Layer | Description |
|---|---|
| RGB | True-colour optical image |
| NDWI Mask | 5-category ice/water index from optical bands |

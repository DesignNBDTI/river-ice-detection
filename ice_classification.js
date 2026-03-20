// Define the date range
var startDate = '2026-02-01';
var endDate   = '2026-03-30';

// GLCM texture thresholds (de Roda Husman et al. 2021)
var GLCM_SHEET_THRESHOLD  = 60;   // >= 60  → sheet ice in ambiguous zone
var GLCM_RUBBLE_THRESHOLD = 120;  // >= 120 → rubble / jam ice

// ── 1. LOAD SENTINEL-1 ────────────────────────────────────────────────────────
var sarCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(roi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .select('VV','VH');

// Apply SAR ice threshold
var viceThresholdLow  = -17;
var viceThresholdHigh = -7;
var hiceThresholdLow  = -23;
var hiceThresholdHigh = -12;

function detectSAR_Ice(image) {
  var vhIceMask = image.select('VH')
    .gt(hiceThresholdLow)
    .and(image.select('VH').lt(hiceThresholdHigh))
    .selfMask();
  var vvIceMask = image.select('VV')
    .gt(viceThresholdLow)
    .and(image.select('VV').lt(viceThresholdHigh))
    .selfMask();
  var combinedIceMask = vvIceMask.selfMask();
  return image
    .addBands(combinedIceMask.rename('IceMask'))
    .set('system:time_start', image.get('system:time_start'));
}

var sarIceCollection = sarCollection.map(detectSAR_Ice);

// ── 2. LOAD SENTINEL-2 (unchanged) ────────────────────────────────────────────
var s2Collection = ee.ImageCollection('COPERNICUS/S2')
    .filterBounds(roi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
    .select(['B2', 'B3', 'B4', 'B8', 'B11']);

function computeIceIndices(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var ndsi = image.normalizedDifference(['B3', 'B11']).rename('NDSI');
  return image
    .addBands([ndwi, ndsi])
    .set('system:time_start', image.get('system:time_start'));
}

var s2Processed = s2Collection.map(computeIceIndices);
var s2List      = s2Processed.toList(s2Processed.size());
var numS2       = s2List.size().getInfo();
var maxDisplay  = 15;

for (var i = 0; i < Math.min(numS2, maxDisplay); i++) {
  var s2Image   = ee.Image(s2List.get(i));
  var s2Date    = s2Image.date().format('YYYY-MM-dd');
  var clippedS2 = s2Image.clip(roi);

  var ndwiMask = clippedS2.expression(
    "(NDWI >= -0.1  && NDWI < -0.05) ? 1" +
    ": (NDWI >= -0.05 && NDWI < 0)   ? 2" +
    ": (NDWI >= 0    && NDWI < 0.05) ? 3" +
    ": (NDWI >= 0.05 && NDWI < 0.1)  ? 4" +
    ": (NDWI >= 0.1  && NDWI < 0.5)  ? 5" +
    ": 0", { "NDWI": clippedS2.select("NDWI") }
  ).selfMask();

  var ndwiVis = {
    min: 1, max: 5,
    palette: ['red', 'orange', 'yellow', 'cyan', 'blue']
  };

  var ndsiMask = clippedS2.expression(
    "(NDSI >= 0.4  && NDSI < 0.68) ? 1" +
    ": (NDSI >= 0.68) ? 2" +
    ": 0", { "NDSI": clippedS2.select("NDSI") }
  ).selfMask();

  var ndsiVis = {min: 1, max: 2, palette: ['yellow', 'white']};

  var combinedMask = clippedS2.select("NDWI").gt(-0.1)
    .and(clippedS2.select("NDWI").lt(0.1))
    .or(clippedS2.select("NDSI").gt(0.67))
    .selfMask();

  var combinedVis = {palette: ['blue']};

  Map.addLayer(clippedS2,  imageVisParam, 'RGB '       + s2Date.getInfo());
  Map.addLayer(ndwiMask,   ndwiVis,       'NDWI Mask ' + s2Date.getInfo());
  // Map.addLayer(ndsiMask,    ndsiVis,    'NDSI Mask '         + s2Date.getInfo());
  // Map.addLayer(combinedMask, combinedVis, 'Combined Ice Mask ' + s2Date.getInfo());
}

// ── 3. SAR LOOP WITH SPECKLE FILTER + GLCM ───────────────────────────────────
var sarList = sarIceCollection.toList(sarIceCollection.size());
var numSAR  = sarList.size().getInfo();

for (var i = 0; i < Math.min(numSAR, maxDisplay); i++) {
  var sarImage   = ee.Image(sarList.get(i));
  var sarDate    = sarImage.date().format('YYYY-MM-dd');
  var clippedSar = sarImage.clip(roi);

  // ── STEP A: 3×3 SPECKLE FILTER ─────────────────────────────────────────────
  // Clip first, then apply focal mean, then clip again to keep mask clean.
  // focal_mean radius=1 in 'square' pixels = 3×3 neighbourhood.
  var vvRaw = clippedSar.select('VV');
  var vhRaw = clippedSar.select('VH');

  var vvFiltered = vvRaw
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .clip(roi);

  var vhFiltered = vhRaw
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .clip(roi);

  // ── STEP B: GLCM TEXTURE (VV) ──────────────────────────────────────────────
  // Normalise filtered VV from dB range (−30…0) to 0–255 integer.
  // glcmTexture() requires integer input.
  // size=5 → 11×11 window (half-window of 5).
  // average:true averages all 4 directions for lighter computation.
  // 'VV_norm_savg' = GLCM sum average ≈ GLCM mean:
  //   high value  = rough / heterogeneous surface (rubble ice, ice jam)
  //   medium value = sheet ice
  //   low value   = smooth surface (open water)
  var vvNorm = vvFiltered
    .unitScale(-30, 0)
    .multiply(255)
    .toUint8()
    .rename('VV_norm');

  var glcm = vvNorm.glcmTexture({size: 5, average: true});

  var glcmMean = glcm
    .select('VV_norm_savg')
    .rename('GLCM_mean')
    .clip(roi);

  // ── STEP C: YOUR ORIGINAL VV CLASSIFICATION (now on filtered VV) ───────────
  // Thresholds and palette are exactly as you had them —
  // only the input changes from raw to speckle-filtered.
  var vvClassified = vvFiltered.expression(
    "(VV < -16.7) ? 1" +
    ": (VV >= -16.7 && VV < -13.7) ? 2" +
    ": (VV >= -13.7 && VV < -8)    ? 3" +
    ": (VV >= -8) ? 4" +
    ": 0", {
      "VV": vvFiltered
    }
  ).selfMask().clip(roi);

  var vvClassVis = {
    min: 1, max: 4,
    palette: ['blue', 'yellow', 'orange', 'red']
  };

  // ── STEP D: GLCM-ASSISTED 3-CLASS CLASSIFICATION ───────────────────────────
  // Adds a second classification layer that uses GLCM texture to resolve
  // the ambiguous zone (−16.7 to −13.7 dB) where meltwater sheet ice
  // and calm open water overlap in backscatter intensity.
  //
  //   Class 1 = Open water  (VV < −16.7 dB)
  //   Class 2 = Sheet ice   (VV ≥ −13.7 dB  OR  ambiguous + GLCM ≥ 60)
  //   Class 3 = Rubble/jam  (VV ≥ −13.7 dB  AND GLCM ≥ 120)
  var vvIce   = vvFiltered.gte(-13.7);
  var vvAmbig = vvFiltered.gte(-16.7).and(vvFiltered.lt(-13.7));

  var glcmClassified = ee.Image.constant(1)        // default: open water
    .where(vvAmbig.and(glcmMean.gte(GLCM_SHEET_THRESHOLD)),  2)
    .where(vvIce,                                             2)
    .where(vvIce.and(glcmMean.gte(GLCM_RUBBLE_THRESHOLD)),   3)
    .updateMask(vvFiltered.mask())
    .clip(roi)
    .rename('glcm_class');

  var glcmClassVis = {
    min: 1, max: 3,
    palette: ['1a78c2', 'b0bec5', 'e64a19']   // blue / grey / orange-red
  };

  // ── STEP E: YOUR ORIGINAL VH CLASSIFICATION (now on filtered VH) ───────────
  var vhClassified = vhFiltered.expression(
    "(VH < -21.2) ? 1" +
    ": (VH >= -21.2 && VH < -15) ? 2" +
    ": (VH >= -15) ? 3" +
    ": 0", {
      "VH": vhFiltered
    }
  ).selfMask().clip(roi);

  var vhClassVis = {
    min: 1, max: 3,
    palette: ['blue', 'yellow', 'orange', 'red']
  };

  // ── STEP F: DISPLAY ALL LAYERS ──────────────────────────────────────────────
  // VV filtered backscatter — greyscale reference (bright = rough/ice)
  Map.addLayer(
    vvFiltered,
    {min: -25, max: 0, palette: ['000000', 'ffffff']},
    'VV filtered (dB) ' + sarDate.getInfo()
  );

  // GLCM texture — bright (yellow) = rough rubble/jam, dark (purple) = smooth water
  Map.addLayer(
    glcmMean,
    {min: 0, max: 200, palette: ['0d0887','7e03a8','cc4778','f89540','f0f921']},
    'GLCM texture ' + sarDate.getInfo()
  );

  // Your original 4-class VV classification (speckle-filtered input)
  Map.addLayer(
    vvClassified,
    vvClassVis,
    'SAR VV Ice ' + sarDate.getInfo()
  );

  // GLCM-assisted 3-class classification (new)
  // Compare this against SAR VV Ice to see where texture changes the result
  Map.addLayer(
    glcmClassified,
    glcmClassVis,
    'GLCM class (1=water 2=sheet 3=rubble) ' + sarDate.getInfo()
  );

  // Your original VH classification — uncomment to enable
  // Map.addLayer(vhClassified, vhClassVis, 'SAR VH Ice ' + sarDate.getInfo());
}

// ── 4. CENTER MAP ─────────────────────────────────────────────────────────────
Map.centerObject(roi);

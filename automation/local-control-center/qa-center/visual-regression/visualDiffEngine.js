/**
 * Phase 5: QA Center of Excellence
 * Visual Diff Engine - Pixel-level comparison for UI regression detection
 */

const crypto = require('crypto');
const path = require('path');

class VisualDiffEngine {
  constructor(config = {}) {
    this.config = {
      threshold: config.threshold || 0.1, // 10% pixel diff threshold
      antialiasing: config.antialiasing ?? true,
      ignoreColors: config.ignoreColors || false,
      ignoreRegions: config.ignoreRegions || [],
      baselineDir: config.baselineDir || './baselines',
      diffDir: config.diffDir || './diffs',
      ...config
    };

    this.baselines = new Map();
    this.comparisons = [];
  }

  /**
   * Compare two images and return diff metrics
   * Expects image data as { width, height, data: Uint8ClampedArray }
   */
  compare(baseline, current, options = {}) {
    const opts = { ...this.config, ...options };

    if (baseline.width !== current.width || baseline.height !== current.height) {
      return {
        match: false,
        reason: 'dimension_mismatch',
        baseline: { width: baseline.width, height: baseline.height },
        current: { width: current.width, height: current.height },
        diffPercent: 100
      };
    }

    const width = baseline.width;
    const height = baseline.height;
    const totalPixels = width * height;

    // Create diff image data
    const diffData = new Uint8ClampedArray(baseline.data.length);
    let diffPixels = 0;
    let maxDiff = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Check if pixel is in ignored region
        if (this._isInIgnoredRegion(x, y, opts.ignoreRegions)) {
          this._setPixel(diffData, x, y, width, [128, 128, 128, 255]); // Gray for ignored
          continue;
        }

        const idx = (y * width + x) * 4;

        const baselinePixel = [
          baseline.data[idx],
          baseline.data[idx + 1],
          baseline.data[idx + 2],
          baseline.data[idx + 3]
        ];

        const currentPixel = [
          current.data[idx],
          current.data[idx + 1],
          current.data[idx + 2],
          current.data[idx + 3]
        ];

        const pixelDiff = this._pixelDiff(baselinePixel, currentPixel, opts);

        if (pixelDiff > 0) {
          // Check for antialiasing
          if (opts.antialiasing && this._isAntialiased(baseline.data, current.data, x, y, width, height)) {
            this._setPixel(diffData, x, y, width, [255, 255, 0, 255]); // Yellow for antialiasing
          } else {
            diffPixels++;
            maxDiff = Math.max(maxDiff, pixelDiff);
            // Red intensity based on diff amount
            const intensity = Math.min(255, Math.floor(pixelDiff * 255));
            this._setPixel(diffData, x, y, width, [255, intensity, intensity, 255]);
          }
        } else {
          // Copy original pixel (dimmed)
          this._setPixel(diffData, x, y, width, [
            Math.floor(baseline.data[idx] * 0.3),
            Math.floor(baseline.data[idx + 1] * 0.3),
            Math.floor(baseline.data[idx + 2] * 0.3),
            255
          ]);
        }
      }
    }

    const diffPercent = (diffPixels / totalPixels) * 100;
    const match = diffPercent <= (opts.threshold * 100);

    const result = {
      match,
      diffPixels,
      totalPixels,
      diffPercent: Math.round(diffPercent * 100) / 100,
      maxDiff,
      threshold: opts.threshold * 100,
      dimensions: { width, height },
      diffImage: {
        width,
        height,
        data: diffData
      }
    };

    this.comparisons.push({
      timestamp: new Date(),
      ...result
    });

    return result;
  }

  /**
   * Calculate difference between two pixels
   */
  _pixelDiff(p1, p2, opts) {
    if (opts.ignoreColors) {
      // Compare luminance only
      const l1 = 0.299 * p1[0] + 0.587 * p1[1] + 0.114 * p1[2];
      const l2 = 0.299 * p2[0] + 0.587 * p2[1] + 0.114 * p2[2];
      return Math.abs(l1 - l2) / 255;
    }

    // Full RGBA comparison
    const dr = Math.abs(p1[0] - p2[0]);
    const dg = Math.abs(p1[1] - p2[1]);
    const db = Math.abs(p1[2] - p2[2]);
    const da = Math.abs(p1[3] - p2[3]);

    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) / (255 * 2);
  }

  /**
   * Check if pixel is part of antialiasing
   */
  _isAntialiased(data1, data2, x, y, width, height) {
    const neighbors = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],          [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    let similarNeighbors = 0;

    for (const [dx, dy] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const idx = (ny * width + nx) * 4;
      const p1 = [data1[idx], data1[idx + 1], data1[idx + 2], data1[idx + 3]];
      const p2 = [data2[idx], data2[idx + 1], data2[idx + 2], data2[idx + 3]];

      if (this._pixelDiff(p1, p2, { ignoreColors: false }) < 0.1) {
        similarNeighbors++;
      }
    }

    // If most neighbors match, this is likely antialiasing
    return similarNeighbors >= 6;
  }

  /**
   * Check if point is in ignored region
   */
  _isInIgnoredRegion(x, y, regions) {
    for (const region of regions) {
      if (x >= region.x && x < region.x + region.width &&
          y >= region.y && y < region.y + region.height) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set pixel in image data
   */
  _setPixel(data, x, y, width, rgba) {
    const idx = (y * width + x) * 4;
    data[idx] = rgba[0];
    data[idx + 1] = rgba[1];
    data[idx + 2] = rgba[2];
    data[idx + 3] = rgba[3];
  }

  /**
   * Generate hash for image (for baseline matching)
   */
  generateHash(imageData) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(imageData.data.buffer));
    hash.update(`${imageData.width}x${imageData.height}`);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Store baseline image
   */
  storeBaseline(name, imageData, metadata = {}) {
    const hash = this.generateHash(imageData);
    this.baselines.set(name, {
      name,
      hash,
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
      metadata: {
        ...metadata,
        createdAt: new Date(),
        version: (this.baselines.get(name)?.metadata?.version || 0) + 1
      }
    });
    return hash;
  }

  /**
   * Compare against stored baseline
   */
  compareToBaseline(name, currentImage, options = {}) {
    const baseline = this.baselines.get(name);

    if (!baseline) {
      return {
        match: false,
        reason: 'baseline_not_found',
        name,
        suggestion: 'Create baseline first with storeBaseline()'
      };
    }

    const result = this.compare(
      { width: baseline.width, height: baseline.height, data: baseline.data },
      currentImage,
      options
    );

    return {
      ...result,
      baselineName: name,
      baselineHash: baseline.hash,
      baselineVersion: baseline.metadata.version
    };
  }

  /**
   * Element-specific comparison with bounding box
   */
  compareElement(baseline, current, element) {
    // Extract element region from both images
    const { x, y, width, height } = element.boundingBox;

    const extractRegion = (img) => {
      const regionData = new Uint8ClampedArray(width * height * 4);

      for (let ry = 0; ry < height; ry++) {
        for (let rx = 0; rx < width; rx++) {
          const srcIdx = ((y + ry) * img.width + (x + rx)) * 4;
          const dstIdx = (ry * width + rx) * 4;

          regionData[dstIdx] = img.data[srcIdx];
          regionData[dstIdx + 1] = img.data[srcIdx + 1];
          regionData[dstIdx + 2] = img.data[srcIdx + 2];
          regionData[dstIdx + 3] = img.data[srcIdx + 3];
        }
      }

      return { width, height, data: regionData };
    };

    const baselineRegion = extractRegion(baseline);
    const currentRegion = extractRegion(current);

    const result = this.compare(baselineRegion, currentRegion);

    return {
      ...result,
      element: {
        selector: element.selector,
        boundingBox: element.boundingBox
      }
    };
  }

  /**
   * Batch compare multiple elements
   */
  compareElements(baseline, current, elements) {
    const results = [];

    for (const element of elements) {
      try {
        const result = this.compareElement(baseline, current, element);
        results.push({
          selector: element.selector,
          ...result
        });
      } catch (error) {
        results.push({
          selector: element.selector,
          match: false,
          error: error.message
        });
      }
    }

    return {
      total: results.length,
      passed: results.filter(r => r.match).length,
      failed: results.filter(r => !r.match).length,
      results
    };
  }

  /**
   * Get comparison statistics
   */
  getStats() {
    if (this.comparisons.length === 0) return null;

    const totalComparisons = this.comparisons.length;
    const matches = this.comparisons.filter(c => c.match).length;
    const avgDiff = this.comparisons.reduce((sum, c) => sum + (c.diffPercent || 0), 0) / totalComparisons;

    return {
      totalComparisons,
      matches,
      failures: totalComparisons - matches,
      matchRate: (matches / totalComparisons * 100).toFixed(2) + '%',
      averageDiffPercent: avgDiff.toFixed(2) + '%',
      baselinesStored: this.baselines.size
    };
  }

  /**
   * Clear comparison history
   */
  clearHistory() {
    this.comparisons = [];
  }

  /**
   * Export baselines to serializable format
   */
  exportBaselines() {
    const exported = {};
    for (const [name, baseline] of this.baselines) {
      exported[name] = {
        name: baseline.name,
        hash: baseline.hash,
        width: baseline.width,
        height: baseline.height,
        data: Buffer.from(baseline.data.buffer).toString('base64'),
        metadata: baseline.metadata
      };
    }
    return exported;
  }

  /**
   * Import baselines from serialized format
   */
  importBaselines(data) {
    for (const [name, baseline] of Object.entries(data)) {
      const buffer = Buffer.from(baseline.data, 'base64');
      this.baselines.set(name, {
        name: baseline.name,
        hash: baseline.hash,
        width: baseline.width,
        height: baseline.height,
        data: new Uint8ClampedArray(buffer),
        metadata: baseline.metadata
      });
    }
  }
}

module.exports = { VisualDiffEngine };

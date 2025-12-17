# Favicon & Image Asset Specifications

## Brand Colors - Olive Grove Palette
- **Grove Dark**: `#3D4A3F` (headers, nav, footer)
- **Grove**: `#4F5D51` (primary sage)
- **Grove Light**: `#6B7A6C` (hover states)
- **Grove Mist**: `#8A9B8C` (secondary text on dark)
- **Parchment**: `#FAF8F5` (page background)
- **Linen**: `#F3EFE8` (section backgrounds)
- **Sand**: `#E8E2D9` (cards, dividers)
- **Ink**: `#2C2F2D` (body text)
- **Ink Light**: `#4A4D4B` (secondary text)
- **Terracotta**: `#C4704E` (primary CTA)
- **Terracotta Dark**: `#A85A3A` (CTA hover)
- **Bay**: `#5B8A9A` (links)

### Primary Brand Colors for Favicon/Logo:
- **Primary Accent**: `#4F5D51` (Grove)
- **Dark Background**: `#3D4A3F` (Grove Dark)
- **Light Text**: `#FAF8F5` (Parchment)

## Design: Interlocking "CC" Monogram
Two overlapping letter "C" shapes that interlock, representing "Cape Cod" or "CC Restaurant Consulting".

### Visual Description
- Two "C" letters positioned side-by-side with overlap
- Left C starts at roughly 25% from left edge
- Right C overlaps the left C by about 30%
- Both C's are the same size and grove colored (#4F5D51)
- Clean, modern stroke-based design (not filled)
- Stroke width: proportional (2.5px at 32x32 scale)
- Round stroke caps for elegant appearance

---

## Required Files

### 1. favicon.ico (Multi-resolution ICO)
**Status**: Generate from favicon.svg

Contains multiple sizes in one file:
- 16x16 pixels
- 32x32 pixels
- 48x48 pixels (optional)

**Generation command (using ImageMagick):**
```bash
# Install ImageMagick if needed: brew install imagemagick

# Convert SVG to ICO with multiple sizes
convert public/favicon.svg -background none -resize 16x16 favicon-16.png
convert public/favicon.svg -background none -resize 32x32 favicon-32.png
convert public/favicon.svg -background none -resize 48x48 favicon-48.png
convert favicon-16.png favicon-32.png favicon-48.png public/favicon.ico
rm favicon-16.png favicon-32.png favicon-48.png
```

**Alternative (using realfavicongenerator.net):**
1. Upload `public/favicon.svg`
2. Download generated favicon package
3. Extract favicon.ico to `public/`

---

### 2. apple-touch-icon.png (180x180)
**Status**: Generate from favicon.svg

- Size: 180x180 pixels
- Format: PNG with solid background (no transparency)
- Background: `#3D4A3F` (grove-dark)
- Padding: ~20px from edges for the monogram

**Generation command:**
```bash
convert public/favicon.svg -background '#3D4A3F' -resize 180x180 -extent 180x180 -gravity center public/apple-touch-icon.png
```

---

### 3. favicon-192.png (Android/PWA)
**Status**: Generate from favicon.svg

- Size: 192x192 pixels
- Format: PNG
- Background: Can be transparent or solid dark

**Generation command:**
```bash
convert public/favicon.svg -background none -resize 192x192 public/favicon-192.png
```

---

### 4. favicon-512.png (PWA Large)
**Status**: Generate from favicon.svg

- Size: 512x512 pixels
- Format: PNG
- Background: Can be transparent or solid dark

**Generation command:**
```bash
convert public/favicon.svg -background none -resize 512x512 public/favicon-512.png
```

---

### 5. og-image.jpg (Open Graph Social Share)
**Status**: CREATE NEW

- Size: 1200x630 pixels
- Format: JPG (better compression for social)
- Background: `#3D4A3F` (grove-dark)

**Design Layout:**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│     ╭──────╮                                          │
│     │  CC  │  ← Large CC monogram (grove, ~200px)     │
│     ╰──────╯                                          │
│                                                        │
│     CAPE COD                                          │
│     RESTAURANT CONSULTING                             │
│     ─────────────────────                             │
│                                                        │
│     Expert Toast POS implementation,                  │
│     networking, and operations consulting             │
│     for restaurants across New England.               │
│                                                        │
│                                                        │
│     ▬▬▬▬▬▬▬▬  ← Grove accent line                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Typography:**
- "CAPE COD" - Playfair Display, 48px, terracotta (#C4704E)
- "RESTAURANT CONSULTING" - Playfair Display, 36px, parchment (#FAF8F5)
- Tagline - Inter, 24px, parchment (#FAF8F5), 70% opacity

**Design Notes:**
- Left-aligned text with generous left margin (~80px)
- CC monogram positioned top-left
- Subtle grove accent line below tagline
- Consider adding a subtle gradient or texture overlay

---

## Quick Generation Script

Save as `generate-favicons.sh`:

```bash
#!/bin/bash

# Requires ImageMagick: brew install imagemagick

cd public

# Generate PNG sizes from SVG
convert favicon.svg -background none -resize 16x16 favicon-16.png
convert favicon.svg -background none -resize 32x32 favicon-32.png
convert favicon.svg -background none -resize 48x48 favicon-48.png
convert favicon.svg -background '#3D4A3F' -resize 180x180 -gravity center -extent 180x180 apple-touch-icon.png
convert favicon.svg -background none -resize 192x192 favicon-192.png
convert favicon.svg -background none -resize 512x512 favicon-512.png

# Create multi-resolution ICO
convert favicon-16.png favicon-32.png favicon-48.png favicon.ico

# Cleanup temporary files
rm favicon-16.png favicon-32.png favicon-48.png

echo "Favicons generated successfully!"
echo "Note: og-image.jpg needs to be created manually in a design tool."
```

---

## Online Tools (Alternative)

If you don't have ImageMagick:

1. **RealFaviconGenerator.net** - Upload SVG, generates all favicon sizes
2. **Favicon.io** - SVG to ICO converter
3. **Canva.com** - Create og-image.jpg with templates
4. **Figma.com** - Design og-image.jpg (free)

---

## File Checklist

After generation, ensure these files exist in `public/`:

- [ ] `favicon.svg` (source, already created)
- [ ] `favicon.ico` (16x16, 32x32, 48x48 multi-res)
- [ ] `apple-touch-icon.png` (180x180)
- [ ] `favicon-192.png` (for PWA)
- [ ] `favicon-512.png` (for PWA)
- [ ] `og-image.jpg` (1200x630 social share)

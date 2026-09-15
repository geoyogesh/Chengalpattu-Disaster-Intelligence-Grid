/**
 * Flat, pre-coloured POI icons rendered as crisp raster map images (no SDF).
 *
 * Colours are baked into the SVG (healthcare = red, school = green), so there
 * is no runtime tinting — simpler and guaranteed sharp. Each is drawn on a
 * white rounded-square badge with a subtle shadow so it stays legible over any
 * background without a pin. Rasterized at high resolution (pixelRatio 2) and
 * displayed larger via icon-size.
 */

const HOSPITAL_RED = '#e03131';
const SCHOOL_GREEN = '#2f9e44';
const RAIL_PURPLE = '#7048e8';

// 44x44 SVG: white rounded badge + bold coloured glyph.
export const FLAT_ICONS: Record<string, string> = {
  'icon-hospital': `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <rect x="3" y="3" width="38" height="38" rx="9"
            fill="#ffffff" stroke="${HOSPITAL_RED}" stroke-width="2.5"/>
      <rect x="19.4" y="11" width="5.2" height="22" rx="2" fill="${HOSPITAL_RED}"/>
      <rect x="11" y="19.4" width="22" height="5.2" rx="2" fill="${HOSPITAL_RED}"/>
    </svg>`,
  'icon-school': `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <rect x="3" y="3" width="38" height="38" rx="9"
            fill="#ffffff" stroke="${SCHOOL_GREEN}" stroke-width="2.5"/>
      <path d="M22 11 L34 17 L22 23 L10 17 Z" fill="${SCHOOL_GREEN}"/>
      <path d="M15 20.5 V26 c0 2.2 3.1 3.6 7 3.6 s7-1.4 7-3.6 V20.5 L22 24.5 Z"
            fill="${SCHOOL_GREEN}"/>
      <rect x="32" y="17" width="2" height="7" rx="1" fill="${SCHOOL_GREEN}"/>
    </svg>`,
  // Simple train glyph: body + windows + two wheels.
  'icon-rail': `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <rect x="3" y="3" width="38" height="38" rx="9"
            fill="#ffffff" stroke="${RAIL_PURPLE}" stroke-width="2.5"/>
      <path d="M16 11 h12 a4 4 0 0 1 4 4 v11 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-11 a4 4 0 0 1 4 -4 z"
            fill="${RAIL_PURPLE}"/>
      <rect x="15" y="15" width="14" height="6" rx="1.5" fill="#ffffff"/>
      <circle cx="17" cy="32" r="2.4" fill="${RAIL_PURPLE}"/>
      <circle cx="27" cy="32" r="2.4" fill="${RAIL_PURPLE}"/>
    </svg>`,
};

/**
 * Rasterize a pre-coloured SVG into an ImageData at pixelRatio 2 for crisp
 * display. Returns {width,height,data} + the ratio to register with MapLibre.
 */
export async function rasterizeIcon(
  svg: string,
  size = 44,
  ratio = 2,
): Promise<{ image: ImageData; ratio: number }> {
  const url = 'data:image/svg+xml;base64,' + btoa(svg.trim());
  const img = new Image();
  img.width = size;
  img.height = size;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = url;
  });
  const c = document.createElement('canvas');
  c.width = size * ratio;
  c.height = size * ratio;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { image: ctx.getImageData(0, 0, c.width, c.height), ratio };
}

/**
 * Cloudflare Worker: static assets + HTTP range support for .pmtiles.
 *
 * WHY THIS EXISTS
 * ---------------
 * MapLibre + pmtiles.js read tiles by fetching small byte-RANGES out of one
 * large `.pmtiles` archive (HTTP "byte serving"). Cloudflare Workers static
 * assets ignore the `Range` request header and return the WHOLE file with a
 * 200 — so pmtiles.js gets 7 MB when it asked for 16 KB, fails its range
 * checks, and no vector layer ever paints (a dark map).
 *
 * This Worker sits in front of the ASSETS binding and implements range serving
 * itself for the tile files: it fetches the asset, slices the requested byte
 * range, and returns a proper `206 Partial Content` with `Content-Range` /
 * `Accept-Ranges`. Everything else (HTML, JS, CSS, shapefiles) defers to the
 * normal static-asset handler, which already serves them correctly and applies
 * the SPA `not_found_handling` for client-side routes.
 *
 * Docs: https://developers.cloudflare.com/workers/static-assets/binding/
 */

/** Only these need range serving; everything else falls through to ASSETS. */
function needsRangeServing(pathname) {
  return pathname.endsWith('.pmtiles');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (needsRangeServing(url.pathname)) {
      // Fetch the full asset from the static-asset store.
      const assetResp = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
      if (!assetResp.ok && assetResp.status !== 200) {
        return assetResp; // 404 etc — let it through unchanged.
      }

      const buf = await assetResp.arrayBuffer();
      const total = buf.byteLength;
      const rangeHeader = request.headers.get('Range');

      const baseHeaders = {
        'Content-Type': 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      };

      // No Range header → return the whole file, but advertise range support.
      if (!rangeHeader) {
        return new Response(buf, { status: 200, headers: { ...baseHeaders, 'Content-Length': String(total) } });
      }

      // Parse "bytes=start-end" (end optional).
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!match) {
        return new Response(buf, { status: 200, headers: { ...baseHeaders, 'Content-Length': String(total) } });
      }
      let start = match[1] === '' ? 0 : parseInt(match[1], 10);
      let end = match[2] === '' ? total - 1 : parseInt(match[2], 10);

      // Unsatisfiable range.
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
        });
      }
      end = Math.min(end, total - 1);
      const slice = buf.slice(start, end + 1);

      return new Response(slice, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': String(slice.byteLength),
        },
      });
    }

    // Everything else: normal static-asset serving (HTML/JS/CSS/shapefiles) +
    // SPA not_found_handling for client-side routes.
    return env.ASSETS.fetch(request);
  },
};

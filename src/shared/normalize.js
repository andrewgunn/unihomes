// Shared by the crawler (Node), the browser (live search) and the proxy Worker.
// Converts the live site's embedded JSON into small whitelisted records. Only
// fields the live site already displays are kept; internal fields (markups,
// landlord settings, …) are dropped deliberately.

export const LIVE_ORIGIN = 'https://www.unihomes.co.uk';

/** "https://www.unihomes.co.uk/a/b?x=1" -> "/a/b?x=1" (null for other hosts). */
export function livePath(href) {
  if (!href) return null;
  try {
    const u = new URL(String(href).replace(/\\\//g, '/'), LIVE_ORIGIN);
    if (u.hostname !== 'www.unihomes.co.uk' && u.hostname !== 'unihomes.co.uk') return null;
    return (u.pathname.replace(/\/+$/, '') || '/') + u.search;
  } catch {
    return null;
  }
}

/** Strip the CDN resizer prefix, leaving the stored image path. */
export function imgPath(url) {
  const m = String(url || '').match(/cdn-p1\.unihomes\.co\.uk\/(.+?)(?:\?|$)/);
  return m ? m[1] : null;
}

/** Whitelisted card data for a property in search results. */
export function listingSummary(p) {
  return {
    id: p.id,
    path: livePath(p.path),
    name: p.propertyName,
    desc: p.shortDescription,
    address: p.addressShort,
    postcode: p.postcode || null,
    type: p.type,
    advert: p.advertType,
    beds: p.bedroomCount,
    baths: p.bathroomCount,
    price: Number(p.price) || null,
    priceMin: Number(p.cheapestRoomPrice) || null,
    priceMax: Number(p.mostExpensiveRoomPrice) || null,
    from: !!p.showFrom,
    available: p.availableFromShort || null,
    roomsAvailable: p.roomsAvailableCount ?? null,
    featured: !!p.isFeatured,
    btr: !!p.isBTRProperty,
    incentive: typeof p.incentive === 'string' ? p.incentive : p.incentive?.text || p.incentive?.title || null,
    images: (p.images || []).map((i) => imgPath(i.fileURLTablet)).filter(Boolean).slice(0, 6),
    lat: Number(p.latitude) || null,
    lng: Number(p.longitude) || null,
    live: p.liveAt || null,
  };
}

/**
 * Whitelisted property detail.
 * @param p      the `:property` prop
 * @param rooms  the `:rooms` prop (display prices)
 * @param extra  { householdPcm, showRoomTypes, bookable, meta, breadcrumbs }
 */
export function propertyDetail(p, rooms, extra = {}) {
  const ll = p.landlord || {};
  const media = (p.media || [])
    .map((m) => ({ type: m.type || 'video', youtube: m.youtube_id || null, url: m.url || null }))
    .filter((m) => m.youtube || m.url);
  return {
    id: p.obfuscated_id,
    meta: extra.meta || null,
    breadcrumbs: extra.breadcrumbs || [],
    name: p.property_name || null,
    street: p.street,
    postcode: p.postcode,
    type: p.type,
    advert: p.advert_type,
    beds: p.room_count,
    roomsAvailable: p.rooms_available_count,
    baths: p.bathroom_count,
    epc: p.epc || null,
    councilTax: p.council_tax_band || null,
    parking: p.parking || null,
    accessibility: p.accessibility || null,
    availableFrom: p.available_from,
    availableTo: ll.hide_available_to ? null : p.available_to,
    deposit: ll.show_deposit ? Number(p.deposit) || 0 : null,
    description: ll.hide_property_descriptions ? null : String(p.description || '').replace(/\r/g, '').trim(),
    pricePppw: Number(p.cheapest_room_price) || null,
    pricePerMonthHousehold: Number(extra.householdPcm) || null,
    features: (p.features || []).map((f) => f.text).filter(Boolean),
    images: (p.images_not_hidden || []).map((i) => i.path || i.file).filter(Boolean),
    floorplans: (p.floorplans || []).map((f) => f.path || f.file).filter(Boolean),
    youtube: p.youtube_id || null,
    walkthrough: p.walkthrough_url || null,
    media,
    rooms: Array.isArray(rooms)
      ? rooms.map((r) => ({ n: r.number, type: r.type_name, pppw: Number(r.total_price) || null, pcm: Number(r.price_per_month) || null, live: r.unit_is_live }))
      : [],
    showRoomTypes: !!extra.showRoomTypes,
    offers: (p.special_offers || []).map((o) => o.text || o.title || o.description).filter(Boolean),
    noUtilities: p.disabled_utilities || null,
    bookable: !!extra.bookable,
    city: p.city ? { name: p.city.name, slug: p.city.slug } : null,
    area: p.area ? { name: p.area.name, slug: p.area.slug } : null,
    lat: Number(p.latitude) || null,
    lng: Number(p.longitude) || null,
    updated: p.updated_at || null,
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#039': "'", '#39': "'", apos: "'" };
const unescapeHtml = (s) => s.replace(/&(amp|lt|gt|quot|#0?39|apos);/g, (_, k) => ENTITIES[k] ?? ENTITIES['#' + k.slice(1)] ?? _);

/**
 * Decode a Vue prop straight from raw HTML without a DOM, e.g.
 *   :initial-properties="JSON.parse('[{"id":1}]')"
 * Laravel's Js::from() hex-escapes quotes/apostrophes, so the single-quoted
 * literal contains only JSON-compatible escapes and can be JSON-decoded.
 */
export function vuePropFromHtml(html, name) {
  const m = html.match(new RegExp(` :${name.replace(/[-]/g, '\\-')}="([^"]*)"`));
  if (!m) return undefined;
  const v = unescapeHtml(m[1]).trim();
  const lit = v.match(/^JSON\.parse\('([\s\S]*)'\)$/);
  try {
    return lit ? JSON.parse(JSON.parse(`"${lit[1].replace(/\\'/g, "'")}"`)) : JSON.parse(v);
  } catch {
    return v;
  }
}

/** Parse a raw live property page (used by the proxy Worker). */
export function propertyFromHtml(html) {
  const p = vuePropFromHtml(html, 'property');
  if (!p || typeof p !== 'object') return null;
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || '';
  const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  return propertyDetail(p, vuePropFromHtml(html, 'rooms'), {
    householdPcm: vuePropFromHtml(html, 'total-house-price-per-month'),
    showRoomTypes: vuePropFromHtml(html, 'show-room-types'),
    bookable: vuePropFromHtml(html, 'is-bookable'),
    meta: { title: unescapeHtml(title), description: unescapeHtml(description) },
  });
}

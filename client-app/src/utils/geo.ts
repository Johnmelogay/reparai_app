/**
 * File: src/utils/geo.ts
 * Purpose: Client-side geographical calculations, sorting, filtering, and PostGIS parsing.
 */

interface Coordinates {
    latitude: number;
    longitude: number;
}

function toFiniteNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

/** Parse PostGIS EWKB hex string → {lat, lng} */
function parseWKBHex(hex: string): { lat: number; lng: number } | null {
    try {
        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        if (bytes.length < 21) return null;

        const isLE = bytes[0] === 1;
        const readUint32 = (offset: number) => {
            const b = bytes.slice(offset, offset + 4);
            return isLE
                ? b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)
                : (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
        };
        const readDouble = (offset: number): number => {
            const buf = new ArrayBuffer(8);
            const view = new DataView(buf);
            for (let i = 0; i < 8; i++) view.setUint8(i, bytes[offset + i]);
            return view.getFloat64(0, isLE);
        };

        const type = readUint32(1);
        const hasSRID = !!(type & 0x20000000);
        let offset = 5;
        if (hasSRID) offset += 4;

        const lng = readDouble(offset);
        const lat = readDouble(offset + 8);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}

/** Parse any location format from Supabase: WKB hex, GeoJSON, WKT, {lat,lng} object */
export function parseGeoPoint(raw: any): { lat: number; lng: number } | null {
    if (!raw) return null;

    if (typeof raw === 'string') {
        // WKT: POINT(lng lat)
        const wkt = raw.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
        if (wkt) {
            const cLng = toFiniteNumber(wkt[1]);
            const cLat = toFiniteNumber(wkt[2]);
            if (cLat != null && cLng != null) return { lat: cLat, lng: cLng };
        }

        // WKB hex (PostGIS EWKB)
        if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 42) {
            const parsed = parseWKBHex(raw);
            if (parsed) return parsed;
        }

        // Stringified GeoJSON
        try {
            return parseGeoPoint(JSON.parse(raw));
        } catch { /* not JSON */ }

        return null;
    }

    // Direct object {lat, lng} or {latitude, longitude}
    const lat = toFiniteNumber(raw?.lat ?? raw?.latitude);
    const lng = toFiniteNumber(raw?.lng ?? raw?.long ?? raw?.longitude);
    if (lat != null && lng != null) return { lat, lng };

    // GeoJSON {type: "Point", coordinates: [lng, lat]}
    if (Array.isArray(raw?.coordinates) && raw.coordinates.length >= 2) {
        const cLng = toFiniteNumber(raw.coordinates[0]);
        const cLat = toFiniteNumber(raw.coordinates[1]);
        if (cLat != null && cLng != null) return { lat: cLat, lng: cLng };
    }

    return null;
}

// Earth radius in kilometers
const R = 6371;

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * @param start Coordinates of the starting point
 * @param end Coordinates of the destination point
 * @returns Distance in kilometers
 */
export const calculateDistance = (start: Coordinates, end: Coordinates): number => {
    const lat1Val = parseFloat(String(start.latitude));
    const lon1Val = parseFloat(String(start.longitude));
    const lat2Val = parseFloat(String(end.latitude));
    const lon2Val = parseFloat(String(end.longitude));

    if (isNaN(lat1Val) || isNaN(lon1Val) || isNaN(lat2Val) || isNaN(lon2Val)) {
        return 0;
    }

    const dLat = (lat2Val - lat1Val) * (Math.PI / 180);
    const dLon = (lon2Val - lon1Val) * (Math.PI / 180);

    const lat1 = lat1Val * (Math.PI / 180);
    const lat2 = lat2Val * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Formats a distance in km to a readable string (e.g., "500m", "2.5 km").
 */
export const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)} km`;
};

/**
 * Calculates the great-circle distance (Haversine) between two coordinate pairs,
 * validating bounds (-90..90 for lat, -180..180 for lng).
 * Returns null if any coordinate is missing or invalid.
 */
export const calculateApproximateDistance = (
    coord1?: { lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null } | null,
    coord2?: { lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null } | null
): number | null => {
    if (!coord1 || !coord2) return null;

    const lat1 = toFiniteNumber(coord1.lat ?? coord1.latitude);
    const lng1 = toFiniteNumber(coord1.lng ?? coord1.longitude);
    const lat2 = toFiniteNumber(coord2.lat ?? coord2.latitude);
    const lng2 = toFiniteNumber(coord2.lng ?? coord2.longitude);

    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
        return null;
    }

    if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90 || lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
        return null;
    }

    return calculateDistance({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 });
};

/**
 * Formats an approximate distance in km:
 * - below 1 km: meters (e.g. "≈ 650 m")
 * - 1 km or more: one decimal place with comma (e.g. "≈ 4,2 km")
 * Returns null if distance is invalid or negative.
 */
export const formatApproximateDistance = (distanceKm: number | null | undefined): string | null => {
    if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) {
        return null;
    }
    if (distanceKm < 1) {
        const meters = Math.round(distanceKm * 1000);
        return `≈ ${meters} m`;
    }
    const formattedKm = distanceKm.toFixed(1).replace('.', ',');
    return `≈ ${formattedKm} km`;
};

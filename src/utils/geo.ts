/**
 * File: src/utils/geo.ts
 * Purpose: Client-side geographical calculations for sorting and filtering.
 */

interface Coordinates {
    latitude: number;
    longitude: number;
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
    const dLat = (end.latitude - start.latitude) * (Math.PI / 180);
    const dLon = (end.longitude - start.longitude) * (Math.PI / 180);

    const lat1 = start.latitude * (Math.PI / 180);
    const lat2 = end.latitude * (Math.PI / 180);

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

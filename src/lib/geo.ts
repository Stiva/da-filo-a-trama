/**
 * Utility per l'estrazione delle coordinate da colonne PostGIS GEOGRAPHY.
 *
 * PostgREST puo restituire la colonna in formati diversi:
 *  - GeoJSON object: { type: "Point", coordinates: [lng, lat] }
 *  - GeoJSON string: stringa JSON parsabile
 *  - WKB/EWKB hex: stringa esadecimale binaria
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

const ZERO_COORDS: Coordinates = { latitude: 0, longitude: 0 };

/**
 * Estrae latitudine e longitudine da un valore PostGIS geography.
 * Gestisce GeoJSON (object o string) e WKB/EWKB hex.
 */
export const extractCoordinates = (coordinate: unknown): Coordinates => {
  if (!coordinate) return ZERO_COORDS;

  // Case 1: GeoJSON object — { type: "Point", coordinates: [lng, lat] }
  if (typeof coordinate === 'object' && coordinate !== null) {
    const geo = coordinate as { coordinates?: [number, number] };
    if (geo.coordinates) {
      return { latitude: geo.coordinates[1], longitude: geo.coordinates[0] };
    }
    return ZERO_COORDS;
  }

  if (typeof coordinate !== 'string') return ZERO_COORDS;

  // Case 2: GeoJSON string — tentativo di JSON.parse
  const trimmed = coordinate.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { coordinates?: [number, number] };
      if (parsed?.coordinates) {
        return { latitude: parsed.coordinates[1], longitude: parsed.coordinates[0] };
      }
    } catch {
      // Non e JSON valido, prosegui con WKB
    }
    return ZERO_COORDS;
  }

  // Case 3: WKB / EWKB hex
  // WKB Point:  byte_order(1) + type(4) + x(8) + y(8) = 21 bytes = 42 hex chars
  // EWKB Point: byte_order(1) + type_with_srid(4) + srid(4) + x(8) + y(8) = 25 bytes = 50 hex chars
  const hex = trimmed.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || (hex.length !== 42 && hex.length !== 50)) {
    return ZERO_COORDS;
  }

  try {
    const buf = Buffer.from(hex, 'hex');
    const littleEndian = buf.readUInt8(0) === 1;

    const wkbType = littleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSRID = (wkbType & 0x20000000) !== 0;
    const geomType = wkbType & 0xff;

    // geomType 1 = Point
    if (geomType !== 1) return ZERO_COORDS;

    const coordOffset = 5 + (hasSRID ? 4 : 0); // 1 (byte order) + 4 (type) + optional 4 (SRID)

    const x = littleEndian
      ? buf.readDoubleLE(coordOffset)
      : buf.readDoubleBE(coordOffset);
    const y = littleEndian
      ? buf.readDoubleLE(coordOffset + 8)
      : buf.readDoubleBE(coordOffset + 8);

    // PostGIS convention: x = longitude, y = latitude
    return { latitude: y, longitude: x };
  } catch {
    return ZERO_COORDS;
  }
};

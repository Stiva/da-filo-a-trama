-- ============================================
-- MIGRAZIONE 041: Aree POI (Points of Interest with Polygons)
-- ============================================

-- 1. Add polygon and color columns
ALTER TABLE public.poi 
ADD COLUMN IF NOT EXISTS area_polygon GEOMETRY(Geometry, 4326),
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6';

-- 2. Create a trigger to automatically update the 'coordinate' (the POINT used for distance tracking/standard markers)
-- based on the centroid of the area_polygon, if present.
CREATE OR REPLACE FUNCTION update_poi_coordinate_from_polygon()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.area_polygon IS NOT NULL THEN
        -- ST_Centroid works on GEOMETRY. NEW.coordinate is GEOGRAPHY(POINT, 4326).
        NEW.coordinate := ST_Centroid(NEW.area_polygon)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_poi_coordinate_from_polygon ON public.poi;
CREATE TRIGGER calc_poi_coordinate_from_polygon
    BEFORE INSERT OR UPDATE OF area_polygon ON public.poi
    FOR EACH ROW
    EXECUTE FUNCTION update_poi_coordinate_from_polygon();

-- 3. Add 'area' to the allowed types if we restrict via CHECK
-- Currently poi.tipo is a CHECK constraint. We might need to drop and recreate it if we specifically want an 'area' POI,
-- although the user said "Aree are a specific type of POI", they also requested "icon" as a field and "color".
-- We can just let areas have any of the existing types (stage, food, etc), or we could add 'area' to the list.
-- The user spec: icon: string // nome icona (es. "tree", "parking", "pool")
-- Our existing types cover a lot. Let's add 'area' as a generic type just in case.

ALTER TABLE public.poi DROP CONSTRAINT IF EXISTS poi_tipo_check;
ALTER TABLE public.poi ADD CONSTRAINT poi_tipo_check CHECK (tipo IN (
    'stage',
    'food',
    'toilet',
    'medical',
    'info',
    'camping',
    'parking',
    'worship',
    'activity',
    'entrance',
    'area',   -- Added this generic one
    'other'
));

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AdminDrawToolsProps {
  onShapeCreated: (layer: L.Layer, geojson: any) => void;
  onShapeEdited: (layer: L.Layer, geojson: any, id: string) => void;
  onShapeDeleted: (id: string) => void;
  editableLayerRef: React.MutableRefObject<L.FeatureGroup | null>;
}

export default function AdminDrawTools({ onShapeCreated, onShapeEdited, onShapeDeleted, editableLayerRef }: AdminDrawToolsProps) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!map || initialized.current) return;
    initialized.current = true;

    // Create a feature group for drawn items if not already passed
    if (!editableLayerRef.current) {
        editableLayerRef.current = new L.FeatureGroup();
        // We'll let the AreaLayer render the actual POIs, but newly drawn/edited shapes will be here until saved
    }
    
    // Add edit layer to map
    map.addLayer(editableLayerRef.current);

    // Setup Geoman interface
    map.pm.addControls({
      position: 'topleft',
      drawPolygon: true,
      drawRectangle: true,
      drawMarker: false, 
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    });

    // Language
    map.pm.setLang('it');

    // Global listener for new shapes
    map.on('pm:create', (e) => {
      const layer = e.layer;
      
      // Optionally add the layer to our feature group so we can manage it
      if (editableLayerRef.current) {
         editableLayerRef.current.addLayer(layer);
      }

      const geojson = (layer as any).toGeoJSON().geometry;
      onShapeCreated(layer, geojson);
    });

    map.on('pm:remove', (e) => {
        const layer = e.layer as any;
        const id = layer.options?.poiId; // We need to inject this during rendering editable layers
        if (id) {
            onShapeDeleted(id);
        }
    });

    // Cleanup
    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('pm:remove');
      if (editableLayerRef.current) {
          map.removeLayer(editableLayerRef.current);
      }
    };
  }, [map, onShapeCreated, onShapeEdited, onShapeDeleted, editableLayerRef]);

  // Hook up edit listeners on the editableLayer group
  useEffect(() => {
      if (!editableLayerRef.current) return;

      const layerGrp = editableLayerRef.current;

      layerGrp.on('pm:edit', (e: any) => {
          const layer = e.layer;
          const geojson = layer.toGeoJSON().geometry;
          const id = layer.options?.poiId;
          
          if (id) {
              onShapeEdited(layer, geojson, id);
          }
      });

      return () => {
          layerGrp.off('pm:edit');
      };
  }, [editableLayerRef, onShapeEdited]);

  return null;
}

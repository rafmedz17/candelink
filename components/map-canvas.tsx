"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { Coordinates, MapBounds, MapPin } from "@/lib/maps";
import { CANDELARIA_CENTER } from "@/lib/maps";

type Props = {
  pins?: MapPin[];
  selectedId?: string | null;
  initialPosition?: Coordinates;
  pickerPoint?: Coordinates | null;
  focusPoint?: Coordinates | null;
  onPick?: (point: Coordinates) => void;
  onSelect?: (id: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
};

export function MapCanvas({
  pins,
  selectedId,
  initialPosition,
  pickerPoint,
  focusPoint,
  onPick,
  onSelect,
  onBoundsChange,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<Leaflet.Map | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const initial = useRef(initialPosition ?? pickerPoint ?? CANDELARIA_CENTER);
  const handlers = useRef({ onPick, onSelect, onBoundsChange });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    handlers.current = { onPick, onSelect, onBoundsChange };
  }, [onPick, onSelect, onBoundsChange]);

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !element.current) return;
        leaflet.current = L;
        map = L.map(element.current, {
          scrollWheelZoom: false,
          maxBounds: [
            [-85, -180],
            [85, 180],
          ],
          maxBoundsViscosity: 1,
        }).setView([initial.current.latitude, initial.current.longitude], 14);
        instance.current = map;
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            noWrap: true,
          },
        )
          .on("tileerror", () => {
            if (!disposed) setTileError(true);
          })
          .on("tileload", () => {
            if (!disposed) setTileError(false);
          })
          .addTo(map);
        function reportBounds() {
          if (!map) return;
          const b = map.getBounds();
          handlers.current.onBoundsChange?.({
            south: Math.max(-90, b.getSouth()),
            north: Math.min(90, b.getNorth()),
            west: Math.max(-180, b.getWest()),
            east: Math.min(180, b.getEast()),
          });
        }
        map.on("moveend", reportBounds);
        map.on("click", (event: Leaflet.LeafletMouseEvent) =>
          handlers.current.onPick?.({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          }),
        );
        resize = new ResizeObserver(() => map?.invalidateSize());
        resize.observe(element.current);
        setReady(true);
        reportBounds();
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map?.remove();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current,
      map = instance.current;
    if (!ready || !L || !map) return;
    const layer = L.layerGroup().addTo(map);
    for (const pin of pins ?? []) {
      const selected = pin.id === selectedId;
      const icon = L.divIcon({
        className: `opportunity-map-pin ${selected ? "is-selected" : ""}`,
        html: `<span><b>${pin.count ?? 1}</b></span>`,
        iconSize: [38, 44],
        iconAnchor: [19, 44],
      });
      L.marker([pin.latitude, pin.longitude], {
        icon,
        title: pin.label,
        alt: pin.label,
        keyboard: true,
      })
        .on("click", () => handlers.current.onSelect?.(pin.id))
        .addTo(layer);
    }
    if (pickerPoint) {
      const icon = L.divIcon({
        className: "business-map-pin",
        html: '<span aria-hidden="true"></span>',
        iconSize: [34, 44],
        iconAnchor: [17, 44],
      });
      const marker = L.marker([pickerPoint.latitude, pickerPoint.longitude], {
        icon,
        draggable: true,
        title: "Business location pin",
        alt: "Business location pin",
      }).addTo(layer);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        handlers.current.onPick?.({ latitude: p.lat, longitude: p.lng });
      });
    }
    return () => {
      layer.remove();
    };
  }, [ready, pins, selectedId, pickerPoint]);

  useEffect(() => {
    if (ready && focusPoint)
      instance.current?.setView(
        [focusPoint.latitude, focusPoint.longitude],
        Math.max(15, instance.current.getZoom()),
        { animate: false },
      );
  }, [ready, focusPoint]);

  return (
    <div className="map-canvas-shell">
      <div
        ref={element}
        className="map-canvas"
        role="region"
        aria-label={
          onPick
            ? "Choose business location on map"
            : "Map of job opportunities"
        }
      />
      {!ready && (
        <p className="map-overlay" role="status">
          {failed
            ? "The interactive map could not be loaded. Please refresh the page."
            : "Loading map…"}
        </p>
      )}
      {tileError && (
        <p className="map-tile-status" role="status">
          Some map imagery could not load. Your location and listing controls
          still work.
        </p>
      )}
    </div>
  );
}

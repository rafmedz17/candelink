"use client";

import { useFeedback } from "./use-feedback";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Trash2 } from "lucide-react";
import { MapCanvas } from "./map-canvas";
import { mapLocationSchema } from "@/lib/validation";
import { saveBusinessLocation } from "@/app/map-actions";
import type { Coordinates } from "@/lib/maps";
import type { Result } from "@/app/actions";

export function BusinessLocationPicker({
  businessId,
  latitude,
  longitude,
}: {
  businessId: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const router = useRouter();
  const [lat, setLat] = useState(latitude == null ? "" : String(latitude));
  const [lng, setLng] = useState(longitude == null ? "" : String(longitude));
  const [focus, setFocus] = useState<Coordinates | null>(null);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [, setResult] = useFeedback<Result>();
  const point = useMemo(() => {
    if (!lat || !lng) return null;
    const p = mapLocationSchema.safeParse({
      latitude: Number(lat),
      longitude: Number(lng),
    });
    return p.success && p.data.latitude !== null && p.data.longitude !== null
      ? (p.data as Coordinates)
      : null;
  }, [lat, lng]);
  function choose(p: Coordinates) {
    setLat(p.latitude.toFixed(6));
    setLng(p.longitude.toFixed(6));
    setResult(null);
  }
  async function save(remove = false) {
    if (!remove && !point) {
      setResult({
        ok: false,
        message:
          "Choose a pin on the map or enter valid latitude and longitude.",
      });
      return;
    }
    setPending(true);
    try {
      const r = await saveBusinessLocation(
        businessId,
        remove ? null : point!.latitude,
        remove ? null : point!.longitude,
      );
      setResult(r);
      if (r.ok) {
        if (remove) {
          setLat("");
          setLng("");
        }
        router.refresh();
      }
    } catch {
      setResult({
        ok: false,
        message: "Your location could not be saved. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setResult({
        ok: false,
        message:
          "Location access is unavailable. Choose a pin manually instead.",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { latitude: coords.latitude, longitude: coords.longitude };
        choose(p);
        setFocus(p);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setResult({
          ok: false,
          message:
            "Couldn't get your location. You can still click the map or enter coordinates.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <section className="panel business-location-picker">
      <h2>
        <MapPin size={21} aria-hidden="true" /> Pin your business location
      </h2>
      <p>
        Click the map or drag the pin to your business entrance. Your published
        opportunities will use this location on the public map.
      </p>
      <MapCanvas
        pickerPoint={point}
        onPick={pending ? undefined : choose}
        focusPoint={focus}
      />
      <form
        className="map-location-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="map-coordinate-fields">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              disabled={pending}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              disabled={pending}
            />
          </label>
        </div>
        <div className="map-location-actions">
          <button
            type="button"
            className="button outline small"
            onClick={locate}
            disabled={pending || locating}
          >
            <LocateFixed size={16} aria-hidden="true" />
            {locating ? "Finding your location…" : "Use my current location"}
          </button>
          {point && (
            <button
              type="button"
              className="button outline small"
              onClick={() => setFocus({ ...point })}
            >
              Center on pin
            </button>
          )}
          <button className="button" disabled={pending || locating}>
            {pending ? "Saving…" : "Save business location"}
          </button>
          {latitude != null && longitude != null && (
            <button
              type="button"
              className="button outline small"
              disabled={pending || locating}
              onClick={() => void save(true)}
            >
              <Trash2 size={15} aria-hidden="true" />
              Remove pin
            </button>
          )}
        </div>
      </form>
      <p className="map-location-help">
        Confirm the pin is at your business before saving. It will be public
        when your business is verified and has an open published job.
      </p>
    </section>
  );
}

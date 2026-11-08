"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Coordinates } from "@/lib/maps";
const MapCanvas = dynamic(
  () => import("./map-canvas").then((m) => m.MapCanvas),
  { ssr: false, loading: () => <p role="status">Loading map...</p> },
);
export type DraftPin = { latitude: string; longitude: string };
export function BusinessMapField({
  value,
  onChange,
  disabled,
}: {
  value: DraftPin;
  onChange: (pin: DraftPin) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [focus, setFocus] = useState<Coordinates | null>(null);
  const point =
    value.latitude !== "" &&
    value.longitude !== "" &&
    Number.isFinite(Number(value.latitude)) &&
    Number.isFinite(Number(value.longitude)) &&
    Math.abs(Number(value.latitude)) <= 90 &&
    Math.abs(Number(value.longitude)) <= 180
      ? { latitude: Number(value.latitude), longitude: Number(value.longitude) }
      : null;
  function choose(pin: Coordinates) {
    onChange({
      latitude: pin.latitude.toFixed(6),
      longitude: pin.longitude.toFixed(6),
    });
    setError("");
  }
  return (
    <div className="owner-map-field">
      <p>
        Choose your business entrance. This optional pin helps people find your
        published jobs on the map.
      </p>
      <MapCanvas
        pickerPoint={point}
        onPick={disabled ? undefined : choose}
        focusPoint={focus}
      />
      <div className="owner-map-actions">
        <button
          className="button outline"
          type="button"
          disabled={disabled || locating}
          onClick={() => {
            if (!navigator.geolocation) {
              setError(
                "Location access is unavailable. Choose a pin on the map instead.",
              );
              return;
            }
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              ({ coords }) => {
                const pin = {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                };
                choose(pin);
                setFocus(pin);
                setLocating(false);
              },
              () => {
                setError(
                  "Couldn't access your location. You can choose a pin manually.",
                );
                setLocating(false);
              },
              { timeout: 10000 },
            );
          }}
        >
          {locating ? "Finding location..." : "Use my location"}
        </button>
        {(value.latitude || value.longitude) && (
          <button
            className="button outline"
            type="button"
            disabled={disabled}
            onClick={() => onChange({ latitude: "", longitude: "" })}
          >
            Remove pin
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>Advanced: enter coordinates</summary>
        <div className="owner-field-grid">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={value.latitude}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, latitude: e.target.value })}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={value.longitude}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...value, longitude: e.target.value })
              }
            />
          </label>
        </div>
      </details>
      <p className="owner-help">
        Your pin saves with the business details below.
      </p>
    </div>
  );
}

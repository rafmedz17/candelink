"use client";

import { useEffect, useRef, useState } from "react";

export function PhotoCropDialog({
  file,
  pending,
  onSave,
  onCancel,
}: {
  file: File;
  pending: boolean;
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const busy = pending || exporting;

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const url = URL.createObjectURL(file);
    const photo = new window.Image();
    photo.onload = () => setImage(photo);
    photo.onerror = () =>
      setError("This photo could not be opened. Choose another JPEG or PNG.");
    photo.src = url;
    return () => {
      URL.revokeObjectURL(url);
      element.close();
    };
  }, [file]);

  function draw(context: CanvasRenderingContext2D, size: number) {
    if (!image) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const left = ((image.naturalWidth - side) * (position.x + 1)) / 2;
    const top = ((image.naturalHeight - side) * (position.y + 1)) / 2;
    context.fillStyle = "white";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, left, top, side, side, 0, 0, size, size);
  }

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) draw(context, 560);
  });

  async function save() {
    if (!image || busy) return;
    setExporting(true);
    setError("");
    try {
      const output = document.createElement("canvas");
      output.width = output.height = 800;
      const context = output.getContext("2d");
      if (!context) throw new Error();
      draw(context, 800);
      const blob = await new Promise<Blob>((resolve, reject) =>
        output.toBlob(
          (value) => (value ? resolve(value) : reject(new Error())),
          "image/jpeg",
          0.9,
        ),
      );
      await onSave(
        new File([blob], "profile-photo.jpg", { type: "image/jpeg" }),
      );
    } catch {
      setError("The photo could not be saved. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return (
    <dialog
      ref={dialog}
      className="photo-crop-dialog"
      aria-labelledby="photo-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="photo-crop-title">Adjust your photo</h2>
      <p>Drag the photo and adjust the zoom to fit the circle.</p>
      <canvas
        ref={canvas}
        width={560}
        height={560}
        className="photo-crop-preview"
        aria-label="Circular photo preview"
        onPointerDown={(event) => {
          if (!image || busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: position.x,
            top: position.y,
          };
        }}
        onPointerMove={(event) => {
          if (!drag.current || !image || busy) return;
          const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
          const scale =
            event.currentTarget.getBoundingClientRect().width / side;
          const horizontal = (image.naturalWidth - side) * scale;
          const vertical = (image.naturalHeight - side) * scale;
          setPosition({
            x: horizontal
              ? clamp(
                  drag.current.left -
                    (2 * (event.clientX - drag.current.x)) / horizontal,
                )
              : 0,
            y: vertical
              ? clamp(
                  drag.current.top -
                    (2 * (event.clientY - drag.current.y)) / vertical,
                )
              : 0,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      <div className="photo-crop-controls">
        <label>
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={busy || !image}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <label>
          Horizontal position
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={position.x}
            disabled={busy || !image}
            onChange={(event) =>
              setPosition({ ...position, x: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Vertical position
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={position.y}
            disabled={busy || !image}
            onChange={(event) =>
              setPosition({ ...position, y: Number(event.target.value) })
            }
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      <div className="photo-crop-actions">
        <button
          type="button"
          className="button outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button"
          disabled={busy || !image}
          onClick={save}
        >
          {busy ? "Saving photo..." : "Use photo"}
        </button>
      </div>
    </dialog>
  );
}

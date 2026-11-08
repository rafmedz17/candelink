"use client";
import { useErrorFeedback } from "./use-feedback";

import { useEffect, useRef, useState } from "react";

export function PhotoCropDialog({
  file,
  pending,
  onSave,
  onCancel,
  variant = "avatar",
}: {
  file: File;
  variant?: "avatar" | "cover";
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
  const setError = useErrorFeedback();
  const [exporting, setExporting] = useState(false);
  const busy = pending || exporting;
  const cover = variant === "cover";
  const aspect = cover ? 3 : 1;
  const cropWidth = image
    ? Math.min(image.naturalWidth, image.naturalHeight * aspect) / zoom
    : 0;
  const cropHeight = cropWidth / aspect;

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
  }, [file, setError]);

  function draw(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    if (!image) return;
    const left = ((image.naturalWidth - cropWidth) * (position.x + 1)) / 2;
    const top = ((image.naturalHeight - cropHeight) * (position.y + 1)) / 2;
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      left,
      top,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );
  }

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) draw(context, 560, Math.round(560 / aspect));
  });

  async function save() {
    if (!image || busy) return;
    setExporting(true);
    setError("");
    try {
      const output = document.createElement("canvas");
      output.width = cover ? 1600 : 800;
      output.height = Math.round(output.width / aspect);
      const context = output.getContext("2d");
      if (!context) throw new Error();
      draw(context, output.width, output.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        output.toBlob(
          (value) => (value ? resolve(value) : reject(new Error())),
          "image/jpeg",
          0.9,
        ),
      );
      await onSave(
        new File(
          [blob],
          cover ? "business-background.jpg" : "profile-photo.jpg",
          { type: "image/jpeg" },
        ),
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
      className={`photo-crop-dialog ${cover ? "background-crop-dialog" : ""}`}
      aria-labelledby="photo-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="photo-crop-title">
        {cover ? "Crop background photo" : "Adjust your photo"}
      </h2>
      <p>
        {cover
          ? "Drag and zoom to frame your business background."
          : "Drag the photo and adjust the zoom to fit the circle."}
      </p>
      <canvas
        ref={canvas}
        width={560}
        height={Math.round(560 / aspect)}
        className={`photo-crop-preview ${cover ? "photo-crop-preview-cover" : ""}`}
        aria-label={
          cover ? "Background photo crop preview" : "Circular photo preview"
        }
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

          const scale =
            event.currentTarget.getBoundingClientRect().width / cropWidth;
          const horizontal = (image.naturalWidth - cropWidth) * scale;
          const vertical = (image.naturalHeight - cropHeight) * scale;
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

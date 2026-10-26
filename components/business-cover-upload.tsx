"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { businessPhoto } from "@/app/business/photo-actions";
import { usePhotoTask } from "./photo-save-context";
import { useFeedback } from "./use-feedback";

function DraftPhoto({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element -- Local file preview.
  return <img src={url} alt="Unsaved background photo" />;
}
export function BusinessCoverUpload({
  businessId,
  paths,
}: {
  businessId: string;
  paths: string[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(paths);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useFeedback();
  const visible = saved.filter((path) => !removed.includes(path));
  const dirty = files.length > 0 || removed.length > 0;
  async function save() {
    setPending(true);
    setResult(null);
    try {
      for (const path of removed) {
        const data = new FormData();
        data.set("business_id", businessId);
        data.set("remove", "true");
        data.set("path", path);
        const response = await businessPhoto(data);
        if (!response.ok) throw new Error(response.message);
        setSaved((current) => current.filter((item) => item !== path));
        setRemoved((current) => current.filter((item) => item !== path));
      }
      for (const file of files) {
        const data = new FormData();
        data.set("business_id", businessId);
        data.set("file", file);
        const response = await businessPhoto(data);
        if (!response.ok) throw new Error(response.message);
        setFiles((current) => current.filter((item) => item !== file));
      }
      if (!photoSave) {
        setResult({ ok: true, message: "Your changes have been saved." });
        router.refresh();
      }
    } catch (error) {
      if (photoSave) throw error;
      setResult({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Photos could not be saved. Please try again.",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  const photoSave = usePhotoTask(`business:${businessId}`, dirty, save);
  const locked = pending || Boolean(photoSave?.busy);
  const [previousPaths, setPreviousPaths] = useState(paths);
  if (paths !== previousPaths) {
    setPreviousPaths(paths);
    setSaved(paths);
  }
  return (
    <section className="panel">
      <h2>Background photos (optional)</h2>
      <p>
        Add up to six JPEG or PNG photos, up to 5 MB each. Multiple photos
        automatically slide on your public business profile. Select photos, then
        save your changes.
      </p>
      <div className="business-photo-previews">
        {visible.map((path, index) => (
          <div key={path}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Configured Storage image. */}
            <img
              src={
                process.env.NEXT_PUBLIC_SUPABASE_URL +
                "/storage/v1/object/public/avatars/" +
                path
              }
              alt={"Background photo " + (index + 1)}
            />
            <button
              type="button"
              className="button outline"
              disabled={locked}
              onClick={() => {
                setRemoved((current) => [...current, path]);
                setResult(null);
              }}
            >
              Remove photo {index + 1}
            </button>
          </div>
        ))}
        {files.map((file, index) => (
          <div key={file.name + file.lastModified + index}>
            <DraftPhoto file={file} />
            <small>Not saved yet</small>
            <button
              type="button"
              className="button outline"
              disabled={locked}
              onClick={() =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
            >
              Remove selected photo {index + 1}
            </button>
          </div>
        ))}
      </div>
      <label className="upload-field">
        Add background photos
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png"
          disabled={locked || visible.length + files.length >= 6}
          onChange={(event) => {
            const selected = Array.from(event.target.files || []);
            event.target.value = "";
            setResult(null);
            if (visible.length + files.length + selected.length > 6) {
              setResult({
                ok: false,
                message: "Choose no more than six background photos in total.",
              });
              return;
            }
            if (
              selected.some(
                (file) =>
                  !["image/jpeg", "image/png"].includes(file.type) ||
                  file.size > 5 * 1024 * 1024,
              )
            ) {
              setResult({
                ok: false,
                message: "Choose JPEG or PNG photos up to 5 MB each.",
              });
              return;
            }
            setFiles((current) => [...current, ...selected]);
          }}
        />
      </label>
      <div className="photo-crop-actions">
        {!photoSave && (
          <button
            type="button"
            className="button"
            disabled={locked || !dirty}
            onClick={save}
          >
            {pending ? "Saving photos..." : "Save changes"}
          </button>
        )}
        {dirty && (
          <button
            type="button"
            className="button outline"
            disabled={locked}
            onClick={() => {
              setFiles([]);
              setRemoved([]);
              setResult(null);
            }}
          >
            Discard changes
          </button>
        )}
      </div>
      {result && (
        <p
          className={"form-message " + (result.ok ? "" : "error")}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}

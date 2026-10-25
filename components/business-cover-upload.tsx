"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { businessPhoto } from "@/app/business/photo-actions";
import type { Result } from "@/app/actions";

export function BusinessCoverUpload({
  businessId,
  paths,
}: {
  businessId: string;
  paths: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <section className="panel">
      <h2>Background photos (optional)</h2>
      <p>
        Add up to six JPEG or PNG photos, up to 5 MB each. Multiple photos
        automatically slide on your public business profile.
      </p>
      <div className="business-photo-previews">
        {paths.map((path, index) => (
          <div key={path}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded images are served by the configured public Storage bucket. */}
            <img
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`}
              alt={`Background photo ${index + 1}`}
            />
            <button
              className="button outline"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  const data = new FormData();
                  data.set("business_id", businessId);
                  data.set("remove", "true");
                  data.set("path", path);
                  setResult(await businessPhoto(data));
                  router.refresh();
                } catch {
                  setResult({
                    ok: false,
                    message:
                      "Photo could not be removed. Check your connection and try again.",
                  });
                } finally {
                  setPending(false);
                }
              }}
            >
              Remove photo {index + 1}
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
          disabled={pending || paths.length >= 6}
          onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (!files.length) return;
            if (paths.length + files.length > 6) {
              setResult({
                ok: false,
                message: "Choose no more than six background photos in total.",
              });
              return;
            }
            setPending(true);
            let added = 0;
            try {
              for (const file of files) {
                const data = new FormData();
                data.set("business_id", businessId);
                data.set("file", file);
                const r = await businessPhoto(data);
                if (!r.ok) {
                  setResult({
                    ok: false,
                    message: `${added ? `${added} photo(s) added. ` : ""}${r.message}`,
                  });
                  return;
                }
                added++;
              }
              setResult({
                ok: true,
                message: `${added} background photo(s) added.`,
              });
            } catch {
              setResult({
                ok: false,
                message:
                  "Upload interrupted. Refresh to check saved photos and try again.",
              });
            } finally {
              setPending(false);
              router.refresh();
            }
          }}
        />
      </label>
      {pending && <p role="status">Saving photos…</p>}
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}

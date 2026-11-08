/* eslint-disable @next/next/no-img-element -- Private local draft previews cannot use image optimization. */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { businessSchema, mapLocationSchema } from "@/lib/validation";
import type { OwnerBusiness } from "@/lib/business";
import { mutate } from "@/app/actions";
import { saveBusinessLocation } from "@/app/map-actions";
import { PhotoUpload } from "./forms";
import { BusinessCoverUpload } from "./business-cover-upload";
import { BusinessMapField, type DraftPin } from "./business-map-field";
import { usePhotoSave, useUnsavedForm } from "./photo-save-context";
import { useFeedback } from "./use-feedback";

type Values = {
  name: string;
  category: string;
  address: string;
  description: string;
  operating_details: string;
  public_email: string;
  public_phone: string;
};
const emptyPhotos: string[] = [];
const imageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
function DraftPreview({
  values,
  logo,
  paths,
  files,
  close,
}: {
  values: Values;
  logo: string | null;
  paths: string[];
  files: File[];
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const readers: FileReader[] = [];
    void Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            readers.push(reader);
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((next) => {
      if (active) setUrls(next);
    });
    return () => {
      active = false;
      readers.forEach((r) => {
        if (r.readyState === FileReader.LOADING) r.abort();
      });
    };
  }, [files]);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  const images = [
    ...paths.map(imageUrl),
    ...urls.slice(logo === "draft" ? 1 : 0),
  ];
  const logoSource =
    logo === null ? null : logo === "draft" ? urls[0] : imageUrl(logo);
  return (
    <dialog
      ref={dialog}
      className="owner-profile-preview"
      aria-labelledby="owner-preview-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="owner-preview-heading">
        <div>
          <span className="badge">Unsaved preview</span>
          <h2 id="owner-preview-title">Business profile preview</h2>
          <p>This preview is private. Your changes have not been published.</p>
        </div>
        <button type="button" className="button outline" onClick={close}>
          Close preview
        </button>
      </div>
      <div
        className="owner-preview-cover"
        style={
          images[0]
            ? {
                backgroundImage: `linear-gradient(transparent,rgba(0,0,0,.7)),url("${images[0]}")`,
              }
            : undefined
        }
      >
        {logoSource && <img src={logoSource} alt="Business logo preview" />}
        <div>
          <h3>{values.name || "Your business name"}</h3>
          <p>
            {values.category || "Category"} |{" "}
            {values.address || "Business address"}
          </p>
        </div>
      </div>
      {(values.description || values.operating_details) && (
        <section className="panel">
          <h3>About the business</h3>
          <p>{values.description}</p>
          <p>{values.operating_details}</p>
        </section>
      )}
      {(values.public_email || values.public_phone) && (
        <section className="panel">
          <h3>Contact this business</h3>
          <p>{values.public_email}</p>
          <p>{values.public_phone}</p>
        </section>
      )}
      {images.length > 1 && (
        <div className="owner-preview-thumbnails">
          {images.map((src, index) => (
            <img
              src={src}
              alt={`Background preview ${index + 1}`}
              key={index}
            />
          ))}
        </div>
      )}
    </dialog>
  );
}
export function BusinessEditor({ business }: { business?: OwnerBusiness }) {
  const router = useRouter();
  const photoSave = usePhotoSave();
  const [, feedback] = useFeedback();
  const [defaults] = useState<Values>(() => ({
    name: business?.name || "",
    category: business?.category || "",
    address: business?.address || "",
    description: business?.description || "",
    operating_details: business?.operating_details || "",
    public_email: business?.public_email || "",
    public_phone: business?.public_phone || "",
  }));
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    defaultValues: defaults,
    resolver: async (input) => {
      const parsed = businessSchema.safeParse(input);
      return parsed.success
        ? { values: parsed.data, errors: {} }
        : {
            values: {},
            errors: Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                { type: "validate", message: issue.message },
              ]),
            ),
          };
    },
  });
  const values = useWatch({ control }) as Values;
  const initialPin = useRef<DraftPin>({
    latitude: business?.latitude == null ? "" : String(business.latitude),
    longitude: business?.longitude == null ? "" : String(business.longitude),
  });
  const [pin, setPin] = useState(initialPin.current);
  const [mapOpen, setMapOpen] = useState(Boolean(initialPin.current.latitude));
  const [progress, setProgress] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pinError, setPinError] = useState("");
  const [preview, setPreview] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [savedLogo, setSavedLogo] = useState(business?.logo_path || null);
  const [covers, setCovers] = useState<{ paths: string[]; files: File[] }>({
    paths: business?.cover_paths || emptyPhotos,
    files: [],
  });
  const onLogo = useCallback(
    (file: File | null, removed = false, savedPath?: string | null) => {
      setLogo(file);
      setLogoRemoved(removed);
      setSavedLogo(savedPath || null);
    },
    [],
  );
  const onCovers = useCallback(
    (paths: string[], files: File[]) => setCovers({ paths, files }),
    [],
  );
  const draftFiles = useMemo(
    () => (logo ? [logo, ...covers.files] : covers.files),
    [logo, covers.files],
  );
  const scope = `business:${business?.id || "new"}`;
  const photosDirty = Boolean(photoSave?.dirty[scope]);
  const pinDirty = JSON.stringify(pin) !== JSON.stringify(initialPin.current);
  const dirty = isDirty || photosDirty || pinDirty;
  const inFlight = useRef(false);
  const created = useRef<string | undefined>(business?.id);
  const busy = Boolean(progress) || Boolean(photoSave?.busy);
  const form = useRef<HTMLFormElement>(null);
  const cancelHref = business
    ? `/business/dashboard?tab=overview&business=${business.id}`
    : "/business/dashboard";
  function focusError(name: string) {
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(),
    );
  }
  async function save(input: Values, navigate = true) {
    if (inFlight.current)
      throw new Error("Please wait for the current save to finish.");
    clearErrors();
    setSaveError("");
    setPinError("");
    const parsed = businessSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        setError(String(issue.path[0]) as keyof Values, {
          message: issue.message,
        });
      focusError(String(parsed.error.issues[0].path[0]));
      throw new Error("Check the highlighted business details.");
    }
    const location = mapLocationSchema.safeParse({
      latitude: pin.latitude === "" ? null : Number(pin.latitude),
      longitude: pin.longitude === "" ? null : Number(pin.longitude),
    });
    if (!location.success) {
      setPinError(
        "Choose valid latitude and longitude together, or remove the pin.",
      );
      setMapOpen(true);
      throw new Error("Check your map pin.");
    }
    inFlight.current = true;
    setProgress("Saving business details...");
    try {
      const response = await mutate("business", {
        ...parsed.data,
        ...(created.current ? { id: created.current } : {}),
      });
      if (!response.ok || !response.businessId)
        throw new Error(response.message);
      created.current = response.businessId;
      if (pinDirty) {
        setProgress("Saving map location...");
        const r = await saveBusinessLocation(
          created.current,
          location.data.latitude,
          location.data.longitude,
        );
        if (!r.ok) throw new Error(r.message);
        initialPin.current = { ...pin };
      }
      if (photosDirty) {
        setProgress("Saving photos...");
        await photoSave!.save(scope, created.current);
      }
      reset(parsed.data);
      feedback({
        ok: true,
        message: business
          ? "Your business changes have been saved."
          : "Business created and sent for admin review.",
      });
      if (navigate) {
        router.push(
          `/business/dashboard?tab=overview&business=${created.current}`,
        );
        router.refresh();
      }
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Please check your connection and retry.";
      const message =
        created.current && !business
          ? `Your business was created, but some changes still need saving. ${detail} Retry here to finish saving the same business.`
          : detail;
      setSaveError(message);
      feedback({ ok: false, message });
      throw error;
    } finally {
      inFlight.current = false;
      setProgress("");
    }
  }
  useUnsavedForm(dirty, async () => {
    await save(values, false);
  });
  function input(
    name: keyof Values,
    label: string,
    maxLength: number,
    type = "text",
    required = false,
  ) {
    const id = `business-${name}`;
    return (
      <label htmlFor={id}>
        {label}
        {required && <span className="owner-required"> Required</span>}
        <input
          id={id}
          type={type}
          {...register(name)}
          maxLength={maxLength}
          disabled={busy}
          aria-required={required}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${id}-error` : undefined}
        />
        {errors[name] && (
          <span id={`${id}-error`} className="owner-field-error">
            {errors[name]?.message}
          </span>
        )}
      </label>
    );
  }
  function textarea(
    name: "description" | "operating_details",
    label: string,
    maxLength: number,
  ) {
    return (
      <label htmlFor={`business-${name}`}>
        {label}
        <textarea
          id={`business-${name}`}
          {...register(name)}
          maxLength={maxLength}
          rows={4}
          disabled={busy}
          aria-invalid={!!errors[name]}
        />
        {errors[name] && (
          <span className="owner-field-error">{errors[name]?.message}</span>
        )}
      </label>
    );
  }
  return (
    <div className="owner-business-editor">
      <form
        ref={form}
        noValidate
        onSubmit={(e) => {
          void handleSubmit((v) => save(v))(e).catch(() => {});
        }}
      >
        <section className="panel owner-editor-section">
          <div className="owner-section-heading">
            <span>01</span>
            <div>
              <h2>Business essentials</h2>
              <p>Only these three fields are required.</p>
            </div>
          </div>
          <div className="owner-field-grid">
            {input("name", "Business name", 120, "text", true)}
            {input("category", "Category", 100, "text", true)}
            <div className="owner-field-wide">
              {input("address", "Business address", 300, "text", true)}
            </div>
          </div>
        </section>
        <details
          className="panel owner-editor-section"
          open={
            Boolean(
              defaults.description ||
              defaults.operating_details ||
              errors.description ||
              errors.operating_details,
            ) || undefined
          }
        >
          <summary>
            About your business <span>Optional</span>
          </summary>
          <div className="owner-section-content">
            {textarea("description", "About the business", 5000)}
            {textarea("operating_details", "Operating details and hours", 2000)}
          </div>
        </details>
        <details
          className="panel owner-editor-section"
          open={
            Boolean(
              defaults.public_email ||
              defaults.public_phone ||
              errors.public_email ||
              errors.public_phone,
            ) || undefined
          }
        >
          <summary>
            Public contact information <span>Optional</span>
          </summary>
          <div className="owner-section-content">
            <p>
              Any email or phone number you enter here will appear on your
              public business profile. You can leave both blank.
            </p>
            <div className="owner-field-grid">
              {input("public_email", "Public email", 254, "email")}
              {input("public_phone", "Public phone number", 40, "tel")}
            </div>
          </div>
        </details>
        <details
          className="panel owner-editor-section"
          open={
            Boolean(
              business?.logo_path ||
              business?.cover_paths.length ||
              photosDirty,
            ) || undefined
          }
        >
          <summary>
            Logo and background photos <span>Optional</span>
          </summary>
          <div className="owner-section-content">
            <p>
              Add a logo or photos to help people recognize your business. These
              are not required for verification.
            </p>
            <PhotoUpload
              path={business?.logo_path || undefined}
              businessId={business?.id || "new"}
              onDraftChange={onLogo}
              controlsDisabled={busy}
              deferRemoval
            />
            <BusinessCoverUpload
              businessId={business?.id || "new"}
              paths={business?.cover_paths || emptyPhotos}
              onDraftChange={onCovers}
              controlsDisabled={busy}
            />
          </div>
        </details>
        <details
          className="panel owner-editor-section"
          open={mapOpen}
          onToggle={(e) => setMapOpen(e.currentTarget.open)}
        >
          <summary>
            Map location <span>Optional</span>
          </summary>
          <div className="owner-section-content">
            {mapOpen && (
              <BusinessMapField value={pin} onChange={setPin} disabled={busy} />
            )}{" "}
            {pinError && (
              <p role="alert" className="owner-field-error">
                {pinError}
              </p>
            )}
          </div>
        </details>
        {saveError && (
          <div className="panel owner-save-error" role="alert">
            <strong>Some changes still need saving</strong>
            <p>{saveError}</p>
          </div>
        )}
        <div className="owner-editor-actions">
          <p role="status">
            {progress ||
              (dirty
                ? "You have unsaved changes."
                : business
                  ? "Your changes are saved."
                  : "Creating your business also sends it for admin review.")}
          </p>
          <div>
            <Link
              className="button outline"
              href={cancelHref}
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              Cancel
            </Link>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => setPreview(true)}
            >
              Preview profile
            </button>
            <button
              className="button"
              type="submit"
              disabled={busy || (!dirty && !!business)}
            >
              {busy
                ? "Saving..."
                : business
                  ? "Save changes"
                  : "Create business"}
            </button>
          </div>
        </div>
      </form>
      {business?.verification_status === "rejected" && (
        <section className="panel owner-resubmit">
          <h2>Ready for another review?</h2>
          <p>Save your changes before resubmitting this business.</p>
          <button
            className="button"
            type="button"
            disabled={dirty || busy}
            onClick={async () => {
              setProgress("Submitting for review...");
              try {
                const r = await mutate("verify", { id: business.id });
                feedback(r);
                if (r.ok) router.refresh();
                else setSaveError(r.message);
              } finally {
                setProgress("");
              }
            }}
          >
            Resubmit for review
          </button>
        </section>
      )}
      {preview && (
        <DraftPreview
          values={values}
          logo={logo ? "draft" : logoRemoved ? null : savedLogo}
          paths={covers.paths}
          files={draftFiles}
          close={() => setPreview(false)}
        />
      )}
    </div>
  );
}

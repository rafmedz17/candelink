"use client";
import { useFeedback } from "./use-feedback";
import {
  usePhotoSave,
  usePhotoTask,
  useUnsavedForm,
} from "./photo-save-context";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  authAction,
  cvLink,
  deleteFile,
  mutate,
  uploadFile,
} from "@/app/actions";
import { Button } from "./ui/button";
import { PhotoCropDialog } from "./photo-crop-dialog";
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  value?: string | number;
  placeholder?: string;
};
export function PrivateCvUpload({ hasCv }: { hasCv: boolean }) {
  const router = useRouter();
  const [result, setResult] = useFeedback();
  const [pending, setPending] = useState(false);
  return (
    <section className="panel">
      <h2>Your private CV</h2>
      <p>
        {hasCv
          ? "A CV is saved to your profile. You can upload a newer version below."
          : "Upload your CV for your next application."}{" "}
        It is never included in your public information.
      </p>
      <label className="form-stack" style={{ marginTop: 20 }}>
        PDF · up to 5 MB
        <input
          type="file"
          accept="application/pdf"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPending(true);
            try {
              const data = new FormData();
              data.set("file", file);
              const r = await uploadFile(data);
              setResult(r);
              if (r.ok) router.refresh();
            } catch {
              setResult({
                ok: false,
                message: "Upload failed. Please check your connection.",
              });
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {hasCv && (
        <Button
          type="button"
          variant="outline"
          className="danger"
          style={{ marginTop: 14 }}
          disabled={pending}
          onClick={async () => {
            if (!window.confirm("Delete this CV from your profile?")) return;
            setPending(true);
            try {
              const r = await deleteFile("cv");
              setResult(r);
              if (r.ok) router.refresh();
            } catch {
              setResult({
                ok: false,
                message: "CV removal failed. Please check your connection.",
              });
            } finally {
              setPending(false);
            }
          }}
        >
          Delete CV
        </Button>
      )}
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
export function PhotoUpload({
  path,
  businessId,
}: {
  path?: string;
  businessId?: string;
}) {
  const router = useRouter();
  const [result, setResult] = useFeedback();
  const [pending, setPending] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [draft, setDraft] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function savePhoto() {
    if (!draft) return;
    const file = draft;
    setPending(true);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("bucket", "avatars");
      if (businessId) data.set("business_id", businessId);
      const response = await uploadFile(data);
      if (!response.ok) throw new Error(response.message);
      if (!photoSave) setResult(response);
      if (response.ok) {
        setDraft(null);
        setPreview(null);
        if (!photoSave) router.refresh();
      }
    } catch (error) {
      if (photoSave) throw error;
      setResult({
        ok: false,
        message: "The upload could not be completed. Check your connection.",
      });
    } finally {
      setPending(false);
    }
  }
  const photoSave = usePhotoTask(
    businessId ? `business:${businessId}` : "profile",
    Boolean(draft),
    savePhoto,
  );
  const locked = pending || Boolean(photoSave?.busy);
  return (
    <div className="panel photo-upload-panel">
      {selectedPhoto && (
        <PhotoCropDialog
          file={selectedPhoto}
          pending={locked}
          onSave={async (file) => {
            setPreview(URL.createObjectURL(file));
            setDraft(file);
            setSelectedPhoto(null);
            setResult(null);
          }}
          onCancel={() => setSelectedPhoto(null)}
        />
      )}
      <h2>{businessId ? "Business logo (optional)" : "Your profile photo"}</h2>
      {(draft || path) && (
        <Image
          src={
            draft && preview
              ? preview
              : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`
          }
          alt={businessId ? "Business logo" : "Profile photo"}
          width={80}
          height={80}
          unoptimized
          style={{
            borderRadius: "50%",
            marginBottom: 20,
            objectFit: "cover",
          }}
        />
      )}
      <label className="upload-field">
        <span>Choose a JPEG or PNG photo</span>
        <small>Up to 5 MB</small>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={locked}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setResult(null);
            if (
              !["image/jpeg", "image/png"].includes(file.type) ||
              file.size > 5 * 1024 * 1024
            ) {
              setResult({
                ok: false,
                message: "Choose a JPEG or PNG photo up to 5 MB.",
              });
              return;
            }
            setSelectedPhoto(file);
          }}
        />
      </label>
      <div className="photo-crop-actions">
        {!photoSave && (
          <Button type="button" disabled={locked || !draft} onClick={savePhoto}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        )}
        {draft && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setDraft(null);
              setPreview(null);
            }}
          >
            Discard changes
          </Button>
        )}
      </div>
      {path && (
        <Button
          type="button"
          variant="outline"
          className="danger photo-delete-button"
          aria-label={
            businessId ? "Delete business logo" : "Delete profile photo"
          }
          title={businessId ? "Delete business logo" : "Delete profile photo"}
          disabled={locked || Boolean(draft)}
          onClick={async () => {
            if (
              !window.confirm(
                `Delete this ${businessId ? "business logo" : "profile photo"}?`,
              )
            )
              return;
            setPending(true);
            try {
              const r = await deleteFile("avatar", businessId);
              setResult(r);
              if (r.ok) router.refresh();
            } catch {
              setResult({
                ok: false,
                message: "Photo removal failed. Please check your connection.",
              });
            } finally {
              setPending(false);
            }
          }}
        >
          <Trash2 size={18} aria-hidden="true" />
        </Button>
      )}
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
export function ProfileVisibility({
  profileId,
  isPublic,
}: {
  profileId: string;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useFeedback();
  const [pending, setPending] = useState(false);
  return (
    <section className="profile-visibility panel">
      <div>
        <h2>
          {isPublic ? "Your profile is visible" : "Keep your profile private"}
        </h2>
        <p>
          {isPublic
            ? "Anyone with your profile link can view your professional information."
            : "Enable visibility when you are ready to share your professional information with others."}
        </p>
      </div>
      <div className="profile-visibility-actions">
        {isPublic && (
          <Link
            className="text-link"
            href={`/profiles/${profileId}`}
            target="_blank"
            rel="noreferrer"
          >
            View public profile ↗
          </Link>
        )}
        {isPublic && (
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/profiles/${profileId}`,
                );
                setResult({ ok: true, message: "Public profile link copied." });
              } catch {
                setResult({
                  ok: false,
                  message:
                    "Copy the profile address from your browser instead.",
                });
              }
            }}
          >
            Copy link
          </Button>
        )}
        <Button
          type="button"
          variant={isPublic ? "outline" : "default"}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const response = await mutate("profile-visibility", {
                public_profile: !isPublic,
              });
              setResult(response);
              if (response.ok) router.refresh();
            } catch {
              setResult({
                ok: false,
                message: "Visibility could not be updated. Please try again.",
              });
            } finally {
              setPending(false);
            }
          }}
        >
          {pending
            ? "Saving…"
            : isPublic
              ? "Make profile private"
              : "Make profile public"}
        </Button>
      </div>
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
export function ActionForm({
  kind,
  fields,
  hidden = {},
  submit = "Save changes",
}: {
  kind: string;
  fields: Field[];
  hidden?: Record<string, unknown>;
  submit?: string;
}) {
  const router = useRouter();
  const photoSave = usePhotoSave();
  const photoScope = kind === "business" ? `business:${hidden.id ?? ""}` : kind;
  const photosDirty = Boolean(photoSave?.dirty[photoScope]);
  const defaults = Object.fromEntries(
    fields.map((field) => [
      field.name,
      String(field.value ?? field.options?.[0] ?? ""),
    ]),
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<Record<string, string>>({ values: defaults });
  const saving = isSubmitting || Boolean(photoSave?.busy);
  const requiresChanges = [
    "profile",
    "business",
    "job",
    "note",
    "application-status",
    "moderate",
  ].includes(kind);
  const [result, setResult] = useFeedback();
  async function saveValues(values: Record<string, string>) {
    if (requiresChanges && !isDirty && !photosDirty) return;
    setResult(null);
    try {
      const response = await mutate(kind, { ...hidden, ...values });
      if (!response.ok) {
        setResult(response);
        throw new Error(response.message);
      }
      if (photosDirty) await photoSave!.save(photoScope);
      setResult(response);
      reset(values);
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't save your changes. Please try again.",
      });
      throw error;
    }
  }
  useUnsavedForm(requiresChanges && (isDirty || photosDirty), async () => {
    await handleSubmit(saveValues, () => {
      throw new Error("Please complete the required fields.");
    })();
  });

  return (
    <form
      className={`form-stack action-form action-form-${kind}`}
      onChangeCapture={() => setResult(null)}
      onSubmit={(event) => {
        void handleSubmit(saveValues)(event).catch(() => {});
      }}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === "textarea" ? (
            <textarea
              {...register(f.name, { required: f.required })}
              disabled={saving}
              required={f.required}
              maxLength={15000}
            />
          ) : f.options ? (
            <select
              {...register(f.name)}
              required={f.required}
              disabled={saving}
            >
              {f.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              {...register(f.name, { required: f.required })}
              disabled={saving}
              required={f.required}
              type={f.type || "text"}
              placeholder={f.placeholder}
              maxLength={f.type === "number" ? undefined : 5000}
            />
          )}
        </label>
      ))}
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`form-message ${result.ok ? "" : "error"}`}
        >
          {result.message}
        </p>
      )}
      <Button
        disabled={saving || (requiresChanges && !isDirty && !photosDirty)}
      >
        {saving ? "Saving…" : submit}
      </Button>
    </form>
  );
}
export function AuthForm({
  mode,
  role = "jobseeker",
}: {
  mode: string;
  role?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>();
  const [result, setResult] = useFeedback();
  return (
    <form
      className="form-stack auth-stack"
      onSubmit={handleSubmit(async (values) => {
        try {
          const r = await authAction(mode, values);
          setResult(r);
          if (r.url) router.push(r.url);
        } catch {
          setResult({
            ok: false,
            message:
              "We couldn't complete that request. Check your connection and try again.",
          });
        }
      })}
    >
      {mode === "register" && (
        <>
          <label>
            Full name
            <input
              autoComplete="name"
              {...register("name", { required: true })}
              placeholder="Your full name"
            />
          </label>
          <fieldset className="role-chooser">
            <legend>I’m here to</legend>
            <div className="role-choices">
              <label className="role-card">
                <input
                  type="radio"
                  value="jobseeker"
                  {...register("role", { required: true })}
                  defaultChecked={role !== "business_owner"}
                />
                <span className="role-card-copy">
                  <strong>Find work</strong>
                  <small>
                    Build your profile and discover local opportunities.
                  </small>
                </span>
              </label>
              <label className="role-card">
                <input
                  type="radio"
                  value="business_owner"
                  {...register("role", { required: true })}
                  defaultChecked={role === "business_owner"}
                />
                <span className="role-card-copy">
                  <strong>Hire locally</strong>
                  <small>
                    Create a business profile and meet local talent.
                  </small>
                </span>
              </label>
            </div>
          </fieldset>
        </>
      )}
      {mode !== "reset-password" && (
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            {...register("email", { required: true })}
            placeholder="you@example.com"
          />
        </label>
      )}
      {mode !== "forgot-password" && (
        <div className="auth-field password-field">
          <label className="password-label" htmlFor="auth-password">
            {mode === "reset-password" ? "New password" : "Password"}
          </label>
          <div className="password-control">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              {...register("password", {
                required: true,
                minLength: mode === "login" ? 1 : 10,
              })}
              minLength={mode === "login" ? 1 : 10}
              placeholder={
                mode === "login"
                  ? "Enter your password"
                  : "At least 10 characters"
              }
            />
            <button
              type="button"
              className="password-toggle"
              aria-controls="auth-password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {mode !== "login" && (
            <small className="field-help">
              Use at least 10 characters to protect your account.
            </small>
          )}
        </div>
      )}
      {mode === "register" && (
        <label className="check-label">
          <input type="checkbox" required />{" "}
          <span>
            I agree to the <Link href="/terms">Terms of service</Link> and
            acknowledge the <Link href="/privacy">Privacy policy</Link>.
          </span>
        </label>
      )}
      {result && (
        <div
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </div>
      )}
      <Button disabled={isSubmitting}>
        {isSubmitting
          ? "Please wait…"
          : {
              login: "Log in",
              register: "Create your account",
              "forgot-password": "Send recovery link",
              "reset-password": "Update password",
            }[mode]}
      </Button>
    </form>
  );
}
export function ApplyForm({ id, sample }: { id: string; sample: boolean }) {
  const [path, setPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useFeedback();
  const [pending, setPending] = useState(false);
  return (
    <div className="form-stack application-form">
      {sample ? (
        <p className="form-message">
          This is a sample opportunity. Applications open when real businesses
          publish their jobs.
        </p>
      ) : (
        <>
          <label className="upload-field">
            <span>Upload your CV</span>
            <small>PDF only · up to 5 MB</small>
            <input
              type="file"
              accept="application/pdf"
              disabled={pending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPending(true);
                setPath("");
                setFileName(file.name);
                setResult(null);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  const r = await uploadFile(form);
                  if (r.ok) setPath(r.url!);
                  else setFileName("");
                  setResult(r);
                } catch {
                  setFileName("");
                  setResult({
                    ok: false,
                    message:
                      "Upload failed. Check your connection and try again.",
                  });
                } finally {
                  setPending(false);
                }
              }}
            />
          </label>
          {fileName && (
            <div className="upload-status" role="status">
              <strong>{path ? "CV ready" : "Uploading CV"}</strong>
              <span>{fileName}</span>
            </div>
          )}
          {result && (
            <p
              className={`form-message ${result.ok ? "" : "error"}`}
              role={result.ok ? "status" : "alert"}
            >
              {result.message}
            </p>
          )}
          {path && (
            <ActionForm
              kind="apply"
              hidden={{ id, cv_path: path }}
              fields={[
                {
                  name: "cover_letter",
                  label: "Cover letter (optional)",
                  type: "textarea",
                },
              ]}
              submit="Submit application"
            />
          )}
          <small>
            Your CV is private and shared only with this hiring team.
          </small>
        </>
      )}
    </div>
  );
}
export function QuickAction({
  kind,
  values,
  label,
  confirm = false,
}: {
  kind: string;
  values: Record<string, unknown>;
  label: string;
  confirm?: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useFeedback();
  const [pending, setPending] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          if (
            confirm &&
            !window.confirm(
              `${label}? This will change the record immediately.`,
            )
          )
            return;
          setPending(true);
          try {
            const r = await mutate(kind, values);
            setResult(r);
            if (r.ok) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "We couldn't complete that action. Please try again.",
            });
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Working…" : label}
      </Button>
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
export function CvButton({ id }: { id: string }) {
  const [link, setLink] = useState("");
  const [result, setResult] = useFeedback();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            const r = await cvLink(id);
            setResult(r);
            if (r.url) setLink(r.url);
          } catch {
            setResult({
              ok: false,
              message: "The CV link could not be created. Please try again.",
            });
          }
        }}
      >
        Access CV
      </Button>
      {link && (
        <a className="text-link" href={link} target="_blank" rel="noreferrer">
          {" "}
          Open private PDF
        </a>
      )}
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

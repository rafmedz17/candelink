"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { authAction, mutate, uploadFile, cvLink } from "@/app/actions";
import { Button } from "./ui/button";
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
  const [message, setMessage] = useState("");
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
              setMessage(r.message);
              if (r.ok) router.refresh();
            } catch {
              setMessage("Upload failed. Please check your connection.");
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {message && (
        <p className="form-message" role="status">
          {message}
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
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="panel">
      <h2>{businessId ? "Business logo" : "Your profile photo"}</h2>
      {path && (
        <Image
          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`}
          alt={businessId ? "Business logo" : "Profile photo"}
          width={80}
          height={80}
          unoptimized
          style={{ borderRadius: 12, marginBottom: 20 }}
        />
      )}
      <label className="form-stack">
        JPEG or PNG · up to 5 MB
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPending(true);
            try {
              const data = new FormData();
              data.set("file", file);
              data.set("bucket", "avatars");
              if (businessId) data.set("business_id", businessId);
              const r = await uploadFile(data);
              setMessage(r.message);
              if (r.ok) router.refresh();
            } catch {
              setMessage(
                "The upload could not be completed. Check your connection.",
              );
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </div>
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
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (values) => {
        const r = await mutate(kind, { ...hidden, ...values });
        setResult(r);
        if (r.ok) router.refresh();
      })}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === "textarea" ? (
            <textarea
              {...register(f.name, { required: f.required })}
              required={f.required}
              defaultValue={f.value}
              maxLength={15000}
            />
          ) : f.options ? (
            <select
              {...register(f.name)}
              defaultValue={f.value}
              required={f.required}
            >
              {f.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              {...register(f.name, { required: f.required })}
              required={f.required}
              type={f.type || "text"}
              defaultValue={f.value}
              placeholder={f.placeholder}
              maxLength={f.type === "number" ? undefined : 5000}
            />
          )}
        </label>
      ))}
      {result && (
        <p role="status" className={`form-message ${result.ok ? "" : "error"}`}>
          {result.message}
        </p>
      )}
      <Button disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submit}
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
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (values) => {
        const r = await authAction(mode, values);
        setResult(r);
        if (r.url) router.push(r.url);
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
          <label>
            I’m here to
            <select {...register("role")} defaultValue={role}>
              <option value="jobseeker">Find work and build my career</option>
              <option value="business_owner">
                Hire talent for my business
              </option>
            </select>
          </label>
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
        <label>
          {mode === "reset-password" ? "New password" : "Password"}
          <input
            type="password"
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
        </label>
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
          role="status"
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
  const [path, setPath] = useState(""),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="form-stack">
      {sample ? (
        <p className="form-message">
          This is a sample opportunity. Applications open when real businesses
          publish their jobs.
        </p>
      ) : (
        <>
          <label>
            Upload your CV · PDF, up to 5 MB
            <input
              type="file"
              accept="application/pdf"
              disabled={pending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPending(true);
                const form = new FormData();
                form.set("file", file);
                const r = await uploadFile(form);
                if (r.ok) setPath(r.url!);
                setMessage(r.message);
                setPending(false);
              }}
            />
          </label>
          {message && (
            <p className="form-message" role="status">
              {message}
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
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <Button
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
          const r = await mutate(kind, values);
          setMessage(r.message);
          setPending(false);
          if (r.ok) router.refresh();
        }}
      >
        {pending ? "Working…" : label}
      </Button>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function CvButton({ id }: { id: string }) {
  const [link, setLink] = useState(""),
    [message, setMessage] = useState("");
  return (
    <div>
      <Button
        variant="outline"
        onClick={async () => {
          const r = await cvLink(id);
          setMessage(r.message);
          if (r.url) setLink(r.url);
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
      {message && <p role="status">{message}</p>}
    </div>
  );
}

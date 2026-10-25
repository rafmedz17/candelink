"use server";
import { supabase } from "@/lib/supabase/server";
import {
  businessSchema,
  credentials,
  loginCredentials,
  jobSchema,
  profileSchema,
  statuses,
} from "@/lib/validation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export type Result = { ok: boolean; message: string; url?: string };
export async function authAction(
  mode: string,
  values: Record<string, string>,
): Promise<Result> {
  try {
    return await runAuth(mode, values);
  } catch {
    return {
      ok: false,
      message:
        "Account services are temporarily unavailable. Please try again.",
    };
  }
}
async function runAuth(
  mode: string,
  values: Record<string, string>,
): Promise<Result> {
  const db = await supabase();
  if (!db)
    return {
      ok: false,
      message:
        "Account services are not configured yet. Add your Supabase environment variables to enable secure sign-in.",
    };
  if (mode === "forgot-password") {
    if (!z.email().safeParse(values.email).success)
      return { ok: false, message: "Enter a valid email address." };
    await db.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    });
    return {
      ok: true,
      message:
        "If this email has an account, a password recovery link will arrive shortly.",
    };
  }
  if (mode === "reset-password") {
    if (values.password.length < 10)
      return { ok: false, message: "Use at least 10 characters." };
    const { error } = await db.auth.updateUser({ password: values.password });
    return {
      ok: !error,
      message: error
        ? "This recovery session has expired. Request a new link."
        : "Password updated. You can return to your dashboard.",
      url: error ? undefined : "/dashboard",
    };
  }
  const parsed = (mode === "login" ? loginCredentials : credentials).safeParse(
    values,
  );
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const { email, password, name, role } = parsed.data;
  const { error } =
    mode === "register"
      ? await db.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, account_type: role || "jobseeker" },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          },
        })
      : await db.auth.signInWithPassword({ email, password });
  if (error)
    return {
      ok: false,
      message:
        mode === "register"
          ? "Registration could not be completed. Check your details or try again later."
          : "We couldn’t sign you in. Check your email and password.",
    };
  return {
    ok: true,
    message:
      mode === "register"
        ? "Check your email to confirm your account before signing in."
        : "Welcome back.",
    url: mode === "register" ? undefined : "/dashboard",
  };
}
export async function logout() {
  const db = await supabase();
  await db?.auth.signOut();
  redirect("/login");
}
export async function mutate(
  kind: string,
  values: Record<string, unknown>,
): Promise<Result> {
  try {
    return await runMutation(kind, values);
  } catch {
    return {
      ok: false,
      message:
        "We couldn’t save your changes. Check your connection and try again.",
    };
  }
}
async function runMutation(
  kind: string,
  values: Record<string, unknown>,
): Promise<Result> {
  const db = await supabase();
  if (!db)
    return {
      ok: false,
      message:
        "Connect Supabase to enable accounts and save your work. Sample listings are for browsing.",
    };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Please log in to continue." };
  const { data: account } = await db
    .from("profiles")
    .select("role,suspended")
    .eq("id", user.id)
    .single();
  if (!account || account.suspended)
    return { ok: false, message: "This account cannot perform this action." };
  const id = z.uuid().safeParse(values.id);
  let error: unknown = null;
  if (kind === "save") {
    if (account.role !== "jobseeker")
      return {
        ok: false,
        message: "Bookmarks are available to jobseeker accounts.",
      };
    if (!id.success)
      return {
        ok: false,
        message:
          "This is a sample opportunity. Real listings can be saved after launch.",
      };
    ({ error } = values.remove
      ? await db
          .from("saved_jobs")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", id.data)
      : await db
          .from("saved_jobs")
          .insert({ user_id: user.id, job_id: id.data }));
  } else if (kind === "profile") {
    const v = profileSchema.safeParse(values);
    if (!v.success) return { ok: false, message: v.error.issues[0].message };
    ({ error } = await db.from("profiles").update(v.data).eq("id", user.id));
  } else if (kind === "profile-visibility") {
    if (account.role !== "jobseeker")
      return { ok: false, message: "Only jobseeker profiles can be public." };
    const v = z.boolean().safeParse(values.public_profile);
    if (!v.success)
      return { ok: false, message: "Invalid profile visibility setting." };
    ({ error } = await db
      .from("profiles")
      .update({ public_profile: v.data })
      .eq("id", user.id));
  } else if (kind === "business") {
    if (account.role !== "business_owner")
      return { ok: false, message: "A business owner account is required." };
    const v = businessSchema.safeParse(values);
    if (!v.success) return { ok: false, message: v.error.issues[0].message };
    ({ error } = id.success
      ? await db.rpc("update_business", { details: v.data, bid: id.data })
      : await db.rpc("create_business", { details: v.data }));
  } else if (kind === "verify") {
    if (!id.success) return { ok: false, message: "Choose a business first." };
    ({ error } = await db
      .from("business_verification_requests")
      .insert({ business_id: id.data, requested_by: user.id }));
  } else if (kind === "job") {
    const v = jobSchema.safeParse(values);
    if (!v.success) return { ok: false, message: v.error.issues[0].message };
    const { business_id, ...editable } = v.data;
    const { data: membership } = await db
      .from("business_members")
      .select("business_id")
      .eq("business_id", business_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership)
      return {
        ok: false,
        message: "You are not authorized to manage this business.",
      };
    ({ error } = id.success
      ? await db
          .from("jobs")
          .update(editable)
          .eq("id", id.data)
          .eq("business_id", business_id)
          .select("id")
          .single()
      : await db.from("jobs").insert(v.data));
  } else if (kind === "job-status") {
    if (
      !id.success ||
      !["published", "closed", "archived", "draft"].includes(
        String(values.status),
      )
    )
      return { ok: false, message: "Invalid listing status." };
    ({ error } = await db
      .from("jobs")
      .update({ status: values.status })
      .eq("id", id.data)
      .select("id")
      .single());
  } else if (kind === "apply") {
    if (account.role !== "jobseeker")
      return { ok: false, message: "Use a jobseeker account to apply." };
    if (!id.success)
      return {
        ok: false,
        message: "Sample listings do not accept applications.",
      };
    const v = z
      .object({
        cover_letter: z.string().max(6000),
        cv_path: z.string().min(1).max(500),
      })
      .safeParse(values);
    if (!v.success || !String(values.cv_path).startsWith(`${user.id}/`))
      return { ok: false, message: "Upload your CV before applying." };
    ({ error } = await db
      .from("applications")
      .insert({ job_id: id.data, applicant_id: user.id, ...v.data }));
  } else if (kind === "application-status") {
    if (
      !id.success ||
      !statuses.includes(values.status as (typeof statuses)[number])
    )
      return { ok: false, message: "Invalid application status." };
    ({ error } = await db.rpc("change_application_status", {
      application_id: id.data,
      new_status: values.status,
    }));
  } else if (kind === "note") {
    const v = z
      .object({ application_id: z.uuid(), note: z.string().max(6000) })
      .safeParse(values);
    if (!v.success) return { ok: false, message: "Invalid note." };
    ({ error } = await db
      .from("applicant_notes")
      .upsert({ ...v.data, author_id: user.id }));
  } else if (kind === "read") {
    if (!id.success) return { ok: false, message: "Invalid notification." };
    ({ error } = await db
      .from("notifications")
      .update({ read: true })
      .eq("id", id.data)
      .eq("user_id", user.id));
  } else if (kind === "report") {
    const v = z
      .object({
        subject_type: z.enum(["job", "user", "business"]),
        subject_id: z.uuid(),
        reason: z.string().min(10).max(3000),
      })
      .safeParse(values);
    if (!v.success)
      return {
        ok: false,
        message:
          "Provide a valid record and a reason of at least 10 characters.",
      };
    ({ error } = await db
      .from("reports")
      .insert({ ...v.data, reporter_id: user.id }));
  } else if (kind === "moderate") {
    if (account.role !== "admin")
      return { ok: false, message: "Administrator access is required." };
    const v = z
      .object({
        id: z.uuid(),
        target: z.enum(["business", "user", "job", "report"]),
        decision: z.string().max(40),
        reason: z.string().trim().max(2000).optional().default(""),
      })
      .safeParse(values);
    if (!v.success)
      return {
        ok: false,
        message:
          "Provide a valid record and decision, with an optional reason of up to 2,000 characters.",
      };
    ({ error } = await db.rpc("moderate", {
      target_id: v.data.id,
      target_type: v.data.target,
      decision: v.data.decision,
      reason: v.data.reason,
    }));
  } else return { ok: false, message: "Unknown action." };
  if (error)
    return {
      ok: false,
      message:
        "Unable to save. Check your permissions, required fields, and whether this action was already completed.",
    };
  revalidatePath("/", "layout");
  return { ok: true, message: "Your changes have been saved." };
}
export async function uploadFile(form: FormData): Promise<Result> {
  const db = await supabase();
  if (!db) return { ok: false, message: "Connect Supabase to upload files." };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Please log in first." };
  const file = form.get("file");
  const bucket = form.get("bucket") === "avatars" ? "avatars" : "cvs";
  const businessId = form.get("business_id");
  if (businessId) {
    const parsed = z.uuid().safeParse(businessId);
    if (!parsed.success) return { ok: false, message: "Invalid business." };
    const { data: member } = await db
      .from("business_members")
      .select("business_id")
      .eq("business_id", parsed.data)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member)
      return { ok: false, message: "Business membership is required." };
  }
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size === 0)
    return { ok: false, message: "Choose a file under 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf =
    file.type === "application/pdf" &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const jpeg =
    file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216;
  const png =
    file.type === "image/png" &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71;
  if (bucket === "cvs" ? !pdf : !jpeg && !png)
    return {
      ok: false,
      message:
        bucket === "cvs"
          ? "Upload a valid PDF CV."
          : "Upload a JPEG or PNG image.",
    };
  const path = `${user.id}/${crypto.randomUUID()}.${pdf ? "pdf" : jpeg ? "jpg" : "png"}`;
  const { error } = await db.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, message: "Upload failed. Please try again." };
  if (bucket === "avatars") {
    const { error: saveError } = businessId
      ? await db.rpc("set_business_logo", {
          bid: String(businessId),
          image_path: path,
        })
      : await db
          .from("profiles")
          .update({ avatar_path: path })
          .eq("id", user.id);
    if (saveError)
      return {
        ok: false,
        message:
          "The image uploaded but could not be attached. Please try again.",
      };
    revalidatePath("/", "layout");
  } else {
    revalidatePath("/jobs");
  }
  return { ok: true, message: "File uploaded securely.", url: path };
}
export async function deleteFile(
  kind: "avatar" | "cv",
  businessId?: string,
): Promise<Result> {
  const db = await supabase();
  if (!db) return { ok: false, message: "Storage is not configured." };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Please log in first." };

  if (kind === "avatar" && businessId) {
    const parsed = z.uuid().safeParse(businessId);
    if (!parsed.success) return { ok: false, message: "Invalid business." };
    const { data: member } = await db
      .from("business_members")
      .select("business_id")
      .eq("business_id", parsed.data)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member)
      return { ok: false, message: "Business membership is required." };
    const { data: business, error: findError } = await db
      .from("businesses")
      .select("logo_path")
      .eq("id", parsed.data)
      .maybeSingle();
    if (findError || !business?.logo_path)
      return { ok: false, message: "No business logo was found." };
    const { error: updateError } = await db.rpc("set_business_logo", {
      bid: parsed.data,
      image_path: null,
    });
    if (updateError)
      return {
        ok: false,
        message: "The business logo could not be removed. Please try again.",
      };
    revalidatePath("/", "layout");
    return { ok: true, message: "Business logo deleted." };
  }

  const { data: profile, error: findError } = await db
    .from("profiles")
    .select("avatar_path,cv_path")
    .eq("id", user.id)
    .maybeSingle();
  const path = kind === "avatar" ? profile?.avatar_path : profile?.cv_path;
  if (findError || typeof path !== "string" || !path)
    return {
      ok: false,
      message:
        kind === "avatar" ? "No profile photo was found." : "No CV was found.",
    };
  if (!path.startsWith(`${user.id}/`))
    return { ok: false, message: "This file cannot be removed." };

  if (kind === "cv") {
    const { count, error: useError } = await db
      .from("applications")
      .select("id", { head: true, count: "exact" })
      .eq("applicant_id", user.id)
      .eq("cv_path", path);
    if (useError) return { ok: false, message: "Unable to check CV usage." };
    const { error: updateError } = await db
      .from("profiles")
      .update({ cv_path: null })
      .eq("id", user.id);
    if (updateError) return { ok: false, message: "CV removal failed." };
    revalidatePath("/", "layout");
    if (count)
      return {
        ok: true,
        message:
          "CV removed from your profile. It remains available for applications that already use it.",
      };
    const { error: removeError } = await db.storage.from("cvs").remove([path]);
    return {
      ok: true,
      message: removeError
        ? "CV removed from your profile, but file cleanup could not be completed."
        : "CV deleted.",
    };
  }

  const { error: removeError } = await db.storage
    .from("avatars")
    .remove([path]);
  if (removeError) return { ok: false, message: "Photo removal failed." };
  const { error: updateError } = await db
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);
  if (updateError)
    return {
      ok: false,
      message: "The photo was deleted, but your profile could not be updated.",
    };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile photo deleted." };
}
export async function cvLink(id: string): Promise<Result> {
  const db = await supabase();
  if (!db) return { ok: false, message: "Storage is not configured." };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in." };
  const { data } = await db
    .from("applications")
    .select("cv_path")
    .eq("id", id)
    .single();
  if (!data)
    return { ok: false, message: "You do not have access to this CV." };
  const { data: link, error } = await db.storage
    .from("cvs")
    .createSignedUrl(data.cv_path, 60);
  return {
    ok: !error,
    message: error ? "CV unavailable." : "CV link expires in 60 seconds.",
    url: link?.signedUrl,
  };
}

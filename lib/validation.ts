import { z } from "zod";
export const credentials = z.object({
  email: z.email(),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  name: z.string().max(100).optional(),
  role: z.enum(["jobseeker", "business_owner"]).optional(),
});
// Existing accounts may predate the current password creation policy.
export const loginCredentials = credentials.extend({
  password: z.string().min(1, "Enter your password.").max(128),
});
export const registrationCredentials = credentials
  .extend({
    confirm_password: z.string().min(1, "Confirm your password.").max(128),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });
export const profileSchema = z.object({
  full_name: z.string().min(2).max(100),
  headline: z.string().max(150),
  location: z.string().max(150),
  introduction: z.string().max(3000),
  skills: z.string().max(1500),
  education: z.string().max(3000),
  experience: z.string().max(5000),
});
export const businessOwnerProfileSchema = profileSchema.omit({
  skills: true,
  education: true,
  experience: true,
});
export const businessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional().default(""),
  category: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  public_email: z
    .union([z.email(), z.literal("")])
    .optional()
    .default(""),
  public_phone: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) =>
        !value ||
        (/^\+?[0-9() .-]+$/.test(value) &&
          value.replace(/\D/g, "").length >= 7 &&
          value.replace(/\D/g, "").length <= 15),
      "Enter a valid contact number.",
    )
    .optional()
    .default(""),
  operating_details: z.string().max(2000).optional().default(""),
});
export const mapLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: "Choose latitude and longitude together.",
  });
export const jobSchema = z
  .object({
    business_id: z.uuid(),
    title: z.string().min(4).max(150),
    description: z
      .string()
      .trim()
      .min(1, "Enter a job description.")
      .max(15000),
    responsibilities: z.string().max(8000),
    qualifications: z.string().max(8000),
    employment_type: z.enum([
      "Full-time",
      "Part-time",
      "Contract",
      "Internship",
    ]),
    arrangement: z.enum(["On-site", "Hybrid", "Remote"]),
    location: z.string().min(2).max(150),
    category: z.string().min(2).max(100),
    salary_min: z.coerce.number().nonnegative().max(10000000),
    salary_max: z.coerce.number().nonnegative().max(10000000),
    vacancies: z.coerce.number().int().min(1).max(1000),
    deadline: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.iso.date().nullable(),
    ),
  })
  .refine((v) => v.salary_max >= v.salary_min, {
    message: "Maximum salary must be at least the minimum.",
  });
export const statuses = [
  "Submitted",
  "Under Review",
  "Shortlisted",
  "Interview",
  "Accepted",
  "Rejected",
  "Withdrawn",
] as const;

import { z } from "zod";
export const credentials = z.object({
  email: z.email(),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  name: z.string().max(100).optional(),
  role: z.enum(["jobseeker", "business_owner"]).optional(),
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
export const businessSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(20).max(5000),
  category: z.string().min(2).max(100),
  address: z.string().min(5).max(300),
  contact_email: z.email(),
  operating_details: z.string().max(2000),
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

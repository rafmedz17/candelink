export const businessStatuses = {
  pending: {
    label: "Waiting for admin review",
    help: "Your business has been sent for review. You can edit its details and prepare draft jobs while you wait.",
  },
  verified: {
    label: "Verified — ready to hire",
    help: "Your business can publish jobs and receive applications.",
  },
  rejected: {
    label: "Changes requested",
    help: "Check the admin feedback, update your details, then resubmit your business for review.",
  },
  suspended: {
    label: "Business suspended",
    help: "Contact the admin to discuss your business status. Editing details does not remove a suspension.",
  },
} as const;
export type BusinessStatus = keyof typeof businessStatuses;
export type OwnerBusiness = {
  id: string;
  name: string;
  category: string;
  address: string;
  description: string;
  operating_details: string;
  public_email: string;
  public_phone: string;
  logo_path: string | null;
  cover_paths: string[];
  latitude: number | null;
  longitude: number | null;
  verification_status: BusinessStatus;
  moderation_reason: string | null;
};

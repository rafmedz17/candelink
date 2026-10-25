export type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "none" | "pending" | "accepted" | "declined" | "removed";
  message_status?: "pending" | "accepted" | "declined" | null;
  message_requester_id?: string | null;
  message_intro_id?: string | null;
  last_message_at?: string;
  last_message?: DirectMessage | null;
  unread_count?: number;
  peer: {
    id: string;
    full_name: string;
    headline: string;
    avatar_path: string | null;
    public_profile: boolean;
    active: boolean;
  };
};
export type DirectMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

// getRandomValues also works over HTTP when testing from a phone on the LAN.
export function createMessageId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10),
  ]
    .map((part) => part.join(""))
    .join("-");
}

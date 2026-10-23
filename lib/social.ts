export type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "removed";
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

"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { followBusiness } from "@/app/businesses/follow-actions";
import { useFeedback } from "./use-feedback";
export function BusinessFollowButton({
  businessId,
  loggedIn,
  following: initial,
  unavailable = false,
}: {
  businessId: string;
  loggedIn: boolean;
  following: boolean;
  unavailable?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [pending, setPending] = useState(false);
  const [, setResult] = useFeedback();
  return (
    <div className="business-follow-actions">
      {loggedIn ? (
        <button
          type="button"
          className={`button ${following ? "ghost business-following" : "outline"}`}
          aria-pressed={following}
          title={
            unavailable
              ? "Following is temporarily unavailable"
              : following
                ? "Unfollow this business"
                : "Get notified about new opportunities"
          }
          disabled={pending || unavailable}
          onClick={async () => {
            setPending(true);
            setResult(null);
            try {
              const next = !following;
              const response = await followBusiness(businessId, next);
              setResult(response);
              if (response.ok) {
                setFollowing(next);
                router.refresh();
              }
            } catch {
              setResult({
                ok: false,
                message: "Couldn't update your follow. Please try again.",
              });
            } finally {
              setPending(false);
            }
          }}
        >
          <Heart
            size={18}
            fill={following ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {pending ? "Updating..." : following ? "Following" : "Follow"}
        </button>
      ) : (
        <Link
          className="button outline"
          href={`/login?next=${encodeURIComponent(`/businesses/${businessId}`)}`}
        >
          <Heart size={18} aria-hidden="true" />
          Follow
        </Link>
      )}
    </div>
  );
}

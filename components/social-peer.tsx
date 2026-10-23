import Image from "next/image";
import Link from "next/link";
import type { Connection } from "@/lib/social";

export function SocialPeer({ peer }: { peer: Connection["peer"] }) {
  return (
    <div className="social-peer">
      <div className="person-avatar">
        {peer.avatar_path ? (
          <Image
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${peer.avatar_path}`}
            alt=""
            width={48}
            height={48}
            unoptimized
          />
        ) : (
          <span aria-hidden="true">
            {(peer.full_name || "C").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div>
        {peer.public_profile && peer.active ? (
          <Link href={`/profiles/${peer.id}`}>
            <strong>{peer.full_name || "Community member"}</strong>
          </Link>
        ) : (
          <strong>{peer.full_name || "Community member"}</strong>
        )}
        <p>{peer.active ? peer.headline : "Account unavailable"}</p>
      </div>
    </div>
  );
}

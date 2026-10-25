import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/site";
import { supabase } from "@/lib/supabase/server";
import { FriendActions } from "@/components/social-controls";

type PublicProfile = {
  id: string;
  full_name: string;
  headline: string;
  location: string;
  introduction: string;
  skills: string;
  education: string;
  experience: string;
  avatar_path: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await supabase();
  if (
    !db ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    notFound();
  }

  const { data } = await db.rpc("get_public_profile", { profile_id: id });
  const profile = data as PublicProfile | null;
  if (!profile) notFound();

  const {
    data: { user },
  } = await db.auth.getUser();
  const connection =
    user && user.id !== id
      ? await db
          .from("friendships")
          .select("id,status,requester_id,recipient_id")
          .or(
            `and(requester_id.eq.${user.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${user.id})`,
          )
          .maybeSingle()
      : null;
  const blockState =
    user && user.id !== id
      ? await db.rpc("block_state", { target_user: id })
      : null;

  const avatarUrl = profile.avatar_path
    ? db.storage.from("avatars").getPublicUrl(profile.avatar_path).data
        .publicUrl
    : null;
  const skills = profile.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container public-profile-page">
          <Link className="back-link" href="/jobs">
            Browse local opportunities
          </Link>
          <article className="social-profile panel public-profile-card">
            <div className="social-profile-header" />
            <div className="social-profile-body">
              <div className="social-avatar">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${profile.full_name}'s profile photo`}
                    width={112}
                    height={112}
                    unoptimized
                  />
                ) : (
                  <span aria-hidden="true">
                    {(profile.full_name || "C").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="public-profile-heading">
                <h1>{profile.full_name}</h1>
                {profile.headline && <p>{profile.headline}</p>}
                {profile.location && (
                  <span>
                    <MapPin size={15} aria-hidden="true" /> {profile.location}
                  </span>
                )}
              </div>
              <div className="profile-social-actions">
                {!user ? (
                  <Link className="button" href="/login">
                    Log in to add friend
                  </Link>
                ) : user.id === id ? (
                  <Link className="button outline" href="/friends">
                    Your friends
                  </Link>
                ) : connection?.error ? (
                  <p role="status">
                    Friend requests are temporarily unavailable.
                  </p>
                ) : (
                  <FriendActions
                    targetId={id}
                    status={connection?.data?.status}
                    connectionId={connection?.data?.id}
                    incoming={connection?.data?.recipient_id === user.id}
                    blocked={
                      Boolean(blockState?.data?.blocked) ||
                      Boolean(blockState?.error)
                    }
                    blockedByMe={Boolean(blockState?.data?.blocked_by_me)}
                  />
                )}
              </div>
              {profile.introduction && (
                <section className="social-profile-copy">
                  <h2>About</h2>
                  <p>{profile.introduction}</p>
                </section>
              )}
              {skills.length > 0 && (
                <section className="social-profile-copy">
                  <h2>Skills</h2>
                  <div className="tags">
                    {skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </section>
              )}
              {profile.experience && (
                <section className="social-profile-copy">
                  <h2>Experience</h2>
                  <p className="profile-rich-text">{profile.experience}</p>
                </section>
              )}
              {profile.education && (
                <section className="social-profile-copy">
                  <h2>Education</h2>
                  <p className="profile-rich-text">{profile.education}</p>
                </section>
              )}
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

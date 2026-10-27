"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";

export function BusinessProfileHero({
  name,
  category,
  address,
  logo,
  photos,
  actions,
}: {
  name: string;
  category: string;
  address: string;
  logo?: string | null;
  photos: string[];
  actions?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const current = count ? index % count : 0;
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % count);
    }, 5000);
    return () => clearInterval(timer);
  }, [count]);
  const imageUrl = (path: string) =>
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
  return (
    <section
      className={`business-profile-hero ${count ? "has-photos" : ""}`}
      aria-label={`${name} business profile`}
    >
      {count > 0 && (
        <div className="business-cover-slides" aria-hidden="true">
          {photos.map((photo, n) => (
            <Image
              width={1600}
              height={900}
              unoptimized
              key={photo}
              src={imageUrl(photo)}
              alt=""
              className={n === current ? "is-current" : ""}
              loading={n === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
      )}
      <div className="business-profile-identity">
        <div className="business-profile-logo">
          {logo ? (
            <Image
              width={96}
              height={96}
              unoptimized
              src={imageUrl(logo)}
              alt={`${name} logo`}
            />
          ) : (
            <Store size={36} aria-hidden="true" />
          )}
        </div>
        <div className="business-profile-copy">
          <p className="eyebrow">{category}</p>
          <h1>{name}</h1>
          <p>
            {category} · {address}
          </p>
        </div>
        {actions && <div className="business-profile-actions">{actions}</div>}
      </div>
    </section>
  );
}

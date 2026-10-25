"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Store } from "lucide-react";

export function BusinessProfileHero({
  name,
  category,
  address,
  logo,
  photos,
}: {
  name: string;
  category: string;
  address: string;
  logo?: string | null;
  photos: string[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const count = photos.length;
  const current = count ? index % count : 0;
  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((value) => (value + 1) % count);
    }, 5000);
    return () => clearInterval(timer);
  }, [count, paused, reduceMotion]);
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
        <div>
          <p className="eyebrow">{category}</p>
          <h1>{name}</h1>
          <p>
            {category} · {address}
          </p>
        </div>
      </div>
      {count > 1 && (
        <div
          className="business-cover-controls"
          aria-label="Background slideshow controls"
        >
          <button
            type="button"
            aria-label="Previous background photo"
            onClick={() => {
              setIndex((current + count - 1) % count);
              setPaused(true);
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span aria-live="off">
            {current + 1} / {count}
          </span>
          <button
            type="button"
            aria-label="Next background photo"
            onClick={() => {
              setIndex((current + 1) % count);
              setPaused(true);
            }}
          >
            <ChevronRight size={18} />
          </button>
          {!reduceMotion && (
            <button
              type="button"
              aria-label={
                paused
                  ? "Play background slideshow"
                  : "Pause background slideshow"
              }
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

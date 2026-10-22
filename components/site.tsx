import Link from "next/link";
import {
  ArrowUpRight,
  MapPin,
  BriefcaseBusiness,
  Link2,
  Coffee,
  Monitor,
  Store,
  Calculator,
  Headphones,
  Menu,
} from "lucide-react";
import type { Job } from "@/lib/sample";
import { SaveButton } from "./save-button";
import { supabase } from "@/lib/supabase/server";
export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="Candelink home">
      <span className="brand-symbol">
        <Link2 size={24} strokeWidth={2.7} />
      </span>
      cande<span>link</span>
      <span className="brand-period">.</span>
    </Link>
  );
}
export async function Header() {
  const db = await supabase();
  const user = db ? (await db.auth.getUser()).data.user : null;
  return (
    <header className="site-header">
      <div className="container nav">
        <Logo />
        <nav aria-label="Main navigation">
          <Link href="/jobs">Find a job</Link>
          <Link href="/businesses">Local businesses</Link>
          <Link href="/#how-it-works">How it works</Link>
        </nav>
        <div className="nav-actions">
          <details className="mobile-menu">
            <summary aria-label="Open navigation">
              <Menu size={22} />
            </summary>
            <div>
              <Link href="/jobs">Find a job</Link>
              <Link href="/businesses">Local businesses</Link>
              <Link href="/#how-it-works">How it works</Link>
              <Link href={user ? "/dashboard" : "/login"}>
                {user ? "My dashboard" : "Log in"}
              </Link>
              <Link href="/business/dashboard">For employers</Link>
            </div>
          </details>
          <Link className="employer-link" href="/business/dashboard">
            For employers <ArrowUpRight size={14} />
          </Link>
          <span className="nav-separator" />
          <Link className="login-link" href={user ? "/dashboard" : "/login"}>
            {user ? "My dashboard" : "Log in"}
          </Link>
          <Link className="button small" href="/register">
            Get started <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="container footer-main">
        <div>
          <Logo />
          <p>
            Where Candelaria Connects.
            <br />
            Local talent. Local businesses. Shared possibilities.
          </p>
          <span className="footer-location">
            <MapPin size={14} /> Candelaria, Quezon, Philippines
          </span>
        </div>
        <div>
          <strong>Find your next</strong>
          <Link href="/jobs">Browse opportunities</Link>
          <Link href="/businesses">Discover businesses</Link>
          <Link href="/register">Create your profile</Link>
        </div>
        <div>
          <strong>Grow your business</strong>
          <Link href="/register?role=business_owner">Start hiring</Link>
          <Link href="/business/dashboard">Employer dashboard</Link>
          <Link href="/#how-it-works">How it works</Link>
        </div>
        <div>
          <strong>Let’s stay connected</strong>
          <p>Built with care for our community.</p>
          <a href="mailto:hello@candelink.example">
            Contact the team <ArrowUpRight size={14} />
          </a>
          <div className="social-label">
            ♡ &nbsp; Proudly local. Always forward.
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} CANDELINK. All rights reserved.
        </span>
        <div>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <span>
            Made for a more connected Candelaria <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
    </footer>
  );
}
export function JobCard({ job, demo = false }: { job: Job; demo?: boolean }) {
  const icons = [
    BriefcaseBusiness,
    Coffee,
    Monitor,
    Store,
    Calculator,
    Headphones,
  ];
  const n = job.id.startsWith("sample")
    ? Number(job.id.split("-")[1]) - 1
    : job.title.length % 6;
  const Icon = icons[n] || Store;
  return (
    <article className="job-card">
      <div className="job-card-top">
        <span className={`company-logo color-${n}`}>
          <Icon size={25} strokeWidth={1.7} />
        </span>
        <SaveButton id={job.id} initial={job.saved} />
      </div>
      <Link href={`/jobs/${job.id}`} className="job-title">
        {job.title}
      </Link>
      <p className="company-name">{job.company}</p>
      <div className="job-location">
        <MapPin size={14} />
        {job.location}
      </div>
      <div className="tags">
        <span>{job.employment_type}</span>
        <span>{job.arrangement}</span>
        {n === 0 && <span className="green-tag">Fresh grads welcome</span>}
      </div>
      <div className="job-card-bottom">
        <strong>
          {job.salary_min
            ? `₱${job.salary_min.toLocaleString()} – ₱${job.salary_max?.toLocaleString()}`
            : "Salary undisclosed"}
          <small>{job.salary_min ? " / month" : ""}</small>
        </strong>
        <span>{demo ? "Sample listing" : "New opportunity"}</span>
      </div>
    </article>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

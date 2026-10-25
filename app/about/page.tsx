import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  MapPin,
  Sprout,
  Store,
  Users,
} from "lucide-react";
import { Footer, Header, PageTitle } from "@/components/site";

export const metadata: Metadata = {
  title: "About CANDELINK | Where Candelaria Connects",
  description:
    "Learn about CANDELINK, a local career and business community developed by Rafael Vincent D. Medina for Candelaria, Quezon.",
};

export default function About() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg about-page">
        <div className="container">
          <PageTitle
            eyebrow="ROOTED HERE. GROWING TOGETHER."
            title="Local connections. Shared possibilities."
            description="CANDELINK brings people, businesses, and opportunities together in Candelaria, Quezon."
          />
          <section className="panel about-mission">
            <span className="step-icon">
              <Sprout size={28} aria-hidden="true" />
            </span>
            <div>
              <h2>A community worth growing together.</h2>
              <p>
                Finding meaningful work and meeting the right people can start
                close to home. CANDELINK gives local jobseekers a place to share
                their skills, discover opportunities, and connect with the
                businesses shaping their community.
              </p>
              <p>
                For business owners, it is a place to introduce their team,
                share open roles, and meet local talent. Our purpose is to make
                those connections easier to find and easier to build.
              </p>
            </div>
          </section>
          <section
            className="about-features"
            aria-labelledby="about-features-heading"
          >
            <h2 id="about-features-heading">Find your next connection.</h2>
            <div className="about-feature-grid">
              {[
                {
                  icon: BriefcaseBusiness,
                  title: "Opportunities close to home",
                  text: "Browse local jobs, explore what teams are looking for, and apply when you find a role that fits.",
                  href: "/jobs",
                  link: "Explore jobs",
                },
                {
                  icon: Store,
                  title: "Meet local businesses",
                  text: "Get to know the people and teams behind local businesses, their work, and their open opportunities.",
                  href: "/businesses",
                  link: "Discover businesses",
                },
                {
                  icon: MapPin,
                  title: "Put opportunities on the map",
                  text: "Explore mapped job opportunities and see which businesses are hiring nearby.",
                  href: "/maps",
                  link: "Explore the map",
                },
                {
                  icon: Users,
                  title: "Grow your local circle",
                  text: "Find public professional profiles, make connections, and start conversations through friends or message requests.",
                  href: "/people",
                  link: "Find people",
                },
              ].map(({ icon: Icon, title, text, href, link }) => (
                <article className="panel" key={title}>
                  <span className="step-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <Link className="text-link" href={href}>
                    {link}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
          <section
            className="panel about-credit"
            aria-labelledby="about-developer-heading"
          >
            <p className="eyebrow">THE DEVELOPER BEHIND CANDELINK</p>
            <h2 id="about-developer-heading">Rafael Vincent D. Medina</h2>
            <p>
              CANDELINK was designed and developed by Rafael Vincent D. Medina,
              with a focus on helping people and businesses connect within their
              local community.
            </p>
            <Link className="button" href="/register">
              Become part of the community
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

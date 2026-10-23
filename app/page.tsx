import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Search,
  Sparkles,
  BriefcaseBusiness,
  Store,
  Users,
  Check,
  Sprout,
  GraduationCap,
  Coffee,
  Monitor,
  ShoppingBag,
  HeartHandshake,
} from "lucide-react";
import { Header, Footer, JobCard } from "@/components/site";
import { getJobs, featuredBusinesses } from "@/lib/data";

export default async function Home() {
  const { jobs, demo } = await getJobs();
  const businesses = await featuredBusinesses();
  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> BIG OPPORTUNITIES. RIGHT HERE AT HOME.
              </div>
              <h1>
                Find opportunities.
                <br />
                Grow{" "}
                <span>
                  locally.
                  <svg viewBox="0 0 285 18" aria-hidden="true">
                    <path d="M3 13 Q140 -4 280 9" />
                  </svg>
                </span>
              </h1>
              <p>
                Your next chapter could be just around the corner.
                <br className="desktop" /> Connect with local businesses,
                discover meaningful work,
                <br className="desktop" /> and build your future in Candelaria.
              </p>
              <form action="/jobs" className="hero-search">
                <Search size={21} />
                <input
                  aria-label="Job title, keyword, or company"
                  name="q"
                  placeholder="Job title, keyword, or company"
                />
                <span className="search-divider" />
                <MapPin size={19} />
                <span className="search-location">Candelaria, Quezon</span>
                <button className="button">
                  Find jobs <ArrowUpRight size={17} />
                </button>
              </form>
              <Link className="text-link map-browse-link" href="/maps">
                <MapPin size={16} aria-hidden="true" /> Explore nearby
                opportunities on the map ↗
              </Link>
              <div className="popular">
                <span>Popular searches:</span>
                {["Administrative", "Sales", "Fresh graduate"].map((t) => (
                  <Link key={t} href={`/jobs?q=${encodeURIComponent(t)}`}>
                    {t}
                  </Link>
                ))}
              </div>
              <div className="hero-foot">
                <span className="mini-avatars">
                  <Image
                    width={1000}
                    height={800}
                    sizes="(max-width: 600px) 100vw, 40vw"
                    src="/images/avatar-1.jpg"
                    alt=""
                  />
                  <Image
                    width={1000}
                    height={800}
                    sizes="(max-width: 600px) 100vw, 40vw"
                    src="/images/avatar-2.jpg"
                    alt=""
                  />
                  <Image
                    width={1000}
                    height={800}
                    sizes="(max-width: 600px) 100vw, 40vw"
                    src="/images/avatar-3.jpg"
                    alt=""
                  />
                  <span>
                    <Users size={15} />
                  </span>
                </span>
                <p>
                  A community built for <strong>people like you.</strong>
                </p>
              </div>
            </div>
            <div className="hero-art">
              <div className="photo-frame">
                <Image
                  width={1000}
                  height={800}
                  sizes="(max-width: 600px) 100vw, 40vw"
                  src="/images/workspace.jpg"
                  alt="A bright, welcoming local workspace with plants and shared tables"
                />
                <div className="photo-shade" />
                <div className="photo-caption">
                  <span className="location-dot">
                    <MapPin size={15} /> ROOTED IN OUR COMMUNITY
                  </span>
                  <h2>
                    Great things start
                    <br />
                    with local connections.
                  </h2>
                </div>
              </div>
              <div className="float-card opportunity">
                <div className="float-icon">
                  <BriefcaseBusiness size={20} />
                </div>
                <div>
                  <strong>Your next opportunity</strong>
                  <small>Closer than you think.</small>
                </div>
                <span className="circle-check">
                  <Check size={13} />
                </span>
              </div>
              <div className="float-card local">
                <span className="local-icon">
                  <Sprout size={24} />
                </span>
                <div>
                  <strong>Local talent. Local growth.</strong>
                  <small>Stronger together, right here.</small>
                </div>
              </div>
              <span className="art-spark">
                <Sparkles size={31} />
              </span>
            </div>
          </div>
        </section>
        <section className="trust-strip">
          <div className="container">
            <span>
              Made for Candelaria.
              <br />
              <strong>Built around you.</strong>
            </span>
            <div>
              <Store /> Local businesses
            </div>
            <div>
              <GraduationCap /> Fresh perspectives
            </div>
            <div>
              <Users /> Meaningful connections
            </div>
            <div>
              <Sprout /> Shared growth
            </div>
          </div>
        </section>
        <section className="section container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
              <h2>Good work. Close to home.</h2>
              <p>Discover opportunities from businesses in your community.</p>
            </div>
            <Link className="text-link" href="/jobs">
              Explore all jobs <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="jobs-grid">
            {jobs.slice(0, 6).map((job) => (
              <JobCard key={job.id} job={job} demo={demo} />
            ))}
          </div>
          {jobs.length === 0 && (
            <div className="empty-state home-empty-state">
              <BriefcaseBusiness size={28} aria-hidden="true" />
              <h3>Local opportunities are on the way</h3>
              <p>
                Build your profile now so you are ready when a local team starts
                hiring.
              </p>
              <Link className="button" href="/register">
                Create your profile
              </Link>
            </div>
          )}
          {demo && (
            <p className="sample-note">
              A glimpse of what’s possible. Listings shown are sample
              opportunities, not active vacancies.
            </p>
          )}
          <div className="center">
            <Link className="button outline" href="/jobs">
              Find your next opportunity <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="business-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  THE PEOPLE BEHIND OUR LOCAL ECONOMY
                </div>
                <h2>Small businesses. Big possibilities.</h2>
                <p>Get to know the teams making our town thrive.</p>
              </div>
              <Link href="/businesses" className="text-link">
                Meet local businesses <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="business-teasers">
              {businesses
                .map((b, i) => ({
                  ...b,
                  image: ["cafe.jpg", "studio.jpg", "local.jpg"][i % 3],
                  icon: [Coffee, Monitor, ShoppingBag][i % 3],
                }))
                .map((b, i) => (
                  <Link
                    className="business-teaser"
                    href={`/businesses/${b.id}`}
                    key={b.name}
                  >
                    <Image
                      width={1000}
                      height={800}
                      sizes="(max-width: 600px) 100vw, 40vw"
                      src={`/images/${b.image}`}
                      alt={`${b.category} workspace`}
                    />
                    <div>
                      <span className={`company-logo color-${i}`}>
                        <b.icon size={23} />
                      </span>
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.category}
                          {demo
                            ? " · Sample business"
                            : " · Candelaria, Quezon"}
                        </small>
                      </span>
                      <ArrowUpRight size={20} />
                    </div>
                  </Link>
                ))}
            </div>
            {businesses.length === 0 && (
              <div className="empty-state home-empty-state">
                <Store size={28} aria-hidden="true" />
                <h3>Make your business part of the community</h3>
                <p>Introduce your team and connect with local talent.</p>
                <Link
                  className="button outline"
                  href="/register?role=business_owner"
                >
                  Create a business profile
                </Link>
              </div>
            )}
          </div>
        </section>
        <section className="section container how-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A LITTLE CONNECTION GOES A LONG WAY</div>
              <h2>Your future, a few steps closer.</h2>
            </div>
            <p>
              Whether you’re finding your place or growing your team,
              <br />
              let’s take the next step together.
            </p>
          </div>
          <div className="steps">
            {[
              {
                n: "01",
                icon: Users,
                title: "Make yourself known",
                text: "Create a profile that tells your story. Your skills, your experience, your potential.",
              },
              {
                n: "02",
                icon: Search,
                title: "Find your connection",
                text: "Explore local opportunities and businesses that share your ambitions.",
              },
              {
                n: "03",
                icon: HeartHandshake,
                title: "Start something great",
                text: "Apply with confidence, meet your next team, and grow right where you belong.",
              },
            ].map((s) => (
              <div className="step" key={s.n}>
                <div>
                  <span className="step-icon">
                    <s.icon size={24} />
                  </span>
                  <span className="step-number">{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="container">
          <div className="hiring-banner">
            <div className="banner-decoration">
              <Store size={86} strokeWidth={1} />
            </div>
            <div>
              <span className="eyebrow">FOR THE LOCAL DREAM BUILDERS</span>
              <h2>Great teams grow locally.</h2>
              <p>
                Your next great hire might be your neighbor.
                <br />
                Find the right people to help your business move forward.
              </p>
            </div>
            <Link href="/register?role=business_owner" className="button light">
              Start hiring locally <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="join-section container">
          <Sprout size={28} />
          <h2>You don’t have to go far to go forward.</h2>
          <p>
            Put your skills on the map. Your community is full of possibilities.
          </p>
          <Link className="button" href="/register">
            Create your free profile <ArrowUpRight size={17} />
          </Link>
          <small>For your career. For your community.</small>
        </section>
      </main>
      <Footer />
    </>
  );
}

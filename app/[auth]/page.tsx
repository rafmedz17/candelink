import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Sprout } from "lucide-react";
import { Header, Footer, PageTitle } from "@/components/site";
import { AuthForm } from "@/components/forms";
export function generateStaticParams() {
  return [
    "login",
    "register",
    "forgot-password",
    "reset-password",
    "privacy",
    "terms",
  ].map((auth) => ({ auth }));
}
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ auth: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { auth } = await params;
  const p = await searchParams;
  if (["privacy", "terms"].includes(auth))
    return (
      <>
        <Header />
        <main id="main-content" className="container legal">
          <PageTitle
            eyebrow="TRUST IS PART OF THE CONNECTION"
            title={
              auth === "privacy"
                ? "Your privacy matters."
                : "Our community, our commitments."
            }
            description="Draft policy for the CANDELINK development platform. Review before public launch."
          />
          {(auth === "privacy"
            ? [
                [
                  "What we collect",
                  "Account details, professional profiles, business information, CVs, and application history are used to connect local talent with local businesses. Public business profiles and published jobs can be viewed by anyone. Your CV and application history remain private.",
                ],
                [
                  "Who can access your data",
                  "Only you and authorized hiring teams for jobs you apply to can access your applications and CVs. Business notes are visible only to the authorized hiring team. Administrative access is restricted and moderation actions are recorded.",
                ],
                [
                  "Your choices",
                  "You can edit your profile, withdraw eligible applications, and request account deletion or a copy of your data through the platform operator. Never upload sensitive government identifiers in your CV.",
                ],
                [
                  "Storage and retention",
                  "Data is stored through Supabase. The operator must configure retention periods, identify the data controller and contact address, and complete a privacy review under applicable Philippine law before launch.",
                ],
              ]
            : [
                [
                  "Using CANDELINK",
                  "Create an accurate profile, respect others, and use the platform only for lawful professional networking and recruitment. You must be authorized to represent any business you register.",
                ],
                [
                  "Fair and honest hiring",
                  "Businesses must complete verification before publishing. Do not publish deceptive jobs, request application fees, discriminate unlawfully, or misuse applicant information.",
                ],
                [
                  "Applications and moderation",
                  "Applying does not guarantee employment. Users may report suspicious content. Administrators may unpublish jobs or suspend accounts with recorded reasons. Contact the operator to request review.",
                ],
                [
                  "Development status",
                  "This development build includes clearly marked sample content. It is not a guarantee of employment or an endorsement of any business. Final operator identity, contact details, and legally reviewed terms must be added before launch.",
                ],
              ]
          ).map(([title, text]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </section>
          ))}
        </main>
        <Footer />
      </>
    );
  if (
    !["login", "register", "forgot-password", "reset-password"].includes(auth)
  )
    notFound();
  const title =
    auth === "register"
      ? "Your next chapter starts here."
      : auth === "login"
        ? "Good to see you again."
        : auth === "reset-password"
          ? "A fresh start, securely."
          : "Let’s get you back in.";
  return (
    <>
      <Header />
      <main id="main-content" className="auth-layout">
        <section className="auth-story">
          <Sprout size={52} strokeWidth={1.2} />
          <div className="eyebrow">WHERE CANDELARIA CONNECTS.</div>
          <h1>
            You don’t have to
            <br />
            go far to go forward.
          </h1>
          <p>
            Discover meaningful work, meet local businesses, and build your
            future in the community you call home.
          </p>
          <ul className="auth-benefits">
            <li>
              <Check size={16} aria-hidden="true" /> Free to create a profile
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Made for local connections
            </li>
          </ul>
        </section>
        <section className="auth-form">
          <div className="eyebrow auth-eyebrow">YOUR LOCAL COMMUNITY</div>
          <h2>{title}</h2>
          <p>
            {auth === "register"
              ? "Build your profile and find your place in our local community."
              : auth === "login"
                ? "Log in to continue building your local connections."
                : "We’ll help you securely recover access to your account."}
          </p>
          <AuthForm
            returnTo={
              p.next === "/contact" ||
              /^\/businesses\/[0-9a-f-]{36}$/i.test(p.next || "")
                ? p.next
                : undefined
            }
            mode={auth}
            role={p.role}
          />
          <div className="auth-links">
            {auth === "login" ? (
              <>
                <Link href="/forgot-password">Forgot password?</Link>
                <Link href="/register">New here? Join us ↗</Link>
              </>
            ) : (
              <Link href="/login">Already connected? Log in ↗</Link>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

import Link from "next/link";
import { Header, Footer, PageTitle } from "@/components/site";
import { ContactAdminForm } from "@/components/contact-admin-form";
import { supabase } from "@/lib/supabase/server";

export const metadata = { title: "Contact the team | Candelink" };
export default async function Contact() {
  const db = await supabase();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const { data: profile } = user
    ? await db!
        .from("profiles")
        .select("role,suspended")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container" style={{ maxWidth: 760 }}>
          <PageTitle
            eyebrow="WE'RE HERE TO HELP"
            title="Contact the team"
            description="Send a private message to a Candelink administrator. Continue the conversation in your Messages inbox."
          />
          <section className="panel">
            {!user ? (
              <>
                <h2>Log in to send a message</h2>
                <p>
                  Use your account so the admin can reply directly to your
                  inbox.
                </p>
                <Link
                  className="button"
                  href="/login?next=/contact"
                  style={{ marginTop: 20 }}
                >
                  Log in to contact admin
                </Link>
              </>
            ) : !profile || profile.suspended ? (
              <p role="alert">
                This account is currently unavailable for messaging.
              </p>
            ) : profile.role === "admin" ? (
              <>
                <h2>Your admin inbox</h2>
                <p>Read and reply to community messages from your inbox.</p>
                <Link
                  className="button"
                  href="/messages"
                  style={{ marginTop: 20 }}
                >
                  Open inbox
                </Link>
              </>
            ) : (
              <ContactAdminForm />
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

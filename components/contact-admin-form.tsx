"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { contactAdmin } from "@/app/contact/actions";
import { createMessageId } from "@/lib/social";
import { useFeedback } from "./use-feedback";

export function ContactAdminForm() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useFeedback();
  const attempt = useRef<{ id: string; content: string } | null>(null);
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!content.trim() || pending) return;
        setPending(true);
        setResult(null);
        try {
          if (!attempt.current || attempt.current.content !== content)
            attempt.current = { id: createMessageId(), content };
          const response = await contactAdmin(attempt.current.id, content);
          setResult(response);
          if (response.ok && response.url) {
            setContent("");
            router.push(response.url);
            router.refresh();
          }
        } catch {
          setResult({
            ok: false,
            message:
              "Your message could not be sent. Check your connection and try again.",
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Your message
        <textarea
          name="message"
          rows={6}
          required
          maxLength={4000}
          value={content}
          disabled={pending}
          onChange={(event) => {
            setContent(event.target.value);
            setResult(null);
          }}
          placeholder="Tell us how we can help..."
        />
      </label>
      <small>
        {content.length}/4000 characters. Replies will arrive in your Messages
        inbox.
      </small>
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
      <button className="button" disabled={pending || !content.trim()}>
        <Send size={17} aria-hidden="true" />
        {pending ? "Sending..." : "Send to admin"}
      </button>
    </form>
  );
}

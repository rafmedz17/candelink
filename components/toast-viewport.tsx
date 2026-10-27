"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, MessageCircle, X } from "lucide-react";
import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToasts,
} from "@/lib/toasts";
export function ToastViewport() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    function updateTarget() {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      const element = dialogs.item(dialogs.length - 1) || document.body;
      setTarget((previous) => (previous === element ? previous : element));
    }
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    queueMicrotask(updateTarget);
    return () => observer.disconnect();
  }, []);
  const items = useSyncExternalStore(
    subscribeToasts,
    getToasts,
    getServerToasts,
  );
  if (!items.length) return null;
  return createPortal(
    <div className="toast-viewport" aria-label="Notifications">
      {items.map((item) => (
        <div
          key={item.id}
          className={`app-toast app-toast-${item.kind}`}
          role={item.kind === "error" ? "alert" : "status"}
        >
          {item.kind === "error" ? (
            <CircleAlert size={19} aria-hidden="true" />
          ) : item.kind === "message" ? (
            <MessageCircle size={19} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={19} aria-hidden="true" />
          )}
          <div>
            <p>{item.message}</p>
            {item.href && (
              <Link href={item.href} onClick={() => dismissToast(item.id)}>
                Open conversation →
              </Link>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(item.id)}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>,
    target || document.body,
  );
}

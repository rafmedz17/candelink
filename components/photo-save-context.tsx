"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Task = { scope: string; dirty: boolean; save: () => Promise<void> };
type Registry = {
  dirty: Record<string, boolean>;
  register: (id: string, task: Task | null) => void;
  save: (scope: string) => Promise<void>;
  busy: boolean;
  registerForm: (id: string, task: Task | null) => void;
};
const Context = createContext<Registry | null>(null);
export function PhotoSaveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const forms = useRef(new Map<string, Task>());
  const [formsDirty, setFormsDirty] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const allowLeave = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const tasks = useRef(new Map<string, Task>());
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const registerForm = useCallback((id: string, task: Task | null) => {
    if (task) forms.current.set(id, task);
    else forms.current.delete(id);
    setFormsDirty([...forms.current.values()].some((item) => item.dirty));
  }, []);
  const hasChanges = formsDirty || Object.keys(dirty).length > 0;
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!hasChanges || allowLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (
        !hasChanges ||
        allowLeave.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const target = new URL(anchor.href, location.href);
      if (target.protocol !== "http:" && target.protocol !== "https:") return;
      if (
        target.origin === location.origin &&
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setError("");
      setDestination(target.href);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    // Browsers exposing the Navigation API can also cancel same-tab history
    // traversal before the current React tree is replaced.
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    function historyNavigate(event: Event) {
      const next = event as Event & {
        navigationType?: string;
        destination?: { url: string };
        hashChange?: boolean;
      };
      if (
        !hasChanges ||
        allowLeave.current ||
        next.navigationType !== "traverse" ||
        next.hashChange ||
        !next.cancelable ||
        !next.destination
      )
        return;
      next.preventDefault();
      setError("");
      setDestination(next.destination.url);
    }
    navigation?.addEventListener("navigate", historyNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", historyNavigate);
    };
  }, [hasChanges]);
  useEffect(() => {
    if (destination && !dialog.current?.open) dialog.current?.showModal();
    else if (!destination) dialog.current?.close();
  }, [destination]);
  function leave() {
    if (!destination) return;
    allowLeave.current = true;
    const target = new URL(destination);
    setDestination(null);
    if (target.origin === location.origin)
      router.push(target.pathname + target.search + target.hash);
    else location.assign(target.href);
  }
  async function saveAndLeave() {
    setLeaving(true);
    setError("");
    try {
      for (const form of [...forms.current.values()])
        if (form.dirty) await form.save();
      leave();
    } catch {
      setError(
        "Please check your form and try saving again. Your changes are still here.",
      );
    } finally {
      setLeaving(false);
    }
  }
  const register = useCallback((id: string, task: Task | null) => {
    if (task) tasks.current.set(id, task);
    else tasks.current.delete(id);
    const next: Record<string, boolean> = {};
    for (const item of tasks.current.values())
      if (item.dirty) next[item.scope] = true;
    setDirty((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
  }, []);
  async function save(scope: string) {
    setBusy(true);
    try {
      for (const task of tasks.current.values())
        if (task.scope === scope && task.dirty) await task.save();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider value={{ dirty, register, save, busy, registerForm }}>
      {children}
      <dialog
        ref={dialog}
        className="unsaved-changes-dialog photo-crop-dialog"
        aria-labelledby="unsaved-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!leaving) setDestination(null);
        }}
      >
        <h2 id="unsaved-title">Save your changes?</h2>
        <p>You have unsaved changes. Save them before leaving this page?</p>
        {error && (
          <p role="alert" className="form-message error">
            {error}
          </p>
        )}
        <div className="photo-crop-actions">
          <button
            type="button"
            className="button outline"
            disabled={leaving}
            onClick={() => setDestination(null)}
          >
            Stay here
          </button>
          <button
            type="button"
            className="button outline danger"
            disabled={leaving}
            onClick={leave}
          >
            Discard
          </button>
          <button
            type="button"
            className="button"
            disabled={leaving || busy}
            onClick={saveAndLeave}
          >
            {leaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </dialog>
    </Context.Provider>
  );
}
export const usePhotoSave = () => useContext(Context);
export function useUnsavedForm(dirty: boolean, save: () => Promise<void>) {
  const context = usePhotoSave();
  const register = context?.registerForm;
  const id = useId();
  useEffect(() => {
    register?.(id, { scope: "form", dirty, save });
  });
  useEffect(() => () => register?.(id, null), [register, id]);
}
export function usePhotoTask(
  scope: string,
  dirty: boolean,
  save: () => Promise<void>,
) {
  const context = usePhotoSave();
  const register = context?.register;
  const id = useId();
  useEffect(() => {
    register?.(id, { scope, dirty, save });
  });
  useEffect(() => () => register?.(id, null), [register, id]);
  return context;
}

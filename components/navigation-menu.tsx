"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function NavigationMenu({
  label,
  className,
  trigger,
  children,
}: {
  label: string;
  className: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) {
        menu.current.open = false;
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <details ref={menu} className={className}>
      <summary aria-label={label} title={label}>
        {trigger}
      </summary>
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button")) {
            if (menu.current) menu.current.open = false;
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export type Toast = {
  id: number;
  message: string;
  kind: "success" | "error" | "message";
  href?: string;
};
let items: Toast[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
export function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  listeners.forEach((listener) => listener());
}
export function showToast(
  message: string,
  kind: Toast["kind"] = "success",
  href?: string,
) {
  const id = ++nextId;
  for (const item of items) {
    if (item.message === message && item.kind === kind && item.href === href)
      dismissToast(item.id);
  }
  while (items.length >= 3) dismissToast(items[0].id);
  items = [...items, { id, message, kind, href }];
  timers.set(
    id,
    setTimeout(() => dismissToast(id), 4000),
  );
  listeners.forEach((listener) => listener());
  return id;
}
export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getToasts = () => items;
const empty: Toast[] = [];
export const getServerToasts = () => empty;

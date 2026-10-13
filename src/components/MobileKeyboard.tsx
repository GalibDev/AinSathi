import { useEffect } from "react";

// Keep the browser's native keyboard; only manage focus and surrounding chrome.
export function MobileKeyboard() {
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const viewport = window.visualViewport;
    let keyboardWasOpen = false;
    let frame = 0;
    const editing = () => {
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement && !el.readOnly && !el.disabled)
        return el;
      if (
        el instanceof HTMLInputElement &&
        !el.readOnly &&
        !el.disabled &&
        [
          "text",
          "search",
          "email",
          "password",
          "tel",
          "url",
          "number",
        ].includes(el.type)
      )
        return el;
      return null;
    };
    const sync = () => {
      const active = editing();
      const open = Boolean(mobile.matches && active);
      document.documentElement.classList.toggle("mobile-editing", open);
      if (!open) keyboardWasOpen = false;
      if (open && active instanceof HTMLInputElement)
        active.enterKeyHint = "done";
    };
    const focusChanged = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const outside = (event: PointerEvent) => {
      if (!mobile.matches) return;
      const active = editing();
      const target = event.target;
      if (!active || !(target instanceof Element)) return;
      // Labels and other fields must retain native focus transfer behavior.
      if (
        target.closest(
          "input, textarea, select, label, [contenteditable='true']",
        )
      )
        return;
      active.blur();
      sync();
    };
    const done = (event: KeyboardEvent) => {
      if (
        !mobile.matches ||
        event.key !== "Enter" ||
        event.isComposing ||
        event.shiftKey
      )
        return;
      const active = editing();
      // Enter remains a newline in notes. Single-line fields finish editing.
      if (active instanceof HTMLInputElement) {
        event.preventDefault();
        active.blur();
        sync();
      }
    };
    const resized = () => {
      if (!mobile.matches || !editing() || !viewport || viewport.scale !== 1)
        return;
      const reduced = window.innerHeight - viewport.height > 140;
      if (keyboardWasOpen && !reduced) editing()?.blur();
      keyboardWasOpen = reduced;
      sync();
    };
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", done);
    viewport?.addEventListener("resize", resized);
    mobile.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", done);
      viewport?.removeEventListener("resize", resized);
      mobile.removeEventListener("change", sync);
      document.documentElement.classList.remove("mobile-editing");
    };
  }, []);
  return null;
}

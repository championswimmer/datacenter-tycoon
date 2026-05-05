import { useEffect, useRef, type RefObject } from "react";

export function useDialogFocus(closeButtonRef: RefObject<HTMLElement | null>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusHandle = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusHandle);
      previousFocusRef.current?.focus();
    };
  }, [closeButtonRef]);
}

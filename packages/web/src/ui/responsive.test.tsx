import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  COMFORTABLE_TOUCH_TARGET_PX,
  getResponsiveMode,
  MIN_TOUCH_TARGET_PX,
  useIsPhoneViewport,
  useResponsiveMode,
} from "./responsive.js";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  window.dispatchEvent(new Event("resize"));
}

function ResponsiveProbe() {
  const mode = useResponsiveMode();
  const isPhone = useIsPhoneViewport();

  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="is-phone">{String(isPhone)}</span>
    </div>
  );
}

afterEach(() => {
  act(() => {
    setViewportWidth(1280);
  });
});

describe("responsive helpers", () => {
  it("uses the shared touch target minimums", () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(44);
    expect(COMFORTABLE_TOUCH_TARGET_PX).toBeGreaterThan(MIN_TOUCH_TARGET_PX);
  });

  it("maps viewport widths to phone, tablet, and desktop modes", () => {
    expect(getResponsiveMode(320)).toBe("phone");
    expect(getResponsiveMode(767)).toBe("phone");
    expect(getResponsiveMode(768)).toBe("tablet");
    expect(getResponsiveMode(1023)).toBe("tablet");
    expect(getResponsiveMode(1024)).toBe("desktop");
  });

  it("updates subscribers when the viewport crosses breakpoints", () => {
    act(() => {
      setViewportWidth(390);
    });

    render(<ResponsiveProbe />);

    expect(screen.getByTestId("mode").textContent).toBe("phone");
    expect(screen.getByTestId("is-phone").textContent).toBe("true");

    act(() => {
      setViewportWidth(900);
    });

    expect(screen.getByTestId("mode").textContent).toBe("tablet");
    expect(screen.getByTestId("is-phone").textContent).toBe("false");

    act(() => {
      setViewportWidth(1280);
    });

    expect(screen.getByTestId("mode").textContent).toBe("desktop");
  });
});

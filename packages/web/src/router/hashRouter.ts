import { useState, useEffect } from "react";

// ── Route shape ────────────────────────────────────────────────────────────────

export type Route =
  | { view: "home" }
  | { view: "dc"; dcId: string; tab: DcTab }
  | { view: "contracts" }
  | { view: "log" }
  | { view: "theme-playground" }; // dev-only

export type DcTab = "floor" | "power" | "contracts";

// ── Parse ──────────────────────────────────────────────────────────────────────

export function parseRoute(hash: string): Route {
  // strip leading "#" and optional leading "/"
  const path = hash.replace(/^#\/?/, "").replace(/^\//, "");

  if (!path) return { view: "home" };

  const segments = path.split("/").filter(Boolean);
  const [seg0, seg1, seg2] = segments;

  if (seg0 === "__theme") return { view: "theme-playground" };
  if (seg0 === "contracts") return { view: "contracts" };
  if (seg0 === "log") return { view: "log" };

  if (seg0 === "dc" && seg1) {
    const tab = seg2 === "power" ? "power" : seg2 === "contracts" ? "contracts" : "floor";
    return { view: "dc", dcId: seg1, tab };
  }

  return { view: "home" };
}

// ── Serialize ──────────────────────────────────────────────────────────────────

export function routeToHash(route: Route): string {
  switch (route.view) {
    case "home":              return "#/";
    case "dc":                return `#/dc/${route.dcId}/${route.tab}`;
    case "contracts":         return "#/contracts";
    case "log":               return "#/log";
    case "theme-playground":  return "#/__theme";
  }
}

// ── Navigate ───────────────────────────────────────────────────────────────────

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route).slice(1); // drop leading "#"
}

export function navigateToDc(dcId: string, tab: DcTab = "floor"): void {
  navigate({ view: "dc", dcId, tab });
}

// ── React hook ─────────────────────────────────────────────────────────────────

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

type DesktopApi = NonNullable<Window["desktop"]>;

export function getDesktopApi(): DesktopApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.desktop;
}

export function isDesktopRuntime(): boolean {
  return getDesktopApi()?.isDesktop === true;
}

export async function applyDesktopMetadata(doc: Document): Promise<void> {
  doc.documentElement.dataset.platform = isDesktopRuntime() ? "desktop" : "web";

  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    return;
  }

  try {
    const version = await desktopApi.getAppVersion();
    doc.documentElement.dataset.desktopVersion = version;
  } catch {
    doc.documentElement.dataset.desktopVersion = "unknown";
  }
}

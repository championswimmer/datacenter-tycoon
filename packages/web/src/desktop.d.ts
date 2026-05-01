declare global {
  interface Window {
    desktop?: {
      readonly isDesktop: true;
      getAppVersion(): Promise<string>;
      getPlatform(): Promise<string>;
    };
  }
}

export {};

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@datacenter-tycoon/web/theme/tokens.css";
import "@datacenter-tycoon/web/theme/global.css";
import { applyDesktopMetadata } from "@datacenter-tycoon/web";
import { App } from "./App.js";

void applyDesktopMetadata(document);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

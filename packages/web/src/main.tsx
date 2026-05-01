import React from "react";
import ReactDOM from "react-dom/client";
import "./theme/tokens.css";
import "./theme/global.css";
import App from "./App.js";
import { applyDesktopMetadata } from "./platform/desktop.js";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

void applyDesktopMetadata(document);

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

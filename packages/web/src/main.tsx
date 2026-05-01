import React from "react";
import ReactDOM from "react-dom/client";
import "./theme/tokens.css";
import "./theme/global.css";
import App from "./App.js";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

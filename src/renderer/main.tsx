import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";

import { installMockApi } from "./dev/mockApi";
import { ToastProvider } from "./components/Toast";
import { App } from "./App";

installMockApi();

const container = document.getElementById("root");
if (container === null) {
  throw new Error("The root container is missing from index.html.");
}

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);

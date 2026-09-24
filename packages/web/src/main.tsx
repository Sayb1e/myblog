import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { SetupWizard } from "./components/SetupWizard.js";
import { ToastProvider } from "./hooks/useToasts.js";
import { PreferencesProvider } from "./prefs.js";
import "./styles.css";

function Boot() {
  const [state, setState] = useState<{ ready: boolean; root: string } | null>(null);

  useEffect(() => {
    const check = window.myblog?.state;
    if (!check) {
      setState({ ready: true, root: "" });
      return;
    }
    check()
      .then(setState)
      .catch(() => setState({ ready: true, root: "" }));
  }, []);

  if (!state) return null;
  return state.ready ? <App /> : <SetupWizard />;
}

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 节点");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <PreferencesProvider>
        <ToastProvider>
          <Boot />
        </ToastProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  </StrictMode>,
);

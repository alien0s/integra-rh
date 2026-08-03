import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider, PersonificacaoProvider } from "./features/auth";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <BrowserRouter>
        <AuthProvider>
          <PersonificacaoProvider>
            <App />
          </PersonificacaoProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

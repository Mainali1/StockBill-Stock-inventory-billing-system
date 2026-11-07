import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { IpcChannels } from "@shared/ipc";
import { call } from "./api";
import { NavBar } from "./components/NavBar";
import { PageFrame } from "./components/PageFrame";
import { PageHeader } from "./components/PageHeader";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { SalesPage } from "./pages/SalesPage";

type AuthStatus = IpcChannels["auth:status"]["out"];

type GuardArea = "setup" | "login" | "app";

/** Sends the visitor to the screen that matches the current session state. */
function Guard({
  status,
  area,
  children,
}: {
  status: AuthStatus;
  area: GuardArea;
  children: ReactNode;
}) {
  if (!status.hasUser) {
    return area === "setup" ? <>{children}</> : <Navigate to="/setup" replace />;
  }
  if (!status.signedIn) {
    return area === "login" ? <>{children}</> : <Navigate to="/login" replace />;
  }
  return area === "app" ? <>{children}</> : <Navigate to="/" replace />;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <NavBar />
      <PageFrame>
        <PageHeader title={title} />
        <p className="placeholder-note">Not built yet.</p>
      </PageFrame>
    </>
  );
}

export function App() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    let cancelled = false;
    call("auth:status", undefined)
      .then((result) => {
        if (!cancelled) {
          setStatus(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ hasUser: true, signedIn: false, username: null, shopName: null });
        }
      });

    call("app:getVersion", undefined)
      .then((res) => {
        if (!cancelled && res?.version) {
          setVersion(res.version);
        }
      })
      .catch(() => {
        // fallback
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === null) {
    return null;
  }

  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <Guard status={status} area="setup">
            <SetupPage
              version={version}
              onSuccess={(data) => {
                setStatus({
                  hasUser: true,
                  signedIn: true,
                  username: data.username,
                  shopName: data.shopName,
                });
              }}
            />
          </Guard>
        }
      />
      <Route
        path="/login"
        element={
          <Guard status={status} area="login">
            <LoginPage
              version={version}
              shopName={status.shopName ?? ""}
              onSuccess={(data) => {
                setStatus({
                  hasUser: true,
                  signedIn: true,
                  username: data.username,
                  shopName: data.shopName,
                });
              }}
            />
          </Guard>
        }
      />
      <Route
        path="/"
        element={
          <Guard status={status} area="app">
            <PlaceholderPage title="Dashboard" />
          </Guard>
        }
      />
      <Route
        path="/sales"
        element={
          <Guard status={status} area="app">
            <SalesPage />
          </Guard>
        }
      />
      <Route
        path="/inventory"
        element={
          <Guard status={status} area="app">
            <InventoryPage />
          </Guard>
        }
      />
      <Route
        path="/suppliers"
        element={
          <Guard status={status} area="app">
            <SuppliersPage />
          </Guard>
        }
      />
      <Route
        path="/reports"
        element={
          <Guard status={status} area="app">
            <PlaceholderPage title="Reports" />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

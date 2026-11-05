import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { IpcChannels } from "@shared/ipc";
import { call } from "./api";
import { NavBar } from "./components/NavBar";
import { PageFrame } from "./components/PageFrame";
import { PageHeader } from "./components/PageHeader";

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

function CenteredCard({ title }: { title: string }) {
  return (
    <div className="centered-card-page">
      <div className="centered-card">
        <h1 className="centered-card__title">{title}</h1>
      </div>
    </div>
  );
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
            <CenteredCard title="Setup" />
          </Guard>
        }
      />
      <Route
        path="/login"
        element={
          <Guard status={status} area="login">
            <CenteredCard title="Login" />
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
            <PlaceholderPage title="Sales" />
          </Guard>
        }
      />
      <Route
        path="/inventory"
        element={
          <Guard status={status} area="app">
            <PlaceholderPage title="Inventory" />
          </Guard>
        }
      />
      <Route
        path="/suppliers"
        element={
          <Guard status={status} area="app">
            <PlaceholderPage title="Suppliers" />
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

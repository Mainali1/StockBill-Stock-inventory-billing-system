import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { call } from "../api";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/sales", label: "Sales", end: false },
  { to: "/inventory", label: "Inventory", end: false },
  { to: "/suppliers", label: "Suppliers", end: false },
  { to: "/reports", label: "Reports", end: false },
];

/** Top navigation bar: wordmark, section links, username and Sign out. */
export function NavBar() {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call("auth:status", undefined)
      .then((status) => {
        if (!cancelled) {
          setUsername(status.username);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsername(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut(): Promise<void> {
    try {
      await call("auth:logout", undefined);
    } finally {
      navigate("/login");
    }
  }

  return (
    <nav className="navbar no-print">
      <span className="navbar__wordmark">StockBill</span>
      <ul className="navbar__links">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "navbar__link navbar__link--active" : "navbar__link"
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="navbar__account">
        <span className="navbar__username">{username}</span>
        <button type="button" className="navbar__signout" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DashboardDto, WeekBarDto } from "@shared/ipc/reports";
import { call } from "../api";
import { NavBar } from "../components/NavBar";
import { PageFrame } from "../components/PageFrame";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { Stamp } from "../components/Stamp";
import { Button } from "../components/Controls";
import { EmptyState, Loading } from "../components/EmptyState";
import { formatCard, formatTable } from "../../main/domain/money";
import { formatLong, formatShort, todayDb } from "../../main/domain/dates";

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayDb());
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await call("dashboard:get", { date });
      setData(res);
    } catch {
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(selectedDate);
  }, [selectedDate, loadDashboard]);

  const maxWeekSales = data?.week
    ? Math.max(0, ...data.week.map((w: WeekBarDto) => w.sales))
    : 0;

  return (
    <>
      <NavBar />
      <PageFrame>
        <PageHeader
          title="Dashboard"
          subtitle={formatLong(selectedDate)}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <input
                type="date"
                aria-label="Dashboard date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                style={{
                  minHeight: "36px",
                  padding: "0 var(--space-2)",
                  background: "var(--paper-hi)",
                  border: "var(--border-thin) solid var(--ink)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                }}
              />
              <Link to="/sales" style={{ textDecoration: "none" }}>
                <Button variant="primary" style={{ minHeight: "36px" }}>
                  New sale
                </Button>
              </Link>
            </div>
          }
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <div
            style={{
              padding: "var(--space-6)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <p style={{ color: "var(--red)", fontWeight: 600, margin: 0 }}>{error}</p>
            <Button variant="secondary" onClick={() => loadDashboard(selectedDate)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* Stat Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--space-4)",
              }}
            >
              <StatCard
                label={
                  data.isToday
                    ? "TODAY'S SALES"
                    : `SALES ON ${formatShort(data.date).toUpperCase()}`
                }
                value={formatCard(data.sales)}
                tone="default"
              />
              <StatCard
                label={
                  data.isToday
                    ? "TODAY'S PROFIT"
                    : `PROFIT ON ${formatShort(data.date).toUpperCase()}`
                }
                value={formatCard(data.profit)}
                tone={data.profit >= 0 ? "good" : "bad"}
              />
              <StatCard
                label="LOW-STOCK ITEMS"
                value={data.lowStockCount}
                tone="bad"
              />
              <StatCard
                label="SUPPLIER DUES"
                value={formatCard(data.supplierDue)}
                tone="default"
              />
            </div>

            {/* Middle Section: Sales This Week & Needs Restock */}
            <div style={{ display: "flex", gap: "var(--space-6)" }}>
              {/* Sales this week chart */}
              <section
                style={{
                  flex: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "var(--text-lg)",
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  Sales this week
                </h2>
                <div
                  className="dashboard-week-chart"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    height: "180px",
                    gap: "var(--space-3)",
                    borderBottom: "var(--border-thin) solid var(--ink)",
                    paddingBottom: "var(--space-1)",
                    width: "100%",
                  }}
                >
                  {data.week.map((day: WeekBarDto) => {
                    const isSelected = day.date === data.date;
                    const pct =
                      maxWeekSales > 0 ? (day.sales / maxWeekSales) * 100 : 0;
                    const isZero = day.sales === 0;
                    const titleText = `${day.label}: ${formatCard(day.sales)}`;

                    return (
                      <div
                        key={day.date}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          height: "100%",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "center",
                            width: "100%",
                            flex: 1,
                          }}
                        >
                          <div
                            title={titleText}
                            aria-label={titleText}
                            style={{
                              position: "relative",
                              width: "80%",
                              maxWidth: "28px",
                              height: isZero ? "2px" : `${Math.max(2, pct)}%`,
                              background: "var(--ink)",
                              minHeight: "2px",
                            }}
                          >
                            {!isZero && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  width: 0,
                                  height: 0,
                                  borderStyle: "solid",
                                  borderWidth: "4px 0 0 4px",
                                  borderColor:
                                    "transparent transparent transparent var(--paper-hi)",
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontFamily: isSelected
                              ? "var(--font-body)"
                              : "var(--font-mono)",
                            color: isSelected
                              ? "var(--ink)"
                              : "var(--ink-soft)",
                            fontWeight: isSelected ? 700 : 400,
                            marginTop: "var(--space-1)",
                          }}
                        >
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Needs restock list */}
              <section
                style={{
                  flex: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "var(--text-lg)",
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  Needs restock
                </h2>
                {data.restock.length === 0 ? (
                  <EmptyState title="Nothing needs restocking" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {data.restock.map((item) => (
                      <Link
                        key={item.productId}
                        to={`/inventory?product=${item.productId}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "var(--space-2) 0",
                          borderBottom: "var(--border-thin) solid var(--rule)",
                          textDecoration: "none",
                          color: "var(--ink)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--red)",
                            fontWeight: 700,
                          }}
                        >
                          {item.quantity} left
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Bottom Section: Recent supplier invoices */}
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--text-lg)",
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Recent supplier invoices
              </h2>
              {data.recentInvoices.length === 0 ? (
                <EmptyState title="No supplier invoices yet" />
              ) : (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "var(--text-sm)",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "var(--border-thin) solid var(--ink)",
                        }}
                      >
                        <th
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            fontSize: "var(--text-xs)",
                            color: "var(--ink-soft)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 600,
                          }}
                        >
                          No.
                        </th>
                        <th
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            fontSize: "var(--text-xs)",
                            color: "var(--ink-soft)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 600,
                          }}
                        >
                          Supplier
                        </th>
                        <th
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "right",
                            fontSize: "var(--text-xs)",
                            color: "var(--ink-soft)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 600,
                          }}
                        >
                          Amount (Rs.)
                        </th>
                        <th
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            textAlign: "right",
                            fontSize: "var(--text-xs)",
                            color: "var(--ink-soft)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          onClick={() =>
                            navigate(`/suppliers?supplier=${inv.supplierId}`)
                          }
                          style={{
                            borderBottom: "var(--border-thin) solid var(--rule)",
                            cursor: "pointer",
                          }}
                        >
                          <td
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            <Link
                              to={`/suppliers?supplier=${inv.supplierId}`}
                              style={{
                                color: "var(--ink)",
                                textDecoration: "none",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.invoiceNo}
                            </Link>
                          </td>
                          <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                            {inv.supplierName}
                          </td>
                          <td
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              textAlign: "right",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {formatTable(inv.total)}
                          </td>
                          <td
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              textAlign: "right",
                            }}
                          >
                            <Stamp
                              kind={
                                inv.status === "PAID" ? "paid" : "due"
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </PageFrame>
    </>
  );
}

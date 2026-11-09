import React, { useCallback, useEffect, useState } from "react";
import type {
  DuesReportDto,
  ProfitReportDto,
  ReportDto,
  ReportTab,
  SalesReportDto,
  StockReportDto,
} from "@shared/ipc/reports";
import { formatCard, formatTable } from "../../main/domain/money";
import { formatLong, formatShort, todayDb } from "../../main/domain/dates";
import { resolveRange, type RangePreset } from "../../main/domain/reports";
import { call } from "../api";
import { BarChart, type BarGroup } from "../components/BarChart";
import { Button, Chip, TextInput } from "../components/Controls";
import { DataTable } from "../components/DataTable";
import { EmptyState, Loading } from "../components/EmptyState";
import { NavBar } from "../components/NavBar";
import { PageFrame } from "../components/PageFrame";
import { PageHeader } from "../components/PageHeader";
import { Stamp } from "../components/Stamp";
import { StatCard } from "../components/StatCard";
import { useToast } from "../components/Toast";

export function ReportsPage(): React.JSX.Element {
  const [tab, setTab] = useState<ReportTab>("profit");
  const [preset, setPreset] = useState<RangePreset | "custom">("week");
  const today = todayDb(new Date());
  const initialWeekRange = resolveRange("week", today);
  const [from, setFrom] = useState<string>(initialWeekRange.from);
  const [to, setTo] = useState<string>(initialWeekRange.to);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDto | null>(null);
  const [shopName, setShopName] = useState<string>("Demo Mart");

  const toast = useToast();

  useEffect(() => {
    call("auth:status", undefined)
      .then((status) => {
        if (status.shopName) {
          setShopName(status.shopName);
        }
      })
      .catch(() => {
        // fallback
      });
  }, []);

  const loadReport = useCallback(
    (currentTab: ReportTab, currentFrom: string, currentTo: string) => {
      setLoading(true);
      setError(null);
      let active = true;
      call("reports:get", { tab: currentTab, from: currentFrom, to: currentTo })
        .then((res) => {
          if (active) {
            setReport(res);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            const msg = err?.message || "Failed to load report.";
            setError(msg);
            toast.error(msg);
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    },
    [toast]
  );

  useEffect(() => {
    return loadReport(tab, from, to);
  }, [tab, from, to, loadReport]);

  const handleTabChange = (newTab: ReportTab) => {
    setTab(newTab);
  };

  const handlePresetChange = (newPreset: RangePreset | "custom") => {
    setPreset(newPreset);
    if (newPreset !== "custom") {
      const range = resolveRange(newPreset, today);
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await call("reports:exportCsv", { tab, from, to });
      if (res.saved) {
        toast.success(`Report exported to ${res.path ?? "CSV"}.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to export CSV.";
      toast.error(message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isCurrentOnly = tab === "stock" || tab === "dues";

  return (
    <>
      <div className="no-print">
        <NavBar />
      </div>

      <PageFrame>
        {/* Print-only header */}
        <div
          className="print-only"
          style={{
            marginBottom: "var(--space-4)",
            borderBottom: "var(--border-thin) solid var(--ink)",
            paddingBottom: "var(--space-2)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 700 }}>
            {shopName}
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            Report: {tab.toUpperCase()} · {isCurrentOnly ? "Current figures" : `${from} to ${to}`}
          </div>
        </div>

        <div className="no-print">
          <PageHeader
            title="Reports"
            subtitle="Sales and profit for the period you choose"
            right={
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" onClick={handleExportCsv}>
                  Export CSV
                </Button>
                <Button variant="primary" onClick={handlePrint}>
                  Print report
                </Button>
              </div>
            }
          />
        </div>

        {/* Navigation & Filter Row */}
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
            marginBottom: "var(--space-5)",
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => handleTabChange("sales")}
              style={{
                minHeight: "40px",
                padding: "0 var(--space-4)",
                border: "var(--border-thin) solid var(--ink)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                background: tab === "sales" ? "var(--ink)" : "transparent",
                color: tab === "sales" ? "var(--paper-hi)" : "var(--ink)",
              }}
            >
              Sales
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("profit")}
              style={{
                minHeight: "40px",
                padding: "0 var(--space-4)",
                border: "var(--border-thin) solid var(--ink)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                background: tab === "profit" ? "var(--ink)" : "transparent",
                color: tab === "profit" ? "var(--paper-hi)" : "var(--ink)",
              }}
            >
              Profit
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("stock")}
              style={{
                minHeight: "40px",
                padding: "0 var(--space-4)",
                border: "var(--border-thin) solid var(--ink)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                background: tab === "stock" ? "var(--ink)" : "transparent",
                color: tab === "stock" ? "var(--paper-hi)" : "var(--ink)",
              }}
            >
              Stock
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("dues")}
              style={{
                minHeight: "40px",
                padding: "0 var(--space-4)",
                border: "var(--border-thin) solid var(--ink)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                background: tab === "dues" ? "var(--ink)" : "transparent",
                color: tab === "dues" ? "var(--paper-hi)" : "var(--ink)",
              }}
            >
              Supplier dues
            </button>
          </div>

          {/* Range Selection */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            {isCurrentOnly ? (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", fontStyle: "italic" }}>
                Current figures
              </span>
            ) : (
              <>
                <Chip selected={preset === "today"} onClick={() => handlePresetChange("today")}>
                  Today
                </Chip>
                <Chip selected={preset === "week"} onClick={() => handlePresetChange("week")}>
                  This week
                </Chip>
                <Chip selected={preset === "month"} onClick={() => handlePresetChange("month")}>
                  This month
                </Chip>
                <Chip selected={preset === "custom"} onClick={() => handlePresetChange("custom")}>
                  Custom
                </Chip>
              </>
            )}
          </div>
        </div>

        {/* Custom Date Inputs if Custom selected */}
        {!isCurrentOnly && preset === "custom" && (
          <div
            className="no-print"
            style={{
              display: "flex",
              gap: "var(--space-4)",
              marginBottom: "var(--space-5)",
              background: "var(--paper-hi)",
              padding: "var(--space-3) var(--space-4)",
              border: "var(--border-thin) solid var(--ink)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              <span>From:</span>
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              <span>To:</span>
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        {/* Body content */}
        {loading ? (
          <Loading />
        ) : error ? (
          <EmptyState title="Could not load report" hint={error} />
        ) : !report ? (
          <EmptyState title="No report data" />
        ) : (
          renderReportContent(report, from)
        )}
      </PageFrame>
    </>
  );
}

function renderReportContent(report: ReportDto, from: string): React.JSX.Element {
  if (report.tab === "sales") {
    return renderSalesReport(report, from);
  }
  if (report.tab === "profit") {
    return renderProfitReport(report);
  }
  if (report.tab === "stock") {
    return renderStockReport(report);
  }
  if (report.tab === "dues") {
    return renderDuesReport(report);
  }
  return <div />;
}

function renderSalesReport(report: SalesReportDto, from: string): React.JSX.Element {
  const isSingleDay = report.byHour !== null;
  const groups: BarGroup[] = report.byDay.map((d, index) => {
    // If range is over 31 days, show only first of each week (approx every 7th day)
    const isOver31 = report.byDay.length > 31;
    let label = formatShort(d.date);
    if (isOver31 && index % 7 !== 0 && index !== 0) {
      label = "";
    }
    return {
      label,
      values: [{ value: d.sales, tone: "ink" }],
    };
  });

  const hourlyGroups: BarGroup[] = (report.byHour ?? []).map((val, idx) => ({
    label: idx.toString().padStart(2, "0"),
    values: [{ value: val, tone: "ink" }],
  }));

  const hasSales = report.total > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Stat Cards */}
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <div style={{ flex: 1 }}>
          <StatCard label="TOTAL SALES" value={formatCard(report.total)} />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard label="SALE ROWS" value={report.count.toString()} />
        </div>
      </div>

      {!hasSales ? (
        <EmptyState title="No sales in this period" hint="Try adjusting the selected date range." />
      ) : (
        <>
          {/* By day chart */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                marginBottom: "var(--space-3)",
              }}
            >
              Sales by day
            </div>
            <BarChart groups={groups} valueFormatter={(v) => formatCard(v)} height={160} />
          </div>

          {/* If single day, By hour chart */}
          {isSingleDay && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-lg)",
                  fontWeight: 600,
                  marginBottom: "var(--space-3)",
                }}
              >
                By hour ({formatLong(from)})
              </div>
              <BarChart groups={hourlyGroups} valueFormatter={(v) => formatCard(v)} height={140} />
            </div>
          )}

          {/* By day table */}
          <div style={{ marginTop: "var(--space-4)" }}>
            <DataTable
              columns={[
                {
                  header: "Date",
                  render: (row) => formatShort(row.date),
                },
                {
                  header: "Sale rows",
                  align: "right",
                  mono: true,
                  render: (row) => row.count.toString(),
                },
                {
                  header: "Sales",
                  align: "right",
                  mono: true,
                  render: (row) => formatTable(row.sales),
                },
                {
                  header: "Profit",
                  align: "right",
                  mono: true,
                  render: (row) => (
                    <span style={{ color: row.profit < 0 ? "var(--red)" : "inherit" }}>
                      {formatTable(row.profit)}
                    </span>
                  ),
                },
              ]}
              rows={report.byDay.filter((b) => b.count > 0 || !isSingleDay)}
              rowKey={(r) => r.date}
            />
          </div>
        </>
      )}
    </div>
  );
}

function renderProfitReport(report: ProfitReportDto): React.JSX.Element {
  const groups: BarGroup[] = report.byDay.map((d, index) => {
    const isOver31 = report.byDay.length > 31;
    let label = formatShort(d.date);
    if (isOver31 && index % 7 !== 0 && index !== 0) {
      label = "";
    }
    return {
      label,
      values: [
        { value: d.sales, tone: "ink" },
        { value: Math.max(0, d.profit), tone: "green" },
      ],
    };
  });

  const hasSales = report.totalSales > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* 4 Stat Cards */}
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <div style={{ flex: 1 }}>
          <StatCard label="TOTAL SALES" value={formatCard(report.totalSales)} />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard label="COST OF GOODS" value={formatCard(report.costOfGoods)} />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard
            label="GROSS PROFIT"
            value={formatCard(report.grossProfit)}
            tone={report.grossProfit < 0 ? "bad" : "good"}
          />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard label="SALE ROWS" value={report.count.toString()} />
        </div>
      </div>

      {!hasSales ? (
        <EmptyState title="No sales in this period" hint="Try adjusting the selected date range." />
      ) : (
        <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
          {/* Left: Paired Chart */}
          <div style={{ flex: 3, minWidth: "300px" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                marginBottom: "var(--space-3)",
              }}
            >
              Sales and profit by day
            </div>
            <BarChart groups={groups} valueFormatter={(v) => formatCard(v)} height={160} />
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-soft)",
                marginTop: "var(--space-2)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    background: "var(--ink)",
                  }}
                />
                Sales
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    background: "var(--green)",
                  }}
                />
                Profit
              </span>
            </div>
          </div>

          {/* Right: Top Selling Products */}
          <div style={{ flex: 2, minWidth: "260px" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                marginBottom: "var(--space-3)",
              }}
            >
              Top selling products
            </div>
            <DataTable
              columns={[
                {
                  header: "Product",
                  render: (row) => row.name,
                },
                {
                  header: "Sold",
                  align: "right",
                  mono: true,
                  render: (row) => row.sold.toString(),
                },
                {
                  header: "Sales",
                  align: "right",
                  mono: true,
                  render: (row) => formatTable(row.sales),
                },
                {
                  header: "Profit",
                  align: "right",
                  mono: true,
                  render: (row) => (
                    <span style={{ color: row.profit < 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
                      {formatTable(row.profit)}
                    </span>
                  ),
                },
              ]}
              rows={report.top}
              rowKey={(r) => r.productId}
              emptyTitle="No products sold"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function renderStockReport(report: StockReportDto): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* 3 Stat Cards */}
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <div style={{ flex: 1 }}>
          <StatCard label="STOCK VALUE" value={formatCard(report.valuation)} />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard label="PRODUCTS" value={report.productCount.toString()} />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard
            label="LOW OR OUT OF STOCK"
            value={report.low.length.toString()}
            tone={report.low.length > 0 ? "bad" : "default"}
          />
        </div>
      </div>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", fontStyle: "italic" }}>
        Stock value uses each product's current cost.
      </div>

      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            marginBottom: "var(--space-3)",
          }}
        >
          Low and out of stock products
        </div>

        <DataTable
          columns={[
            {
              header: "Product",
              render: (row) => row.name,
            },
            {
              header: "Qty",
              align: "right",
              mono: true,
              render: (row) => (
                <span style={{ color: "var(--red)", fontWeight: 700 }}>
                  {row.quantity}
                </span>
              ),
            },
            {
              header: "Reorder at",
              align: "right",
              mono: true,
              render: (row) => row.reorderLevel.toString(),
            },
            {
              header: "Status",
              align: "center",
              render: (row) => (
                <Stamp kind={row.status === "OUT" ? "out" : "low"}>
                  {row.status === "OUT" ? "OUT" : "LOW"}
                </Stamp>
              ),
            },
          ]}
          rows={report.low}
          rowKey={(r) => r.id}
          emptyTitle="All products in stock"
          emptyHint="No items are below reorder level."
        />
      </div>
    </div>
  );
}

function renderDuesReport(report: DuesReportDto): React.JSX.Element {
  const tableRows = [
    ...report.suppliers.map((s) => ({
      key: s.id.toString(),
      name: s.name,
      due: s.due,
      isTotal: false,
    })),
    {
      key: "total",
      name: "Total",
      due: report.totalDue,
      isTotal: true,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* 2 Stat Cards */}
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <div style={{ flex: 1 }}>
          <StatCard
            label="TOTAL DUE"
            value={formatCard(report.totalDue)}
            tone={report.totalDue > 0 ? "bad" : "default"}
          />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard label="SUPPLIERS OWED" value={report.suppliers.length.toString()} />
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            marginBottom: "var(--space-3)",
          }}
        >
          Outstanding supplier balances
        </div>

        <DataTable
          columns={[
            {
              header: "Supplier",
              render: (row) => (
                <span style={{ fontWeight: row.isTotal ? 700 : "inherit" }}>
                  {row.name}
                </span>
              ),
            },
            {
              header: "Due",
              align: "right",
              mono: true,
              render: (row) => (
                <span
                  style={{
                    fontWeight: row.isTotal ? 700 : "inherit",
                    color: row.due > 0 ? "var(--red)" : "inherit",
                  }}
                >
                  {formatTable(row.due)}
                </span>
              ),
            },
          ]}
          rows={tableRows}
          rowKey={(r) => r.key}
          emptyTitle="No supplier dues"
          emptyHint="All supplier invoices have been settled in full."
        />
      </div>
    </div>
  );
}

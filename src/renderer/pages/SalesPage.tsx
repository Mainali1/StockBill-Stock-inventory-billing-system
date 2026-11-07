import React, { useEffect, useState, useMemo, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { PageFrame } from "../components/PageFrame";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import { BarChart, type BarGroup } from "../components/BarChart";
import { Button, Chip, TextInput } from "../components/Controls";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { call, ApiCallError } from "../api";
import { useToast } from "../components/Toast";
import { formatTable, formatCard, paisaToRupeesString, rupeesToPaisa } from "../../main/domain/money";
import { nowDbDateTime, dbToInput, inputToDb, formatLong } from "../../main/domain/dates";
import type { SalePickerProductDto, DaySalesDto, SaleRowDto } from "@shared/ipc/sales";

interface CartLine {
  productId: number;
  productName: string;
  quantity: number;
  maxStock: number;
  unitPricePaisa: number;
  unitPriceRupees: string;
}

export function SalesPage(): React.JSX.Element {
  const toast = useToast();

  // Picker state
  const [products, setProducts] = useState<SalePickerProductDto[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Cart / Entry state
  const [whenInput, setWhenInput] = useState<string>(() => dbToInput(nowDbDateTime()));
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Day sales state
  const datePart = useMemo(() => {
    return whenInput ? whenInput.slice(0, 10) : nowDbDateTime().slice(0, 10);
  }, [whenInput]);

  const [daySales, setDaySales] = useState<DaySalesDto | null>(null);

  // Edit dialog state
  const [editingSale, setEditingSale] = useState<SaleRowDto | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editPriceRupees, setEditPriceRupees] = useState<string>("");
  const [editWhen, setEditWhen] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete dialog state
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);

  const loadDaySales = useCallback(async (date: string) => {
    try {
      const res = await call("sales:day", { date });
      setDaySales(res);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (datePart) {
      loadDaySales(datePart);
    }
  }, [datePart, loadDaySales]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await call("sales:picker", {
        search: search.trim() || undefined,
        category: selectedCategory,
      });
      setProducts(res.products);
      setCategories(res.categories);
    } catch (err) {
      console.error(err);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, loadProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, loadProducts]);

  const handleResetNow = () => {
    setWhenInput(dbToInput(nowDbDateTime()));
  };

  const handleAddToCart = (product: SalePickerProductDto) => {
    if (product.quantity <= 0) return;
    setRuleError(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          maxStock: product.quantity,
          unitPricePaisa: product.price,
          unitPriceRupees: paisaToRupeesString(product.price),
        },
      ];
    });
  };

  const handleQuantityChange = (productId: number, qty: number) => {
    setRuleError(null);
    setLines((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l;
        const validQty = Math.max(1, Math.min(l.maxStock, qty));
        return { ...l, quantity: validQty };
      })
    );
  };

  const handlePriceChange = (productId: number, val: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l;
        try {
          const paisa = rupeesToPaisa(val);
          return { ...l, unitPriceRupees: val, unitPricePaisa: paisa };
        } catch {
          return { ...l, unitPriceRupees: val };
        }
      })
    );
  };

  const handleRemoveLine = (productId: number) => {
    setRuleError(null);
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const handleSaveSales = async () => {
    if (lines.length === 0 || saving) return;
    setRuleError(null);
    setSaving(true);

    try {
      const soldAtDb = inputToDb(whenInput);
      const payloadLines = lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPricePaisa,
      }));

      await call("sales:save", {
        soldAt: soldAtDb,
        lines: payloadLines,
      });

      const count = lines.length;
      toast.success(`Saved ${count} item(s).`);
      setLines([]);
      await Promise.all([loadProducts(), loadDaySales(datePart)]);
    } catch (err) {
      if (err instanceof ApiCallError) {
        if (err.code === "RULE") {
          setRuleError(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const cartTotal = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.quantity * l.unitPricePaisa, 0);
  }, [lines]);

  const hourlyChartGroups: BarGroup[] = useMemo(() => {
    if (!daySales) return [];
    return daySales.hourly.map((val, hr) => ({
      label: hr.toString().padStart(2, "0"),
      values: [{ value: val, tone: "ink" }],
    }));
  }, [daySales]);

  const handleOpenEdit = (r: SaleRowDto) => {
    setEditingSale(r);
    setEditQty(r.quantity);
    setEditPriceRupees(paisaToRupeesString(r.unitPrice));
    setEditWhen(dbToInput(r.soldAt));
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSale || savingEdit) return;
    setEditError(null);
    setSavingEdit(true);

    try {
      const paisa = rupeesToPaisa(editPriceRupees);
      const soldAtDb = inputToDb(editWhen);

      await call("sales:update", {
        id: editingSale.id,
        quantity: editQty,
        unitPrice: paisa,
        soldAt: soldAtDb,
      });

      toast.success("Sale updated.");
      setEditingSale(null);
      await Promise.all([loadProducts(), loadDaySales(datePart)]);
    } catch (err) {
      if (err instanceof ApiCallError) {
        setEditError(err.message);
      } else {
        setEditError("Something went wrong. Please try again.");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingSaleId === null) return;
    try {
      await call("sales:delete", { id: deletingSaleId });
      toast.success("Sale deleted. Stock restored.");
      setDeletingSaleId(null);
      await Promise.all([loadProducts(), loadDaySales(datePart)]);
    } catch (err) {
      if (err instanceof ApiCallError) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  };

  const daySaleColumns: Column<SaleRowDto>[] = [
    {
      header: "Time",
      mono: true,
      render: (r) => r.soldAt.slice(11, 16),
    },
    {
      header: "Product",
      render: (r) => <span style={{ fontWeight: 600 }}>{r.productName}</span>,
    },
    {
      header: "Qty",
      align: "right",
      mono: true,
      render: (r) => r.quantity,
    },
    {
      header: "Unit price",
      align: "right",
      mono: true,
      render: (r) => formatTable(r.unitPrice),
    },
    {
      header: "Line total",
      align: "right",
      mono: true,
      render: (r) => formatTable(r.lineTotal),
    },
    {
      header: "Profit",
      align: "right",
      mono: true,
      render: (r) => (
        <span
          style={{
            color: r.profit < 0 ? "var(--red)" : "var(--green)",
            fontWeight: 600,
          }}
        >
          {formatTable(r.profit)}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      render: (r) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            onClick={() => handleOpenEdit(r)}
            style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--text-xs)" }}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDeletingSaleId(r.id)}
            style={{
              padding: "var(--space-1) var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--red)",
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const productColumns: Column<SalePickerProductDto>[] = [
    {
      header: "Product",
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          {p.code && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>
              {p.code}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Stock",
      align: "right",
      render: (p) => (
        <span
          style={{
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: p.quantity <= 0 ? "var(--red)" : "inherit",
          }}
        >
          {p.quantity <= 0 ? "Out" : p.quantity}
        </span>
      ),
    },
    {
      header: "Price",
      align: "right",
      mono: true,
      render: (p) => formatTable(p.price),
    },
    {
      header: "",
      align: "right",
      render: (p) => (
        <Button
          variant="secondary"
          disabled={p.quantity <= 0}
          onClick={() => handleAddToCart(p)}
          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-sm)" }}
        >
          Add
        </Button>
      ),
    },
  ];

  return (
    <>
      <NavBar />
      <PageFrame>
        <PageHeader title="Sales" subtitle="Record what was sold, and when" />

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
          {/* Left column: Product picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <TextInput
              placeholder="Search product or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
              <Chip
                selected={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Chip>
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Chip>
              ))}
            </div>

            <div style={{ border: "var(--border-thin) solid var(--ink)", background: "var(--paper-hi)" }}>
              <DataTable
                columns={productColumns}
                rows={products}
                rowKey={(p) => p.id}
                emptyTitle="No products match"
                emptyHint="Try a different search or filter."
              />
            </div>
          </div>

          {/* Right column: Sale entry panel */}
          <Panel title="Sale entry">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* When field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label
                  htmlFor="sales-when-input"
                  style={{
                    fontSize: "var(--text-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink-soft)",
                    fontWeight: 600,
                  }}
                >
                  When
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <input
                    id="sales-when-input"
                    type="datetime-local"
                    value={whenInput}
                    onChange={(e) => setWhenInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "var(--space-2)",
                      border: "var(--border-thin) solid var(--ink)",
                      background: "var(--paper-hi)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                  <Button variant="secondary" onClick={handleResetNow}>
                    Now
                  </Button>
                </div>
              </div>

              {/* Line items */}
              <div style={{ minHeight: "160px", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {lines.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "160px",
                      color: "var(--ink-soft)",
                      fontSize: "var(--text-sm)",
                      border: "var(--border-thin) dashed var(--rule)",
                    }}
                  >
                    No items added yet. Pick products from the left.
                  </div>
                ) : (
                  lines.map((l) => {
                    const lineTotal = l.quantity * l.unitPricePaisa;
                    return (
                      <div
                        key={l.productId}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 100px 90px 80px 32px",
                          gap: "var(--space-2)",
                          alignItems: "center",
                          padding: "var(--space-2) 0",
                          borderBottom: "var(--border-thin) solid var(--rule)",
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{l.productName}</span>

                        {/* Qty minus / input / plus */}
                        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(l.productId, l.quantity - 1)}
                            disabled={l.quantity <= 1}
                            style={{
                              width: "24px",
                              height: "28px",
                              border: "var(--border-thin) solid var(--ink)",
                              background: "var(--paper)",
                              cursor: "pointer",
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={l.maxStock}
                            value={l.quantity}
                            onChange={(e) => handleQuantityChange(l.productId, parseInt(e.target.value, 10) || 1)}
                            style={{
                              width: "40px",
                              height: "28px",
                              textAlign: "center",
                              border: "var(--border-thin) solid var(--ink)",
                              background: "var(--paper-hi)",
                              fontFamily: "var(--font-mono)",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(l.productId, l.quantity + 1)}
                            disabled={l.quantity >= l.maxStock}
                            style={{
                              width: "24px",
                              height: "28px",
                              border: "var(--border-thin) solid var(--ink)",
                              background: "var(--paper)",
                              cursor: "pointer",
                            }}
                          >
                            +
                          </button>
                        </div>

                        {/* Unit price input */}
                        <div>
                          <input
                            type="text"
                            value={l.unitPriceRupees}
                            onChange={(e) => handlePriceChange(l.productId, e.target.value)}
                            style={{
                              width: "100%",
                              height: "28px",
                              textAlign: "right",
                              paddingRight: "var(--space-1)",
                              border: "var(--border-thin) solid var(--ink)",
                              background: "var(--paper-hi)",
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-xs)",
                            }}
                          />
                        </div>

                        {/* Line total */}
                        <span
                          style={{
                            textAlign: "right",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-sm)",
                            fontWeight: 600,
                          }}
                        >
                          {formatTable(lineTotal)}
                        </span>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(l.productId)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--red)",
                            cursor: "pointer",
                            fontSize: "var(--text-base)",
                            fontWeight: 700,
                          }}
                          title="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Error message */}
              {ruleError && (
                <div
                  role="alert"
                  style={{
                    color: "var(--red)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    padding: "var(--space-2)",
                    background: "var(--paper)",
                    border: "var(--border-thin) solid var(--red)",
                  }}
                >
                  {ruleError}
                </div>
              )}

              {/* Panel Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "var(--space-4)",
                  borderTop: "var(--border-thin) solid var(--ink)",
                }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", textTransform: "uppercase" }}>
                    Total
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 700,
                    }}
                  >
                    Rs. {formatTable(cartTotal)}
                  </div>
                </div>
                <Button
                  variant="primary"
                  disabled={lines.length === 0 || saving}
                  onClick={handleSaveSales}
                >
                  Save sales
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Full-width panel below: Sales on {formatLong(date)} */}
        <div
          style={{
            border: "var(--border-thick) solid var(--ink)",
            background: "var(--paper-hi)",
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            marginBottom: "var(--space-8)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "var(--border-thin) solid var(--rule)",
              paddingBottom: "var(--space-3)",
            }}
          >
            <h2 style={{ fontSize: "var(--text-xl)", margin: 0, fontFamily: "var(--font-display)" }}>
              Sales on {formatLong(datePart)}
            </h2>
          </div>

          {/* Three stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
            <StatCard
              label="Total sales"
              value={formatCard(daySales?.total ?? 0)}
              tone="default"
            />
            <StatCard
              label="Profit"
              value={formatCard(daySales?.profit ?? 0)}
              tone={(daySales?.profit ?? 0) >= 0 ? "good" : "bad"}
            />
            <StatCard
              label="Sale rows"
              value={daySales?.count ?? 0}
              tone="default"
            />
          </div>

          {/* By hour bar chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span
              style={{
                fontSize: "var(--text-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
                fontWeight: 600,
              }}
            >
              By hour
            </span>
            <div style={{ background: "var(--paper)", padding: "var(--space-4)", border: "var(--border-thin) solid var(--rule)" }}>
              <BarChart
                groups={hourlyChartGroups}
                height={120}
                valueFormatter={(val) => `Rs. ${formatTable(val)}`}
              />
            </div>
          </div>

          {/* Table of the day's rows */}
          <div style={{ border: "var(--border-thin) solid var(--ink)" }}>
            {!daySales || daySales.rows.length === 0 ? (
              <EmptyState
                title="No sales on this day"
                hint="Pick products above and save to record some."
              />
            ) : (
              <DataTable
                columns={daySaleColumns}
                rows={daySales.rows}
                rowKey={(r) => r.id}
              />
            )}
          </div>
        </div>

        {/* Edit Sale Dialog */}
        {editingSale && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-sale-dialog-title"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(59, 42, 26, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
            }}
          >
            <div
              style={{
                background: "var(--paper-hi)",
                border: "var(--border-thick) solid var(--ink)",
                padding: "var(--space-6)",
                width: "420px",
                maxWidth: "90vw",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <h3
                id="edit-sale-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "var(--text-lg)",
                  borderBottom: "var(--border-thin) solid var(--rule)",
                  paddingBottom: "var(--space-2)",
                }}
              >
                Edit sale: {editingSale.productName}
              </h3>

              {editError && (
                <div
                  role="alert"
                  style={{
                    color: "var(--red)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    padding: "var(--space-2)",
                    background: "var(--paper)",
                    border: "var(--border-thin) solid var(--red)",
                  }}
                >
                  {editError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label
                  htmlFor="edit-sale-qty"
                  style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-soft)" }}
                >
                  Quantity
                </label>
                <TextInput
                  id="edit-sale-qty"
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label
                  htmlFor="edit-sale-price"
                  style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-soft)" }}
                >
                  Unit price (Rs.)
                </label>
                <TextInput
                  id="edit-sale-price"
                  type="text"
                  value={editPriceRupees}
                  onChange={(e) => setEditPriceRupees(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label
                  htmlFor="edit-sale-when"
                  style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-soft)" }}
                >
                  When
                </label>
                <TextInput
                  id="edit-sale-when"
                  type="datetime-local"
                  value={editWhen}
                  onChange={(e) => setEditWhen(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                <Button variant="secondary" onClick={() => setEditingSale(null)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={savingEdit} onClick={handleSaveEdit}>
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Sale Confirm Dialog */}
        <ConfirmDialog
          open={deletingSaleId !== null}
          title="Delete sale"
          message="Delete this sale? The stock will be put back."
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingSaleId(null)}
        />
      </PageFrame>
    </>
  );
}

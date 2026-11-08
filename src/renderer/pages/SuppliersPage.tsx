import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  SupplierSummaryDto,
  SupplierDetailDto,
  SupplierInput,
  InvoiceInput,
} from "@shared/ipc/suppliers";
import { ApiCallError, call } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { Panel } from "../components/Panel";
import { Stamp } from "../components/Stamp";
import { Button, Field, TextInput, Select } from "../components/Controls";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loading } from "../components/EmptyState";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageHeader";
import { PageFrame } from "../components/PageFrame";
import { NavBar } from "../components/NavBar";
import {
  paisaToRupeesString,
  rupeesToPaisa,
  formatCard,
  formatTable,
} from "../money";
import { todayDb, formatShort } from "../dates";

interface ProductOption {
  id: number;
  name: string;
  code: string | null;
  cost: number;
}

interface InvoiceFormItem {
  productId: number;
  quantity: string;
  unitCostRupees: string;
}

export function SuppliersPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierSummaryDto[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<SupplierDetailDto | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [mode, setMode] = useState<"detail" | "supplierForm" | "invoiceForm">("detail");
  const [isNewSupplier, setIsNewSupplier] = useState(false);

  const [supplierFormData, setSupplierFormData] = useState<SupplierInput>({
    name: "",
    contactName: "",
    phone: "",
    address: "",
    supplies: "",
  });
  const [supplierFieldErrors, setSupplierFieldErrors] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayDb());
  const [invoiceItems, setInvoiceItems] = useState<InvoiceFormItem[]>([]);
  const [paidNowRupees, setPaidNowRupees] = useState("0");
  const [invoiceFieldErrors, setInvoiceFieldErrors] = useState<Record<string, string>>({});

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<number>>(new Set());

  const newInvoiceOpenerRef = useRef<HTMLElement | null>(null);
  const recordPaymentOpenerRef = useRef<HTMLElement | null>(null);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 200);
  };

  const loadSupplierDetail = useCallback(async (id: number) => {
    try {
      setLoadingDetail(true);
      const detail = await call("suppliers:get", { id });
      setSelectedSupplierDetail(detail);
      setSearchParams({ supplier: String(id) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load supplier detail";
      toastError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, [setSearchParams, toastError]);

  const loadSuppliersList = useCallback(async (selectId?: number) => {
    try {
      setLoadingList(true);
      setError(null);
      const res = await call("suppliers:list", { search: debouncedSearch });
      setSuppliers(res.suppliers);
      setTotalDue(res.totalDue);

      if (selectId) {
        loadSupplierDetail(selectId);
      } else if (res.suppliers.length > 0 && !selectedSupplierDetail && mode === "detail") {
        loadSupplierDetail(res.suppliers[0]!.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load suppliers";
      setError(msg);
    } finally {
      setLoadingList(false);
    }
  }, [debouncedSearch, loadSupplierDetail, mode, selectedSupplierDetail]);

  const loadProductOptions = async () => {
    try {
      const prods = await call("suppliers:productOptions", undefined);
      setProductOptions(prods);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSuppliersList();
    loadProductOptions();
  }, [loadSuppliersList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (paymentDialogOpen) {
          e.preventDefault();
          setPaymentDialogOpen(false);
          recordPaymentOpenerRef.current?.focus();
        } else if (mode === "invoiceForm") {
          e.preventDefault();
          setMode("detail");
          newInvoiceOpenerRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paymentDialogOpen, mode]);

  useEffect(() => {
    const suppIdParam = searchParams.get("supplier");
    if (suppIdParam && suppliers.length > 0) {
      const targetId = Number(suppIdParam);
      if (selectedSupplierDetail?.id !== targetId) {
        loadSupplierDetail(targetId);
      }
    }
  }, [searchParams, suppliers, loadSupplierDetail, selectedSupplierDetail?.id]);

  const toggleInvoiceExpanded = (invId: number) => {
    setExpandedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invId)) {
        next.delete(invId);
      } else {
        next.add(invId);
      }
      return next;
    });
  };

  const handleOpenAddSupplier = () => {
    setIsNewSupplier(true);
    setSupplierFormData({
      name: "",
      contactName: "",
      phone: "",
      address: "",
      supplies: "",
    });
    setSupplierFieldErrors({});
    setMode("supplierForm");
  };

  const handleOpenEditSupplier = () => {
    if (!selectedSupplierDetail) return;
    setIsNewSupplier(false);
    setSupplierFormData({
      id: selectedSupplierDetail.id,
      name: selectedSupplierDetail.name,
      contactName: selectedSupplierDetail.contactName ?? "",
      phone: selectedSupplierDetail.phone ?? "",
      address: selectedSupplierDetail.address ?? "",
      supplies: selectedSupplierDetail.supplies ?? "",
    });
    setSupplierFieldErrors({});
    setMode("supplierForm");
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierFieldErrors({});
    if (!supplierFormData.name?.trim()) {
      setSupplierFieldErrors({ name: "Name is required." });
      return;
    }

    try {
      const saved = await call("suppliers:save", {
        id: isNewSupplier ? undefined : supplierFormData.id,
        name: supplierFormData.name.trim(),
        contactName: supplierFormData.contactName?.trim() || null,
        phone: supplierFormData.phone?.trim() || null,
        address: supplierFormData.address?.trim() || null,
        supplies: supplierFormData.supplies?.trim() || null,
      });

      success(isNewSupplier ? "Supplier created." : "Supplier saved.");
      setMode("detail");
      setSelectedSupplierDetail(saved);
      await loadSuppliersList(saved.id);
    } catch (err: unknown) {
      if (err instanceof ApiCallError && err.fields) {
        setSupplierFieldErrors(err.fields);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to save supplier.";
        toastError(msg);
      }
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplierDetail) return;
    try {
      const res = await call("suppliers:delete", { id: selectedSupplierDetail.id });
      setDeleteConfirmOpen(false);
      if (res.result === "archived") {
        success("This supplier has invoices, so it was archived instead of deleted.");
      } else {
        success("Supplier deleted.");
      }
      setSelectedSupplierDetail(null);
      setMode("detail");
      setSearchParams({});
      await loadSuppliersList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete supplier.";
      toastError(msg);
    }
  };

  const handleOpenNewInvoice = () => {
    if (!selectedSupplierDetail) return;
    newInvoiceOpenerRef.current = document.activeElement as HTMLElement | null;
    setInvoiceNo("");
    setInvoiceDate(todayDb());
    if (productOptions.length > 0) {
      const first = productOptions[0]!;
      setInvoiceItems([
        {
          productId: first.id,
          quantity: "1",
          unitCostRupees: paisaToRupeesString(first.cost),
        },
      ]);
    } else {
      setInvoiceItems([]);
    }
    setPaidNowRupees("0");
    setInvoiceFieldErrors({});
    setMode("invoiceForm");
  };

  const handleAddInvoiceItem = () => {
    if (productOptions.length === 0) return;
    const existingIds = new Set(invoiceItems.map((it) => it.productId));
    const nextProd = productOptions.find((p) => !existingIds.has(p.id)) || productOptions[0]!;
    setInvoiceItems((prev) => [
      ...prev,
      {
        productId: nextProd.id,
        quantity: "1",
        unitCostRupees: paisaToRupeesString(nextProd.cost),
      },
    ]);
  };

  const handleRemoveInvoiceItem = (index: number) => {
    setInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleInvoiceItemChange = (
    index: number,
    field: keyof InvoiceFormItem,
    val: string | number
  ) => {
    setInvoiceItems((prev) => {
      const next = [...prev];
      const item = { ...next[index]! };
      if (field === "productId") {
        const prodId = Number(val);
        item.productId = prodId;
        const prod = productOptions.find((p) => p.id === prodId);
        if (prod) {
          item.unitCostRupees = paisaToRupeesString(prod.cost);
        }
      } else if (field === "quantity") {
        item.quantity = String(val);
      } else if (field === "unitCostRupees") {
        item.unitCostRupees = String(val);
      }
      next[index] = item;
      return next;
    });
  };

  const computedInvoiceTotal = useMemo(() => {
    let tot = 0;
    for (const item of invoiceItems) {
      const q = parseInt(item.quantity, 10);
      if (Number.isInteger(q) && q > 0) {
        try {
          const costPaisa = rupeesToPaisa(item.unitCostRupees);
          tot += q * costPaisa;
        } catch {
          // ignore parsing error while typing
        }
      }
    }
    return tot;
  }, [invoiceItems]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierDetail) return;
    setInvoiceFieldErrors({});

    const errors: Record<string, string> = {};
    if (!invoiceNo.trim()) {
      errors["invoiceNo"] = "Invoice number is required.";
    }
    if (!invoiceDate.trim()) {
      errors["invoiceDate"] = "Enter a valid date.";
    }
    if (invoiceItems.length === 0) {
      errors["items"] = "Add at least one item.";
    }

    const itemsPayload: { productId: number; quantity: number; unitCost: number }[] = [];
    const seenProds = new Set<number>();
    for (const it of invoiceItems) {
      if (seenProds.has(it.productId)) {
        errors["items"] = "Each product can appear only once per invoice.";
      }
      seenProds.add(it.productId);

      const q = parseInt(it.quantity, 10);
      if (!Number.isInteger(q) || q < 1) {
        errors["quantity"] = "Enter a whole number of 1 or more.";
      }

      let costP = 0;
      try {
        costP = rupeesToPaisa(it.unitCostRupees);
      } catch {
        errors["unitCost"] = "Enter an amount of 0 or more, with at most 2 decimals.";
      }

      itemsPayload.push({
        productId: it.productId,
        quantity: q,
        unitCost: costP,
      });
    }

    let paidNowPaisa = 0;
    try {
      paidNowPaisa = rupeesToPaisa(paidNowRupees);
      if (paidNowPaisa > computedInvoiceTotal) {
        errors["paidNow"] = "Amount paid cannot be more than the invoice total.";
      }
    } catch {
      errors["paidNow"] = "Enter an amount of 0 or more, with at most 2 decimals.";
    }

    if (Object.keys(errors).length > 0) {
      setInvoiceFieldErrors(errors);
      return;
    }

    const payload: InvoiceInput = {
      supplierId: selectedSupplierDetail.id,
      invoiceNo: invoiceNo.trim(),
      invoiceDate: invoiceDate.trim(),
      items: itemsPayload,
      paidNow: paidNowPaisa,
    };

    try {
      await call("invoices:create", payload);
      success("Invoice created.");
      setMode("detail");
      await loadSuppliersList(selectedSupplierDetail.id);
      await loadSupplierDetail(selectedSupplierDetail.id);
    } catch (err: unknown) {
      if (err instanceof ApiCallError && err.fields) {
        setInvoiceFieldErrors(err.fields);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to create invoice.";
        toastError(msg);
      }
    }
  };

  const handleOpenRecordPayment = () => {
    if (!selectedSupplierDetail || selectedSupplierDetail.due <= 0) return;
    recordPaymentOpenerRef.current = document.activeElement as HTMLElement | null;
    setPaymentAmountRupees("");
    setPaymentError(null);
    setPaymentDialogOpen(true);
  };

  const handlePayFullBalance = () => {
    if (!selectedSupplierDetail) return;
    setPaymentAmountRupees(paisaToRupeesString(selectedSupplierDetail.due));
    setPaymentError(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierDetail) return;
    setPaymentError(null);

    let amountPaisa = 0;
    try {
      amountPaisa = rupeesToPaisa(paymentAmountRupees);
      if (amountPaisa <= 0) {
        setPaymentError("Enter an amount greater than 0.");
        return;
      }
      if (amountPaisa > selectedSupplierDetail.due) {
        const formattedDue = formatCard(selectedSupplierDetail.due).replace(/^Rs\.\s*/, "");
        setPaymentError(`Payment is more than the balance due (Rs. ${formattedDue}).`);
        return;
      }
    } catch {
      setPaymentError("Enter an amount greater than 0.");
      return;
    }

    try {
      const refreshed = await call("payments:record", {
        supplierId: selectedSupplierDetail.id,
        amount: amountPaisa,
      });
      success("Payment recorded.");
      setPaymentDialogOpen(false);
      setSelectedSupplierDetail(refreshed);
      await loadSuppliersList(selectedSupplierDetail.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payment.";
      setPaymentError(msg);
    }
  };

  const columns: Column<SupplierSummaryDto>[] = [
    {
      header: "Supplier",
      render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span>,
    },
    {
      header: "Supplies",
      render: (s) => (
        <span style={{ color: "var(--ink-soft)" }}>{s.supplies ?? "—"}</span>
      ),
    },
    {
      header: "Last order",
      render: (s) => (
        <span style={{ color: "var(--ink-soft)" }}>
          {s.lastInvoiceDate ? formatShort(s.lastInvoiceDate) : "—"}
        </span>
      ),
    },
    {
      header: "Due (Rs.)",
      align: "right",
      mono: true,
      render: (s) => {
        const hasDue = s.due > 0;
        return (
          <span
            style={{
              fontWeight: 700,
              color: hasDue ? "var(--red)" : "var(--ink)",
            }}
          >
            {formatTable(s.due)}
          </span>
        );
      },
    },
    {
      header: "",
      align: "right",
      render: (s) => (
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setMode("detail");
            loadSupplierDetail(s.id);
          }}
          style={{ minHeight: "32px", padding: "0 var(--space-3)" }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <NavBar />
      <PageFrame>
        <PageHeader
          title="Suppliers"
          subtitle="Who you buy from, and what you owe"
          right={
            <Button
              variant="primary"
              onClick={handleOpenAddSupplier}
              style={{ minHeight: "40px" }}
            >
              Add supplier
            </Button>
          }
        />

        <div
          style={{
            display: "flex",
            gap: "var(--space-6)",
            alignItems: "flex-start",
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          {/* Left section: Suppliers list table */}
          <section
            style={{
              flex: "3 1 500px",
              minWidth: "320px",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <TextInput
              aria-label="Search suppliers"
              placeholder="Search supplier or item"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: "100%", minHeight: "40px" }}
            />

            {loadingList ? (
              <Loading />
            ) : error ? (
              <div style={{ color: "var(--red)", padding: "var(--space-4)" }}>{error}</div>
            ) : (
              <>
                <DataTable
                  columns={columns}
                  rows={suppliers}
                  rowKey={(s) => s.id}
                  selectedKey={selectedSupplierDetail?.id}
                  onRowClick={(s) => {
                    setMode("detail");
                    loadSupplierDetail(s.id);
                  }}
                  emptyTitle={
                    suppliers.length === 0 && !debouncedSearch
                      ? "No suppliers yet"
                      : "No suppliers match"
                  }
                  emptyHint={
                    suppliers.length === 0 && !debouncedSearch
                      ? "Add a supplier before recording an invoice."
                      : "Try a different search."
                  }
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "var(--border-thick) solid var(--ink)",
                    paddingTop: "var(--space-2)",
                    fontSize: "var(--text-lg)",
                    fontWeight: 700,
                  }}
                >
                  <span>Total dues</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: totalDue > 0 ? "var(--red)" : "var(--ink)",
                    }}
                  >
                    {formatCard(totalDue)}
                  </span>
                </div>
              </>
            )}
          </section>

          {/* Right section: Detail / Supplier Form / Invoice Form Panel */}
          <div style={{ flex: "2 1 360px", minWidth: "320px" }}>
            {mode === "supplierForm" && (
              <Panel title={isNewSupplier ? "New supplier" : "Edit supplier"}>
                <form
                  onSubmit={handleSaveSupplier}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
                >
                  <Field label="Name" error={supplierFieldErrors["name"]}>
                    <TextInput
                      value={supplierFormData.name}
                      onChange={(e) =>
                        setSupplierFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g. Koshi Wholesale"
                    />
                  </Field>

                  <Field label="Contact name" error={supplierFieldErrors["contactName"]}>
                    <TextInput
                      value={supplierFormData.contactName ?? ""}
                      onChange={(e) =>
                        setSupplierFormData((prev) => ({ ...prev, contactName: e.target.value }))
                      }
                      placeholder="e.g. Hari Prasad"
                    />
                  </Field>

                  <Field label="Phone" error={supplierFieldErrors["phone"]}>
                    <TextInput
                      mono
                      value={supplierFormData.phone ?? ""}
                      onChange={(e) =>
                        setSupplierFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="e.g. 9800000001"
                    />
                  </Field>

                  <Field label="Address" error={supplierFieldErrors["address"]}>
                    <TextInput
                      value={supplierFormData.address ?? ""}
                      onChange={(e) =>
                        setSupplierFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="e.g. Biratnagar"
                    />
                  </Field>

                  <Field label="Supplies" error={supplierFieldErrors["supplies"]}>
                    <TextInput
                      value={supplierFormData.supplies ?? ""}
                      onChange={(e) =>
                        setSupplierFormData((prev) => ({ ...prev, supplies: e.target.value }))
                      }
                      placeholder="e.g. Grocery staples"
                    />
                  </Field>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      marginTop: "var(--space-4)",
                      paddingTop: "var(--space-3)",
                      borderTop: "var(--border-thin) solid var(--rule)",
                    }}
                  >
                    {!isNewSupplier && (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteConfirmOpen(true)}
                        style={{ flex: 1 }}
                      >
                        Delete
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMode("detail")}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" style={{ flex: 2 }}>
                      Save supplier
                    </Button>
                  </div>
                </form>
              </Panel>
            )}

            {mode === "invoiceForm" && selectedSupplierDetail && (
              <Panel title="New invoice">
                <form
                  onSubmit={handleSaveInvoice}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
                >
                  <Field label="Invoice number" error={invoiceFieldErrors["invoiceNo"]}>
                    <TextInput
                      mono
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      placeholder="e.g. INV-1002"
                    />
                  </Field>

                  <Field label="Invoice date" error={invoiceFieldErrors["invoiceDate"]}>
                    <TextInput
                      mono
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </Field>

                  <div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      Items
                    </div>

                    {invoiceItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-1)",
                          padding: "var(--space-2)",
                          border: "var(--border-thin) solid var(--rule)",
                          marginBottom: "var(--space-2)",
                          background: "var(--paper)",
                        }}
                      >
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <Select
                            value={item.productId}
                            onChange={(e) =>
                              handleInvoiceItemChange(idx, "productId", e.target.value)
                            }
                            style={{ flex: 2 }}
                          >
                            {productOptions.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.code ? `[${p.code}]` : ""}
                              </option>
                            ))}
                          </Select>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => handleRemoveInvoiceItem(idx)}
                            style={{ padding: "0 var(--space-2)", minHeight: "32px" }}
                          >
                            ✕
                          </Button>
                        </div>

                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <div style={{ flex: 1 }}>
                            <TextInput
                              mono
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleInvoiceItemChange(idx, "quantity", e.target.value)
                              }
                              placeholder="Qty"
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <TextInput
                              mono
                              value={item.unitCostRupees}
                              onChange={(e) =>
                                handleInvoiceItemChange(idx, "unitCostRupees", e.target.value)
                              }
                              placeholder="Unit Cost Rs."
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {invoiceFieldErrors["items"] && (
                      <div style={{ color: "var(--red)", fontSize: "var(--text-xs)" }}>
                        {invoiceFieldErrors["items"]}
                      </div>
                    )}
                    {invoiceFieldErrors["quantity"] && (
                      <div style={{ color: "var(--red)", fontSize: "var(--text-xs)" }}>
                        {invoiceFieldErrors["quantity"]}
                      </div>
                    )}
                    {invoiceFieldErrors["unitCost"] && (
                      <div style={{ color: "var(--red)", fontSize: "var(--text-xs)" }}>
                        {invoiceFieldErrors["unitCost"]}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddInvoiceItem}
                      style={{ width: "100%", marginTop: "var(--space-1)" }}
                    >
                      + Add item
                    </Button>
                  </div>

                  <div
                    style={{
                      border: "var(--border-thin) dashed var(--ink-soft)",
                      padding: "var(--space-2) var(--space-3)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                      }}
                    >
                      Total (computed)
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: "var(--text-lg)",
                      }}
                    >
                      {formatCard(computedInvoiceTotal)}
                    </span>
                  </div>

                  <Field label="Paid now (Rs.)" error={invoiceFieldErrors["paidNow"]}>
                    <TextInput
                      mono
                      value={paidNowRupees}
                      onChange={(e) => setPaidNowRupees(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      marginTop: "var(--space-4)",
                      paddingTop: "var(--space-3)",
                      borderTop: "var(--border-thin) solid var(--rule)",
                    }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMode("detail")}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" style={{ flex: 2 }}>
                      Save invoice
                    </Button>
                  </div>
                </form>
              </Panel>
            )}

            {mode === "detail" && selectedSupplierDetail && (
              <Panel
                title={
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span>{selectedSupplierDetail.name}</span>
                    <Button
                      variant="secondary"
                      onClick={handleOpenEditSupplier}
                      style={{ minHeight: "28px", padding: "0 var(--space-2)", fontSize: "var(--text-xs)" }}
                    >
                      Edit
                    </Button>
                  </div>
                }
              >
                {loadingDetail ? (
                  <Loading />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      <div style={{ display: "flex", gap: "var(--space-4)" }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--ink-soft)",
                            }}
                          >
                            Contact
                          </div>
                          <div>{selectedSupplierDetail.contactName ?? <span style={{ color: "var(--ink-soft)" }}>Not provided</span>}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--ink-soft)",
                            }}
                          >
                            Phone
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {selectedSupplierDetail.phone ?? <span style={{ color: "var(--ink-soft)" }}>Not provided</span>}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--ink-soft)",
                          }}
                        >
                          Address
                        </div>
                        <div>{selectedSupplierDetail.address ?? <span style={{ color: "var(--ink-soft)" }}>Not provided</span>}</div>
                      </div>
                    </div>

                    <div
                      style={{
                        border: "var(--border-thin) dashed var(--ink-soft)",
                        padding: "var(--space-3) var(--space-4)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                        }}
                      >
                        Balance due
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xl)",
                          fontWeight: 700,
                          color: selectedSupplierDetail.due > 0 ? "var(--red)" : "var(--ink)",
                        }}
                      >
                        {formatCard(selectedSupplierDetail.due)}
                      </span>
                    </div>

                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                          fontSize: "var(--text-base)",
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        Invoice history
                      </div>

                      {selectedSupplierDetail.invoices.length === 0 ? (
                        <div
                          style={{
                            padding: "var(--space-4)",
                            textAlign: "center",
                            color: "var(--ink-soft)",
                            border: "var(--border-thin) solid var(--rule)",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>No invoices yet</div>
                          <div style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>
                            Use New invoice when stock arrives.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {selectedSupplierDetail.invoices.map((inv) => {
                            const isExpanded = expandedInvoiceIds.has(inv.id);
                            return (
                              <div
                                key={inv.id}
                                style={{
                                  borderBottom: "var(--border-thin) solid var(--rule)",
                                  padding: "var(--space-2) 0",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <div>
                                    <span
                                      style={{
                                        fontFamily: "var(--font-mono)",
                                        fontWeight: 700,
                                        fontSize: "var(--text-sm)",
                                      }}
                                    >
                                      {inv.invoiceNo}
                                    </span>
                                    <div
                                      style={{
                                        fontSize: "var(--text-xs)",
                                        color: "var(--ink-soft)",
                                      }}
                                    >
                                      {formatShort(inv.invoiceDate)}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "var(--space-3)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: "var(--text-sm)",
                                      }}
                                    >
                                      {formatTable(inv.total)}
                                    </span>
                                    <Stamp kind={inv.status === "PAID" ? "paid" : "due"}>
                                      {inv.status}
                                    </Stamp>
                                    <Button
                                      variant="secondary"
                                      aria-label={`Toggle details for ${inv.invoiceNo}`}
                                      onClick={() => toggleInvoiceExpanded(inv.id)}
                                      style={{
                                        minHeight: "26px",
                                        padding: "0 var(--space-2)",
                                        fontSize: "var(--text-xs)",
                                      }}
                                    >
                                      {isExpanded ? "▲" : "▼"}
                                    </Button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div
                                    style={{
                                      marginTop: "var(--space-2)",
                                      padding: "var(--space-2)",
                                      background: "var(--paper-hi)",
                                      border: "var(--border-thin) solid var(--rule)",
                                    }}
                                  >
                                    <table
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: "var(--text-xs)",
                                      }}
                                    >
                                      <thead>
                                        <tr
                                          style={{
                                            color: "var(--ink-soft)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            textAlign: "left",
                                          }}
                                        >
                                          <th>Item</th>
                                          <th style={{ textAlign: "right" }}>Qty</th>
                                          <th style={{ textAlign: "right" }}>Unit Cost</th>
                                          <th style={{ textAlign: "right" }}>Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {inv.items.map((it, idx) => (
                                          <tr key={idx}>
                                            <td style={{ padding: "4px 0" }}>{it.productName}</td>
                                            <td
                                              style={{
                                                textAlign: "right",
                                                fontFamily: "var(--font-mono)",
                                              }}
                                            >
                                              {it.quantity}
                                            </td>
                                            <td
                                              style={{
                                                textAlign: "right",
                                                fontFamily: "var(--font-mono)",
                                              }}
                                            >
                                              {formatTable(it.unitCost)}
                                            </td>
                                            <td
                                              style={{
                                                textAlign: "right",
                                                fontFamily: "var(--font-mono)",
                                                fontWeight: 600,
                                              }}
                                            >
                                              {formatTable(it.quantity * it.unitCost)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-2)",
                        marginTop: "var(--space-2)",
                        paddingTop: "var(--space-3)",
                        borderTop: "var(--border-thin) solid var(--rule)",
                      }}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleOpenNewInvoice}
                        style={{ flex: 1, minHeight: "44px" }}
                      >
                        New invoice
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleOpenRecordPayment}
                        disabled={selectedSupplierDetail.due <= 0}
                        title={selectedSupplierDetail.due <= 0 ? "Nothing is due" : undefined}
                        style={{ flex: 1, minHeight: "44px" }}
                      >
                        Record payment
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>

        {paymentDialogOpen && selectedSupplierDetail && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(59, 42, 26, 0.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: "var(--paper-hi)",
                border: "var(--border-thick) solid var(--ink)",
                padding: "var(--space-6)",
                width: "380px",
                maxWidth: "90%",
                boxShadow: "var(--shadow-frame)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  margin: "0 0 var(--space-2) 0",
                  fontSize: "var(--text-xl)",
                }}
              >
                Record payment
              </h2>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--ink-soft)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Balance due: {formatCard(selectedSupplierDetail.due)}
              </div>

              <form onSubmit={handleConfirmPayment}>
                <Field label="Amount to pay (Rs.)" error={paymentError ?? undefined}>
                  <TextInput
                    mono
                    value={paymentAmountRupees}
                    onChange={(e) => {
                      setPaymentAmountRupees(e.target.value);
                      setPaymentError(null);
                    }}
                    placeholder="0.00"
                    autoFocus
                  />
                </Field>

                <div style={{ marginTop: "var(--space-2)" }}>
                  <button
                    type="button"
                    onClick={handlePayFullBalance}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--red)",
                      textDecoration: "underline",
                      fontSize: "var(--text-xs)",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    Pay full balance
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-5)",
                  }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPaymentDialogOpen(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" style={{ flex: 2 }}>
                    Record payment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete supplier"
          message={`Are you sure you want to delete ${selectedSupplierDetail?.name}?`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleDeleteSupplier}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      </PageFrame>
    </>
  );
}

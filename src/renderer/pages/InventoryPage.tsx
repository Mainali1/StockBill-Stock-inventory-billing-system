import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProductDto, ProductInput } from "@shared/ipc/inventory";
import { ApiCallError, call } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { Panel } from "../components/Panel";
import { Stamp, type StampKind } from "../components/Stamp";
import { Button, Chip, Field, TextInput, Select } from "../components/Controls";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loading } from "../components/EmptyState";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageHeader";
import { PageFrame } from "../components/PageFrame";
import { NavBar } from "../components/NavBar";
import { paisaToRupeesString, rupeesToPaisa, formatTable } from "../money";

interface SupplierOption {
  id: number;
  name: string;
}

interface ProductFormData {
  id?: number;
  name: string;
  code: string;
  category: string;
  supplierId: number | null;
  costRupees: string;
  priceRupees: string;
  quantity: string;
  reorderLevel: string;
}

const emptyFormData: ProductFormData = {
  name: "",
  code: "",
  category: "",
  supplierId: null,
  costRupees: "",
  priceRupees: "",
  quantity: "0",
  reorderLevel: "0",
};

export function InventoryPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductDto | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Confirmation dialogs
  const [pendingSelection, setPendingSelection] = useState<{
    prod: ProductDto | null;
    isNew: boolean;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Debounce search 200ms
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 200);
  };

  const loadCategories = useCallback(async () => {
    try {
      const cats = await call("inventory:categories", undefined);
      setCategories(cats);
    } catch {
      // ignore
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const supps = await call("suppliers:listActive", undefined);
      setSuppliers(supps);
    } catch {
      // ignore
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await call("inventory:list", {
        search: debouncedSearch,
        category: selectedCategory,
        lowOnly,
      });
      setProducts(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load inventory";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, lowOnly]);

  useEffect(() => {
    loadCategories();
    loadSuppliers();
  }, [loadCategories, loadSuppliers]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectProductInternal = useCallback(
    (prod: ProductDto | null, brandNew: boolean) => {
      setSelectedProduct(prod);
      setIsNew(brandNew);
      setFieldErrors({});
      setIsDirty(false);
      if (brandNew) {
        setFormData({
          ...emptyFormData,
          category: selectedCategory ?? (categories.length > 0 ? (categories[0] ?? "") : ""),
        });
      } else if (prod) {
        setFormData({
          id: prod.id,
          name: prod.name,
          code: prod.code ?? "",
          category: prod.category,
          supplierId: prod.supplierId,
          costRupees: paisaToRupeesString(prod.cost),
          priceRupees: paisaToRupeesString(prod.price),
          quantity: String(prod.quantity),
          reorderLevel: String(prod.reorderLevel),
        });
      }
    },
    [categories, selectedCategory]
  );

  // Handle URL query parameter ?product=<id>
  useEffect(() => {
    const prodIdParam = searchParams.get("product");
    if (prodIdParam && products.length > 0) {
      const targetId = Number(prodIdParam);
      const target = products.find((p) => p.id === targetId);
      if (target) {
        selectProductInternal(target, false);
      }
    }
  }, [searchParams, products, selectProductInternal]);

  const requestSelectProduct = (prod: ProductDto | null, brandNew: boolean) => {
    if (isDirty) {
      setPendingSelection({ prod, isNew: brandNew });
      return;
    }
    selectProductInternal(prod, brandNew);
  };

  const handleFieldChange = (field: keyof ProductFormData, value: string | number | null) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Warning when price < cost
  const priceBelowCostWarning = useMemo(() => {
    try {
      const c = rupeesToPaisa(formData.costRupees);
      const p = rupeesToPaisa(formData.priceRupees);
      if (p < c) {
        return "Price is lower than cost. You will lose money on each sale.";
      }
    } catch {
      // Input is being edited or invalid
    }
    return null;
  }, [formData.costRupees, formData.priceRupees]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    let costPaisa: number;
    let pricePaisa: number;
    let qty: number;
    let reorder: number;

    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors["name"] = "Name is required.";
    }
    if (!formData.category.trim()) {
      errors["category"] = "Category is required.";
    }

    try {
      costPaisa = rupeesToPaisa(formData.costRupees);
    } catch (err: unknown) {
      errors["cost"] = err instanceof Error ? err.message : "Enter an amount of 0 or more, with at most 2 decimals.";
      costPaisa = 0;
    }

    try {
      pricePaisa = rupeesToPaisa(formData.priceRupees);
    } catch (err: unknown) {
      errors["price"] = err instanceof Error ? err.message : "Enter an amount of 0 or more, with at most 2 decimals.";
      pricePaisa = 0;
    }

    const qtyNum = Number(formData.quantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 0 || formData.quantity.trim() === "") {
      errors["quantity"] = "Enter a whole number of 0 or more.";
      qty = 0;
    } else {
      qty = qtyNum;
    }

    const reorderNum = Number(formData.reorderLevel);
    if (!Number.isInteger(reorderNum) || reorderNum < 0 || formData.reorderLevel.trim() === "") {
      errors["reorderLevel"] = "Enter a whole number of 0 or more.";
      reorder = 0;
    } else {
      reorder = reorderNum;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: ProductInput = {
      id: isNew ? undefined : formData.id,
      name: formData.name.trim(),
      code: formData.code.trim() ? formData.code.trim() : null,
      category: formData.category.trim(),
      supplierId: formData.supplierId || null,
      cost: costPaisa,
      price: pricePaisa,
      quantity: qty,
      reorderLevel: reorder,
    };

    try {
      const res = await call("inventory:save", payload);
      success(isNew ? "Product created." : "Product saved.");
      if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) {
          toastError(w);
        }
      }
      setIsDirty(false);
      await loadCategories();
      await loadProducts();
      selectProductInternal(res.product, false);
      setSearchParams({ product: String(res.product.id) });
    } catch (err: unknown) {
      if (err instanceof ApiCallError && err.fields) {
        setFieldErrors(err.fields);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to save product.";
        toastError(msg);
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      const res = await call("inventory:delete", { id: selectedProduct.id });
      setDeleteConfirmOpen(false);
      if (res.result === "archived") {
        success("This product has sales or invoices, so it was archived instead of deleted.");
      } else {
        success("Product deleted.");
      }
      setIsDirty(false);
      selectProductInternal(null, false);
      setSearchParams({});
      await loadCategories();
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete product.";
      toastError(msg);
    }
  };

  const columns: Column<ProductDto>[] = [
    {
      header: "Product",
      render: (p) => (
        <div>
          <span style={{ fontWeight: 600 }}>{p.name}</span>
          {p.code && (
            <span
              style={{
                marginLeft: "var(--space-2)",
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
                fontSize: "var(--text-xs)",
              }}
            >
              [{p.code}]
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Category",
      render: (p) => <span style={{ color: "var(--ink-soft)" }}>{p.category}</span>,
    },
    {
      header: "Qty",
      align: "right",
      mono: true,
      render: (p) => {
        const isAlert = p.status === "LOW" || p.status === "OUT";
        return (
          <span
            style={{
              fontWeight: 700,
              color: isAlert ? "var(--red)" : "var(--ink)",
            }}
          >
            {p.quantity}
          </span>
        );
      },
    },
    {
      header: "Cost",
      align: "right",
      mono: true,
      render: (p) => formatTable(p.cost),
    },
    {
      header: "Price",
      align: "right",
      mono: true,
      render: (p) => formatTable(p.price),
    },
    {
      header: "Status",
      render: (p) => {
        const kind: StampKind =
          p.status === "IN_STOCK" ? "in-stock" : p.status === "LOW" ? "low" : "out";
        const label = p.status === "IN_STOCK" ? "IN STOCK" : p.status;
        return <Stamp kind={kind}>{label}</Stamp>;
      },
    },
    {
      header: "",
      align: "right",
      render: (p) => (
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            requestSelectProduct(p, false);
          }}
          style={{ minHeight: "32px", padding: "0 var(--space-3)" }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <NavBar />
      <PageFrame>
        <PageHeader
          title="Inventory"
          subtitle="Products, stock levels and prices"
          right={
            <Button
              variant="primary"
              onClick={() => requestSelectProduct(null, true)}
              style={{ minHeight: "40px" }}
            >
              Add product
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
          {/* Left section: Search, chips, and Table */}
          <section
            style={{
              flex: "3 1 500px",
              minWidth: "320px",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <TextInput
                aria-label="Search inventory"
                placeholder="Search by name or code"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{ width: "100%", minHeight: "40px" }}
              />

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Chip
                  selected={selectedCategory === null && !lowOnly}
                  onClick={() => {
                    setSelectedCategory(null);
                    setLowOnly(false);
                  }}
                >
                  All
                </Chip>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    selected={selectedCategory === cat}
                    onClick={() => {
                      setSelectedCategory(selectedCategory === cat ? null : cat);
                    }}
                  >
                    {cat}
                  </Chip>
                ))}
                <Chip
                  selected={lowOnly}
                  onClick={() => {
                    setLowOnly((prev) => !prev);
                  }}
                >
                  Low stock only
                </Chip>
              </div>
            </div>

            {loading ? (
              <Loading />
            ) : error ? (
              <div style={{ color: "var(--red)", padding: "var(--space-4)" }}>{error}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={products}
                rowKey={(p) => p.id}
                selectedKey={selectedProduct?.id}
                onRowClick={(p) => requestSelectProduct(p, false)}
                emptyTitle={
                  products.length === 0 && !debouncedSearch && !selectedCategory && !lowOnly
                    ? "No products yet"
                    : "No products match"
                }
                emptyHint={
                  products.length === 0 && !debouncedSearch && !selectedCategory && !lowOnly
                    ? "Add your first product with the button above."
                    : "Try a different search or filter."
                }
              />
            )}
          </section>

          {/* Right section: Panel */}
          {(selectedProduct || isNew) && (
            <div style={{ flex: "2 1 320px", minWidth: "300px" }}>
              <Panel title={isNew ? "New product" : "Edit product"}>
                <form
                  onSubmit={handleSave}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
                >
                  <Field label="Name" error={fieldErrors["name"]}>
                    <TextInput
                      value={formData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Basmati Rice 5kg"
                    />
                  </Field>

                  <Field label="Code (optional)" error={fieldErrors["code"]}>
                    <TextInput
                      mono
                      value={formData.code}
                      onChange={(e) => handleFieldChange("code", e.target.value)}
                      placeholder="e.g. RICE5"
                    />
                  </Field>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Category" error={fieldErrors["category"]}>
                        <TextInput
                          list="categories-datalist"
                          value={formData.category}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          placeholder="Category"
                        />
                        <datalist id="categories-datalist">
                          {categories.map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </Field>
                    </div>

                    <div style={{ flex: 1 }}>
                      <Field label="Supplier" error={fieldErrors["supplierId"]}>
                        <Select
                          value={formData.supplierId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              "supplierId",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                        >
                          <option value="">No supplier</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Cost (Rs.)" error={fieldErrors["cost"]}>
                        <TextInput
                          mono
                          value={formData.costRupees}
                          onChange={(e) => handleFieldChange("costRupees", e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                    </div>

                    <div style={{ flex: 1 }}>
                      <Field label="Price (Rs.)" error={fieldErrors["price"]}>
                        <TextInput
                          mono
                          value={formData.priceRupees}
                          onChange={(e) => handleFieldChange("priceRupees", e.target.value)}
                          placeholder="0.00"
                        />
                        {priceBelowCostWarning && (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--red)",
                              marginTop: "var(--space-1)",
                              display: "block",
                            }}
                          >
                            {priceBelowCostWarning}
                          </span>
                        )}
                      </Field>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Quantity" error={fieldErrors["quantity"]}>
                        <TextInput
                          mono
                          type="number"
                          min="0"
                          step="1"
                          value={formData.quantity}
                          onChange={(e) => handleFieldChange("quantity", e.target.value)}
                        />
                      </Field>
                    </div>

                    <div style={{ flex: 1 }}>
                      <Field label="Reorder at" error={fieldErrors["reorderLevel"]}>
                        <TextInput
                          mono
                          type="number"
                          min="0"
                          step="1"
                          value={formData.reorderLevel}
                          onChange={(e) => handleFieldChange("reorderLevel", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      marginTop: "var(--space-4)",
                      paddingTop: "var(--space-3)",
                      borderTop: "var(--border-thin) solid var(--rule)",
                    }}
                  >
                    {!isNew && (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteConfirmOpen(true)}
                        style={{ flex: 1 }}
                      >
                        Delete
                      </Button>
                    )}
                    <Button type="submit" variant="primary" style={{ flex: 2 }}>
                      Save changes
                    </Button>
                  </div>
                </form>
              </Panel>
            </div>
          )}
        </div>

        {/* Confirm discard changes dialog */}
        <ConfirmDialog
          open={pendingSelection !== null}
          title="Discard unsaved changes?"
          message="You have unsaved changes in this form. If you continue, your changes will be lost."
          confirmLabel="Discard changes"
          destructive
          onConfirm={() => {
            if (pendingSelection) {
              selectProductInternal(pendingSelection.prod, pendingSelection.isNew);
              setPendingSelection(null);
            }
          }}
          onCancel={() => setPendingSelection(null)}
        />

        {/* Confirm delete product dialog */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete product"
          message={`Are you sure you want to delete ${selectedProduct?.name}?`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      </PageFrame>
    </>
  );
}

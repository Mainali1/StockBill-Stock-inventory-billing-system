import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Panel } from "./Panel";
import { getRotation, Stamp } from "./Stamp";
import { StatCard } from "./StatCard";
import { DataTable } from "./DataTable";
import { Button, Chip, Field, Select, TextInput } from "./Controls";
import { BarChart } from "./BarChart";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastProvider, useToast } from "./Toast";
import { EmptyState, Loading } from "./EmptyState";

describe("Shared components", () => {
  it("Panel renders title, children and footer", () => {
    render(
      <Panel title="Side Panel" footer={<button>Save</button>}>
        <p>Panel Body</p>
      </Panel>,
    );
    expect(screen.getByText("Side Panel")).toBeInTheDocument();
    expect(screen.getByText("Panel Body")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("Stamp derives deterministic rotation from text", () => {
    const rot1 = getRotation("IN STOCK");
    const rot2 = getRotation("IN STOCK");
    expect(rot1).toBe(rot2);
    expect(rot1).toBeGreaterThanOrEqual(-2);
    expect(rot1).toBeLessThanOrEqual(2);

    const { container } = render(<Stamp kind="paid">PAID</Stamp>);
    const stamp = container.querySelector(".stamp");
    expect(stamp).toBeInTheDocument();
    expect(stamp).toHaveTextContent("PAID");
  });

  it("StatCard renders label, value and tone", () => {
    render(<StatCard label="Total Sales" value="Rs. 1,000" tone="good" />);
    expect(screen.getByText("Total Sales")).toBeInTheDocument();
    expect(screen.getByText("Rs. 1,000")).toBeInTheDocument();
  });

  it("DataTable renders rows, calls onRowClick, and shows empty state", () => {
    interface Item {
      id: number;
      name: string;
    }
    const onRowClick = vi.fn();
    const columns = [
      { header: "ID", mono: true, render: (row: Item) => row.id },
      { header: "Name", render: (row: Item) => row.name },
    ];

    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={[
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Item 1"));
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: "Item 1" });

    // Empty state
    rerender(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyTitle="Nothing here"
        emptyHint="Add an item"
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add an item")).toBeInTheDocument();
  });

  it("Controls: Button, Chip, Field, TextInput, Select", () => {
    const onClick = vi.fn();
    render(
      <Field label="Username" error="Required field">
        <TextInput placeholder="Enter user" />
        <Select defaultValue="one">
          <option value="one">One</option>
        </Select>
        <Button variant="primary" onClick={onClick}>
          Submit
        </Button>
        <Chip selected onClick={onClick}>
          Filter
        </Chip>
      </Field>,
    );

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Required field")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter user")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Submit"));
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Filter"));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("BarChart renders proportional heights, baseline for 0, and corner triangle", () => {
    const groups = [
      {
        label: "Sun",
        values: [
          { value: 100, tone: "ink" as const },
          { value: 50, tone: "green" as const },
        ],
      },
      {
        label: "Mon",
        values: [{ value: 0, tone: "ink" as const }],
      },
    ];

    const { container } = render(<BarChart groups={groups} />);

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();

    const bars = container.querySelectorAll(".bar-chart__bar");
    expect(bars.length).toBe(3);

    expect(bars[0]).toHaveStyle({ height: "100%" });
    expect(bars[1]).toHaveStyle({ height: "50%" });
    expect(bars[2]).toHaveStyle({ height: "2px" });
    expect(bars[0]).toHaveAttribute("title", "Sun: 100");
    expect(bars[0]).toHaveAttribute("aria-label", "Sun: 100");
  });

  it("ConfirmDialog opens, confirms, and cancels", () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();

    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="Are you sure?"
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        open={false}
        title="Delete Item"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText("Delete Item")).not.toBeInTheDocument();
  });

  it("ToastProvider and useToast emit status toasts", () => {
    function TestComponent() {
      const toast = useToast();
      return (
        <div>
          <button onClick={() => toast.success("All good")}>Trigger Success</button>
          <button onClick={() => toast.error("Failed")}>Trigger Error</button>
        </div>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger Success"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("All good");

    fireEvent.click(screen.getByText("Trigger Error"));
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("EmptyState and Loading render correctly", () => {
    render(
      <>
        <EmptyState title="No items" hint="Create one" />
        <Loading />
      </>,
    );

    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Create one")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});

# Entity relationship diagram

The database has eight tables. The exact column definitions, constraints and indexes are in
[`schema.sql`](schema.sql), which mirrors the migrations. `tests/docs.test.ts` fails if this diagram
and the migrated schema disagree about a table or a column.

```mermaid
erDiagram
    users {
        INTEGER id PK
        TEXT username UK
        TEXT password_hash
        TEXT created_at
    }

    settings {
        TEXT key PK
        TEXT value
    }

    suppliers {
        INTEGER id PK
        TEXT name UK
        TEXT contact_name
        TEXT phone
        TEXT address
        TEXT supplies
        INTEGER archived
    }

    products {
        INTEGER id PK
        TEXT name
        TEXT code UK
        TEXT category
        INTEGER supplier_id FK
        INTEGER cost
        INTEGER price
        INTEGER quantity
        INTEGER reorder_level
        INTEGER archived
    }

    sales {
        INTEGER id PK
        INTEGER product_id FK
        INTEGER quantity
        INTEGER unit_price
        INTEGER unit_cost
        TEXT sold_at
    }

    supplier_invoices {
        INTEGER id PK
        INTEGER supplier_id FK
        TEXT invoice_no
        TEXT invoice_date
        INTEGER total
        INTEGER paid_amount
        TEXT created_at
    }

    supplier_invoice_items {
        INTEGER id PK
        INTEGER invoice_id FK
        INTEGER product_id FK
        INTEGER quantity
        INTEGER unit_cost
    }

    supplier_payments {
        INTEGER id PK
        INTEGER supplier_id FK
        INTEGER amount
        TEXT paid_at
    }

    suppliers |o--o{ products : "usually supplies"
    suppliers ||--o{ supplier_invoices : "bills through"
    suppliers ||--o{ supplier_payments : "is paid by"
    supplier_invoices ||--|{ supplier_invoice_items : "lists"
    products ||--o{ sales : "is sold in"
    products ||--o{ supplier_invoice_items : "is received in"
```

## Reading the diagram

- `users` and `settings` have no relations. There is one owner account, and `settings` holds
  key and value pairs such as `shop_name`.
- A product may have no supplier, because `products.supplier_id` is optional. That is why the
  supplier to product line starts with the "zero or one" mark. Every other foreign key is required.
- A supplier invoice must list at least one item (SUP-3), so its line to
  `supplier_invoice_items` is "one or more".
- `UK` marks a unique column. `products.code` is unique but optional.
- Derived values are never stored: product status (OUT, LOW, IN STOCK), supplier due, and invoice
  status (PAID or DUE) are calculated from the columns above.

## Money and date-time formats

All money columns (`cost`, `price`, `unit_price`, `unit_cost`, `total`, `paid_amount`, `amount`)
are whole numbers of **paisa**, so Rs. 1,200.50 is stored as `120050`. This avoids rounding errors
that appear when money is stored as a decimal. The screens convert to rupees only at the edge, using
`Intl.NumberFormat('en-IN')`.

Date-times are stored as local-time text in the form `YYYY-MM-DD HH:MM` with no time zone
(`sales.sold_at`), and dates as `YYYY-MM-DD` (`supplier_invoices.invoice_date`). Because the
Sales screen lets the owner choose any date and time, grouping a day or an hour is done with
simple string functions on these values. A `CHECK` constraint on each column rejects any other shape.

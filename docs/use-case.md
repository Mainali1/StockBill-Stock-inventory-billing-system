# Use cases

StockBill has one actor, the shop owner. Each use case below lists the requirement IDs from
[`SPEC.md`](SPEC.md) that define it. [`requirements-trace.md`](requirements-trace.md) shows the test
files behind each ID.

```mermaid
flowchart LR
    owner["Shop owner"]

    uc1(["Set up shop (AUTH-1)"])
    uc2(["Sign in (AUTH-2)"])
    uc3(["Manage products (INV-1 to INV-5)"])
    uc4(["Manage suppliers (SUP-1, SUP-2, SUP-5)"])
    uc5(["Record supplier invoice (SUP-3)"])
    uc6(["Record supplier payment (SUP-4)"])
    uc7(["Record sales (SAL-1, SAL-2)"])
    uc8(["Review and correct sales (SAL-3, SAL-4)"])
    uc9(["View dashboard (DASH-1 to DASH-5)"])
    uc10(["View reports (REP-1 to REP-5)"])
    uc11(["Export and print reports (REP-6, REP-7)"])

    owner --- uc1
    owner --- uc2
    owner --- uc3
    owner --- uc4
    owner --- uc5
    owner --- uc6
    owner --- uc7
    owner --- uc8
    owner --- uc9
    owner --- uc10
    owner --- uc11
```

Mermaid has no native use-case notation, so this flowchart follows the standard layout: the actor on
the left, linked by plain lines to rounded use-case nodes.

## How the use cases connect

- **Set up shop** runs once, on first launch, and signs the owner in. Every later start uses **Sign in**.
  Session checks on every other screen are covered by AUTH-3.
- **Record supplier invoice** adds stock and creates an amount owed. **Record supplier payment** reduces
  that amount, oldest invoice first.
- **Record sales** removes stock. **Review and correct sales** edits or deletes a sale row and puts the
  stock difference back.
- The dashboard and the reports only read data. They show the effect of the use cases above.

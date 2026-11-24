# Demo script

A walkthrough of about ten minutes for the viva, in plain English. Each step ends with the requirement IDs
from [`SPEC.md`](SPEC.md) that it demonstrates.

## Before you start

Re-run the seed on the day of the demo. The sample sales are placed in the ten days up to today, so a fresh
seed makes "This week" and "This month" show real data.

```
npm run seed:demo
STOCKBILL_DB=./demo/stockbill-demo.db npm run dev
```

On Windows PowerShell set the variable first: `$env:STOCKBILL_DB = "./demo/stockbill-demo.db"`, then run `npm run dev`.

The demo shop is "Demo Mart" with 5 suppliers, 12 products, 6 supplier invoices and about 100 sales.
**Salt 1kg starts out of stock** (step 3 shows its OUT status and step 5 restocks it).

## The story to tell

One shop owner keeps stock under control: what the shop has, what it owes suppliers, and what it sold. The
app runs offline on one computer. Every number on screen is calculated from rows in one SQLite file.

## Walkthrough

1. **Sign in.** Enter a wrong password and show that the message is generic. Then sign in as `admin` with
   password `admin12345`. *Demonstrates AUTH-2, AUTH-4 and AUTH-5.*

2. **Dashboard overview.** Point to the cards for sales, profit, low-stock items and supplier dues. Change the
   date and watch the numbers and the week bars follow. Show the restock list and the latest invoices with
   their PAID or DUE stamps, and the **New sale** button. None of these values are stored; they are calculated when the screen opens.
   *Demonstrates DASH-1 to DASH-5.*

3. **Inventory.** Search for `tea`. Clear it and turn on **Low stock only**. Open a product, change its price,
   and save. Try a price below the cost and show the warning. Delete **Soap Bar**, which has sales, and show that it is archived instead of removed. The seed brings it back next time. *Demonstrates INV-1, INV-2, INV-3, INV-4 and INV-5.*

4. **Supplier balance and payment.** Open **Himal Traders**. Show its balance due, about Rs. 17,887, and its
   invoice history. Press **Record payment**, try an amount above the balance (it is refused), then press
   **Pay full balance** and confirm. A payment settles the oldest unpaid invoices first, in one transaction.
   *Demonstrates SUP-2, SUP-4 and SUP-5.*

5. **New supplier invoice that restocks Salt.** Still on Himal Traders, press **New invoice**, add **Salt 1kg**
   with quantity 40 and a unit cost, and save. Open Inventory and show that Salt 1kg now has 40 in stock.
   The invoice added stock and created an amount owed. *Demonstrates SUP-3 and INV-3.*

6. **Sales at a chosen date and time.** On **Sales**, add two items and set **When** to 10:15 today, then
   press **Save sales**. Add one item and set **When** to 18:40 yesterday, then save. Point out that the
   "Sales on" panel, its totals and its by-hour chart change with the **When** date. The time is chosen by
   the owner, not taken from the clock. *Demonstrates SAL-1, SAL-2 and SAL-3.*

7. **Try to oversell.** Add Tea 250g, which has 2 in stock, and try to raise its quantity to 5. The quantity
   stops at the stock level. The same
   rule is enforced again in the main process, which answers "Only 2 of Tea 250g in stock." if a request ever
   asks for more. *Demonstrates SAL-2.*

8. **Edit and delete a sale.** In the day table press **Edit** on a row, change the quantity, and save.
   Then press **Delete** and confirm. The message says the stock was restored. Open Inventory and show the
   stock came back. *Demonstrates SAL-4.*

9. **Dashboard and reports reflect the new data.** Go back to the Dashboard and show the new sales and the
   lower supplier dues. Open **Reports**, show the Profit, Sales, Stock and Supplier dues tabs, and switch the
   range to **This month**. Stock and Supplier dues describe "now", so the range chips are disabled there.
   *Demonstrates DASH-1, DASH-4 and REP-1 to REP-5.*

10. **Export and print.** Press **Export CSV** and open the saved file in a spreadsheet. Press **Print report**
    and show the print preview: navigation and buttons are hidden. Finish with **Sign out**, which returns to
    the Login screen. *Demonstrates REP-6, REP-7 and AUTH-3.*

## Questions to expect

| Question | Short answer |
|---|---|
| Why is money stored as whole numbers? | Paisa as integers avoid the rounding errors that decimals cause. Conversion to rupees happens only on screen. |
| How is SQL injection prevented? | Only prepared statements with bound parameters. Search text goes through `escapeLike`. AUTH-5 tests real payloads. |
| How are passwords stored? | As bcrypt hashes with cost 10. No handler ever returns a hash. |
| Why can the screens not read the database? | They are sandboxed. They can only call named IPC channels, and the main process validates every input. |
| Where is "do not sell more than the stock" enforced? | In the main process, inside the sale transaction. The screen only helps the owner. |
| How do you know every requirement is tested? | `docs/requirements-trace.md` lists each ID with its test files. `tests/docs.test.ts` fails if one has none. |
| What if the documents drift from the code? | The same test compares `schema.sql` and the ER diagram with the migrated database. |
| Why archive instead of delete? | A product or supplier with history must stay, or old sales and invoices would point to nothing. |

## If something goes wrong

- **The data looks wrong or empty.** Close the app and run `npm run seed:demo` again. It recreates the demo file.
- **The app asks you to sign in again.** The session lives in memory and ends when the app closes.
- **A native module error on start.** Run `npm run rebuild:electron` once, then `npm run dev`.

# CFR Travel Voucher & Log Generator ⚡

A mobile-friendly field travel expense logger and company Excel generator built for service engineers and field representatives.

## Features
- **Mobile-First Data Entry Flow:**
  - Route first: `From` & `To` with auto-suggestions of frequent locations & ⇄ swap button.
  - Travel Mode second: `Bike`, `Auto`, `Bus`, `Train`, `Hamali`, `Food`, `Taxi`, `Car`, `Lodging`, `Flight`.
  - Amount & Distance third: Live KM to ₹ rate calculations.
  - Purpose & quick action chips fourth.
- **Full In-Place Editing:** Easily edit any logged trip with one click, modify the route, mode, or amount, and save in-place.
- **1-Tap Quick Actions:**
  - `+🍽️ ₹600 Food`: Standardized company food allowance entry.
  - `🔄 Return Log`: Reverses the previous trip route instantly.
- **Exact Company Excel Export (`.xlsx`):**
  - Generates multi-sheet Excel workbooks matching the company's exact template (custom fonts, fills, merged headers, formulas, and office sign-off blocks).
  - Works both in-browser (via ExcelJS for instant offline/Vercel downloads) and via Python OpenPyXL.
- **Live WYSIWYG Preview:** Inspect the exact 21-column company spreadsheet before downloading.
- **Profile Persistence:** Employee name, reporting manager, and default client are stored in `localStorage` so you never have to re-enter them.

## Local Run
Simply double-click `run.bat` or run:
```bash
python server.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser (or your local IP on phone).

## Deploy to Vercel
1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import `travel-log-generator`.
4. Click **"Deploy"** (no build settings needed; Vercel automatically deploys the frontend and serverless endpoints).

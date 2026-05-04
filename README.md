# Travel Recap

A privacy-first web app that turns your **Google Maps Timeline** and **UPI transaction history** into a beautiful trip recap — see where you went, what you spent, and how the two line up, rendered as a shareable postcard.

## Features

- **Trip postcard** — date range, distance travelled, total spent, and stops-per-day at a glance
- **Map** — dark CartoDB tiles with your route polylines; lime markers for stops where you spent, magenta for unmatched stops
- **Itinerary rail** — stops grouped by day with per-day totals, vertical timeline connectors, and transaction breakdowns
- **Smart matching** — UPI payments are matched to stops within ±30 minutes
- **Share link** — bundle the recap into a `#hash` URL fragment (compressed, Base64); no server, no upload
- **CSV export** — download the recap as a spreadsheet
- **Date filtering** — narrow the recap to a specific window
- **Dark mode by default** — cyan / lime / magenta accents on a near-black canvas, with an orange brand colour

## Privacy

Files are parsed **entirely in your browser**. Nothing is uploaded to any server. Share links embed the recap data in the URL fragment (`#…`), which browsers do not send to servers.

## How to get your files

### Google Maps Timeline JSON

1. Open Google Maps on your phone.
2. Tap your profile photo → **Your Timeline**.
3. Tap the three-dot menu → **Export Timeline data**.
4. A `Timeline.json` file will be saved — download and upload it here.

### UPI Transaction History

- **GPay** — Profile → Transaction History → download icon → export as CSV.
- **PhonePe** — History → top-right menu → Download Statement → select date range → Download PDF.
- **Bank CSV** — Log in to netbanking → Statements → download as CSV for your date range.

## Local development

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`. Hot reload is on.

```bash
npm run build   # production build
npm run lint    # eslint
npm start       # serve the production build
```

## Tech stack

- **Next.js 14** (App Router, static export)
- **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **Leaflet** + **react-leaflet** for the map
- **pdfjs-dist** to parse PhonePe / GPay PDFs
- Native `CompressionStream` / `DecompressionStream` for share-link compression

## Project structure

```
app/            Next.js App Router pages, layout, global CSS
components/     UploadForm, RecapView, RecapMap, FileDropzone,
                HowToGuide, PageDecorations
lib/            Pure logic — timeline & UPI parsers, matching,
                share encoding, CSV export, type definitions
scripts/        One-off Node scripts (e.g. saving a recap CSV locally)
```

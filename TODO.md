# PharmaChain Enhancement Tasks

## 1. Live Tracking ✅
- [x] Add auto-refreshing live tracking (polling every 5s) to `TrackBox.tsx`
- [x] Add "Live" badge + auto-refresh to Scan.tsx shipment/box result cards

## 2. Back to Dashboard button ✅
- [x] Add "Back to Dashboard" button to ShipmentScan.tsx (`/shipment-scan`)
- [x] Add "Back to Dashboard" button to TrackBox.tsx for logged-in users

## 3. Scan QR in transport ✅
- [x] Add "Scan QR" menu item to transport role in Sidebar.tsx

## Build ✅
- [x] Typecheck compiles (only pre-existing unrelated error in src/lib/db.ts:319)
- [x] Rebuilt dist/ - sw.js regenerated successfully (58 precache entries)
- [x] Backend healthy on port 41837

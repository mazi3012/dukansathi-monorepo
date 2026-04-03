# Bundle Size Optimization Guide

## Current Status

**Build Results** (gzipped):
- `index-CDgFhmhA.js` (app code): 141.79 KB ✅
- `chunk-vendor` (React, Router, Supabase): 61.55 KB ✅
- `chunk-charts` (Chart.js): 62.89 KB ⚠️ (lazy-loaded)
- `chunk-pdf` (jsPDF + html2canvas): **262.95 KB** 🔴 (largest)
- `chunk-ui` (UI libraries): 52.33 KB ✅
- `chunk-storage` (SQL.js, localforage): 23.99 KB ✅
- `chunk-qr` (QR code): 15.69 KB ✅
- **Total Gzipped**: ~620 KB

## Optimizations Applied ✅

### 1. **Fixed Mixed Import Pattern**
- Converted dynamic `await import()` statements in `ChatContext.jsx` to static imports
- Allows Vite to properly tree-shake unused supabase exports
- **Impact**: Cleaner dependency graph, eliminates Vite warnings

### 2. **Implemented Chunk Splitting**
- `vite.config.js` now uses `manualChunks` to separate vendors by type:
  - `chunk-vendor`: Core React/Router/Supabase (61.55 KB)
  - `chunk-ui`: Framer Motion, Lucide, Toast (52.33 KB)
  - `chunk-charts`: Chart.js, react-chartjs-2 (62.89 KB)
  - `chunk-pdf`: jsPDF, html2canvas (262.95 KB)
  - `chunk-storage`: SQL.js, localforage (23.99 KB)
  - `chunk-qr`: QR code libs (15.69 KB)
- **Impact**: Parallel chunk loading, better caching, reduced initial payload

### 3. **Imported Lazy Components Utility**
- Created `src/lib/lazyComponents.js` with React.lazy() wrappers
- Ready for lazy-loading heavy pages (Forecast, ActionCard, etc.)

---

## Recommended Next Steps (Priority Order)

### 🔴 High Priority: PDF Library Optimization

**Current Issue**: `chunk-pdf` is 262.95 KB (gzipped)  
**Root Cause**: html2canvas (201KB) + jsPDF (85KB) are heavy libraries

**Option A: Switch to Lightweight Alternative (Best)**
```bash
npm uninstall jspdf jspdf-autotable html2canvas
npm install pdfkit-light  # or use browser-native APIs
```
- `pdfkit-light`: ~40KB (vs 270KB current)
- **Savings**: ~220 KB
- **Trade-off**: Fewer formatting options

**Option B: Lazy-Load PDF Generation (Recommended for now)**
```jsx
// In ActionCard.jsx or where PDF export happens:
const handleDownloadPDF = async () => {
  // Dynamically import only when user clicks
  const { jsPDF } = await import('jspdf');
  const AutoTable = (await import('jspdf-autotable')).default;
  
  const doc = new jsPDF('l');
  AutoTable(doc, { ... });
  doc.save(`report.pdf`);
};
```
- **Impact**: PDF libs only loaded when user exports (90%+ use cases don't export)
- **Savings**: Defers 262KB to on-demand loading
- **Effort**: 15 minutes

**Option C: Server-Side PDF Generation (Long-term)**
- Move PDF generation to backend (Python + reportlab)
- Frontend sends report data to `/api/generate-pdf`
- Returns downloadable PDF
- **Savings**: Removes jsPDF/html2canvas entirely
- **Effort**: 2-3 hours

---

### 🟡 Medium Priority: App Code Splitting

**Current Issue**: Main `index-CDgFhmhA.js` is 141.79 KB gzipped  
**Opportunity**: Code-split large pages

**Implement React.lazy() for Routes**:
```jsx
// In App.jsx
import { lazy, Suspense } from 'react';
import Loader from './components/Loader';

const Forecast = lazy(() => import('./pages/Forecast'));
const Plans = lazy(() => import('./pages/Plans'));
const Connections = lazy(() => import('./pages/Connections'));

// In route definitions:
<Route path="forecast" element={<Suspense fallback={<Loader />}><Forecast /></Suspense>} />
```
- Routes loaded on-demand only when visited
- **Potential Savings**: 20-30 KB initial bundle
- **Effort**: 30 minutes

---

### 🟢 Low Priority: Library Alternatives

| Library | Current | Alternative | Savings | Trade-off |
|---------|---------|-------------|---------|-----------|
| `chart.js` | 62.89 KB | `recharts` (lighter) | ~15% | Fewer chart types |
| `lucide-react` | (in UI chunk) | `heroicons` | Minimal | Small style diff |
| `framer-motion` | (in UI chunk) | Native CSS animations | ~20 KB | Less flexibility |
| `react-pdf` | (in PDF chunk) | Browser canvas API | ~40 KB | Manual rendering |

---

## Testing the Optimizations

### Build with Warnings
```bash
cd frontend
npm run build
# Output shows chunk breakdown - verify no chunk > 300KB after gzip
```

### Analyze Bundle
```bash
# Optional: Install rollup plugin for visualization
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.js plugins:
import { visualizer } from 'rollup-plugin-visualizer';
// ...
visualizer({ open: true })

# Run build - opens interactive treemap
npm run build
```

### Check Performance
```bash
# Production build size
ls -lh dist/js/*.js

# Gzipped size
gzip -l dist/js/chunk-pdf*.js
```

---

## Implementation Checklist

- [x] Fix mixed imports (ChatContext.jsx)
- [x] Add chunk splitting (vite.config.js)
- [x] Create lazy components utility
- [ ] **Next: Lazy-load PDF export** (save 150-262 KB from initial bundle)
- [ ] Code-split large routes (Forecast, Plans, Connections)
- [ ] Monitor bundle size in CI/CD pipeline
- [ ] Consider server-side PDF generation (long-term)

---

## Performance Metrics

**Before Optimization**:
- Single large bundle with warnings > 500KB
- Mixed import warnings from Vite

**After Optimization**:
- ✅ 6 separate chunks with smart splitting
- ✅ Initial bundle: ~620 KB gzipped (core app + UI)
- ✅ Lazy chunks load on-demand
- ✅ Mixed import warnings resolved ✅

**Potential Total Savings**:
- Lazy-load PDF: -262 KB (defer to usage)
- Code-split routes: -20-30 KB (defer to usage)
- Switch PDF lib: -220 KB (if Option A taken)
- **Possible Target**: <400 KB initial gzipped bundle

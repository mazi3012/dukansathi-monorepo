/**
 * Lazy-loaded components for code splitting.
 * These components are only loaded when imported, reducing initial bundle size.
 * Used for heavy libraries like Charts, PDF generation, and QR codes.
 */

import { lazy } from 'react';

// Lazy-load the Forecast page which uses heavy chart libraries
export const LazyForecast = lazy(() => import('../pages/Forecast'));

// Lazy-load PDF/report components (if created separately)
// These libraries are large and only needed when user exports reports
export const LazyActionCard = lazy(() => import('../components/ActionCard'));

/**
 * Usage in parent component:
 * 
 * import { Suspense } from 'react';
 * import { LazyForecast } from '../lib/lazyComponents';
 * 
 * <Suspense fallback={<Loader />}>
 *   <LazyForecast />
 * </Suspense>
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CalendarDays, Target, RefreshCw, AlertCircle, Package, Flame, BellRing } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const currency = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

const compactDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const riskTone = (risk) => {
    if (risk === 'out' || risk === 'critical') return 'text-red-500';
    if (risk === 'high') return 'text-orange-500';
    if (risk === 'medium') return 'text-yellow-500';
    return 'text-emerald-500';
};

const Forecast = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('revenue');
    const [revenuePayload, setRevenuePayload] = useState(null);
    const [inventoryPayload, setInventoryPayload] = useState(null);
    const [isDark, setIsDark] = useState(() => {
        if (typeof document === 'undefined') return true;
        return document.documentElement.getAttribute('data-theme') === 'dark' || 
               (!document.documentElement.getAttribute('data-theme') && 
                window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    // Listen for theme changes
    useEffect(() => {
        const handleThemeChange = () => {
            const newIsDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
                            (!document.documentElement.getAttribute('data-theme') && 
                            window.matchMedia('(prefers-color-scheme: dark)').matches);
            setIsDark(newIsDark);
        };
        
        const themeObserver = new MutationObserver(handleThemeChange);
        themeObserver.observe(document.documentElement, { attributes: true });
        window.addEventListener('theme-changed', handleThemeChange);
        
        return () => {
            themeObserver.disconnect();
            window.removeEventListener('theme-changed', handleThemeChange);
        };
    }, []);

    const fetchWithAuth = async (path, options = {}) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Please login again to continue.');
        }

        const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
        const apiUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

        const res = await fetch(`${apiUrl}${path}`, {
            method: options.method || 'GET',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                ...(options.headers || {}),
            },
            body: options.body,
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || 'Request failed');
        }

        return res.json();
    };

    const loadAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [revenue, inventory] = await Promise.all([
                fetchWithAuth('/api/forecast?horizon_days=30&lookback_days=120'),
                fetchWithAuth('/api/inventory-forecast?lookback_days=60'),
            ]);

            setRevenuePayload(revenue);
            setInventoryPayload(inventory);

            // Generate fresh stockout notifications in the background.
            fetchWithAuth('/api/notifications/generate?lookback_days=60&risk_days_threshold=14', { method: 'POST' }).catch(() => null);
        } catch (e) {
            setError(e.message || 'Failed to load forecast data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const revenueChart = useMemo(() => {
        if (!revenuePayload) return null;

        const historyTail = revenuePayload.history.slice(-30);
        const forecastHead = revenuePayload.forecast.slice(0, 30);
        const labels = [...historyTail.map((d) => compactDate(d.date)), ...forecastHead.map((d) => compactDate(d.date))];

        // Theme-aware colors
        const actualColor = isDark ? '#38bdf8' : '#0ea5e9';
        const actualBgColor = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)';
        const forecastColor = isDark ? '#fb923c' : '#f97316';

        return {
            labels,
            datasets: [
                {
                    label: 'Actual',
                    data: [...historyTail.map((d) => d.revenue), ...new Array(forecastHead.length).fill(null)],
                    borderColor: actualColor,
                    backgroundColor: actualBgColor,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: 'Forecast',
                    data: [...new Array(historyTail.length).fill(null), ...forecastHead.map((d) => d.revenue)],
                    borderColor: forecastColor,
                    borderDash: [6, 4],
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                },
            ],
        };
    }, [revenuePayload, isDark]);

    const demandChart = useMemo(() => {
        if (!inventoryPayload) return null;
        const top = (inventoryPayload.top_demand_products || []).slice(0, 8);

        // Theme-aware bar color
        const barColor = isDark ? '#818cf8' : '#6366f1';

        return {
            labels: top.map((p) => p.name),
            datasets: [
                {
                    label: 'Expected Units (Next 7 Days)',
                    data: top.map((p) => p.forecast_next_7_units || 0),
                    backgroundColor: barColor,
                    borderRadius: 10,
                },
            ],
        };
    }, [inventoryPayload, isDark]);

    const revenueSummary = revenuePayload?.summary || {};
    const inventorySummary = inventoryPayload?.summary || {};

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-text-main">Forecast Hub</h1>
                    <p className="text-sm text-text-muted">Revenue trend, product demand, and inventory run-out predictions.</p>
                </div>
                <button
                    onClick={loadAll}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition disabled:opacity-70"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="glass-card border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 mt-0.5" size={18} />
                    <div>
                        <p className="font-semibold text-red-500">Could not load forecast</p>
                        <p className="text-sm text-text-muted">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div className="glass-card rounded-2xl border p-5 bg-gradient-to-br from-sky-500/20 to-cyan-500/5 border-sky-500/30">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-muted">Next 7 Days Revenue</span>
                        <CalendarDays size={18} className="text-text-main" />
                    </div>
                    <p className="mt-3 text-2xl font-black tracking-tight text-text-main">
                        {currency.format(revenueSummary.next_7_days_revenue || 0)}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-5 bg-gradient-to-br from-orange-500/20 to-amber-500/5 border-orange-500/30">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-muted">Next 30 Days Revenue</span>
                        <Target size={18} className="text-text-main" />
                    </div>
                    <p className="mt-3 text-2xl font-black tracking-tight text-text-main">
                        {currency.format(revenueSummary.next_30_days_revenue || 0)}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-5 bg-gradient-to-br from-rose-500/20 to-red-500/5 border-rose-500/30">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-muted">Critical Stock Alerts</span>
                        <BellRing size={18} className="text-text-main" />
                    </div>
                    <p className="mt-3 text-2xl font-black tracking-tight text-text-main">
                        {inventorySummary.critical_count || 0}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-5 bg-gradient-to-br from-emerald-500/20 to-lime-500/5 border-emerald-500/30">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-muted">Demanding Products</span>
                        <Flame size={18} className="text-text-main" />
                    </div>
                    <p className="mt-3 text-2xl font-black tracking-tight text-text-main">
                        {(inventoryPayload?.top_demand_products || []).length}
                    </p>
                </motion.div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
                    { id: 'stockout', label: 'Run-out Forecast', icon: Package },
                    { id: 'demand', label: 'Product Demand', icon: Flame },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap font-semibold transition-all ${
                            activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-card-bg text-text-muted hover:text-text-main border border-card-border'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'revenue' && (
                <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4">
                    <h2 className="text-lg font-bold text-text-main">Actual vs Revenue Forecast</h2>
                    <div className="h-[320px]">
                        {revenueChart && (
                            <Line
                                data={revenueChart}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { 
                                        legend: { 
                                            position: 'bottom',
                                            labels: {
                                                color: isDark ? '#cbd5e1' : '#64748b',
                                                font: { size: 12 }
                                            }
                                        } 
                                    },
                                    scales: {
                                        y: {
                                            grid: {
                                                color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                            },
                                            ticks: {
                                                callback: (v) => `Rs ${Number(v).toLocaleString('en-IN')}`,
                                                color: isDark ? '#cbd5e1' : '#64748b',
                                            },
                                        },
                                        x: {
                                            grid: {
                                                color: isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                            },
                                            ticks: {
                                                color: isDark ? '#cbd5e1' : '#64748b',
                                            }
                                        }
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'stockout' && (
                <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4 overflow-x-auto">
                    <h2 className="text-lg font-bold text-text-main">Inventory Run-out Forecast</h2>
                    <table className="w-full min-w-[900px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-card-border/50 text-[11px] uppercase tracking-wider text-text-muted">
                                <th className="py-2 pr-3">Product</th>
                                <th className="py-2 pr-3">Stock</th>
                                <th className="py-2 pr-3">Avg Daily Sale</th>
                                <th className="py-2 pr-3">Days Left</th>
                                <th className="py-2 pr-3">Run-out Date</th>
                                <th className="py-2 pr-3">Reorder Qty</th>
                                <th className="py-2 pr-3">Risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(inventoryPayload?.products || []).slice(0, 25).map((item) => (
                                <tr key={item.product_id} className="border-b border-card-border/10">
                                    <td className="py-3 pr-3 font-semibold text-text-main">{item.name}</td>
                                    <td className="py-3 pr-3 text-text-main">{item.current_stock} {item.unit}</td>
                                    <td className="py-3 pr-3 text-text-main">{item.avg_daily_units}</td>
                                    <td className="py-3 pr-3 text-text-main">{item.days_to_stockout ?? '-'}</td>
                                    <td className="py-3 pr-3 text-text-main">{item.expected_stockout_date || '-'}</td>
                                    <td className="py-3 pr-3 text-text-main">{item.recommended_reorder_qty}</td>
                                    <td className={`py-3 pr-3 font-bold uppercase ${riskTone(item.risk_level)}`}>{item.risk_level}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'demand' && (
                <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4">
                    <h2 className="text-lg font-bold text-text-main">Upcoming Product Demand (Next 7 Days)</h2>
                    <div className="h-[340px]">
                        {demandChart && (
                            <Bar
                                data={demandChart}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { 
                                        legend: { 
                                            display: false 
                                        } 
                                    },
                                    scales: {
                                        y: { 
                                            beginAtZero: true,
                                            grid: {
                                                color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                            },
                                            ticks: {
                                                color: isDark ? '#cbd5e1' : '#64748b',
                                            }
                                        },
                                        x: {
                                            grid: {
                                                color: isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                            },
                                            ticks: {
                                                color: isDark ? '#cbd5e1' : '#64748b',
                                            }
                                        }
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Forecast;

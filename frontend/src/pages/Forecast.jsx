import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CalendarDays, Target, RefreshCw, AlertCircle, Package, Flame, BellRing, Zap, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
import DemandInsightsModal from '../components/DemandInsightsModal';

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
    const [aiInsights, setAiInsights] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [activeTab, setActiveTab] = useState('revenue');
    const [revenuePayload, setRevenuePayload] = useState(null);
    const [inventoryPayload, setInventoryPayload] = useState(null);
    const [isDark, setIsDark] = useState(() => {
        if (typeof document === 'undefined') return true;
        return document.documentElement.getAttribute('data-theme') === 'dark' || 
               (!document.documentElement.getAttribute('data-theme') && 
                window.matchMedia('(prefers-color-scheme: dark)').matches);
    });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const loadAiInsights = async () => {
        setLoadingAi(true);
        try {
            const res = await fetchWithAuth('/api/forecast/ai-insights');
            setAiInsights(res.insights);
        } catch (e) {
            setError(e.message || 'Failed to generate AI insights');
        } finally {
            setLoadingAi(false);
        }
    };

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

        // Theme-aware colors based on demand trend
        const getBarColor = (trend) => {
            if (trend === 'accelerating') return isDark ? '#ef4444' : '#dc2626';
            if (trend === 'growing') return isDark ? '#fb923c' : '#f97316';
            if (trend === 'stable') return isDark ? '#818cf8' : '#6366f1';
            if (trend === 'declining') return isDark ? '#94a3b8' : '#64748b';
            return isDark ? '#818cf8' : '#6366f1';
        };

        return {
            labels: top.map((p) => p.name),
            datasets: [
                {
                    label: 'Expected Units (Next 7 Days)',
                    data: top.map((p) => p.forecast_next_7_units || 0),
                    backgroundColor: top.map((p) => getBarColor(p.demand_trend)),
                    borderRadius: 10,
                    borderSkipped: false,
                },
            ],
        };
    }, [inventoryPayload, isDark]);

    const revenueSummary = revenuePayload?.summary || {};
    const inventorySummary = inventoryPayload?.summary || {};

    return (
        <div className="space-y-4 md:space-y-6 pb-8 w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-4xl font-black tracking-tighter font-heading text-text-main truncate">Forecast Hub</h1>
                    <p className="text-[10px] md:text-sm font-black text-text-muted uppercase tracking-widest md:tracking-[0.3em] mt-0.5 md:mt-1 truncate">Predict trends & demand</p>
                </div>
                <button
                    onClick={loadAll}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs md:text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shrink-0"
                >
                    <RefreshCw size={16} className={`md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
                    <span className="uppercase tracking-widest font-black">Refresh</span>
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

            {/* AI Executive Summary Banner */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl md:rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-fuchsia-500/5 to-indigo-500/5 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 opacity-50"></div>
                <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:pt-1">
                        <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-2 md:p-3 rounded-xl shadow-lg shadow-indigo-500/20 shrink-0">
                            <Zap className="text-white w-4 h-4 md:w-6 md:h-6" />
                        </div>
                        <h2 className="text-sm md:text-lg font-black tracking-widest text-text-main font-heading md:hidden">AI Insights</h2>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                        <h2 className="hidden md:block text-lg font-black tracking-widest text-text-main font-heading">Executive AI Summary</h2>
                        
                        {!aiInsights ? (
                            <div className="space-y-3">
                                <p className="text-xs md:text-sm text-text-muted font-medium">Generate a personalized, AI-driven market analysis based on your current statistical forecast and inventory velocity.</p>
                                <button
                                    onClick={loadAiInsights}
                                    disabled={loadingAi}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-bold text-xs md:text-sm hover:opacity-90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loadingAi ? (
                                        <RefreshCw size={16} className="animate-spin" />
                                    ) : (
                                        <Zap size={16} />
                                    )}
                                    <span>{loadingAi ? 'Analyzing Data...' : 'Generate AI Insight (1 Credit)'}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm md:text-base text-text-main font-medium leading-relaxed italic border-l-2 border-indigo-500/30 pl-3">
                                    "{aiInsights}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 shrink-0 px-0.5">
                <motion.div className="glass-card rounded-2xl border p-2.5 md:p-5 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 border-sky-500/20">
                    <div className="flex items-center justify-between text-text-muted mb-1 md:mb-3">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">Weekly</span>
                        <CalendarDays size={14} className="md:w-[18px] md:h-[18px]" />
                    </div>
                    <p className="text-sm md:text-xl font-black tracking-tight text-text-main truncate">
                        {currency.format(revenueSummary.next_7_days_revenue || 0)}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-2.5 md:p-5 bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/20">
                    <div className="flex items-center justify-between text-text-muted mb-1 md:mb-3">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">Monthly</span>
                        <Target size={14} className="md:w-[18px] md:h-[18px]" />
                    </div>
                    <p className="text-sm md:text-xl font-black tracking-tight text-text-main truncate">
                        {currency.format(revenueSummary.next_30_days_revenue || 0)}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-2.5 md:p-5 bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20">
                    <div className="flex items-center justify-between text-text-muted mb-1 md:mb-3">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">Alerts</span>
                        <BellRing size={14} className="md:w-[18px] md:h-[18px]" />
                    </div>
                    <p className="text-sm md:text-xl font-black tracking-tight text-text-main">
                        {inventorySummary.critical_count || 0}
                    </p>
                </motion.div>

                <motion.div className="glass-card rounded-2xl border p-2.5 md:p-5 bg-gradient-to-br from-emerald-500/10 to-lime-500/5 border-emerald-500/20">
                    <div className="flex items-center justify-between text-text-muted mb-1 md:mb-3">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">Hot</span>
                        <Flame size={14} className="md:w-[18px] md:h-[18px]" />
                    </div>
                    <p className="text-sm md:text-xl font-black tracking-tight text-text-main">
                        {(inventoryPayload?.top_demand_products || []).length}
                    </p>
                </motion.div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full shrink-0 border-b border-card-border/30 mb-2">
                {[
                    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
                    { id: 'stockout', label: 'Stockout', icon: Package },
                    { id: 'demand', label: 'Demand', icon: Flame },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl whitespace-nowrap text-[11px] md:text-sm font-black md:font-bold tracking-widest md:tracking-normal uppercase md:normal-case transition-all shrink-0 ${
                            activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-card-bg/30 text-text-muted hover:text-text-main border border-card-border/50'
                        }`}
                    >
                        <tab.icon size={14} className="md:w-4 md:h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'revenue' && (
                <div className="glass-card rounded-2xl md:rounded-3xl border border-card-border p-3 md:p-6 space-y-4 w-full">
                    <h2 className="text-sm md:text-lg font-black text-text-main uppercase tracking-widest font-heading">Trends</h2>
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
                <div className="glass-card rounded-2xl md:rounded-3xl border border-card-border p-3 md:p-6 space-y-4 w-full">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xs md:text-lg font-black text-text-main uppercase tracking-widest font-heading">Inventory Hub</h2>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest hidden md:block">Real-time Stock Tracking</span>
                    </div>

                    {/* Desktop View: Wide Table */}
                    <div className="hidden lg:block overflow-x-auto w-full scrollbar-hide pb-2">
                        <table className="w-full min-w-[700px] text-left border-collapse">
                            <thead>
                                <tr className="border-b border-card-border/50 text-[10px] md:text-[11px] uppercase tracking-widest text-text-muted">
                                    <th className="py-2 pr-2">Product</th>
                                    <th className="py-2 pr-2">Stock</th>
                                    <th className="py-2 pr-2">Avg Sale</th>
                                    <th className="py-2 pr-2">Left</th>
                                    <th className="py-2 pr-2">Run-out</th>
                                    <th className="py-2 pr-2">Reorder</th>
                                    <th className="py-2 pr-2">Risk</th>
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

                    {/* Mobile View: Vertical Cards */}
                    <div className="lg:hidden grid grid-cols-1 gap-3">
                        {(inventoryPayload?.products || []).slice(0, 15).map((item) => (
                            <div key={item.product_id} className="glass-card rounded-xl border border-card-border p-3 space-y-2.5">
                                <div className="flex items-start justify-between">
                                    <h3 className="font-black text-xs text-text-main leading-tight truncate max-w-[70%]">{item.name}</h3>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${riskTone(item.risk_level)} bg-current/10 border border-current/20`}>
                                        {item.risk_level}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 py-0.5 border-y border-card-border/5">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Stock</span>
                                        <span className="text-[10px] font-black text-text-main">{item.current_stock}</span>
                                    </div>
                                    <div className="flex flex-col border-x border-card-border/5 px-2">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Sale</span>
                                        <span className="text-[10px] font-black text-text-main">~{item.avg_daily_units}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Run-out</span>
                                        <span className="text-[10px] font-black text-accent-red">{item.days_to_stockout ?? '-'}d</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[9px]">
                                    <span className="text-text-muted font-black uppercase tracking-tighter">Smart Reorder</span>
                                    <span className="text-indigo-500 font-black">{item.recommended_reorder_qty} Units</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'demand' && (
                <div className="space-y-4 md:space-y-6 w-full">
                    {/* Demand Insights Summary */}
                    <div className="grid grid-cols-3 gap-2 md:gap-4 shrink-0">
                        {(() => {
                            const top = (inventoryPayload?.top_demand_products || []).slice(0, 8);
                            const accelerating = top.filter(p => p.demand_trend === 'accelerating').length;
                            const growing = top.filter(p => p.demand_trend === 'growing').length;
                            const declining = top.filter(p => p.demand_trend === 'declining').length;
                            
                            const avgWeekChange = top.length > 0 
                                ? (top.reduce((sum, p) => sum + (p.week_over_week_percent || 0), 0) / top.length).toFixed(1)
                                : 0;

                            return (
                                <>
                                    <motion.div className="glass-card rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Accelerating</p>
                                                <p className="text-3xl font-black text-red-500">{accelerating}</p>
                                            </div>
                                            <Zap size={32} className="text-red-500/30" />
                                        </div>
                                    </motion.div>

                                    <motion.div className="glass-card rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Growing</p>
                                                <p className="text-3xl font-black text-orange-500">{growing}</p>
                                            </div>
                                            <TrendingUp size={32} className="text-orange-500/30" />
                                        </div>
                                    </motion.div>

                                    <motion.div className="glass-card rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Avg WoW Change</p>
                                                <p className={`text-3xl font-black ${avgWeekChange > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                                                    {avgWeekChange > 0 ? '+' : ''}{avgWeekChange}%
                                                </p>
                                            </div>
                                            {avgWeekChange > 0 ? (
                                                <ArrowUpRight size={32} className="text-orange-500/30" />
                                            ) : (
                                                <ArrowDownLeft size={32} className="text-blue-500/30" />
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Chart */}
                    <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4">
                        <h2 className="text-lg font-bold text-text-main">Upcoming Product Demand (Next 7 Days)</h2>
                        <div className="h-[340px]">
                            {demandChart && (
                                <Bar
                                    data={demandChart}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        indexAxis: undefined,
                                        onClick: (event, elements) => {
                                            if (elements.length > 0) {
                                                const index = elements[0].index;
                                                const top = (inventoryPayload?.top_demand_products || []).slice(0, 8);
                                                if (top[index]) {
                                                    setSelectedProduct(top[index]);
                                                    setIsModalOpen(true);
                                                }
                                            }
                                        },
                                        plugins: { 
                                            legend: { 
                                                display: false 
                                            },
                                            tooltip: {
                                                callbacks: {
                                                    afterLabel: (context) => {
                                                        const top = (inventoryPayload?.top_demand_products || []).slice(0, 8);
                                                        const product = top[context.dataIndex];
                                                        if (product) {
                                                            return `WoW: ${product.week_over_week_percent > 0 ? '+' : ''}${product.week_over_week_percent.toFixed(1)}%`;
                                                        }
                                                        return '';
                                                    }
                                                }
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
                        <p className="text-xs text-text-muted text-center">Click on any bar to see detailed demand insights</p>
                    </div>

                    {/* Detailed Demand List */}
                    <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-3">
                        <h2 className="text-lg font-bold text-text-main mb-4">Top Demanding Products</h2>
                        {(inventoryPayload?.top_demand_products || []).slice(0, 12).map((product, idx) => {
                            const trendColor = {
                                accelerating: 'text-red-500 bg-red-500/10',
                                growing: 'text-orange-500 bg-orange-500/10',
                                stable: 'text-cyan-500 bg-cyan-500/10',
                                declining: 'text-slate-500 bg-slate-500/10',
                            }[product.demand_trend] || 'text-indigo-500 bg-indigo-500/10';

                            const percentColor = product.week_over_week_percent > 0 
                                ? 'text-orange-500' 
                                : product.week_over_week_percent < -15 
                                ? 'text-blue-500' 
                                : 'text-slate-500';

                            return (
                                <motion.button
                                    key={product.product_id}
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setIsModalOpen(true);
                                    }}
                                    whileHover={{ scale: 1.01 }}
                                    className="w-full glass-card rounded-xl border border-card-border p-4 cursor-pointer hover:border-indigo-500/50 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-bold text-text-main truncate">{idx + 1}. {product.name}</h3>
                                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ${trendColor}`}>
                                                    {product.demand_trend}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                                                <span>This week: {Math.round(product.sold_this_week)} {product.unit}</span>
                                                <span>•</span>
                                                <span>Forecast: {Math.round(product.forecast_next_7_units)} {product.unit}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className={`text-xl font-black ${percentColor}`}>
                                                {product.week_over_week_percent > 0 ? '+' : ''}{product.week_over_week_percent.toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] font-bold uppercase text-text-muted">
                                                WoW Change
                                            </div>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            )}

        {/* Demand Insights Modal */}
        <DemandInsightsModal 
            product={selectedProduct} 
            isOpen={isModalOpen} 
            onClose={() => {
                setIsModalOpen(false);
                setSelectedProduct(null);
            }} 
        />
        </div>
    );
};

export default Forecast;

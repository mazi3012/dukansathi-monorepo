import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CalendarDays, Target, RefreshCw, AlertCircle } from 'lucide-react';
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

const Forecast = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payload, setPayload] = useState(null);

    const loadForecast = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Please login again to view forecast.');
            }

            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

            const res = await fetch(`${API_URL}/api/forecast?horizon_days=30&lookback_days=120`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail || 'Unable to load forecast');
            }

            const data = await res.json();
            setPayload(data);
        } catch (e) {
            setError(e.message || 'Failed to fetch forecast');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadForecast();
    }, []);

    const chartData = useMemo(() => {
        if (!payload) return null;

        const historyTail = payload.history.slice(-30);
        const forecastHead = payload.forecast.slice(0, 30);

        const labels = [
            ...historyTail.map((d) => compactDate(d.date)),
            ...forecastHead.map((d) => compactDate(d.date)),
        ];

        const historySeries = [
            ...historyTail.map((d) => d.revenue),
            ...new Array(forecastHead.length).fill(null),
        ];

        const forecastSeries = [
            ...new Array(historyTail.length).fill(null),
            ...forecastHead.map((d) => d.revenue),
        ];

        const lowerSeries = [
            ...new Array(historyTail.length).fill(null),
            ...forecastHead.map((d) => d.lower),
        ];

        const upperSeries = [
            ...new Array(historyTail.length).fill(null),
            ...forecastHead.map((d) => d.upper),
        ];

        const byWeek = [];
        for (let i = 0; i < forecastHead.length; i += 7) {
            const chunk = forecastHead.slice(i, i + 7);
            byWeek.push(chunk.reduce((sum, d) => sum + d.revenue, 0));
        }

        return {
            revenueLine: {
                labels,
                datasets: [
                    {
                        label: 'Actual (Last 30 Days)',
                        data: historySeries,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.15)',
                        borderWidth: 2,
                        tension: 0.35,
                        pointRadius: 0,
                    },
                    {
                        label: 'Forecast (Next 30 Days)',
                        data: forecastSeries,
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderWidth: 2,
                        borderDash: [6, 4],
                        tension: 0.35,
                        pointRadius: 0,
                    },
                    {
                        label: 'Forecast Lower',
                        data: lowerSeries,
                        borderColor: 'rgba(249, 115, 22, 0.3)',
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0.25,
                    },
                    {
                        label: 'Forecast Upper',
                        data: upperSeries,
                        borderColor: 'rgba(249, 115, 22, 0.3)',
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0.25,
                    },
                ],
            },
            weeklyBars: {
                labels: byWeek.map((_, i) => `Week ${i + 1}`),
                datasets: [
                    {
                        label: 'Projected Revenue',
                        data: byWeek,
                        backgroundColor: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
                        borderRadius: 8,
                    },
                ],
            },
        };
    }, [payload]);

    const summaryCards = payload ? [
        {
            title: 'Next 7 Days',
            value: currency.format(payload.summary.next_7_days_revenue || 0),
            icon: CalendarDays,
            tone: 'from-sky-500/20 to-cyan-500/5 border-sky-500/30',
        },
        {
            title: 'Next 30 Days',
            value: currency.format(payload.summary.next_30_days_revenue || 0),
            icon: Target,
            tone: 'from-orange-500/20 to-amber-500/5 border-orange-500/30',
        },
        {
            title: 'Trend Signal',
            value: `${payload.summary.trend_percent > 0 ? '+' : ''}${payload.summary.trend_percent || 0}%`,
            icon: TrendingUp,
            tone: 'from-emerald-500/20 to-lime-500/5 border-emerald-500/30',
        },
    ] : [];

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-text-main">Revenue Forecast</h1>
                    <p className="text-sm text-text-muted">AI-backed projection for the next 7 and 30 days (Asia/Kolkata).</p>
                </div>
                <button
                    onClick={loadForecast}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summaryCards.map((card) => (
                    <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`glass-card rounded-2xl border p-5 bg-gradient-to-br ${card.tone}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-text-muted">{card.title}</span>
                            <card.icon size={18} className="text-text-main" />
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-text-main">{loading ? '...' : card.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4">
                <h2 className="text-lg font-bold text-text-main">Actual vs Forecast</h2>
                <div className="h-[320px]">
                    {chartData && (
                        <Line
                            data={chartData.revenueLine}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom' },
                                },
                                scales: {
                                    y: {
                                        ticks: {
                                            callback: (v) => `Rs ${Number(v).toLocaleString('en-IN')}`,
                                        },
                                    },
                                },
                            }}
                        />
                    )}
                </div>
            </div>

            <div className="glass-card rounded-3xl border border-card-border p-4 md:p-6 space-y-4">
                <h2 className="text-lg font-bold text-text-main">Weekly Projection</h2>
                <div className="h-[260px]">
                    {chartData && (
                        <Bar
                            data={chartData.weeklyBars}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                },
                                scales: {
                                    y: {
                                        ticks: {
                                            callback: (v) => `Rs ${Number(v).toLocaleString('en-IN')}`,
                                        },
                                    },
                                },
                            }}
                        />
                    )}
                </div>
                {payload && (
                    <p className="text-xs text-text-muted">
                        Model: {payload.model_info?.name || 'n/a'} • History points: {payload.model_info?.history_points || 0}
                    </p>
                )}
            </div>
        </div>
    );
};

export default Forecast;

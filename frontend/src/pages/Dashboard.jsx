import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingBag, AlertTriangle, Plus, ChevronRight, MessageSquare, Package, Users, Activity, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardSkeleton } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { saleRepo } from '../lib/db/saleRepository';
import { productRepo } from '../lib/db/productRepository';
import { customerRepo } from '../lib/db/customerRepository';
import { syncEngine } from '../lib/db/syncEngine';
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
    Filler,
    ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register ChartJS plugins
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement
);

// Customized Chart.js defaults for the 2026 aesthetic
ChartJS.defaults.font.family = '"Inter", sans-serif';
ChartJS.defaults.color = '#94a3b8'; // slate-400

const StatCard = ({ title, value, change, icon: Icon, colorClass, gradientClass, delay = 0, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 80, damping: 20 }}
        whileHover={{ y: -8, scale: 1.02 }}
        className="relative overflow-hidden glass-card p-4 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col justify-between group h-full transition-all duration-500 border border-card-border/50 hover:border-indigo-500/30"
    >
        {/* Animated Background Glow */}
        <div className={`absolute -inset-px bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-700 rounded-[24px] md:rounded-[32px]`} />

        <div className="flex justify-between items-start relative z-10">
            <div className="text-text-muted flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] mb-2 md:mb-4 transition-colors group-hover:text-text-main">
                {title}
            </div>
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[14px] md:rounded-[18px] bg-card-bg/80 backdrop-blur-xl shadow-lg border border-card-border flex items-center justify-center ${colorClass} group-hover:scale-110 transition-transform duration-500`}>
                <Icon className="w-5 h-5 md:w-[22px] md:h-[22px]" />
            </div>
        </div>

        <div className="relative z-10 mt-2">
            {isLoading ? (
                <div className="h-8 md:h-10 w-24 md:w-32 bg-indigo-500/5 rounded-xl skeleton-shimmer" />
            ) : (
                <div className="text-2xl md:text-3xl lg:text-4xl font-black font-heading text-text-main tracking-tighter leading-none transition-colors group-hover:text-indigo-500 truncate">{value}</div>
            )}

            <div className="flex items-center gap-3 mt-2 md:mt-4">
                {change && (
                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-wider">
                        <TrendingUp size={12} strokeWidth={3} /> {change}
                    </div>
                )}
                <div className="h-[2px] flex-1 bg-gradient-to-r from-card-border/50 to-transparent" />
            </div>
        </div>
    </motion.div>
);

const ActionButton = ({ icon: Icon, label, color, gradient, onClick, active = false }) => (
    <motion.button
        whileHover={{ y: -5, scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex flex-col items-center gap-2 md:gap-4 relative group"
    >
        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] flex items-center justify-center text-white shadow-2xl relative overflow-hidden transition-all duration-500 ${active ? 'ring-4 ring-indigo-500/30' : ''}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:rotate-12 transition-transform duration-700`} />
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Glossy Overlay */}
            <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent z-10" />

            <Icon className="w-6 h-6 md:w-8 md:h-8 relative z-20 drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-110" />
        </div>
        <span className="text-[9px] md:text-[10px] font-black text-text-muted uppercase tracking-[0.1em] md:tracking-[0.2em] transition-colors group-hover:text-indigo-500 text-center leading-tight max-w-[64px] md:max-w-none">{label}</span>
    </motion.button>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const [timeframe, setTimeframe] = useState('today'); // 'today' | 'all'
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        ordersCount: 0,
        lowStockCount: 0,
        totalCustomers: 0
    });
    const [recentSales, setRecentSales] = useState([]);
    const [salesData, setSalesData] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, [timeframe]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // ── LOCAL-FIRST: SQLite Repositories ──────────────────────────
            // 1. Sales & Orders
            const allSales = await saleRepo.getAll();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filteredSales = timeframe === 'today'
                ? allSales.filter(s => new Date(s.created_at) >= today)
                : allSales;

            const revenue = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0);
            const ordersCount = filteredSales.length;

            // 2. Low Stock Count
            const allProducts = await productRepo.getAll();
            const lowStockCount = allProducts.filter(p => p.stock_quantity < 5).length;

            // 3. Total Unique Customers 
            const allCustomers = await customerRepo.getAll();
            const totalCustomers = allCustomers.length;

            // 4. Recent Activity (Already have allSales, just take first 4)
            const recent = allSales.slice(0, 4);
            // Note: In local SQLite, we'd need a join or separate fetch for customer names if not stored in sales.
            // For now, we'll use the sales data we have.

            // 5. Weekly Sales Data for Chart (Last 7 Days)
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 6);
            lastWeek.setHours(0, 0, 0, 0);

            const weeklySales = allSales.filter(s => new Date(s.created_at) >= lastWeek);

            // Aggregate weekly sales by day
            const weeklyAggregated = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
                weeklyAggregated[dateStr] = 0;
            }

            weeklySales.forEach(sale => {
                const dateStr = new Date(sale.created_at).toLocaleDateString('en-US', { weekday: 'short' });
                if (weeklyAggregated[dateStr] !== undefined) {
                    weeklyAggregated[dateStr] += parseFloat(sale.total_amount) || 0;
                }
            });

            setSalesData(Object.values(weeklyAggregated));
            setStats({
                revenue,
                ordersCount,
                lowStockCount,
                totalCustomers
            });
            setRecentSales(recent);

            // Background sync trigger if online
            if (navigator.onLine) {
                syncEngine.syncAll();
            }

        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Chart.js Configuration
    const chartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        }),
        datasets: [
            {
                label: 'Revenue (₹)',
                data: salesData,
                borderColor: '#4f46e5', // indigo-600
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
                    gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
                    return gradient;
                },
                borderWidth: 3,
                tension: 0.4, // Smooth Spline curve
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#4f46e5',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)', // slate-900
                titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                bodyFont: { family: 'Inter', size: 13 },
                padding: 12,
                cornerRadius: 12,
                displayColors: false,
                callbacks: {
                    label: (context) => `₹${context.parsed.y.toLocaleString('en-IN')}`
                }
            },
        },
        scales: {
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { font: { family: 'Inter', weight: '500' }, color: '#64748b' }
            },
            y: {
                grid: { color: '#f1f5f9', borderDash: [5, 5], drawBorder: false },
                ticks: {
                    font: { family: 'Inter', weight: '500' },
                    color: '#64748b',
                    callback: (value) => `₹${value >= 1000 ? (value / 1000) + 'k' : value}`
                },
                beginAtZero: true
            }
        },
        interaction: { intersect: false, mode: 'index' },
    };

    if (loading && recentSales.length === 0) {
        return <div className="p-6"><DashboardSkeleton /></div>;
    }

    return (
        <div className="pb-24 space-y-8 min-h-screen relative selection:bg-indigo-500/30">
            {/* Ambient Background Blur for main content area */}
            <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between px-4 md:px-6 pt-4 md:pt-6 gap-3 md:gap-4 relative z-10">
                <div className="flex items-center gap-4 md:gap-5">
                    <div className="hidden md:flex w-16 h-16 rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5">
                        <Activity className="w-8 h-8" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Overview</h1>
                        <p className="text-[9px] md:text-[10px] font-black text-text-muted uppercase tracking-[0.2em] md:tracking-[0.3em] mt-0.5 md:mt-1 transition-colors">
                            <span className="md:hidden">Business Insights</span>
                            <span className="hidden md:inline">Store Analytics</span>
                        </p>
                    </div>
                </div>
                {/* Timeframe Toggle */}
                <div className="flex w-full md:w-auto bg-card-bg/40 backdrop-blur-xl border border-card-border p-1 md:p-1.5 rounded-2xl md:self-auto shadow-sm">
                    <button
                        onClick={() => setTimeframe('today')}
                        className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'today' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'}`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setTimeframe('all')}
                        className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'all' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'}`}
                    >
                        All Time
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-4 md:px-6 relative z-10">
                <StatCard
                    title={timeframe === 'today' ? "Today's Revenue" : "Total Revenue"}
                    value={`₹${stats.revenue.toLocaleString('en-IN')}`}
                    icon={TrendingUp}
                    delay={0.1}
                    isLoading={loading}
                    colorClass="text-indigo-600"
                    gradientClass="from-indigo-500 to-purple-500"
                />
                <StatCard
                    title={timeframe === 'today' ? "Bills Today" : "Total Bills"}
                    value={stats.ordersCount}
                    icon={ShoppingBag}
                    delay={0.2}
                    isLoading={loading}
                    colorClass="text-blue-600"
                    gradientClass="from-blue-500 to-cyan-500"
                />
                <StatCard
                    title="Low Inventory"
                    value={stats.lowStockCount}
                    icon={AlertTriangle}
                    delay={0.3}
                    isLoading={loading}
                    colorClass="text-amber-500"
                    gradientClass="from-amber-400 to-orange-500"
                />
                <StatCard
                    title="Customers"
                    value={stats.totalCustomers}
                    icon={Users}
                    delay={0.4}
                    isLoading={loading}
                    colorClass="text-emerald-600"
                    gradientClass="from-emerald-400 to-teal-500"
                />
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 px-4 md:px-6 relative z-10">

                {/* Left Column (Charts & Quick Actions) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Revenue Spline Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
                        className="glass-card p-6 rounded-3xl"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-heading font-bold text-text-main transition-colors">Weekly Revenue</h2>
                            <span className="text-xs font-bold text-text-muted bg-card-bg px-3 py-1 rounded-full border border-card-border transition-colors">Last 7 Days</span>
                        </div>
                        <div className="h-[280px] w-full relative">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader className="animate-spin text-indigo-400" size={32} />
                                </div>
                            ) : (
                                <Line data={chartData} options={chartOptions} />
                            )}
                        </div>
                    </motion.div>

                    {/* Quick Actions Bento */}
                    <div>
                        <h2 className="text-xs md:text-sm font-bold text-text-main uppercase tracking-widest mb-3 md:mb-4 transition-colors">Quick Actions</h2>
                        <div className="flex flex-row justify-between sm:justify-start gap-2 sm:gap-6">
                            <ActionButton icon={Plus} label="New Bill" gradient="from-indigo-500 to-indigo-600" onClick={() => navigate('/sales')} />
                            <ActionButton icon={Package} label="Add Stock" gradient="from-blue-500 to-blue-600" onClick={() => navigate('/inventory')} />
                            <ActionButton icon={Users} label="Customers" gradient="from-purple-500 to-purple-600" onClick={() => navigate('/customers')} />
                            {stats.lowStockCount > 0 && (
                                <ActionButton icon={AlertTriangle} label="Action Needed" active={true} gradient="from-amber-500 to-orange-500" onClick={() => navigate('/inventory')} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column (Recent Activity) */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
                    className="glass-card rounded-3xl flex flex-col h-full"
                >
                    <div className="p-6 border-b border-card-border flex items-center justify-between">
                        <h2 className="text-lg font-heading font-bold text-text-main transition-colors">Recent Sales</h2>
                        <button onClick={() => navigate('/sales')} className="w-8 h-8 rounded-full bg-card-bg flex items-center justify-center text-text-muted hover:bg-indigo-500/10 hover:text-indigo-500 transition-all border border-card-border">
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex-1 p-2 overflow-hidden">
                        {loading ? (
                            <div className="h-full flex items-center justify-center p-8">
                                <Loader className="animate-spin text-indigo-400" size={24} />
                            </div>
                        ) : recentSales.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-text-muted text-center">
                                <Activity className="mb-3 opacity-20" size={48} />
                                <p className="font-medium text-sm">No sales yet today</p>
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                <AnimatePresence>
                                    {recentSales.map((sale, i) => (
                                        <motion.li
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.7 + (i * 0.1) }}
                                            key={sale.id}
                                            className="p-4 rounded-2xl hover:bg-card-bg/80 transition-all flex items-center justify-between group border border-transparent hover:border-card-border"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-card-bg flex items-center justify-center text-text-muted font-bold text-sm shadow-inner border border-card-border">
                                                    #{sale.id}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-text-main group-hover:text-indigo-500 transition-colors">
                                                        {sale.customers?.name || "Cash Walk-in"}
                                                    </div>
                                                    <div className="text-xs font-medium text-text-muted mt-0.5 flex items-center gap-2">
                                                        <span>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="w-1 h-1 rounded-full bg-card-border"></span>
                                                        <span>{sale.payment_method}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-extrabold text-emerald-600">
                                                    +₹{sale.total_amount}
                                                </div>
                                            </div>
                                        </motion.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                        )}
                    </div>
                    {/* View All Footer */}
                    <div className="p-4 bg-card-bg/30 rounded-b-3xl border-t border-card-border text-center">
                        <Link to="/sales" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors">View All Sales</Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;

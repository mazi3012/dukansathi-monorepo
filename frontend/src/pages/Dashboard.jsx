import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingBag, AlertTriangle, Plus, ChevronRight, MessageSquare, Loader, Package, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 100 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="relative overflow-hidden bg-white/40 backdrop-blur-xl p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 flex flex-col justify-between group"
    >
        {/* Glow effect on hover */}
        <div className={`absolute -inset-px bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl`} />

        <div className="flex justify-between items-start relative z-10">
            <div className="text-slate-500 flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-4">
                {title}
            </div>
            <div className={`p-2 rounded-2xl bg-white shadow-sm border border-slate-100 ${colorClass}`}>
                <Icon size={18} />
            </div>
        </div>

        <div className="relative z-10">
            {isLoading ? (
                <div className="h-8 w-24 bg-slate-200/50 rounded-lg animate-pulse" />
            ) : (
                <div className="text-3xl font-heading font-extrabold text-slate-900 tracking-tight">{value}</div>
            )}
            {change && (
                <div className="flex items-center gap-1 mt-2 text-xs font-bold text-emerald-500 bg-emerald-50 w-fit px-2 py-1 rounded-full">
                    <TrendingUp size={12} /> {change}
                </div>
            )}
        </div>
    </motion.div>
);

const ActionButton = ({ icon: Icon, label, color, gradient, onClick, active = false }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex flex-col items-center gap-3 relative group"
    >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg relative overflow-hidden ${active ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            {/* Inner glass reflection */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent z-10" />
            <Icon size={26} className="relative z-20 drop-shadow-md" />
        </div>
        <span className="text-xs font-bold text-slate-600 transition-colors group-hover:text-slate-900">{label}</span>
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
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            // 1. Sales & Orders (Filtered by Timeframe)
            let salesQuery = supabase.from('sales').select('total_amount, created_at');

            if (timeframe === 'today') {
                salesQuery = salesQuery.gte('created_at', todayISO);
            }

            const { data: salesDataResult, error: salesError } = await salesQuery;
            if (salesError) throw salesError;

            const revenue = salesDataResult.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0);
            const ordersCount = salesDataResult.length;

            // 2. Low Stock Count
            const { count: lowStock, error: stockError } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .lt('stock_quantity', 5);

            // 3. Total Unique Customers 
            const { count: customersCount, error: custError } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });

            // 4. Recent Activity
            const { data: recent, error: recentError } = await supabase
                .from('sales')
                .select('*, customers(name)')
                .order('created_at', { ascending: false })
                .limit(4);

            if (recentError) throw recentError;

            // 5. Weekly Sales Data for Chart (Last 7 Days)
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 6);
            lastWeek.setHours(0, 0, 0, 0);

            const { data: weeklySales, error: weeklyError } = await supabase
                .from('sales')
                .select('total_amount, created_at')
                .gte('created_at', lastWeek.toISOString())
                .order('created_at', { ascending: true });

            if (weeklyError) throw weeklyError;

            // Aggregate weekly sales by day
            const weeklyAggregated = {};
            // Initialize last 7 days with 0
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
                lowStockCount: lowStock || 0,
                totalCustomers: customersCount || 0
            });
            setRecentSales(recent || []);

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

    return (
        <div className="pb-24 space-y-8 min-h-screen bg-slate-50 relative selection:bg-indigo-500/30">
            {/* Ambient Background Blur for main content area */}
            <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-8 gap-4 relative z-10">
                <div>
                    <h1 className="text-3xl font-heading font-extrabold text-slate-900 tracking-tight">Overview</h1>
                    <p className="text-slate-500 font-medium">Here's what's happening with your store {timeframe === 'today' ? 'today' : 'overall'}.</p>
                </div>
                {/* Timeframe Toggle */}
                <div className="flex bg-slate-200/50 p-1 rounded-xl backdrop-blur-sm self-start md:self-auto border border-slate-200/50">
                    <button
                        onClick={() => setTimeframe('today')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeframe === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setTimeframe('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeframe === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        All Time
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6 relative z-10">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 relative z-10">

                {/* Left Column (Charts & Quick Actions) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Revenue Spline Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
                        className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-heading font-bold text-slate-900">Weekly Revenue</h2>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Last 7 Days</span>
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
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Command Center</h2>
                        <div className="flex flex-wrap gap-4 sm:gap-6">
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
                    className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 flex flex-col"
                >
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-heading font-bold text-slate-900">Recent Sales</h2>
                        <button onClick={() => navigate('/sales')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex-1 p-2 overflow-hidden">
                        {loading ? (
                            <div className="h-full flex items-center justify-center p-8">
                                <Loader className="animate-spin text-indigo-400" size={24} />
                            </div>
                        ) : recentSales.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                                <ShoppingBag className="mb-3 opacity-20" size={48} />
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
                                            className="p-4 rounded-2xl hover:bg-slate-50/80 transition-colors flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shadow-inner">
                                                    #{sale.id}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                        {sale.customers?.name || "Cash Walk-in"}
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-400 mt-0.5 flex items-center gap-2">
                                                        <span>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
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
                    <div className="p-4 bg-slate-50/50 rounded-b-3xl border-t border-slate-100 text-center">
                        <Link to="/sales" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View Complete Ledger</Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;

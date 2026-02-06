import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingBag, AlertTriangle, Plus, ChevronRight, MessageSquare, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

const StatCard = ({ title, value, change, color, isLoading }) => (
    <motion.div
        whileTap={{ scale: 0.98 }}
        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"
    >
        <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">{title}</div>
        <div className="flex items-end justify-between mt-2">
            {isLoading ? (
                <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
            ) : (
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
            )}
            {change && <div className="text-emerald-500 text-xs font-medium mb-1">{change}</div>}
        </div>
    </motion.div>
);

const ActionButton = ({ icon: Icon, label, color, onClick }) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex flex-col items-center gap-2"
    >
        <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-white shadow-md`}>
            <Icon size={24} />
        </div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
    </motion.button>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        lowStockCount: 0
    });
    const [recentSales, setRecentSales] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            // 1. Today's Sales & Orders
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select('total_amount, created_at')
                .gte('created_at', todayISO);

            if (salesError) throw salesError;

            const todaySales = salesData.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0);
            const todayOrders = salesData.length;

            // 2. Low Stock Count
            const { count: lowStock, error: stockError } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .lt('stock_quantity', 5); // Assuming 5 is the global threshold or we could check per item vs min_stock_level, but simple query first

            // Better Low Stock Query (vs min_stock_level column if possible, but difficult in simple query without RPC or complex filter)
            // For now, let's stick to a fixed threshold or try to filter client side if dataset is small, 
            // OR use RPC. Let's start with simple logic: quantity < 5.

            // 3. Recent Activity
            const { data: recent, error: recentError } = await supabase
                .from('sales')
                .select('*, customers(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;

            setStats({
                todaySales,
                todayOrders,
                lowStockCount: lowStock || 0
            });
            setRecentSales(recent || []);

        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-20 space-y-6 min-h-screen bg-slate-50">
            {/* Header */}
            <header className="flex items-center justify-between px-4 pt-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl font-heading font-bold text-slate-900">Dukan Sathi</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/chat">
                        <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                            <MessageSquare size={20} />
                        </button>
                    </Link>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                        DS
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 px-4">
                <StatCard
                    title="Today's Sale"
                    value={`₹${stats.todaySales.toLocaleString('en-IN')}`}
                    isLoading={loading}
                    color="text-indigo-600"
                />
                <StatCard
                    title="Today's Orders"
                    value={stats.todayOrders}
                    isLoading={loading}
                    color="text-slate-900"
                />
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-3 px-5">Quick Actions</h2>
                <div className="flex justify-around bg-white mx-4 p-4 rounded-2xl shadow-sm border border-slate-100">
                    <ActionButton icon={Plus} label="New Bill" color="bg-indigo-600" onClick={() => navigate('/sales')} />
                    <ActionButton icon={ShoppingBag} label="Add Item" color="bg-pink-500" onClick={() => navigate('/inventory')} />
                    <ActionButton icon={AlertTriangle} label="Low Stock" color={stats.lowStockCount > 0 ? "bg-amber-500 animate-pulse" : "bg-slate-400"} onClick={() => navigate('/inventory')} />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="px-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
                    <button onClick={() => navigate('/sales')} className="text-indigo-600 text-xs font-medium flex items-center">
                        View All <ChevronRight size={14} />
                    </button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 flex justify-center"><Loader className="animate-spin text-slate-400" /></div>
                    ) : recentSales.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No recent transactions</div>
                    ) : (
                        recentSales.map((sale) => (
                            <div key={sale.id} className="p-4 border-b border-slate-50 last:border-0 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                                        #{sale.id}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">
                                            {sale.customers?.name || "Cash Customer"}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.payment_method}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-emerald-600">
                                    +₹{sale.total_amount}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

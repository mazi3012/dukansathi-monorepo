import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Package, Calendar } from 'lucide-react';

const DemandInsightsModal = ({ product, isOpen, onClose }) => {
    if (!product) return null;

    const {
        name,
        sold_this_week = 0,
        sold_last_week = 0,
        sold_this_month = 0,
        sold_last_month = 0,
        week_over_week_percent = 0,
        month_over_month_percent = 0,
        demand_trend = 'stable',
        forecast_next_7_units = 0,
        forecast_next_30_units = 0,
        current_stock = 0,
        avg_daily_units = 0,
        days_to_stockout,
        risk_level = 'healthy',
        recommended_reorder_qty = 0,
        unit = 'pcs',
    } = product;

    // Determine trend color and icon
    const trendConfig = {
        accelerating: { color: 'text-red-500', bg: 'bg-red-500/10', icon: TrendingUp, label: 'Accelerating Demand', subtext: 'Sales increasing rapidly' },
        growing: { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: TrendingUp, label: 'Growing Demand', subtext: 'Sales trending up' },
        stable: { color: 'text-cyan-500', bg: 'bg-cyan-500/10', icon: Package, label: 'Stable Demand', subtext: 'Sales consistent' },
        declining: { color: 'text-slate-500', bg: 'bg-slate-500/10', icon: TrendingDown, label: 'Declining Demand', subtext: 'Sales trending down' },
    };

    const trend = trendConfig[demand_trend] || trendConfig.stable;
    const TrendIcon = trend.icon;

    // Determine risk color
    const riskConfig = {
        healthy: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', badge: 'Healthy', icon: CheckCircle },
        watch: { color: 'text-blue-500', bg: 'bg-blue-500/10', badge: 'Watch', icon: AlertCircle },
        medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', badge: 'Medium Risk', icon: AlertCircle },
        high: { color: 'text-orange-500', bg: 'bg-orange-500/10', badge: 'High Risk', icon: AlertCircle },
        critical: { color: 'text-red-500', bg: 'bg-red-500/10', badge: 'Critical', icon: AlertCircle },
        out: { color: 'text-red-600', bg: 'bg-red-600/10', badge: 'Out of Stock', icon: AlertCircle },
    };

    const riskInfo = riskConfig[risk_level] || riskConfig.healthy;
    const RiskIcon = riskInfo.icon;

    // Percentage color helper
    const getPercentColor = (percent) => {
        if (percent > 20) return 'text-red-500';
        if (percent > 0) return 'text-orange-500';
        if (percent > -20) return 'text-slate-500';
        return 'text-blue-500';
    };

    const getPercentSymbol = (percent) => {
        if (percent > 0) return '↑';
        if (percent < 0) return '↓';
        return '→';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', bounce: 0.2 }}
                        className="relative w-full max-w-2xl bg-card-bg border border-card-border rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-card-border p-6 flex items-start justify-between">
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-text-main mb-1">{name}</h2>
                                <p className="text-sm text-text-muted">Detailed demand analysis and insights</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-card-bg/80 rounded-full transition-colors text-text-muted hover:text-text-main"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Demand Trend Card */}
                            <div className={`rounded-2xl border border-card-border/50 p-5 ${trend.bg}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${trend.bg}`}>
                                        <TrendIcon size={24} className={trend.color} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`text-lg font-bold ${trend.color}`}>{trend.label}</h3>
                                        <p className="text-sm text-text-muted mt-1">{trend.subtext}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Stock Risk Status */}
                            <div className={`rounded-2xl border border-card-border/50 p-5 ${riskInfo.bg}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${riskInfo.bg}`}>
                                        <RiskIcon size={24} className={riskInfo.color} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className={`text-lg font-bold ${riskInfo.color}`}>{riskInfo.badge}</h3>
                                            <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${riskInfo.bg} ${riskInfo.color}`}>
                                                {current_stock} {unit}
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-muted">
                                            {days_to_stockout !== null && days_to_stockout !== undefined
                                                ? `Estimated stockout in ${Math.round(days_to_stockout)} days`
                                                : 'Sufficient stock available'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Sales Comparison Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Week Over Week */}
                                <div className="glass-card rounded-2xl border border-card-border p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">This Week vs Last Week</p>
                                            <h4 className="text-2xl font-black text-text-main">{Math.round(sold_this_week)} {unit}</h4>
                                        </div>
                                        <div className={`text-3xl font-black ${getPercentColor(week_over_week_percent)}`}>
                                            {getPercentSymbol(week_over_week_percent)} {Math.abs(week_over_week_percent).toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        Last week: {Math.round(sold_last_week)} {unit}
                                    </div>
                                    <div className="mt-3 h-1 bg-card-border rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, Math.abs(week_over_week_percent))}%` }}
                                            className={week_over_week_percent > 0 ? 'bg-orange-500' : 'bg-blue-500'}
                                        />
                                    </div>
                                </div>

                                {/* Month Over Month */}
                                <div className="glass-card rounded-2xl border border-card-border p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">This Month vs Last Month</p>
                                            <h4 className="text-2xl font-black text-text-main">{Math.round(sold_this_month)} {unit}</h4>
                                        </div>
                                        <div className={`text-3xl font-black ${getPercentColor(month_over_month_percent)}`}>
                                            {getPercentSymbol(month_over_month_percent)} {Math.abs(month_over_month_percent).toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        Last month: {Math.round(sold_last_month)} {unit}
                                    </div>
                                    <div className="mt-3 h-1 bg-card-border rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, Math.abs(month_over_month_percent))}%` }}
                                            className={month_over_month_percent > 0 ? 'bg-orange-500' : 'bg-blue-500'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Forecast & Recommendations */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="glass-card rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar size={18} className="text-indigo-500" />
                                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">7-Day Forecast</p>
                                    </div>
                                    <p className="text-3xl font-black text-text-main">{Math.round(forecast_next_7_units)} {unit}</p>
                                    <p className="text-xs text-text-muted mt-2">Expected sales in next 7 days</p>
                                </div>

                                <div className="glass-card rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Flame size={18} className="text-orange-500" />
                                        <p className="text-xs font-bold uppercase tracking-wider text-orange-500">30-Day Forecast</p>
                                    </div>
                                    <p className="text-3xl font-black text-text-main">{Math.round(forecast_next_30_units)} {unit}</p>
                                    <p className="text-xs text-text-muted mt-2">Expected sales in next 30 days</p>
                                </div>
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-4 rounded-xl bg-card-border/20">
                                    <p className="text-xs font-bold uppercase text-text-muted mb-1">Daily Average</p>
                                    <p className="text-2xl font-black text-text-main">{avg_daily_units.toFixed(1)}</p>
                                    <p className="text-[10px] text-text-muted mt-1">{unit}/day</p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-card-border/20">
                                    <p className="text-xs font-bold uppercase text-text-muted mb-1">Current Stock</p>
                                    <p className="text-2xl font-black text-text-main">{Math.round(current_stock)}</p>
                                    <p className="text-[10px] text-text-muted mt-1">{unit}</p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-card-border/20">
                                    <p className="text-xs font-bold uppercase text-text-muted mb-1">Days to Stockout</p>
                                    <p className="text-2xl font-black text-text-main">
                                        {days_to_stockout !== null && days_to_stockout !== undefined
                                            ? Math.round(days_to_stockout)
                                            : '∞'}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">days</p>
                                </div>
                            </div>

                            {/* Reorder Recommendation */}
                            {recommended_reorder_qty > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-amber-600 dark:text-amber-400 mb-1">Reorder Recommended</h4>
                                            <p className="text-sm text-text-muted mb-3">
                                                Reorder <span className="font-bold text-text-main">{Math.round(recommended_reorder_qty)} {unit}</span> to maintain optimal stock levels
                                            </p>
                                            <button className="text-xs font-bold uppercase px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">
                                                Reorder Now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Insight Summary */}
                            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5">
                                <h4 className="font-bold text-text-main mb-3">Key Insights</h4>
                                <ul className="space-y-2 text-sm text-text-muted">
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-500 font-bold mt-0.5">•</span>
                                        <span>
                                            {week_over_week_percent > 0
                                                ? `Demand is strong, growing ${week_over_week_percent.toFixed(1)}% week-over-week`
                                                : `Demand has dropped ${Math.abs(week_over_week_percent).toFixed(1)}% this week`}
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-500 font-bold mt-0.5">•</span>
                                        <span>
                                            Average daily sales: {avg_daily_units.toFixed(1)} {unit}
                                        </span>
                                    </li>
                                    {days_to_stockout !== null && days_to_stockout < 14 && (
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-500 font-bold mt-0.5">⚠</span>
                                            <span>
                                                At current velocity, stock will run out in ~{Math.round(days_to_stockout)} days
                                            </span>
                                        </li>
                                    )}
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-500 font-bold mt-0.5">•</span>
                                        <span>
                                            Expected to sell {Math.round(forecast_next_7_units)} units in the next 7 days
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DemandInsightsModal;

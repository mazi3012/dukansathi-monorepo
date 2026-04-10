import React, { useState } from 'react';
import {
    Headphones, Send, CheckCircle2, AlertCircle, Loader2,
    MessageSquare, Bug, HelpCircle, Zap, ChevronDown, User, Mail, Phone, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
const TICKET_API_URL = `${API_URL}/api/support/ticket`;

const CATEGORY_OPTIONS = [
    { value: 'billing', label: '💳 Billing & Payments', icon: '💳' },
    { value: 'technical', label: '🐛 Technical Issue / Bug', icon: '🐛' },
    { value: 'feature', label: '💡 Feature Request', icon: '💡' },
    { value: 'account', label: '👤 Account & Access', icon: '👤' },
    { value: 'ai', label: '🤖 AI / Chat Problem', icon: '🤖' },
    { value: 'other', label: '🔧 Other', icon: '🔧' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { value: 'medium', label: 'Medium', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { value: 'high', label: 'High', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
    { value: 'critical', label: 'Critical 🔥', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
];

const StatCard = ({ icon: Icon, title, desc, color }) => (
    <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="glass-card rounded-2xl p-5 border border-card-border flex items-start gap-4"
    >
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={20} />
        </div>
        <div>
            <p className="font-bold text-text-main text-sm">{title}</p>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{desc}</p>
        </div>
    </motion.div>
);

const ContactUs = () => {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        category: '',
        priority: 'medium',
        subject: '',
        message: '',
    });

    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [errorMsg, setErrorMsg] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);

    React.useEffect(() => {
        const prefill = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setForm(f => ({
                    ...f,
                    name: user.user_metadata?.full_name || '',
                    email: user.email || '',
                    phone: user.user_metadata?.phone || '',
                }));
            }
        };
        prefill();
    }, []);

    const handleChange = (e) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.category || !form.subject || !form.message) {
            setErrorMsg('Please fill in all required fields.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        const payload = {
            ...form,
            submitted_at: new Date().toISOString(),
            source: 'dukansathi-app',
        };

        try {
            const res = await fetch(TICKET_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }

            setStatus('success');
            setForm(f => ({ ...f, category: '', priority: 'medium', subject: '', message: '' }));
        } catch (err) {
            console.error('Ticket submission failed:', err);
            setErrorMsg(err.message.includes('HTTP') 
                ? 'Failed to submit ticket. Please try again later.' 
                : err.message);
            setStatus('error');
        }
    };

    const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === form.category);
    const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === form.priority);

    return (
        <div className="pb-16 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10"
            >
                <div className="flex items-center gap-4 mb-3">
                    <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white">
                        <Headphones size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-text-main">Contact & Support</h1>
                        <div className="h-1.5 w-12 bg-indigo-600 rounded-full mt-1.5" />
                    </div>
                </div>
                <p className="text-base text-text-muted ml-1 inline-block max-w-xl">
                    Need help? Raise a support ticket and our expert team will reach out to you shortly. 
                    We're here to ensure your <span className="text-indigo-600 font-bold">Dukan Sathi</span> experience is perfect.
                </p>
            </motion.div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                    icon={Zap}
                    title="Fast Response"
                    desc="We typically reply within 2–4 business hours."
                    color="bg-amber-500/10 text-amber-500"
                />
                <StatCard
                    icon={MessageSquare}
                    title="Email Support"
                    desc="support@dukansathi.com — for all inquiries."
                    color="bg-indigo-500/10 text-indigo-500"
                />
                <StatCard
                    icon={HelpCircle}
                    title="Ticket Tracking"
                    desc="All tickets are tracked and resolved systematically."
                    color="bg-emerald-500/10 text-emerald-500"
                />
            </div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="glass-card rounded-3xl p-6 md:p-8 border border-card-border"
            >
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black text-text-main flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <FileText size={18} className="text-indigo-600" />
                        </div>
                        Raise a Support Ticket
                    </h2>
                    <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-indigo-500 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <Zap size={12} className="fill-current" />
                        Priority Support
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                                <CheckCircle2 size={44} className="text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-black text-text-main">Ticket Submitted!</h3>
                            <p className="text-sm text-text-muted max-w-xs">
                                Your support ticket has been raised successfully. We'll get back to you at <strong>{form.email}</strong> soon.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setStatus('idle')}
                                className="mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
                            >
                                Raise Another Ticket
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.form
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onSubmit={handleSubmit}
                            className="space-y-5"
                        >
                            {/* Error Banner */}
                            <AnimatePresence>
                                {status === 'error' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium"
                                    >
                                        <AlertCircle size={16} />
                                        {errorMsg}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Row 1: Name & Email */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <User size={12} /> Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        placeholder="Your name"
                                        required
                                        className="w-full px-4 py-3.5 rounded-2xl bg-card-bg/50 border border-card-border text-text-main text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <Mail size={12} /> Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full px-4 py-3.5 rounded-2xl bg-card-bg/50 border border-card-border text-text-main text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Phone & Category */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <Phone size={12} /> Phone (Optional)
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                        placeholder="+91 9876543210"
                                        className="w-full px-4 py-3.5 rounded-2xl bg-card-bg/50 border border-card-border text-text-main text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    />
                                </div>

                                {/* Category Dropdown */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryOpen(o => !o)}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-card-bg/50 border border-card-border text-sm text-left flex items-center justify-between focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    >
                                        <span className={selectedCategory ? 'text-text-main' : 'text-text-muted/50'}>
                                            {selectedCategory?.label || 'Select issue type...'}
                                        </span>
                                        <ChevronDown
                                            size={16}
                                            className={`text-text-muted transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <AnimatePresence>
                                        {categoryOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute top-full left-0 right-0 mt-1.5 bg-white/90 dark:bg-card-bg backdrop-blur-xl rounded-2xl border border-card-border shadow-2xl z-50 overflow-hidden p-1.5"
                                            >
                                                {CATEGORY_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setForm(f => ({ ...f, category: opt.value }));
                                                            setCategoryOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.category === opt.value
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'text-text-main hover:bg-card-bg/80'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Priority Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Priority</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRIORITY_OPTIONS.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${form.priority === p.value
                                                ? p.color + ' scale-105 shadow-sm'
                                                : 'text-text-muted border-card-border hover:border-indigo-500/40'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subject */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                    Subject <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="subject"
                                    value={form.subject}
                                    onChange={handleChange}
                                    placeholder="Brief description of your issue..."
                                    required
                                    maxLength={120}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-card-bg/50 border border-card-border text-text-main text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                />
                            </div>

                            {/* Message */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="message"
                                    value={form.message}
                                    onChange={handleChange}
                                    placeholder="Please describe your issue in detail — steps to reproduce, screenshots info, expected vs actual behavior..."
                                    required
                                    rows={5}
                                    className="w-full px-4 py-4 rounded-2xl bg-card-bg/50 border border-card-border text-text-main text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner resize-none"
                                />
                                <p className="text-right text-[10px] text-text-muted">{form.message.length} chars</p>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={status === 'loading'}
                                whileHover={{ scale: status === 'loading' ? 1 : 1.01, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full relative overflow-hidden group py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-500/25 transition-all flex items-center justify-center gap-3"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer-slide" />
                                {status === 'loading' ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Submitting Your Request...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} strokeWidth={2.5} />
                                        <span>Submit Support Ticket</span>
                                    </>
                                )}
                            </motion.button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Footer Note */}
            <p className="text-center text-xs text-text-muted pb-4">
                You can also email us at{' '}
                <a href="mailto:support@dukansathi.com" className="text-indigo-500 font-semibold hover:underline">
                    support@dukansathi.com
                </a>
            </p>
        </div>
    );
};

export default ContactUs;

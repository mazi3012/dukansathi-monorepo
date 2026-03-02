import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, User, ArrowUpRight, Filter, MoreVertical, Users, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { HeaderSkeleton, TableRowSkeleton } from '../components/Skeleton';
import toast from 'react-hot-toast';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

    const fetchCustomers = React.useCallback(async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
            toast.error("Failed to fetch customers.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();

        // Auto-refresh when returning to tab (e.g. from Telegram)
        const onFocus = () => fetchCustomers();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchCustomers]);

    const handleSave = async () => {
        try {
            let user = null;
            const { data: authData } = await supabase.auth.getUser();
            user = authData.user;
            if (!user) {
                toast.error("Please login to add a customer.");
                return;
            }

            if (!formData.name) {
                toast.error("Name is required.");
                return;
            }

            const payload = {
                user_id: user ? user.id : 'anon',
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
                total_spend: 0,
                credit_balance: 0
            };
            const { error } = await supabase
                .from('customers')
                .insert([payload]);
            if (error) throw error;

            toast.success("Customer added successfully!");
            setIsAddModalOpen(false);
            setFormData({ name: '', phone: '', email: '', address: '' });
            fetchCustomers();
        } catch (err) {
            console.error("Error adding customer:", err);
            toast.error("Failed to add customer: " + err.message);
        }
    };

    const handleDeleteCustomer = async (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("Are you sure? This delete cannot be undone. Data will be deleted permanently.")) {
            try {
                const { error } = await supabase.from('customers').delete().eq('id', id);
                if (error) throw error;
                toast.success("Customer deleted successfully");
                fetchCustomers();
            } catch (err) {
                console.error("Error deleting customer:", err);
                toast.error("Failed to delete customer. " + err.message);
            }
        }
    };

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="pb-20 min-h-screen relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Page Title Section - Streamlined */}
            {loading && customers.length === 0 ? (
                <HeaderSkeleton />
            ) : (
                <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-10 transition-all duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-110">
                            <Users size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Client Registry</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors flex items-center gap-2">
                                Neural Nodes • {filteredCustomers.length} Verified Handles
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-hover:text-indigo-500" size={18} />
                            <input
                                placeholder="Search identity..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-[280px] bg-card-bg/40 backdrop-blur-xl border border-card-border p-4 pl-12 rounded-2xl outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-text-main font-bold transition-all text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                        >
                            <Plus size={18} strokeWidth={3} />
                            Register Client
                        </button>
                    </div>
                </header>
            )}

            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
                {loading && customers.length === 0 ? (
                    [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="glass-card rounded-[32px] p-6 h-48 border border-card-border/50 animate-pulse">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-card-bg" />
                                <div className="space-y-2">
                                    <div className="h-5 w-32 bg-card-bg rounded-lg" />
                                    <div className="h-3 w-20 bg-card-bg rounded-lg" />
                                </div>
                            </div>
                            <div className="pt-6 border-t border-card-border/50 flex justify-between">
                                <div className="h-4 w-20 bg-card-bg rounded-lg" />
                                <div className="h-6 w-24 bg-card-bg rounded-full" />
                            </div>
                        </div>
                    ))
                ) : filteredCustomers.length === 0 ? (
                    <div className="col-span-full text-center py-24 glass-card rounded-[40px] border-dashed border-card-border/50">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                            <Users size={40} className="text-indigo-500/40" />
                        </div>
                        <h3 className="text-2xl font-heading font-black text-text-main mb-2 transition-colors">No Connections Found</h3>
                        <p className="text-text-muted font-bold max-w-sm mx-auto mb-8 transition-colors">Start building your community. Add customers to track spending and loyalty.</p>
                        <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-indigo-500/10 text-indigo-500 font-extrabold rounded-2xl border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:scale-105 active:scale-95">
                            Onboard First Client
                        </button>
                    </div>
                ) : (
                    filteredCustomers.map((c, index) => (
                        <Link to={`/customers/${c.id}`} key={c.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03, duration: 0.4 }}
                                className="glass-card rounded-[32px] p-6 hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden"
                            >
                                {/* Decorative Glow */}
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex items-start justify-between mb-6 relative z-10">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 uppercase">
                                            {c.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-heading font-black text-text-main text-lg truncate transition-colors group-hover:text-indigo-500">{c.name}</h3>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5 transition-colors flex items-center gap-1.5">
                                                <Phone size={10} /> {c.phone || 'NO CONTACT'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 relative z-20">
                                        <button
                                            onClick={(e) => handleDeleteCustomer(c.id, e)}
                                            className="w-8 h-8 rounded-lg bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <button className="w-8 h-8 rounded-lg bg-card-bg border border-card-border flex items-center justify-center text-text-muted hover:text-indigo-500 transition-colors">
                                            <ArrowUpRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-card-border/50 relative z-10">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Due Balance</span>
                                        <div className={`text-lg font-black tracking-tighter transition-colors ${c.credit_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            ₹{(c.credit_balance || 0).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-end">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${c.credit_balance > 0 ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                            {c.credit_balance > 0 ? 'Payment Due' : 'All Clear'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    ))
                )}
            </div>

            <button onClick={() => setIsAddModalOpen(true)} className="md:hidden fixed right-4 bottom-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
                <Plus size={28} />
            </button>

            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto" onClick={() => setIsAddModalOpen(false)} />
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="bg-bg-main w-full max-w-lg h-[80vh] sm:h-auto sm:rounded-[32px] rounded-t-[32px] p-8 pointer-events-auto flex flex-col shadow-2xl border border-card-border relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-2xl font-black font-heading text-text-main transition-colors tracking-tight">Create Identity</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest transition-colors">Digital Ledger Protocol v2</p>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 rounded-xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/50 transition-all active:scale-95">
                                    <Plus className="rotate-45" size={24} />
                                </button>
                            </div>

                            <div className="space-y-6 overflow-y-auto pr-2 scrollbar-hide mb-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest block ml-1">Full Name</label>
                                    <input placeholder="Enter Client Name" className="w-full p-4 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-text-main" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest block ml-1">Communication Channel</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-12 rounded-xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted">
                                            <Phone size={18} />
                                        </div>
                                        <input placeholder="+91 XXXXX XXXXX" className="flex-1 p-4 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-text-main" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest block ml-1">Physical Location</label>
                                        <textarea placeholder="Client Address..." rows={3} className="w-full p-4 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-text-main resize-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                                Commit to Database
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Customers;

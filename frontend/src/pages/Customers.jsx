import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, User, ArrowUpRight, Filter, MoreVertical, Users, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { HeaderSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { customerRepo } from '../lib/db/customerRepository';
import { syncEngine } from '../lib/db/syncEngine';
import { authService } from '../lib/authService';
import toast from 'react-hot-toast';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', gstin: '', state: '' });

    const INDIAN_STATES = [
        "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
        "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
        "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
        "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
        "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
    ];

    const getStateFromGSTIN = (gstin) => {
        if (!gstin || gstin.length < 2) return "";
        const stateCode = gstin.substring(0, 2);
        const codeMap = {
            "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
            "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
            "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
            "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
            "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
            "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
            "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
            "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
        };
        return codeMap[stateCode] || "";
    };

    const fetchCustomers = React.useCallback(async () => {
        try {
            setLoading(true);

            // Fetch from Local SQLite
            const data = await customerRepo.getAll();
            setCustomers(data || []);

            // Trigger background sync if online
            if (navigator.onLine) {
                syncEngine.syncAll().then(() => {
                    customerRepo.getAll().then(updatedData => setCustomers(updatedData));
                });
            }
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
            const user = await authService.getCurrentUser();
            // Removed strict return if !user to allow offline usage if cached user exists
            // But we still need a user_id for the record. 
            // authService handles the fallback.

            if (!formData.name) {
                toast.error("Name is required.");
                return;
            }

            if (isEditModalOpen && editingCustomer) {
                const payload = {
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    gstin: formData.gstin,
                    state: formData.state,
                    id: editingCustomer.id
                };
                await customerRepo.upsert(payload);
                toast.success("Identity updated successfully!");
                setIsEditModalOpen(false);
                setEditingCustomer(null);
            } else {
                const localId = Date.now();
                const payload = {
                    id: localId,
                    user_id: user ? user.id : 'anon',
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    gstin: formData.gstin,
                    state: formData.state,
                    credit_balance: 0
                };
                await customerRepo.upsert(payload);
                toast.success("Customer added successfully!");
                setIsAddModalOpen(false);
            }

            if (navigator.onLine) {
                syncEngine.syncAll();
            }

            setFormData({ name: '', phone: '', email: '', address: '', gstin: '', state: '' });
            fetchCustomers();
        } catch (err) {
            console.error("Error saving customer:", err);
            toast.error("Failed to save: " + err.message);
        }
    };

    const handleEditClick = (c, e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingCustomer(c);
        setFormData({
            name: c.name || '',
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            gstin: c.gstin || '',
            state: c.state || ''
        });
        setIsEditModalOpen(true);
    };

    const handleDeleteCustomer = async (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("Are you sure? This delete cannot be undone. Data will be deleted permanently.")) {
            try {
                await customerRepo.delete(id);
                toast.success("Customer deleted successfully");
                fetchCustomers();
            } catch (err) {
                console.error("Error deleting customer:", err);
                toast.error("Failed to delete customer. " + err.message);
            }
        }
    };

    const filteredCustomers = (customers || []).filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

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
                            <h1 className="text-2xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Customers</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors flex items-center gap-2">
                                Directory • {filteredCustomers.length} Customers
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-hover:text-indigo-500" size={18} />
                            <input
                                placeholder="Search customers..."
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
                            Add Customer
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
                        <h3 className="text-2xl font-heading font-black text-text-main mb-2 transition-colors">No Customers Found</h3>
                        <p className="text-text-muted font-bold max-w-sm mx-auto mb-8 transition-colors">Start building your community. Add customers to track spending and loyalty.</p>
                        <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-indigo-500/10 text-indigo-500 font-extrabold rounded-2xl border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:scale-105 active:scale-95">
                            Add First Customer
                        </button>
                    </div>
                ) : (
                    filteredCustomers.map((c, index) => (
                        <Link to={`/customers/${c.id}`} key={c.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02, duration: 0.4 }}
                                className="glass-card rounded-2xl sm:rounded-[32px] p-3 sm:p-5 hover:translate-x-1 sm:hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3 sm:gap-5 relative z-10">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-lg sm:text-2xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 uppercase shrink-0">
                                        {c.name ? c.name[0] : '?'}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-heading font-black text-text-main text-sm sm:text-xl truncate transition-colors group-hover:text-indigo-500">
                                            {c.name}
                                        </h3>
                                        <p className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5 transition-colors flex items-center gap-1.5 truncate">
                                            <Phone size={10} strokeWidth={3} /> {c.phone || 'NO CONTACT'}
                                        </p>
                                    </div>

                                    {/* Balance */}
                                    <div className="text-right shrink-0 px-2 lg:px-6">
                                        <div className={`text-base sm:text-2xl font-black tracking-tighter transition-colors ${c.credit_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            ₹{(c.credit_balance || 0).toLocaleString('en-IN')}
                                        </div>
                                        <div className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter mt-0.5 ${c.credit_balance > 0 ? 'text-red-500/70 animate-pulse' : 'text-emerald-500/70'}`}>
                                            {c.credit_balance > 0 ? 'Due' : 'Clear'}
                                        </div>
                                    </div>

                                    {/* Actions (Desktop) */}
                                    <div className="hidden sm:flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(c, e); }}
                                            className="w-10 h-10 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-500/70 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all shadow-sm"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCustomer(c.id, e); }}
                                            className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Mobile Arrow */}
                                    <div className="sm:hidden text-text-muted/30">
                                        <ChevronRight size={18} />
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
                {(isAddModalOpen || isEditModalOpen) && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} />
                        <motion.div
                            initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-bg-main w-full max-w-lg h-[85vh] sm:h-auto sm:rounded-[40px] rounded-t-[40px] p-8 pointer-events-auto flex flex-col shadow-2xl border border-card-border relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                            <div className="flex justify-between items-center mb-10 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5">
                                        {isEditModalOpen ? <Edit2 size={28} /> : <User size={28} />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black font-heading text-text-main transition-colors tracking-tight">
                                            {isEditModalOpen ? 'Edit Customer' : 'Add Customer'}
                                        </h2>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] transition-colors mt-1">Enter customer details</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="w-12 h-12 rounded-2xl bg-card-bg/80 border border-card-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/50 transition-all active:scale-90 shadow-sm">
                                    <Plus className="rotate-45" size={24} />
                                </button>
                            </div>

                            <div className="space-y-8 overflow-y-auto pr-2 scrollbar-hide mb-8 flex-1">
                                <div className="space-y-3">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1 transition-colors">Full Name</label>
                                    <input placeholder="Ex: John Matrix" className="w-full p-5 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/20 outline-none shadow-inner" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Phone Number</label>
                                    <div className="relative group">
                                        <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-indigo-500 transition-colors" />
                                        <input placeholder="+91 XXXXX XXXXX" className="w-full p-5 pl-14 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/20 outline-none shadow-inner" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Address</label>
                                        <textarea placeholder="Client Primary Address..." rows={3} className="w-full p-5 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/20 resize-none outline-none shadow-inner text-sm" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">GSTIN</label>
                                        <input
                                            placeholder="27AAAAA0000A1Z5"
                                            maxLength={15}
                                            className="w-full p-5 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main uppercase font-mono placeholder-text-muted/20 outline-none shadow-inner"
                                            value={formData.gstin}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                const state = getStateFromGSTIN(val);
                                                setFormData({ ...formData, gstin: val, state: state || formData.state });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1 transition-colors">State</label>
                                        <select
                                            className="w-full p-5 bg-card-bg rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main outline-none shadow-inner appearance-none"
                                            value={formData.state}
                                            onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        >
                                            <option value="">Select State</option>
                                            {INDIAN_STATES.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-card-border/50 shrink-0">
                                <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
                                    {isEditModalOpen ? 'Update Customer' : 'Save Customer'}
                                    <ArrowUpRight size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Customers;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, FileText, ArrowDownLeft, ArrowUpRight, Loader, Edit2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const CustomerDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('due'); // 'due' | 'history' | 'info'
    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({ name: '', phone: '', email: '', address: '', gstin: '', state: '' });

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

    // Due Modal State
    const [isDueModalOpen, setIsDueModalOpen] = useState(false);
    const [dueType, setDueType] = useState('credit'); // 'credit' (add due) | 'payment' (receive money)
    const [dueAmount, setDueAmount] = useState('');
    const [dueNote, setDueNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Customer Info
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (custError) throw custError;
            setCustomer(custData);
            setEditData({
                name: custData.name || '',
                phone: custData.phone || '',
                email: custData.email || '',
                address: custData.address || '',
                gstin: custData.gstin || '',
                state: custData.state || ''
            });

            // 2. Fetch Sales History & Ledger
            const { data: ledgerData, error: ledgerError } = await supabase
                .from('customer_ledger')
                .select('*')
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            if (ledgerError) throw ledgerError;

            // Map ledger to transactions
            const txns = ledgerData.map(item => ({
                id: item.id,
                type: item.type === 'credit' ? 'SALE' : 'PAYMENT',
                amount: item.amount,
                date: new Date(item.created_at).toLocaleDateString(),
                description: item.note || (item.type === 'credit' ? 'Due Added' : 'Payment Received'),
                mode: item.mode
            }));

            setTransactions(txns);

        } catch (error) {
            console.error("Error fetching customer details:", error);
            toast.error("Failed to load customer data.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        try {
            setIsProcessing(true);
            const { error } = await supabase
                .from('customers')
                .update(editData)
                .eq('id', id);

            if (error) throw error;

            toast.success("Profile updated successfully!");
            setIsEditModalOpen(false);
            fetchData();
        } catch (err) {
            toast.error("Update failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveDue = async () => {
        try {
            const amount = parseFloat(dueAmount);
            if (!amount || amount <= 0) {
                toast.error("Please enter a valid amount.");
                return;
            }

            setIsProcessing(true);
            const { data: authData } = await supabase.auth.getUser();
            const user = authData.user;

            // 1. Update Customer Balance
            const newBalance = dueType === 'credit'
                ? (customer.credit_balance || 0) + amount
                : (customer.credit_balance || 0) - amount;

            const { error: balanceError } = await supabase
                .from('customers')
                .update({ credit_balance: newBalance })
                .eq('id', id);

            if (balanceError) throw balanceError;

            // 2. Insert into Ledger
            const { error: ledgerError } = await supabase
                .from('customer_ledger')
                .insert([{
                    user_id: user.id,
                    customer_id: id,
                    amount: amount,
                    type: dueType,
                    mode: dueType === 'payment' ? 'Cash' : 'Manual',
                    note: dueNote || (dueType === 'credit' ? 'Manual Due Adjustment' : 'Manual Payment Entry')
                }]);

            if (ledgerError) throw ledgerError;

            toast.success(dueType === 'credit' ? "Due added successfully" : "Payment recorded successfully");
            setIsDueModalOpen(false);
            setDueAmount('');
            setDueNote('');
            fetchData();
        } catch (err) {
            toast.error("Action failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader className="animate-spin text-indigo-600" />
        </div>
    );

    if (!customer) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="text-slate-500 mb-4">Customer not found</div>
            <button onClick={() => navigate('/customers')} className="text-indigo-600 font-bold">Go Back</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-bg-main pb-20 relative overflow-hidden transition-colors">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Page Title Section - Streamlined */}
            <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-10">
                <div className="flex items-center gap-5">
                    <button onClick={() => navigate(-1)} className="w-16 h-16 rounded-[22px] bg-card-bg/40 backdrop-blur-xl border border-card-border flex items-center justify-center text-text-muted hover:text-indigo-500 hover:border-indigo-500/50 transition-all active:scale-95 shadow-xl shadow-indigo-500/5">
                        <ArrowLeft size={32} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">{customer.name}</h1>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors flex items-center gap-2">
                            Client Dossier • {customer.phone || 'Identity Secured'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="h-16 px-6 rounded-[22px] bg-card-bg/40 backdrop-blur-xl border border-card-border flex items-center justify-center gap-3 text-text-muted hover:text-indigo-500 hover:border-indigo-500/50 transition-all active:scale-95 shadow-xl shadow-indigo-500/5 group"
                    >
                        <Edit2 size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Update Profile</span>
                    </button>
                    {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-[22px] shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all">
                            <Phone size={24} strokeWidth={2.5} />
                        </a>
                    )}
                </div>
            </header>

            {/* Tabs - Glassy */}
            <div className="flex p-1 mx-6 mt-8 bg-card-bg/40 backdrop-blur-xl border border-card-border rounded-2xl relative z-10 overflow-hidden">
                {['due', 'history', 'info'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === tab
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        {tab === 'due' ? 'Ledger' : tab === 'history' ? 'Protocol' : 'Profile'}
                    </button>
                ))}
            </div>

            {/* Content - Glassy */}
            <div className="p-6 relative z-10">
                {activeTab === 'due' && (
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <button
                                onClick={() => { setDueType('credit'); setIsDueModalOpen(true); }}
                                className="flex-1 py-5 bg-red-500/10 text-red-500 font-black rounded-3xl border border-red-500/20 flex items-center justify-center gap-3 transition-all hover:bg-red-500 hover:text-white uppercase tracking-widest text-[10px]"
                            >
                                <ArrowDownLeft size={18} strokeWidth={3} /> Debit Memo
                            </button>
                            <button
                                onClick={() => { setDueType('payment'); setIsDueModalOpen(true); }}
                                className="flex-1 py-5 bg-emerald-500/10 text-emerald-500 font-black rounded-3xl border border-emerald-500/20 flex items-center justify-center gap-3 transition-all hover:bg-emerald-500 hover:text-white uppercase tracking-widest text-[10px]"
                            >
                                <ArrowUpRight size={18} strokeWidth={3} /> Credit Entry
                            </button>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Live Transaction Stream</h3>
                            {transactions.length === 0 ? (
                                <div className="text-center py-12 glass-card rounded-[32px] border-dashed text-text-muted font-bold">No transactions logged in database</div>
                            ) : (
                                transactions.map(txn => (
                                    <div key={txn.id} className="glass-card p-5 rounded-[28px] border border-card-border/50 flex justify-between items-center group hover:-translate-y-1 transition-all duration-300">
                                        <div className="flex gap-4 items-center">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${txn.type === 'SALE' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                }`}>
                                                {txn.type === 'SALE' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                                            </div>
                                            <div>
                                                <div className="font-heading font-black text-text-main text-base group-hover:text-indigo-500 transition-colors uppercase tracking-tight">{txn.description}</div>
                                                <div className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">{txn.date}</div>
                                            </div>
                                        </div>
                                        <div className={`text-lg font-black tracking-tighter ${txn.type === 'SALE' ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {txn.type === 'SALE' ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        {transactions.length === 0 ? (
                            <div className="text-center py-12 glass-card rounded-[32px] border-dashed text-text-muted font-bold">No invoices found in registry</div>
                        ) : (
                            transactions.map(inv => (
                                <div key={inv.id} className="glass-card p-6 rounded-[32px] border border-card-border/50 flex justify-between items-center group hover:-translate-y-1 transition-all duration-300">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <div className="font-heading font-black text-text-main text-lg truncate max-w-[150px] tracking-tight">#{inv.id.slice(0, 8).toUpperCase()}</div>
                                            <div className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">{inv.date}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-text-main tracking-tighter">₹{inv.amount.toLocaleString('en-IN')}</div>
                                        <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full">
                                            Verified
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-[32px] border border-card-border shadow-md space-y-4">
                            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Contact Details</h3>
                            <div className="space-y-3">
                                <div className="flex gap-4 p-4 bg-card-bg/40 rounded-2xl border border-card-border">
                                    <Phone size={18} className="text-indigo-500 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Phone Number</p>
                                        <p className="font-bold text-text-main">{customer.phone || "Not linked"}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 bg-card-bg/40 rounded-2xl border border-card-border">
                                    <Mail size={18} className="text-indigo-500 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Email Address</p>
                                        <p className="font-bold text-text-main">{customer.email || "Not linked"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-[32px] border border-card-border shadow-md space-y-4">
                            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Location & Identity</h3>
                            <div className="space-y-3">
                                <div className="flex gap-5 p-6 bg-card-bg/40 rounded-3xl border border-card-border shadow-inner">
                                    <MapPin size={24} className="text-indigo-500 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Primary Settlement Location</p>
                                        <p className="text-lg font-bold text-text-main leading-relaxed">{customer.address || "Digital Nomad (No address linked)"}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 bg-card-bg/40 rounded-2xl border border-card-border">
                                    <FileText size={18} className="text-indigo-500 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">GST Identity</p>
                                        <p className="font-bold text-text-main">{customer.gstin ? `${customer.gstin} (${customer.state || 'N/A'})` : "Regular (Non-GST)"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            <AnimatePresence>
                {/* Edit Profile Modal */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-bg-main w-full max-w-lg rounded-[32px] p-6 relative z-10 border border-card-border shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black font-heading text-text-main tracking-tight">Modify Identity</h2>
                                <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted hover:text-red-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 overflow-y-auto pr-1 scrollbar-hide flex-1">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Customer Name</label>
                                    <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Phone Number</label>
                                    <input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Email Address</label>
                                    <input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Address</label>
                                    <textarea value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} rows={2} className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main resize-none" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">GSTIN</label>
                                        <input
                                            value={editData.gstin}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                const state = getStateFromGSTIN(val);
                                                setEditData({ ...editData, gstin: val, state: state || editData.state });
                                            }}
                                            className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main uppercase font-mono"
                                            maxLength={15}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Place of Supply [State]</label>
                                        <select
                                            value={editData.state}
                                            onChange={e => setEditData({ ...editData, state: e.target.value })}
                                            className="w-full p-3.5 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main appearance-none cursor-pointer"
                                        >
                                            <option value="">Select State</option>
                                            {INDIAN_STATES.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleUpdateProfile} disabled={isProcessing} className="w-full mt-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all disabled:opacity-50">
                                {isProcessing ? <Loader className="animate-spin" size={18} /> : <><Save size={18} /> Apply Changes</>}
                            </button>
                        </motion.div>
                    </div>
                )}

                {/* Due Adjustment Modal */}
                {isDueModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDueModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-bg-main w-full max-w-md rounded-[32px] p-6 relative z-10 border border-card-border shadow-2xl">
                            <h2 className="text-xl font-black font-heading text-text-main mb-6 uppercase tracking-tight">
                                {dueType === 'credit' ? 'Create Debit Memo' : 'Register Credit Entry'}
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Transaction Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted">₹</span>
                                        <input type="number" value={dueAmount} onChange={e => setDueAmount(e.target.value)} className="w-full p-4 pl-10 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 outline-none font-black text-2xl text-text-main" placeholder="0.00" autoFocus />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Narration / Note</label>
                                    <input value={dueNote} onChange={e => setDueNote(e.target.value)} className="w-full p-4 bg-card-bg/50 rounded-xl border border-card-border focus:border-indigo-500 outline-none font-bold text-text-main" placeholder="Brief description..." />
                                </div>
                            </div>

                            <button onClick={handleSaveDue} disabled={isProcessing} className={`w-full mt-8 py-4 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest text-xs transition-all disabled:opacity-50 ${dueType === 'credit' ? 'bg-red-600 shadow-red-500/20 hover:bg-red-700' : 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700'}`}>
                                {isProcessing ? <Loader className="animate-spin" size={18} /> : dueType === 'credit' ? 'Add to Due' : 'Record Payment'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerDetails;

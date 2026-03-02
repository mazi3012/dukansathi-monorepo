import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, FileText, ArrowDownLeft, ArrowUpRight, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

const CustomerDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('due'); // 'due' | 'history' | 'info'
    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

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

            // 2. Fetch Sales History (Invoices)
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select('*')
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            if (salesError) throw salesError;

            // Map sales to "Transactions" format for the Ledger View
            const txns = salesData.map(sale => ({
                id: sale.id,
                type: 'SALE',
                amount: sale.total_amount,
                date: new Date(sale.created_at).toLocaleDateString(),
                description: `Invoice #${sale.id.slice(0, 6)}...` // Shorten UUID
            }));

            setTransactions(txns);

        } catch (error) {
            console.error("Error fetching customer details:", error);
        } finally {
            setLoading(false);
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
                    {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-[10px]">
                            <Phone size={18} strokeWidth={3} />
                            Voice Link
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
                            <button className="flex-1 py-5 bg-red-500/10 text-red-500 font-black rounded-3xl border border-red-500/20 flex items-center justify-center gap-3 transition-all hover:bg-red-500 hover:text-white uppercase tracking-widest text-[10px]">
                                <ArrowDownLeft size={18} strokeWidth={3} /> Debit Memo
                            </button>
                            <button className="flex-1 py-5 bg-emerald-500/10 text-emerald-500 font-black rounded-3xl border border-emerald-500/20 flex items-center justify-center gap-3 transition-all hover:bg-emerald-500 hover:text-white uppercase tracking-widest text-[10px]">
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
                    <div className="space-y-8 glass-card p-8 rounded-[40px] border border-card-border shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] block mb-3 ml-1">Neural Node Location</label>
                            <div className="flex gap-4 p-5 bg-card-bg/40 rounded-2xl border border-card-border">
                                <MapPin size={20} className="text-indigo-500 shrink-0" />
                                <p className="font-bold text-text-main">{customer.address || "No spatial coordinates provided"}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] block mb-3 ml-1">Digital Identity Handle</label>
                            <div className="flex gap-4 p-5 bg-card-bg/40 rounded-2xl border border-card-border">
                                <Mail size={20} className="text-indigo-500 shrink-0" />
                                <p className="font-bold text-text-main">{customer.email || "No encryption handle linked"}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDetails;

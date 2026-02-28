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
            const isGuest = sessionStorage.getItem('guest_mode') === 'true';
            const API_URL = (import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

            if (isGuest) {
                // 1. Fetch Local Customer Info
                const custRes = await fetch(`${API_URL}/api/local/customers/${id}`);
                if (!custRes.ok) throw new Error('Local Customer API error');
                const custData = await custRes.json();
                setCustomer(custData);

                // 2. Fetch Local History (Sales & Payments)
                const [salesRes, paymentsRes] = await Promise.all([
                    fetch(`${API_URL}/api/local/sales?customer_name=${encodeURIComponent(custData.name)}`),
                    fetch(`${API_URL}/api/local/payments?customer_name=${encodeURIComponent(custData.name)}`)
                ]);

                const localSales = salesRes.ok ? await salesRes.json() : [];
                const localPayments = paymentsRes.ok ? await paymentsRes.json() : [];

                // Map and Merge Transactions
                const salesTxns = localSales.map(sale => ({
                    id: `local-sale-${sale.id}`,
                    type: 'SALE',
                    amount: sale.total_amount,
                    date: new Date(sale.created_at).toLocaleDateString(),
                    description: `Bill #${sale.id}`
                }));

                const paymentsTxns = localPayments.map(p => ({
                    id: `local-payment-${p.id}`,
                    type: p.payment_type === 'credit' ? 'SALE' : 'PAYMENT',
                    amount: p.amount,
                    date: new Date(p.created_at).toLocaleDateString(),
                    description: p.payment_type === 'credit' ? 'Credit Added' : 'Payment Received'
                }));

                const allTxns = [...salesTxns, ...paymentsTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
                setTransactions(allTxns);
                return;
            }

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
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-heading font-bold text-slate-900">Customer Details</h1>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{customer.name}</h2>
                        {customer.phone && (
                            <a href={`tel:${customer.phone}`} className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <Phone size={14} /> {customer.phone}
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-white border-b border-slate-100 overflow-x-auto">
                {['due', 'history', 'info'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors capitalize ${activeTab === tab
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-400'
                            }`}
                    >
                        {tab === 'due' ? 'Due Record' : tab === 'history' ? 'Invoices' : 'Profile'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'due' && (
                    <div className="space-y-4">
                        <div className="flex gap-3 mb-4">
                            <button className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100 flex items-center justify-center gap-2">
                                <ArrowDownLeft size={18} /> Given
                            </button>
                            <button className="flex-1 py-3 bg-green-50 text-green-600 font-bold rounded-xl border border-green-100 flex items-center justify-center gap-2">
                                <ArrowUpRight size={18} /> Got Payment
                            </button>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">Recent Transactions</h3>
                            {transactions.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm">No transactions yet</div>
                            ) : (
                                transactions.map(txn => (
                                    <div key={txn.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                        <div className="flex gap-3 items-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'SALE' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                                                }`}>
                                                {txn.type === 'SALE' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">{txn.description}</div>
                                                <div className="text-xs text-slate-400">{txn.date}</div>
                                            </div>
                                        </div>
                                        <div className={`font-bold ${txn.type === 'SALE' ? 'text-red-600' : 'text-green-600'}`}>
                                            {txn.type === 'SALE' ? '-' : '+'}₹{txn.amount}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {transactions.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">No invoices found</div>
                        ) : (
                            transactions.map(inv => (
                                <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                                    <div className="flex gap-3 items-center">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 truncate max-w-[150px]">#{inv.id.slice(0, 8)}</div>
                                            <div className="text-xs text-slate-400">{inv.date}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800">₹{inv.amount}</div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">
                                            Recorded
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Address</label>
                            <div className="flex gap-2 text-slate-700 mt-1">
                                <MapPin size={18} className="text-slate-400 shrink-0" />
                                <p>{customer.address || "No address provided"}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                            <div className="flex gap-2 text-slate-700 mt-1">
                                <Mail size={18} className="text-slate-400 shrink-0" />
                                <p>{customer.email || "No email provided"}</p>
                            </div>
                        </div>
                        {/* GSTIN field if we add it later */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDetails;

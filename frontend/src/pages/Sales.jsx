import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, FileText, Calendar, Trash2, Loader, Eye, Printer, X, Receipt, ArrowUpRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { HeaderSkeleton, TableRowSkeleton } from '../components/Skeleton';
import Combobox from '../components/Combobox';
import InvoiceTemplate from '../components/InvoiceTemplate';


const Sales = () => {
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('today'); // 'today' | 'all'
    const timeframes = [
        { id: 'today', label: 'Cycle 01' },
        { id: 'all', label: 'Archival' }
    ];

    // Data from DB
    const [customers, setCustomers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [history, setHistory] = useState([]);
    const [userProfile, setUserProfile] = useState(null);

    // Form State
    const [billType, setBillType] = useState('NON_GST'); // NON_GST | GST
    const [isInterState, setIsInterState] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null); // ID for linking
    const [customerName, setCustomerName] = useState(''); // Text for display/input

    const [items, setItems] = useState([
        { id: Date.now(), product_id: null, name: '', hsn: '', qty: 1, price: '', tax_percent: 0 }
    ]);
    const [additionalDiscount, setAdditionalDiscount] = useState('');
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // Lowercase to match DB check constraint

    // Receipt View State
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptSale, setReceiptSale] = useState(null);
    const [receiptItems, setReceiptItems] = useState([]);
    const invoiceRef = useRef();

    // Calculations
    const totals = useMemo(() => {
        let subtotal = 0;
        let totalTax = 0;

        items.forEach(item => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            const taxRate = parseFloat(item.tax_percent) || 0;

            const itemTotal = qty * price;
            const itemTax = billType === 'GST' ? (itemTotal * taxRate) / 100 : 0;

            subtotal += itemTotal;
            totalTax += itemTax;
        });

        const discount = parseFloat(additionalDiscount) || 0;
        const grandTotal = subtotal + totalTax - discount;
        const paid = parseFloat(amountPaid) || 0;
        const balance = grandTotal > 0 ? grandTotal - paid : 0;

        // Payment Status Logic
        let status = 'credit'; // Default to credit (matches DB constraint 'paid', 'partial', 'credit')
        if (grandTotal > 0 && paid >= grandTotal) status = 'paid';
        else if (paid > 0) status = 'partial';

        return { subtotal, totalTax, grandTotal, balance, status };
    }, [items, billType, additionalDiscount, amountPaid]);


    // Fetch Data
    useEffect(() => {
        fetchData();
        fetchHistory();

        // Auto-refresh when returning to tab (e.g. from Telegram)
        const onFocus = () => {
            fetchData();
            fetchHistory();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [timeframe]);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);
                if (profile?.is_gst_registered) setBillType('GST');
            }
            const { data: prods } = await supabase.from('products').select('*');
            setProductsList(prods || []);
            const { data: custs } = await supabase.from('customers').select('*');
            setCustomers(custs || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            let query = supabase
                .from('sales')
                .select('*, customers(name)')
                .order('created_at', { ascending: false });

            if (timeframe === 'today') {
                query = query.gte('created_at', todayISO);
            }

            const { data: sales, error } = await query.limit(20);
            if (error) throw error;
            setHistory(sales || []);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Handlers
    const handleViewReceipt = async (sale) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('sale_items')
                .select('*, products(name, tax_percent, hsn_code)')
                .eq('sale_id', sale.id);

            if (error) throw error;

            setReceiptItems(data || []);
            setReceiptSale(sale);
            setShowReceiptModal(true);
        } catch (error) {
            console.error("Error fetching items:", error);
            alert("Failed to load receipt details");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (invoiceRef.current) {
            // Basic print: window.print() with CSS hiding others
            // Ideally we'd stick a style tag, but relying on 'print:hidden' on main wrapper is cleaner if we can specificy it.
            // But we can't easily wrap the whole app.
            // Alternative: Open new window
            const content = invoiceRef.current.innerHTML;
            const style = `
    < script src = "https://cdn.tailwindcss.com" ></script >
        <style>
            body {background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        </style>
`;
            const win = window.open('', '', 'height=700,width=800');
            win.document.write('<html><head>' + style + '</head><body>' + content + '</body></html>');
            win.document.close();
            win.print();
        }
    };

    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), product_id: null, name: '', hsn: '', qty: 1, price: '', tax_percent: 0 }]);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleGenerateInvoice = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Please login");

            if (!selectedCustomerId && !customerName) return alert("Please select a customer");
            if (items.length === 0 || !items[0].name) return alert("Please add at least one item");

            // 1. Create Sale Record
            const salePayload = {
                user_id: user.id,
                customer_id: selectedCustomerId, // Can be null if generic customer, but usually we map it
                // If it's a new customer name typed in, we might want to create them first or just store in notes?
                // For now, let's assume selectedCustomerId is preferred, but logic in schema allows null.

                invoice_type: billType === 'GST' ? 'gst' : 'regular',
                subtotal: totals.subtotal,
                discount_amount: parseFloat(additionalDiscount) || 0,
                total_tax_amount: totals.totalTax,
                total_amount: totals.grandTotal,
                payment_method: paymentMethod, // cash, upi, etc.
                payment_status: totals.status,
                amount_paid: parseFloat(amountPaid) || 0,
                balance_due: totals.balance,
                created_at: new Date()
            };

            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert([salePayload])
                .select()
                .single();

            if (saleError) throw saleError;
            const saleId = saleData.id;

            // 2. Create Sale Items
            const itemsPayload = items.map(item => {
                const qty = parseFloat(item.qty) || 0;
                const price = parseFloat(item.price) || 0;
                const total = qty * price;

                return {
                    user_id: user.id,
                    sale_id: saleId,
                    product_id: item.product_id, // Important for stock trigger
                    quantity: qty,
                    unit_price: price,
                    total_price: total,
                    hsn_code: item.hsn,
                    // Basic Tax logic for items if GST
                    taxable_amount: billType === 'GST' ? total : 0, // Simplified
                    // We aren't calculating detailed split (CGST/SGST per item) here to keep it simple, 
                    // relying on the header totals mostly, but schema has fields.
                    // Ideally we distribute totals.totalTax proportionally or calculated per item.
                };
            });

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(itemsPayload);

            if (itemsError) throw itemsError;

            // 3. Update Customer Balance (if customer selected)
            if (selectedCustomerId) {
                const { data: customerData, error: custFetchError } = await supabase
                    .from('customers')
                    .select('total_spend, credit_balance')
                    .eq('id', selectedCustomerId)
                    .single();

                if (!custFetchError && customerData) {
                    const newSpend = (parseFloat(customerData.total_spend) || 0) + totals.grandTotal;
                    const newCredit = (parseFloat(customerData.credit_balance) || 0) + totals.balance;

                    await supabase
                        .from('customers')
                        .update({
                            total_spend: newSpend,
                            credit_balance: newCredit,
                            last_visit: new Date()
                        })
                        .eq('id', selectedCustomerId);
                }
            }

            // Success
            alert("Invoice Created Successfully!");
            setShowModal(false);
            setItems([{ id: Date.now(), product_id: null, name: '', hsn: '', qty: 1, price: '', tax_percent: 0 }]);
            setAmountPaid('');
            setCustomerName('');
            setSelectedCustomerId(null);
            fetchHistory(); // Refresh list

        } catch (error) {
            console.error("Invoice Error:", error);
            alert("Failed to create invoice: " + error.message);
        }
    };

    return (
        <div className="pb-20 min-h-screen relative overflow-hidden transition-colors">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Page Title Section - Streamlined */}
            {loading && history.length === 0 ? (
                <HeaderSkeleton />
            ) : (
                <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-10 transition-all duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[22px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/5 transition-transform hover:scale-110">
                            <TrendingUp size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Revenue Stream</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors flex items-center gap-2">
                                Flow Tracking • {timeframe === 'today' ? "Today's Pulse" : "All Time Performance"}
                            </p>
                        </div>
                    </div>

                    {/* Timeframe Toggle - Glassy */}
                    <div className="flex bg-card-bg/40 backdrop-blur-xl border border-card-border p-1.5 rounded-2xl self-start md:self-auto shadow-sm">
                        <button
                            onClick={() => setTimeframe('today')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'today' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setTimeframe('all')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'all' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'}`}
                        >
                            All Time
                        </button>
                    </div>
                </header>
            )}

            <div className="p-4 md:p-6 space-y-5 relative z-10">
                {loading && history.length === 0 ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="glass-card rounded-[32px] p-6 h-32 border border-card-border/50 animate-pulse">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-card-bg" />
                                    <div className="space-y-2">
                                        <div className="h-5 w-40 bg-card-bg rounded-lg" />
                                        <div className="h-3 w-24 bg-card-bg rounded-lg" />
                                    </div>
                                </div>
                                <div className="h-8 w-24 bg-card-bg rounded-full" />
                            </div>
                        </div>
                    ))
                ) : history.length === 0 ? (
                    <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-card-border/50">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                            <Receipt size={40} className="text-indigo-500/40" />
                        </div>
                        <h3 className="text-2xl font-heading font-black text-text-main mb-2 transition-colors">Engine Idle</h3>
                        <p className="text-text-muted font-bold max-w-sm mx-auto mb-8 transition-colors">No transactions detected in this sector. Synchronize with cloud or forge a new bill.</p>
                        <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                            Initialize First Sale
                        </button>
                    </div>
                ) : (
                    history.map((sale, index) => (
                        <motion.div
                            key={sale.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.04, duration: 0.4 }}
                            className="glass-card rounded-[32px] p-6 hover:translate-x-2 transition-all duration-500 group relative overflow-hidden"
                            onClick={() => handleViewReceipt(sale)}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                        #{sale.id.toString().slice(-4).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-heading font-black text-text-main text-lg transition-colors group-hover:text-indigo-500">
                                                {sale.customers?.name || "Anonymous Client"}
                                            </h3>
                                            <span className={`px - 2.5 py - 1 rounded - lg text - [10px] font - black uppercase tracking - widest border transition - all ${sale.invoice_type === 'gst' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-text-muted/10 text-text-muted border-card-border'} `}>
                                                {sale.invoice_type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest transition-colors flex items-center gap-1.5">
                                                <Calendar size={10} /> {new Date(sale.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest transition-colors flex items-center gap-1.5 bg-indigo-500/5 px-2 py-0.5 rounded-lg border border-indigo-500/10">
                                                {sale.payment_method}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 border-card-border/50 pt-5 md:pt-0">
                                    <div className="text-right">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter block mb-1">Total Valuation</span>
                                        <div className="text-2xl font-black text-text-main tracking-tighter transition-colors group-hover:text-indigo-500">₹{(sale.total_amount || 0).toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right flex flex-col items-end">
                                            <span className={`${sale.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : sale.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} px - 3 py - 1 rounded - full text - [9px] font - black uppercase tracking - widest border transition - all`}>
                                                {sale.payment_status}
                                            </span>
                                            {sale.balance_due > 0 && (
                                                <span className="text-[9px] font-black text-red-500 mt-1 uppercase tracking-tighter">Due: ₹{sale.balance_due}</span>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted group-hover:text-indigo-500 group-hover:border-indigo-500/50 transition-all">
                                            <ArrowUpRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <button
                onClick={() => setShowModal(true)}
                className="fixed right-4 bottom-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
                <Plus size={28} />
            </button>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
                            onClick={() => setShowModal(false)}
                        />

                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="bg-bg-main w-full max-w-2xl h-[95vh] sm:h-[90vh] sm:rounded-[40px] rounded-t-[40px] p-8 pointer-events-auto flex flex-col shadow-2xl border border-card-border relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-3xl font-black font-heading text-text-main tracking-tight transition-colors">Forge Invoice</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest transition-colors">Transaction Protocol Level 4</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/50 transition-all active:scale-95 shadow-sm">
                                    <Plus className="rotate-45" size={28} />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 space-y-8 pr-2 scrollbar-hide">
                                {/* Configuration */}
                                {userProfile?.is_gst_registered && (
                                    <div className="bg-card-bg/50 p-1.5 rounded-2xl border border-card-border/50 flex gap-2">
                                        <button
                                            onClick={() => setBillType('NON_GST')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${billType === 'NON_GST' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-muted hover:bg-card-bg'}`}
                                        >
                                            Standard Ledger
                                        </button>
                                        <button
                                            onClick={() => setBillType('GST')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${billType === 'GST' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-muted hover:bg-card-bg'}`}
                                        >
                                            Tax Compliant (GST)
                                        </button>
                                    </div>
                                )}

                                {/* Client Selector */}
                                <div className="space-y-3">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-widest block ml-1">Client Entity</label>
                                    <div className="flex gap-3">
                                        <div className="flex-1 glass-card p-1 rounded-2xl border border-card-border/50">
                                            <Combobox
                                                options={customers}
                                                value={customerName}
                                                onChange={(val) => {
                                                    if (typeof val === 'object') {
                                                        setCustomerName(val.name);
                                                        setSelectedCustomerId(val.id);
                                                    } else {
                                                        setCustomerName(val);
                                                        setSelectedCustomerId(null);
                                                    }
                                                }}
                                                placeholder="Link to Intelligence Profile..."
                                                labelKey="name"
                                            />
                                        </div>
                                        <button className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all shadow-indigo-500/5">
                                            <Plus size={24} />
                                        </button>
                                    </div>
                                </div>

                                {/* Items Forge */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest">Inventory Assets</label>
                                        <button onClick={handleAddItem} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline decoration-2 underline-offset-4">+ Deploy Asset</button>
                                    </div>

                                    <div className="space-y-4">
                                        {items.map((item, index) => (
                                            <div key={item.id} className="glass-card rounded-3xl p-5 border border-card-border/50 relative group">
                                                <button onClick={() => handleRemoveItem(index)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                    <Trash2 size={16} />
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-8">
                                                        <Combobox
                                                            options={productsList}
                                                            value={item.name}
                                                            onChange={(val) => {
                                                                if (typeof val === 'object') {
                                                                    const newItems = [...items];
                                                                    newItems[index].name = val.name;
                                                                    newItems[index].price = val.selling_price || '';
                                                                    newItems[index].product_id = val.id;
                                                                    if (billType === 'GST') {
                                                                        newItems[index].hsn = val.hsn_code || '';
                                                                        newItems[index].tax_percent = val.tax_percent || 0;
                                                                    }
                                                                    setItems(newItems);
                                                                } else {
                                                                    handleItemChange(index, 'name', val);
                                                                }
                                                            }}
                                                            placeholder="Select Quantum Asset..."
                                                            labelKey="name"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-4 flex gap-2">
                                                        <input type="number" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} className="w-20 p-3 bg-card-bg rounded-xl border border-card-border text-center font-black text-text-main focus:border-indigo-500 transition-all shadow-inner" />
                                                        <input type="number" placeholder="Price" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="flex-1 p-3 bg-card-bg rounded-xl border border-card-border font-black text-text-main focus:border-indigo-500 transition-all shadow-inner" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Valuation Matrix */}
                                <div className="glass-card rounded-[32px] p-8 border border-indigo-500/10 bg-indigo-500/[0.02] space-y-4">
                                    <div className="flex justify-between items-center text-text-muted">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Base Valuation</span>
                                        <span className="font-black text-text-main">₹{totals.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-4 border-y border-card-border/30">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Efficiency Rebate</span>
                                            <input type="number" value={additionalDiscount} onChange={(e) => setAdditionalDiscount(e.target.value)} className="w-20 p-1 bg-card-bg border border-card-border rounded-lg text-center font-black text-indigo-500 text-xs" placeholder="0" />
                                        </div>
                                        <div className="text-2xl font-black text-text-main tracking-tighter">
                                            ₹{totals.grandTotal.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <div>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Settlement Value</span>
                                            <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="mt-2 w-32 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl font-black text-emerald-500 text-lg shadow-inner focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none" placeholder="0" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Neural Debt</span>
                                            <div className="text-xl font-black text-red-500 tracking-tighter mt-1">₹{totals.balance.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8">
                                <button onClick={handleGenerateInvoice} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                                    Transmit to Ledger
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Receipt Modal */}
            <AnimatePresence>
                {showReceiptModal && receiptSale && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={() => setShowReceiptModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col"
                        >
                            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                                <h2 className="text-lg font-bold text-slate-800">
                                    {receiptSale.invoice_type === 'gst' ? 'Tax Invoice' : 'Receipt'} Preview
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrint}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                    <button onClick={() => setShowReceiptModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-500/20 p-4 sm:p-8">
                                <div className="shadow-lg">
                                    <InvoiceTemplate
                                        ref={invoiceRef}
                                        sale={receiptSale}
                                        items={receiptItems}
                                        businessProfile={userProfile}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Sales;


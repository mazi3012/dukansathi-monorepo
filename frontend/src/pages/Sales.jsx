import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, FileText, Calendar, Trash2, Loader, Eye, Printer, X, Receipt, ArrowUpRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { HeaderSkeleton, TableRowSkeleton } from '../components/Skeleton';
import Combobox from '../components/Combobox';
import { TaxCalculator, isInterState } from '../utils/gstUtils';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { productRepo } from '../lib/db/productRepository';
import { customerRepo } from '../lib/db/customerRepository';
import { saleRepo } from '../lib/db/saleRepository';
import { syncEngine } from '../lib/db/syncEngine';
import { getDB, persistDB } from '../lib/sqlite';
import { authService } from '../lib/authService';
import toast from 'react-hot-toast';


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
    const [isInterStateSale, setIsInterStateSale] = useState(false);
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
        const computedItems = items.map(item => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            const taxableValue = qty * price;

            let cgst = 0, sgst = 0, igst = 0, taxTotal = 0, gstRate = 0;

            if (billType === 'GST' && userProfile?.gstin) {
                const taxCalc = TaxCalculator.calculate({
                    sellingPrice: price,
                    quantity: qty,
                    hsnCode: item.hsn || null,
                    sellerGstin: userProfile.gstin,
                    buyerGstin: null,
                    placeOfSupply: isInterStateSale ? 'IGST' : null
                });
                cgst = taxCalc.cgst_amount;
                sgst = taxCalc.sgst_amount;
                igst = taxCalc.igst_amount;
                taxTotal = cgst + sgst + igst;
                gstRate = taxCalc.gst_rate;
            }

            return { ...item, taxableValue, cgst, sgst, igst, taxTotal, gstRate };
        });

        const subtotal = computedItems.reduce((sum, i) => sum + i.taxableValue, 0);
        const totalTax = computedItems.reduce((sum, i) => sum + i.taxTotal, 0);
        const totalCgst = computedItems.reduce((sum, i) => sum + i.cgst, 0);
        const totalSgst = computedItems.reduce((sum, i) => sum + i.sgst, 0);
        const totalIgst = computedItems.reduce((sum, i) => sum + i.igst, 0);

        const discount = parseFloat(additionalDiscount) || 0;
        const grandTotal = subtotal + totalTax - discount;
        const paid = parseFloat(amountPaid) || 0;
        const balance = grandTotal > 0 ? grandTotal - paid : 0;

        const status = grandTotal <= 0 ? 'paid' : (paid >= grandTotal ? 'paid' : (paid > 0 ? 'partial' : 'credit'));

        return { subtotal, totalTax, totalCgst, totalSgst, totalIgst, grandTotal, balance, status, computedItems };
    }, [items, billType, additionalDiscount, amountPaid, userProfile, isInterStateSale]);


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
            const user = await authService.getCurrentUser();
            if (user) {
                const profile = await authService.getCurrentProfile(user.id);
                setUserProfile(profile);
                if (profile?.is_gst_registered) setBillType('GST');
            }

            // Fetch from Local SQLite
            const prods = await productRepo.getAll();
            setProductsList(prods || []);
            const custs = await customerRepo.getAll();
            setCustomers(custs || []);

            // Background sync
            if (navigator.onLine) {
                syncEngine.syncAll().then(() => {
                    productRepo.getAll().then(p => setProductsList(p));
                    customerRepo.getAll().then(c => setCustomers(c));
                });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const sales = await saleRepo.getAll();
            if (sales && sales.length > 0) {
                // Map customer_name for the UI if it's joined, but for now just populate
                // We'll add a custom query to saleRepo if needed, or join manually
                const db = getDB();
                const sql = `
                    SELECT s.*, c.name as customer_name 
                    FROM sales s 
                    LEFT JOIN customers c ON s.customer_id = c.id 
                    ORDER BY s.created_at DESC 
                    LIMIT 50
                `;
                const result = db.exec(sql);
                if (result.length > 0) {
                    const columns = result[0].columns;
                    const items = result[0].values.map(v => {
                        const obj = {};
                        columns.forEach((col, i) => obj[col] = v[i]);
                        obj.customers = { name: obj.customer_name };
                        return obj;
                    });
                    setHistory(items);
                } else {
                    setHistory([]);
                }
            } else {
                setHistory([]);
            }
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
            const db = getDB();

            // Fetch items from Local SQLite
            const sql = `
                SELECT si.*, p.name as product_name, p.tax_percent, p.hsn_code 
                FROM sale_items si 
                LEFT JOIN products p ON si.product_id = p.id 
                WHERE si.sale_id = ?
            `;
            const result = db.exec(sql, [sale.id]);

            if (result.length > 0) {
                const columns = result[0].columns;
                const items = result[0].values.map(v => {
                    const obj = {};
                    columns.forEach((col, i) => obj[col] = v[i]);
                    obj.products = { name: obj.product_name, tax_percent: obj.tax_percent, hsn_code: obj.hsn_code };
                    return obj;
                });
                setReceiptItems(items);
            } else {
                setReceiptItems([]);
            }

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

    const handleDeleteSale = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure? This delete cannot be undone. Data will be deleted permanently.")) {
            try {
                await saleRepo.delete(id);
                toast.success("Sale deleted successfully");
                fetchHistory(); // Refresh history list
            } catch (err) {
                console.error("Error deleting sale:", err);
                toast.error("Failed to delete sale. " + err.message);
            }
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
            const user = await authService.getCurrentUser();
            const userId = user ? user.id : 'anon';

            if (!selectedCustomerId && !customerName) return alert("Please select a customer");
            if (items.length === 0 || !items[0].name) return alert("Please add at least one item");

            const saleId = Date.now();
            const now = new Date().toISOString();

            const saleData = {
                id: saleId,
                user_id: userId,
                customer_id: selectedCustomerId,
                invoice_type: billType === 'GST' ? 'gst' : 'regular',
                subtotal: totals.subtotal,
                discount_amount: parseFloat(additionalDiscount) || 0,
                taxable_amount: billType === 'GST' ? totals.subtotal : 0,
                cgst_amount: totals.totalCgst,
                sgst_amount: totals.totalSgst,
                igst_amount: totals.totalIgst,
                total_tax_amount: totals.totalTax,
                total_amount: totals.grandTotal,
                payment_method: paymentMethod,
                payment_status: totals.status,
                amount_paid: parseFloat(amountPaid) || 0,
                balance_due: totals.balance
            };

            const saleItems = totals.computedItems.map(item => ({
                product_id: item.product_id,
                quantity: parseFloat(item.qty) || 0,
                unit_price: parseFloat(item.price) || 0,
                hsn_code: item.hsn || null,
                taxable_amount: item.taxableValue,
                cgst_percent: item.gstRate ? item.gstRate / 2 : 0,
                cgst_amount: item.cgst,
                sgst_percent: item.gstRate ? item.gstRate / 2 : 0,
                sgst_amount: item.sgst,
                igst_percent: item.igst > 0 ? item.gstRate : 0,
                igst_amount: item.igst,
                total_price: item.taxableValue + item.taxTotal
            }));

            // Use Repository for double-write
            await saleRepo.createSale(saleData, saleItems);

            // 3. Update Product Stock locally
            for (const item of items) {
                if (item.product_id) {
                    await saleRepo.updateStock(item.product_id, -(parseFloat(item.qty) || 0));
                }
            }

            // 4. Update Customer Balance locally
            if (selectedCustomerId) {
                await customerRepo.updateBalance(selectedCustomerId, totals.balance, 'credit');
            }

            // Success
            toast.success("Invoice Created Locally!");
            setShowModal(false);
            setItems([{ id: Date.now(), product_id: null, name: '', hsn: '', qty: 1, price: '', tax_percent: 0 }]);
            setAmountPaid('');
            setCustomerName('');
            setSelectedCustomerId(null);
            fetchHistory(); // Refresh from local DB

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
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${sale.invoice_type === 'gst' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-text-muted/10 text-text-muted border-card-border'}`}>
                                                {sale.invoice_type === 'gst' ? 'GST' : 'Standard'}
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
                                        <div className="flex gap-2 relative z-20">
                                            <button
                                                onClick={(e) => handleDeleteSale(sale.id, e)}
                                                className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                            <div className="w-10 h-10 rounded-xl bg-card-bg border border-card-border flex items-center justify-center text-text-muted group-hover:text-indigo-500 group-hover:border-indigo-500/50 transition-all">
                                                <ArrowUpRight size={20} />
                                            </div>
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
                                    {receiptSale.invoice_type === 'gst' ? 'Tax Invoice' : 'Bill of Supply'} Preview
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
                                        theme={userProfile?.invoice_theme || 'classic'}
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


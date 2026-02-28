import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, FileText, Calendar, Trash2, Loader, Eye, Printer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import Combobox from '../components/Combobox';
import InvoiceTemplate from '../components/InvoiceTemplate';


const Sales = () => {
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Data from DB
    const [customers, setCustomers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
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
    }, []);

    const fetchData = async () => {
        try {
            const isGuest = sessionStorage.getItem('guest_mode') === 'true';
            const API_URL = (import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

            if (isGuest) {
                // Guest mode — load local products & customers for invoice form
                const [prodsRes, custsRes] = await Promise.all([
                    fetch(`${API_URL}/api/local/products`),
                    fetch(`${API_URL}/api/local/customers`)
                ]);
                setProductsList(prodsRes.ok ? await prodsRes.json() : []);
                setCustomers(custsRes.ok ? await custsRes.json() : []);
                return;
            }

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
            const isGuest = sessionStorage.getItem('guest_mode') === 'true';
            const API_URL = (import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

            if (isGuest) {
                const res = await fetch(`${API_URL}/api/local/sales`);
                if (!res.ok) throw new Error('Local API error');
                const localSales = await res.json();
                // Map local sale shape → UI shape
                setSalesHistory(localSales.map(s => ({
                    id: s.id,
                    total_amount: s.total_amount,
                    payment_status: s.payment_status || 'paid',
                    payment_method: s.payment_method || 'cash',
                    created_at: s.created_at,
                    customers: { name: s.customer_name || 'Walk-in Customer' }
                })));
                return;
            }
            const { data: sales, error } = await supabase
                .from('sales')
                .select('*, customers(name)')
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            setSalesHistory(sales || []);
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
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        <div className="pb-20 min-h-screen bg-slate-50">
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-2xl border-b border-slate-200/50 p-4 md:p-6 flex justify-between items-center shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight leading-none">Sales Ledger</h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">Track and manage invoices</p>
                    </div>
                </div>
                <button className="p-2.5 bg-white border border-slate-200/60 text-slate-600 rounded-xl shadow-sm hover:bg-slate-50 hover:text-indigo-600 transition-colors">
                    <Calendar size={20} />
                </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
                {loading && !salesHistory.length ? (
                    <div className="flex justify-center p-10"><Loader className="animate-spin text-indigo-600" /></div>
                ) : (
                    salesHistory.map((sale, index) => (
                        <motion.div
                            key={sale.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            className="bg-white/60 backdrop-blur-xl rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/60 flex items-center justify-between hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-slate-300/50 transition-all duration-300 group relative overflow-hidden"
                        >
                            {/* Background Highlight */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200/50 flex items-center justify-center text-orange-500 group-hover:scale-105 transition-transform duration-300">
                                    <FileText size={24} className="group-hover:text-orange-600 transition-colors" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-900 transition-colors">INV-{sale.id}</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">{sale.customers?.name || "Cash Customer"}</span> <span className="mx-1">•</span> {new Date(sale.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="text-right mr-2">
                                    <div className="font-extrabold text-slate-900 text-xl tracking-tight">₹{sale.total_amount}</div>
                                    <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${sale.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : sale.payment_status === 'partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                        {sale.payment_status}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleViewReceipt(sale)}
                                    className="p-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 hover:bg-indigo-50 focus:ring-4 focus:ring-indigo-500/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Eye size={20} />
                                </button>
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

            {/* New Sale Modal (Full Schema) */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setShowModal(false)}
                        />

                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            className="bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl p-6 pointer-events-auto flex flex-col shadow-xl relative z-10"
                        >
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                <h2 className="text-xl font-bold font-heading text-slate-800">New Invoice</h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">Close</button>
                            </div>

                            <div className="overflow-y-auto flex-1 space-y-5 pr-1">
                                {/* Bill Configuration */}
                                {userProfile?.is_gst_registered && (
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-1 rounded-xl">
                                        <button
                                            onClick={() => setBillType('NON_GST')}
                                            className={`py-2 text-sm font-bold rounded-lg transition-colors ${billType === 'NON_GST' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                        >
                                            Regular (Non-GST)
                                        </button>
                                        <button
                                            onClick={() => setBillType('GST')}
                                            className={`py-2 text-sm font-bold rounded-lg transition-colors ${billType === 'GST' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                        >
                                            GST Invoice
                                        </button>
                                    </div>
                                )}

                                {/* Customer Info */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Customer</label>
                                    <div className="flex gap-2 mt-1 mb-2">
                                        <div className="flex-1">
                                            <Combobox
                                                options={customers}
                                                value={customerName}
                                                onChange={(val) => {
                                                    if (typeof val === 'object') {
                                                        setCustomerName(val.name);
                                                        setSelectedCustomerId(val.id);
                                                    } else {
                                                        setCustomerName(val);
                                                        setSelectedCustomerId(null); // Reset ID if manual type, or handle search matches
                                                    }
                                                }}
                                                placeholder="Search Customer..."
                                                labelKey="name"
                                            />
                                        </div>
                                        {/* TODO: Add logic to create new customer */}
                                        <button className="p-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold">+</button>
                                    </div>

                                    {billType === 'GST' && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="interState"
                                                checked={isInterState}
                                                onChange={(e) => setIsInterState(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <label htmlFor="interState" className="text-sm text-slate-600 font-medium">Inter-state (IGST)</label>
                                        </div>
                                    )}
                                </div>

                                {/* Items List */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Items</label>
                                        <button onClick={handleAddItem} className="text-indigo-600 text-xs font-bold">+ Add Item</button>
                                    </div>

                                    <div className="space-y-3">
                                        {items.map((item, index) => (
                                            <div key={item.id} className="relative group p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={14} />
                                                </button>

                                                <div className="grid grid-cols-12 gap-2 mb-2">
                                                    <div className="col-span-12 sm:col-span-8">
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
                                                            placeholder="Search Item..."
                                                            labelKey="name"
                                                            renderItem={(item) => (
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span>{item.name}</span>
                                                                    <span className="text-xs font-bold text-slate-500">₹{item.selling_price}</span>
                                                                </div>
                                                            )}
                                                        />
                                                    </div>
                                                    {billType === 'GST' && (
                                                        <div className="col-span-4 sm:col-span-4">
                                                            <input
                                                                placeholder="HSN"
                                                                value={item.hsn}
                                                                onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                                                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-xs text-center"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-12 gap-2">
                                                    <div className="col-span-3">
                                                        <input
                                                            type="number" placeholder="Qty"
                                                            value={item.qty}
                                                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                            className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm text-center"
                                                        />
                                                    </div>
                                                    <div className="col-span-4">
                                                        <input
                                                            type="number" placeholder="Price"
                                                            value={item.price}
                                                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                                            className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm"
                                                        />
                                                    </div>
                                                    {billType === 'GST' && (
                                                        <div className="col-span-3">
                                                            <input
                                                                type="number" placeholder="Tax%"
                                                                value={item.tax_percent}
                                                                onChange={(e) => handleItemChange(index, 'tax_percent', e.target.value)}
                                                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm text-center"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="col-span-2 flex items-center justify-end font-bold text-slate-700 text-sm">
                                                        ₹{(item.qty * item.price).toFixed(0)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment Info */}
                                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Subtotal</span>
                                        <span className="font-medium text-slate-900">₹{totals.subtotal.toFixed(2)}</span>
                                    </div>

                                    {billType === 'GST' && (
                                        <>
                                            {isInterState ? (
                                                <div className="flex justify-between text-slate-500">
                                                    <span>IGST</span>
                                                    <span className="font-medium text-slate-900">₹{totals.totalTax.toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>CGST ({(totals.totalTax / 2 / totals.subtotal * 100).toFixed(1)}%)</span>
                                                        <span className="font-medium text-slate-900">₹{(totals.totalTax / 2).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>SGST ({(totals.totalTax / 2 / totals.subtotal * 100).toFixed(1)}%)</span>
                                                        <span className="font-medium text-slate-900">₹{(totals.totalTax / 2).toFixed(2)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}

                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-slate-500">Additional Discount</span>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={additionalDiscount}
                                            onChange={(e) => setAdditionalDiscount(e.target.value)}
                                            className="w-24 p-1 bg-white border border-slate-200 rounded text-right"
                                        />
                                    </div>

                                    <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-3">
                                        <span>Grand Total</span>
                                        <span>₹{totals.grandTotal.toFixed(2)}</span>
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-slate-500 font-bold">Amount Paid</span>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={amountPaid}
                                            onChange={(e) => setAmountPaid(e.target.value)}
                                            className="w-32 p-2 bg-green-50 border border-green-200 rounded-lg text-right font-bold text-green-700"
                                        />
                                    </div>

                                    <div className="flex justify-between text-sm pt-1">
                                        <span className="text-red-500 font-medium">Balance Due</span>
                                        <span className="font-bold text-red-600">₹{totals.balance.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                                        <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                                            {['cash', 'upi', 'card', 'credit'].map(m => ( // Lowercase values
                                                <button
                                                    key={m}
                                                    onClick={() => setPaymentMethod(m)}
                                                    className={`px-3 py-2 rounded-lg text-sm font-bold border whitespace-nowrap capitalize ${paymentMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="w-1/3">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                        <div className={`mt-1 py-2 text-center rounded-lg font-bold border capitalize ${totals.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                            totals.status === 'partial' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                            {totals.status}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 mt-auto">
                                <button onClick={handleGenerateInvoice} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">
                                    Generate Invoice
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

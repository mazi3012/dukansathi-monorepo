import React, { useState, useEffect } from 'react';
import { Check, X, Edit2, ShoppingBag, User, FileText, Save, RefreshCw } from 'lucide-react';
import InvoiceTemplate from './InvoiceTemplate';

const ActionCard = ({ actionData, onApprove, onDiscard, businessProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState(actionData);

    // Sync with prop if it changes
    useEffect(() => {
        setLocalData(actionData);
    }, [actionData]);

    if (!localData) return null;

    const { type, items, customer_name, name, selling_price, stock_quantity, category, phone, address } = localData;

    // --- HANDLER FOR INVOICE EDITING ---
    const handleInvoiceItemChange = (index, field, value) => {
        const newItems = [...(localData.items || [])];
        newItems[index] = { ...newItems[index], [field]: value };

        // Recalculate total for that item if qty/price changed
        // (price/qty input might be string, parse safely)
        if (field === 'quantity' || field === 'price') {
            const q = parseFloat(newItems[index].quantity) || 0;
            const p = parseFloat(newItems[index].price) || 0;
            newItems[index].total = q * p;
        }

        const newTotal = newItems.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);

        setLocalData({
            ...localData,
            items: newItems,
            total_amount: newTotal
        });
    };

    const handleCustomerNameChange = (val) => {
        setLocalData({ ...localData, customer_name: val });
    };


    // 1. INVOICE DRAFT CARD
    if (type === 'invoice_draft') {
        const itemsList = localData.items || [];

        // Smart Context: Use Business Profile to determine template type (GST vs Regular)
        const isGstShop = businessProfile?.is_gst_registered || false;

        // PREPARE ITEMS FOR TEMPLATE (Field Mapping & Calculation)
        let subtotal = 0;
        let totalTaxAmount = 0;
        let grandTotal = 0;

        const templateItems = itemsList.map(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.price) || 0; // Draft uses 'price', Template uses 'unit_price'

            // Tax Logic (Default to 0 if not present in draft)
            // Ideally backend should fetch tax_percent too. For now assume inclusive or 0 for draft.
            // If GST Shop, let's assume rates are exclusive for calculation simplicity in draft unless specified.
            const taxPercent = parseFloat(item.tax_percent) || 0;

            const taxableValue = qty * rate;
            const taxAmt = (taxableValue * taxPercent) / 100;
            const itemTotal = taxableValue + taxAmt;

            subtotal += taxableValue;
            totalTaxAmount += taxAmt;
            grandTotal += itemTotal;

            return {
                ...item,
                name: item.product_name, // Map product_name -> name
                products: { name: item.product_name }, // Map for deep access if used
                unit_price: rate, // Map price -> unit_price
                quantity: qty,
                tax_percent: taxPercent
            };
        });

        // Note: localData.total_amount might be from the backend (simple qty*price). 
        // We override it with our precise calculation for the template.

        const mockSale = {
            id: "DRAFT",
            created_at: new Date().toISOString(),
            invoice_type: isGstShop ? "gst" : "regular",
            customer_name: localData.customer_name,
            customers: { name: localData.customer_name, address: "TBD", phone: "TBD" },

            // Calculated Totals
            subtotal: subtotal,
            total_tax_amount: totalTaxAmount,
            total_amount: grandTotal,
            amount_paid: grandTotal, // Assume fully paid for draft preview context
            balance_due: 0,
            discount_amount: 0
        };

        // If business profile is available, we should pass it to the template
        // But InvoiceTemplate expects a specific structure for businessProfile.
        // It should work fine as long as profiles table structure matches what we expect.
        // If businessProfile is null (loading/error), default to "My Shop"

        return (
            <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden mt-4 w-full max-w-2xl mx-auto transition-all">
                {/* Header Toolbar */}
                <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" />
                        <span className="font-bold text-indigo-900 text-sm">
                            {isGstShop ? "Draft Tax Invoice (GST)" : "Draft Receipt"}
                        </span>
                        {isEditing && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 rounded-full border border-amber-200 animate-pulse">EDITING</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-200 text-slate-500'}`}
                            title="Edit Draft"
                        >
                            {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
                        </button>
                    </div>
                </div>

                <div className="p-0 overflow-hidden relative">
                    {/* EDIT MODE OVERLAY / FORM */}
                    {isEditing ? (
                        <div className="p-6 bg-white">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Customer Name</label>
                                <input
                                    value={localData.customer_name || ''}
                                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Items</label>
                                {localData.items?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-xs text-slate-400 font-mono">Item</p>
                                            <input
                                                value={item.product_name}
                                                onChange={(e) => handleInvoiceItemChange(idx, 'product_name', e.target.value)}
                                                className="w-full bg-transparent font-medium text-slate-700 border-b border-transparent focus:border-indigo-300 outline-none text-sm"
                                            />
                                        </div>
                                        <div className="w-20">
                                            <p className="text-[10px] text-slate-400">Qty</p>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleInvoiceItemChange(idx, 'quantity', e.target.value)}
                                                className="w-full border rounded p-1 text-sm text-center"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <p className="text-[10px] text-slate-400">Rate (₹)</p>
                                            <input
                                                type="number"
                                                value={item.price || 0}
                                                onChange={(e) => handleInvoiceItemChange(idx, 'price', e.target.value)}
                                                className="w-full border rounded p-1 text-sm text-right"
                                            />
                                        </div>
                                        <div className="w-20 text-right">
                                            <p className="text-[10px] text-slate-400">Total</p>
                                            <p className="font-bold text-slate-700 mt-1">₹{(item.quantity * item.price) || 0}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                <span className="font-bold text-indigo-900">Total Amount</span>
                                <span className="font-bold text-2xl text-indigo-700">₹{grandTotal}</span>
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE (PREVIEW) */
                        <div className="transform scale-[0.85] origin-top border-b border-slate-100">
                            <InvoiceTemplate
                                sale={mockSale}
                                items={templateItems}
                                businessProfile={businessProfile || { business_name: "Loading...", address: "Please approve to finalize" }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50 p-4 flex justify-between gap-4 border-t border-slate-200">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 text-sm"
                    >
                        Discard
                    </button>
                    <button
                        onClick={() => onApprove(localData)}
                        className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all transform active:scale-95 flex justify-center items-center gap-2 text-sm"
                    >
                        <Check size={18} /> Approve Invoice
                    </button>
                </div>
            </div>
        );
    }

    // 2. PRODUCT DRAFT CARD
    if (type === 'product_draft') {
        return (
            <div className="bg-white rounded-xl shadow-md border border-emerald-100 overflow-hidden mt-4 w-full max-w-md mx-auto transition-all">
                <div className="bg-emerald-50 px-4 py-3 flex justify-between items-center border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={18} className="text-emerald-700" />
                        <span className="font-bold text-emerald-900 text-sm">Add New Product</span>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Product Name
                        </label>
                        <input
                            type="text"
                            value={localData.name || ''}
                            onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-slate-700"
                            placeholder="e.g. Lifebuoy Soap"
                        />
                    </div>

                    <div className="flex gap-4">
                        {/* Price */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Selling Price
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={localData.selling_price || ''}
                                    onChange={(e) => setLocalData({ ...localData, selling_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-slate-800"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Stock */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Stock Qty
                            </label>
                            <input
                                type="number"
                                value={localData.stock_quantity || ''}
                                onChange={(e) => setLocalData({ ...localData, stock_quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-slate-700"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Discard
                    </button>
                    <button
                        onClick={() => onApprove(localData)}
                        className="flex-1 py-2 px-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={16} /> Add Product
                    </button>
                </div>
            </div>
        )
    }

    // 3. PRODUCT DRAFT CARD
    if (type === 'product_draft') {
        // State for expanding details
        const [showDetails, setShowDetails] = useState(() => {
            // Auto-expand if CP is already set by AI and > 0, or if user manually opens
            return (localData.cost_price && parseFloat(localData.cost_price) > 0);
        });

        return (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden w-full max-w-md mx-auto my-4 transition-all duration-300 hover:shadow-md">
                <div className="bg-indigo-50 px-4 py-3 flex justify-between items-center border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                        <Package size={18} className="text-indigo-600" />
                        <span className="font-bold text-indigo-900 text-sm">New Product Draft</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-indigo-200 text-indigo-600 rounded-full uppercase tracking-wider">
                        ADD STOCK
                    </span>
                </div>

                <div className="p-4 space-y-4">
                    {/* Product Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Product Name
                        </label>
                        <input
                            type="text"
                            value={localData.name || ''}
                            onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-slate-700"
                            placeholder="e.g. Maggi Masala"
                        />
                    </div>

                    <div className="flex gap-4">
                        {/* Selling Price */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Selling Price (SP)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={localData.selling_price || ''}
                                    onChange={(e) => setLocalData({ ...localData, selling_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-slate-800"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Stock Quantity */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Stock Qty
                            </label>
                            <input
                                type="number"
                                value={localData.stock_quantity || ''}
                                onChange={(e) => setLocalData({ ...localData, stock_quantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-800"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Show More / Less Toggle */}
                    <div>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                        >
                            {showDetails ? (
                                <>Hide Details <ChevronUp size={14} /></>
                            ) : (
                                <>+ Add Cost Price & Category <ChevronDown size={14} /></>
                            )}
                        </button>
                    </div>

                    {/* Extended Details (Collapsible) */}
                    {showDetails && (
                        <div className="pt-2 space-y-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex gap-4">
                                {/* Cost Price */}
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Cost Price (CP)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={localData.cost_price || ''}
                                            onChange={(e) => setLocalData({ ...localData, cost_price: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none font-medium text-slate-600 bg-slate-50"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={localData.category || 'General'}
                                        onChange={(e) => setLocalData({ ...localData, category: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-slate-700"
                                    >
                                        <option value="General">General</option>
                                        <option value="Grocery">Grocery</option>
                                        <option value="Vegetables">Vegetables</option>
                                        <option value="Snacks">Snacks</option>
                                        <option value="Personal Care">Personal Care</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Discard
                    </button>
                    <button
                        onClick={() => onApprove(localData)}
                        className="flex-1 py-2 px-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={16} /> Confirm Add
                    </button>
                </div>
            </div>
        );
    }

    // 4. PAYMENT / DUES UPDATE CARD
    if (type === 'payment_draft') {
        // Determine mode based on amount sign or user selection
        // Default to 'credit' (Red/Add Dues) if positive, 'payment' (Green/Receive Payment) if negative
        // But initially from NLP it might be positive for both actions, relying on keywords. 
        // Let's use local state to toggle.

        // Initialize state only once
        const [mode, setMode] = useState(() => {
            // If amount is explicitly negative, it's a payment/deduction. 
            // If implicit from "paid", NLP might send positive amount but intention is payment.
            // We'll default to 'payment' (Green) if user said "paid/received", 'credit' (Red) if "add due".
            // Since we don't have the raw query here easily, we rely on the amount sign from NLP if available.
            return (localData.amount < 0) ? 'payment' : 'credit';
        });

        const isCredit = mode === 'credit'; // Red (Give Udhar)
        const themeColor = isCredit ? 'red' : 'emerald';
        const ThemeIcon = isCredit ? RefreshCw : Check; // Just some icon variety

        // Helper to handle amount change
        const handleAmountChange = (val) => {
            // Keep the visual amount positive
            const absVal = Math.abs(parseFloat(val) || 0);
            setLocalData({ ...localData, amount: absVal });
        };

        const handleConfirm = () => {
            // Send ALWAYS POSITIVE amount + explicit payment_type
            // Chat.jsx will handle the direction (add or subtract) based on payment_type
            const finalAmount = Math.abs(parseFloat(localData.amount) || 0);
            onApprove({
                ...localData,
                amount: finalAmount,
                payment_type: mode   // 'credit' = add dues, 'payment' = reduce dues
            });
        };

        return (
            <div className={`bg-white rounded-xl shadow-sm border overflow-hidden w-full max-w-md mx-auto my-4 transition-all duration-300 hover:shadow-md ${isCredit ? 'border-red-200' : 'border-emerald-200'}`}>
                {/* Header with Toggle */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${isCredit ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className={`flex items-center gap-2 ${isCredit ? 'text-red-700' : 'text-emerald-700'}`}>
                        <div className={`p-1.5 rounded-lg ${isCredit ? 'bg-red-100' : 'bg-emerald-100'}`}>
                            <ThemeIcon size={16} />
                        </div>
                        <span className="font-semibold text-sm">
                            {isCredit ? "Give Credit / Udhar" : "Receive Payment / Jama"}
                        </span>
                    </div>
                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 bg-white border rounded-full uppercase tracking-wider ${isCredit ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
                        DRAFT
                    </span>
                </div>

                {/* Toggle Switch */}
                <div className="flex bg-slate-100 p-1 mx-4 mt-4 rounded-lg">
                    <button
                        onClick={() => setMode('credit')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${isCredit ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Give Credit (Red)
                    </button>
                    <button
                        onClick={() => setMode('payment')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!isCredit ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Get Payment (Green)
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Customer */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Customer Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={localData.customer_name || ''}
                                onChange={(e) => setLocalData({ ...localData, customer_name: e.target.value })}
                                className={`w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all placeholder:text-slate-300 font-medium text-slate-700 ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                                placeholder="Enter customer name..."
                            />
                        </div>
                    </div>

                    {/* Amount & Mode Row */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={Math.abs(localData.amount) || ''}
                                    onChange={(e) => handleAmountChange(e.target.value)}
                                    className={`w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-bold text-slate-800 ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Mode
                            </label>
                            <select
                                value={localData.mode || 'Cash'}
                                onChange={(e) => setLocalData({ ...localData, mode: e.target.value })}
                                className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 outline-none bg-white font-medium text-slate-700 ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank">Bank</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className={`px-4 py-3 border-t flex gap-3 ${isCredit ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Discard
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`flex-1 py-2 px-3 text-white rounded-lg text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 ${isCredit ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                    >
                        <Check size={16} /> {isCredit ? "Confirm Credit" : "Confirm Payment"}
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default ActionCard;

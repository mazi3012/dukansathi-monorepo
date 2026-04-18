import React, { useState, useEffect } from 'react';
import { Check, X, Edit2, ShoppingBag, User, FileText, Save, RefreshCw, Package, ChevronDown, ChevronUp, Layers, Download, Share, List } from 'lucide-react';
import InvoiceTemplate from './InvoiceTemplate';
import { getStateFromGSTIN, TaxCalculator, HSN_TAX_RATES } from '../utils/gstUtils';

const ActionCard = ({ actionData, onApprove, onDiscard, businessProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState(actionData);
    const [paymentStatus, setPaymentStatus] = useState('paid');
    const [amountPaid, setAmountPaid] = useState('');

    // --- GST Calculation Helper for Draft ---
    const getTemplateItems = (itemsList, activeIsGst, forceInterState = false) => {
        return itemsList.map(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.price) || 0;
            const hsn = item.hsn_code || "1905"; // Fallback to 18% slab (e.g. Biscuits) if AI missed it

            const taxCalc = TaxCalculator.calculate({
                sellingPrice: rate,
                quantity: qty,
                hsnCode: hsn,
                sellerGstin: businessProfile?.gstin,
                buyerGstin: forceInterState ? 'OTHER_STATE' : localData.gstin,
                placeOfSupply: forceInterState ? null : localData.state_code,
                forceInterState,
                taxRate: item.tax_percent !== undefined ? parseFloat(item.tax_percent) : null,
                isInclusive: item.tax_type === 'inclusive'
            });

            const cgst = activeIsGst ? taxCalc.cgst_amount : 0;
            const sgst = activeIsGst ? taxCalc.sgst_amount : 0;
            const igst = activeIsGst ? taxCalc.igst_amount : 0;
            const taxTotal = cgst + sgst + igst;

            return {
                ...item,
                name: item.product_name,
                products: { name: item.product_name },
                unit_price: rate,
                quantity: qty,
                hsn_code: activeIsGst ? hsn : null,
                taxable_amount: taxCalc.taxable_value,
                cgst_amount: cgst,
                sgst_amount: sgst,
                igst_amount: igst,
                tax_percent: activeIsGst ? taxCalc.gst_rate : 0,
                total_amount: taxCalc.taxable_value + taxTotal
            };
        });
    };

    // Sync with prop if it changes
    useEffect(() => {
        let updatedData = { ...actionData };
        if (updatedData.type === 'customer_draft' && updatedData.gstin && !updatedData.state) {
            const detectedState = getStateFromGSTIN(updatedData.gstin);
            if (detectedState) {
                updatedData.state = detectedState;
            }
        }
        setLocalData(updatedData);
    }, [actionData]);

    // Enrich invoice items with product prices from inventory (for display)
    useEffect(() => {
        const enrichPricesForDisplay = async () => {
            if (actionData.type === 'invoice_draft' && actionData.items) {
                try {
                    const { supabase } = await import('../lib/supabase');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const enrichedItems = await Promise.all(
                        actionData.items.map(async (item) => {
                            // If price is 0 or missing, try to look it up
                            const itemName = (item.product_name || item.name || '').trim();
                            if ((parseFloat(item.price) || 0) === 0 && itemName) {
                                try {
                                    let prodData = null;

                                    try {
                                        const { data: fuzzyProd } = await supabase.rpc('fuzzy_match_product', {
                                            query: itemName,
                                            uid: user.id
                                        });
                                        if (fuzzyProd && fuzzyProd.length > 0) {
                                            prodData = fuzzyProd[0];
                                        }
                                    } catch (_) {
                                        // RPC may not exist in some environments.
                                    }

                                    if (!prodData) {
                                        const { data: ilikeProd } = await supabase.from('products')
                                            .select('selling_price, cost_price, hsn_code, tax_percent, unit')
                                            .ilike('name', `%${itemName}%`)
                                            .eq('user_id', user.id)
                                            .limit(1)
                                            .maybeSingle();
                                        prodData = ilikeProd;
                                    }
                                    
                                    if (prodData && prodData.selling_price) {
                                        return {
                                            ...item,
                                            price: prodData.selling_price,
                                            hsn_code: item.hsn_code || prodData.hsn_code,
                                            tax_percent: item.tax_percent || prodData.tax_percent
                                        };
                                    }
                                } catch (e) {
                                    // Product not found, keep original
                                    return item;
                                }
                            }
                            return item;
                        })
                    );

                    setLocalData(prev => ({
                        ...prev,
                        items: enrichedItems
                    }));
                } catch (err) {
                    console.warn('Failed to enrich prices for display:', err);
                }
            }
        };

        enrichPricesForDisplay();
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
        const isGstShop = businessProfile?.is_gst_registered || false;
        
        // Use a local state for bill type if it's a GST shop, allowing toggle to Non-GST
        const [billType, setBillType] = useState(localData.invoice_type || (isGstShop ? 'GST' : 'NON_GST'));
        const activeIsGst = billType === 'GST';
        // Out-of-State toggle — forces IGST even when both parties may be in same state
        const [isOutOfState, setIsOutOfState] = useState(false);
        // Prevent double-click on approve
        const [isApproving, setIsApproving] = useState(false);

        // PREPARE ITEMS FOR TEMPLATE
        const templateItems = getTemplateItems(itemsList, activeIsGst, isOutOfState);

        const hasCustomerName = Boolean((localData.customer_name || '').trim());
        const hasValidItems = Array.isArray(itemsList) && itemsList.length > 0 && itemsList.every((item) => {
            const pname = (item.product_name || '').trim();
            const qty = parseFloat(item.quantity);
            return Boolean(pname) && Number.isFinite(qty) && qty > 0;
        });
        const amountPaidValue = parseFloat(amountPaid);
        const hasValidPayment =
            paymentStatus !== 'partial' || (Number.isFinite(amountPaidValue) && amountPaidValue > 0);
        const canApproveInvoice = hasCustomerName && hasValidItems && hasValidPayment;

        // Calculate Totals
        const subtotal = templateItems.reduce((sum, item) => sum + item.taxable_amount, 0);
        const totalTaxAmount = templateItems.reduce((sum, item) => sum + (item.cgst_amount + item.sgst_amount + item.igst_amount), 0);
        const grandTotal = Math.round((subtotal + totalTaxAmount + Number.EPSILON) * 100) / 100;

        // SYNC PAYMENT: If user has 'paid' selected, and the total changes (e.g. toggling GST), update amountPaid
        useEffect(() => {
            if (paymentStatus === 'paid') {
                setAmountPaid(grandTotal.toString());
            }
        }, [grandTotal, paymentStatus]);


        const mockSale = {
            id: "DRAFT",
            created_at: new Date().toISOString(),
            invoice_type: activeIsGst ? "gst" : "regular",
            customer_name: localData.customer_name,
            customers: {
                name: localData.customer_name,
                address: localData.address || "TBD",
                phone: localData.phone || "TBD",
                gstin: localData.gstin
            },
            subtotal,
            total_tax_amount: totalTaxAmount,
            total_amount: grandTotal,
            cgst_amount: templateItems.reduce((sum, i) => sum + i.cgst_amount, 0),
            sgst_amount: templateItems.reduce((sum, i) => sum + i.sgst_amount, 0),
            igst_amount: templateItems.reduce((sum, i) => sum + i.igst_amount, 0),
            payment_status: paymentStatus,
            amount_paid: parseFloat(amountPaid) || (paymentStatus === 'paid' ? grandTotal : 0),
            balance_due: Math.round((Math.max(0, grandTotal - (parseFloat(amountPaid) || (paymentStatus === 'paid' ? grandTotal : 0))) + Number.EPSILON) * 100) / 100,
            discount_amount: 0
        };

        // If business profile is available, we should pass it to the template
        // But InvoiceTemplate expects a specific structure for businessProfile.
        // It should work fine as long as profiles table structure matches what we expect.
        // If businessProfile is null (loading/error), default to "My Shop"

        // INVOICE (Handled by InvoiceTemplate now, skipping this wrapper if it's external, but wait, InvoiceTemplate is inside ActionCard? No, InvoiceTemplate is separate component. The ActionCard doesn't wrap it in a box here, it just returns InvoiceTemplate).
        return (
            <div className="glass-card rounded-[28px] shadow-xl border border-card-border overflow-hidden w-full max-w-md md:max-w-xl mx-auto my-4 transition-all">
                {/* Header Toolbar */}
                <div className="bg-indigo-600 px-4 py-3 flex justify-between items-center">
                    <div className="flex flex-col text-white">
                        <div className="flex items-center gap-2">
                            <FileText size={18} />
                            <span className="font-bold text-sm tracking-tight">
                                {activeIsGst ? "Tax Invoice Draft" : "Bill of Supply Draft"}
                            </span>
                            {isEditing && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full animate-pulse tracking-wider">EDITING</span>}
                            {!isEditing && activeIsGst && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                                    TAX COMPLIANT
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4 text-white items-center">
                        {isGstShop && !isEditing && (
                            <div className="flex items-center gap-2 pr-2 border-r border-white/20">
                                <span className="text-[9px] font-black uppercase tracking-tighter opacity-80">
                                    GST
                                </span>
                                <div 
                                    onClick={() => setBillType(activeIsGst ? 'NON_GST' : 'GST')}
                                    className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${activeIsGst ? 'bg-indigo-400' : 'bg-white/20'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${activeIsGst ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        )}
                        {/* Out-of-State / IGST Toggle — shown only when GST is active */}
                        {isGstShop && activeIsGst && !isEditing && (
                            <div className="flex items-center gap-1.5 pr-2 border-r border-white/20">
                                <input
                                    type="checkbox"
                                    id="out-of-state-chk"
                                    checked={isOutOfState}
                                    onChange={(e) => setIsOutOfState(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-white cursor-pointer"
                                />
                                <label htmlFor="out-of-state-chk" className="text-[9px] font-black uppercase tracking-tighter cursor-pointer select-none">
                                    Out-of-State (IGST)
                                </label>
                            </div>
                        )}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/20"
                            title="Edit Draft"
                        >
                            {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
                        </button>
                    </div>
                </div>

                <div className="p-0 overflow-hidden relative bg-card-bg">
                    {/* EDIT MODE OVERLAY / FORM */}
                    {isEditing ? (
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Customer Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 text-text-muted/70" size={16} />
                                    <input
                                        value={localData.customer_name || ''}
                                        onChange={(e) => handleCustomerNameChange(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-text-main"
                                        placeholder="Enter customer name..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Items</label>
                                {localData.items?.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-2 bg-bg-main p-3 rounded-xl border border-card-border">
                                        <input
                                            value={item.product_name}
                                            onChange={(e) => handleInvoiceItemChange(idx, 'product_name', e.target.value)}
                                            className="w-full bg-transparent font-medium border-b border-card-border/50 focus:border-indigo-500 outline-none text-sm pb-1 text-text-main"
                                            placeholder="Item name"
                                        />
                                        <div className="flex gap-2 items-center mt-1">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase mb-1">Qty</p>
                                                <div className="flex items-center gap-1 border border-card-border rounded-lg px-2 bg-card-bg focus-within:ring-1 focus-within:ring-indigo-500 shadow-inner">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleInvoiceItemChange(idx, 'quantity', e.target.value)}
                                                        className="w-full py-1 text-sm bg-transparent outline-none font-medium text-center text-text-main"
                                                    />
                                                    {item.unit && <span className="text-[10px] text-text-muted font-bold pr-1">{item.unit}</span>}
                                                </div>
                                            </div>
                                            <div className="w-6 text-center text-text-muted font-bold text-xs mt-4">×</div>
                                            <div className="flex-1">
                                                <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase mb-1">Rate</p>
                                                <div className="flex items-center gap-1 border border-card-border rounded-lg px-2 bg-card-bg focus-within:ring-1 focus-within:ring-indigo-500 shadow-inner">
                                                    <span className="text-[10px] text-text-muted font-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        value={item.price || 0}
                                                        onChange={(e) => handleInvoiceItemChange(idx, 'price', e.target.value)}
                                                        className="w-full py-1 text-sm bg-transparent outline-none font-medium text-text-main"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 text-right">
                                                <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase mb-1">Total</p>
                                                <p className="font-bold text-text-main mt-1 text-sm">₹{((item.quantity * item.price) || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE (PREVIEW) */
                        <div className="p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-start border-b border-card-border/30 pb-3">
                                <div>
                                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Bill To</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <User size={14} className="text-indigo-500" />
                                        <p className="font-bold text-text-main text-base">{localData.customer_name || 'Walk-in Customer'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-12 text-[10px] font-bold text-text-muted/70 uppercase tracking-wider mb-1 px-1">
                                    <span className="col-span-6">Item</span>
                                    <span className="col-span-3 text-center">Qty × Rate</span>
                                    <span className="col-span-3 text-right">Amount</span>
                                </div>
                                {templateItems.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-1 items-center pb-2 border-b border-card-border/10 last:border-0 last:pb-0">
                                        <div className="col-span-6 pr-2">
                                            <p className="text-sm font-semibold text-text-main leading-tight truncate">
                                                {item.name}
                                                {item.tax_percent > 0 && (
                                                    <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-md font-bold uppercase tracking-tighter">
                                                        {item.tax_percent}% GST
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="col-span-3 text-center">
                                            <p className="text-xs font-medium text-text-muted">{item.quantity} × ₹{item.unit_price}</p>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <p className="text-sm font-bold text-text-main">₹{((item.quantity * item.unit_price)).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tax Breakdown for GST Shops */}
                            {isGstShop && totalTaxAmount > 0 && (
                                <div className="mt-4 pt-3 border-t border-card-border/20 space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Taxable Value</span>
                                        <span className="text-xs font-bold text-text-main">₹{subtotal.toFixed(2)}</span>
                                    </div>
                                    {mockSale.igst_amount > 0 ? (
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">IGST (Inter-State)</span>
                                            <span className="text-xs font-bold text-indigo-500">₹{mockSale.igst_amount.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">CGST (Central)</span>
                                                <span className="text-xs font-bold text-indigo-500">₹{mockSale.cgst_amount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">SGST (State)</span>
                                                <span className="text-xs font-bold text-indigo-500">₹{mockSale.sgst_amount.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tax Breakdown for GST drafts */}
                    {activeIsGst && totalTaxAmount > 0 && (
                        <div className="px-4 py-2 bg-indigo-50/30 border-b border-card-border/30 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-text-muted">
                                <span>TAXABLE VALUE</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                <span>TOTAL TAX (GST)</span>
                                <span>+ ₹{totalTaxAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Grand Total Area (Always visible) */}
                    <div className={`flex justify-between items-center p-4 border-b border-card-border/50 ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-transparent'}`}>
                        <span className="font-bold text-text-muted text-sm uppercase tracking-wider">{activeIsGst ? 'Invoice Total' : 'Total Amount'}</span>
                        <span className="font-black text-2xl text-indigo-600">₹{grandTotal.toFixed(2)}</span>
                    </div>

                    {/* Payment Status Selection (Draft Mode Only) */}
                    {!isEditing && (
                        <div className="p-4 bg-bg-main/20 space-y-3">
                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Payment Status</label>
                            <div className="flex bg-card-bg/50 p-1 rounded-xl border border-card-border/30">
                                {['paid', 'unpaid', 'partial'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            setPaymentStatus(status);
                                            if (status === 'paid') setAmountPaid(grandTotal.toString());
                                            else if (status === 'unpaid') setAmountPaid('0');
                                        }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize ${paymentStatus === status
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-text-muted hover:text-text-main hover:bg-card-bg/50'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>

                            {paymentStatus === 'partial' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Amount Paid (Partial)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-text-muted font-bold text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={amountPaid}
                                            onChange={(e) => setAmountPaid(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-text-main bg-card-bg/40"
                                            placeholder="Enter amount paid..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-card-bg/40 p-3 sm:p-4 flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-1.5 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Discard
                    </button>
                    <button
                        onClick={() => {
                            if (isApproving || !canApproveInvoice) return;
                            setIsApproving(true);
                            onApprove({
                                ...localData,
                                invoice_type: activeIsGst ? 'gst' : 'regular',
                                isOutOfState,
                                payment_status: paymentStatus,
                                amount_paid: parseFloat(amountPaid) || (paymentStatus === 'paid' ? grandTotal : 0)
                            });
                        }}
                        disabled={isApproving || !canApproveInvoice}
                        className={`flex-1 py-1.5 px-3 font-bold rounded-lg shadow-md text-sm flex justify-center items-center gap-2 transition-all ${
                            (isApproving || !canApproveInvoice)
                                ? 'bg-indigo-400 text-white cursor-not-allowed opacity-80'
                                : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                        }`}
                    >
                        {isApproving ? (
                            <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg> Processing...</>
                        ) : (
                            <><Check size={18} /> {canApproveInvoice ? 'Approve' : 'Complete Draft'}</>
                        )}
                    </button>
                </div>
            </div>
        );
    }


    // 2. PRODUCT DRAFT CARD — full form with CP, category, and extras
    if (type === 'product_draft') {
        // State for expanding details
        const [showDetails, setShowDetails] = useState(() => {
            // Auto-expand if CP is already set by AI and > 0, or if user manually opens
            return (localData.cost_price && parseFloat(localData.cost_price) > 0);
        });

        return (
            <div className="glass-card rounded-[28px] overflow-hidden w-full max-w-md md:max-w-xl mx-auto my-4 border border-card-border/50 shadow-lg transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/30">
                <div className="bg-indigo-500/10 px-4 py-3 flex justify-between items-center border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                        <Package size={18} className="text-indigo-600" />
                        <span className="font-bold text-text-main font-bold text-sm">New Product Draft</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-transparent border border-indigo-500/30 text-indigo-600 rounded-full uppercase tracking-wider">
                        ADD STOCK
                    </span>
                </div>

                <div className="p-4 space-y-4">
                    {/* Product Name */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                            Product Name
                        </label>
                        <input
                            type="text"
                            value={localData.name || ''}
                            onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-text-main"
                            placeholder="e.g. Maggi Masala"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Selling Price */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                Selling Price (SP)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-text-muted/70 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={localData.selling_price || ''}
                                    onChange={(e) => setLocalData({ ...localData, selling_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-text-main"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Stock Quantity */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                Stock Qty
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={localData.stock_quantity || ''}
                                    onChange={(e) => setLocalData({ ...localData, stock_quantity: parseInt(e.target.value) || 0 })}
                                    className="flex-1 px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-text-main"
                                    placeholder="0"
                                />
                                <select
                                    value={localData.unit || 'pcs'}
                                    onChange={(e) => setLocalData({ ...localData, unit: e.target.value })}
                                    className="w-20 px-1 sm:px-2 py-2 text-xs border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-transparent font-bold text-text-main"
                                >
                                    <option value="pcs">pcs</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="litre">litre</option>
                                    <option value="ml">ml</option>
                                    <option value="dozen">dozen</option>
                                    <option value="box">box</option>
                                    <option value="packet">packet</option>
                                    <option value="metre">metre</option>
                                    <option value="set">set</option>
                                </select>
                            </div>
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
                        <div className="pt-2 space-y-4 border-t border-card-border/30 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Cost Price */}
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Cost Price (CP)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-text-muted/70 font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={localData.cost_price || ''}
                                            onChange={(e) => setLocalData({ ...localData, cost_price: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none font-medium text-text-main bg-card-bg/40"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={localData.category || 'General'}
                                        onChange={(e) => setLocalData({ ...localData, category: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-bg-main/50 font-medium text-text-main"
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

                <div className="px-4 py-3 bg-card-bg/40 border-t border-card-border/30 flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center justify-center gap-2"
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
            // Use explicit payment_type from NLP (set by agent_graph.py)
            // Fallback: positive amount = credit (add dues), negative = payment (deduct)
            return localData.payment_type === 'payment' ? 'payment' : 'credit';
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
            <div className={`glass-card rounded-[28px] border overflow-hidden w-full max-w-md md:max-w-xl mx-auto my-4 shadow-lg transition-all duration-300 hover:shadow-lg ${isCredit ? 'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/10' : 'border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10'}`}>
                {/* Header with Toggle */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${isCredit ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <div className={`flex items-center gap-2 ${isCredit ? 'text-red-700' : 'text-emerald-700'}`}>
                        <div className={`p-1.5 rounded-lg ${isCredit ? 'bg-red-100' : 'bg-emerald-100'}`}>
                            <ThemeIcon size={16} />
                        </div>
                        <span className="font-semibold text-sm">
                            {isCredit ? "Give Credit / Udhar" : "Receive Payment / Jama"}
                        </span>
                    </div>
                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 bg-transparent border rounded-full uppercase tracking-wider ${isCredit ? 'border-red-500/30 text-red-600' : 'border-emerald-500/30 text-emerald-600'}`}>
                        DRAFT
                    </span>
                </div>

                {/* Toggle Switch */}
                <div className="flex bg-bg-main/50 p-1 mx-4 mt-4 rounded-lg">
                    <button
                        onClick={() => setMode('credit')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${isCredit ? 'bg-transparent text-red-600 shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        Give Credit (Red)
                    </button>
                    <button
                        onClick={() => setMode('payment')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!isCredit ? 'bg-transparent text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        Get Payment (Green)
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Customer */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                            Customer Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-text-muted/70" size={16} />
                            <input
                                type="text"
                                value={localData.customer_name || ''}
                                onChange={(e) => setLocalData({ ...localData, customer_name: e.target.value })}
                                className={`w-full pl-9 pr-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 outline-none transition-all placeholder:text-text-muted/50 font-medium text-text-main ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                                placeholder="Enter customer name..."
                            />
                        </div>
                    </div>

                    {/* Amount & Mode Row */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-text-muted/70 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={Math.abs(localData.amount) || ''}
                                    onChange={(e) => handleAmountChange(e.target.value)}
                                    className={`w-full pl-8 pr-3 py-2 text-sm border border-card-border rounded-lg focus:ring-2 outline-none transition-all font-bold text-text-main bg-card-bg shadow-inner ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                Mode
                            </label>
                            <select
                                value={localData.mode || 'Cash'}
                                onChange={(e) => setLocalData({ ...localData, mode: e.target.value })}
                                className={`w-full px-3 py-2 text-sm border border-card-border rounded-lg focus:ring-2 outline-none bg-card-bg font-medium text-text-main shadow-inner ${isCredit ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-500 focus:border-emerald-500'}`}
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank">Bank</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className={`px-4 py-3 border-t flex gap-3 ${isCredit ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center justify-center gap-2"
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

    // 5. CUSTOMER DRAFT CARD
    if (type === 'customer_draft') {
        return (
            <div className="glass-card rounded-[28px] overflow-hidden w-full max-w-md md:max-w-xl mx-auto my-4 border border-card-border/50 shadow-lg transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/30">
                {/* Header */}
                <div className="bg-blue-500/10 px-4 py-3 flex justify-between items-center border-b border-blue-500/20">
                    <div className="flex items-center gap-2">
                        <User size={18} className="text-blue-600" />
                        <span className="font-bold text-text-main font-bold text-sm">Add New Customer</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-transparent border border-blue-500/30 text-blue-600 rounded-full uppercase tracking-wider">
                        NEW
                    </span>
                </div>

                <div className="p-4 space-y-3">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                            Customer Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={localData.name || ''}
                            onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-text-main"
                            placeholder="e.g. Rahul Sharma"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                            Phone <span className="text-text-muted/70">(optional)</span>
                        </label>
                        <input
                            type="tel"
                            value={localData.phone || ''}
                            onChange={(e) => setLocalData({ ...localData, phone: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-text-main"
                            placeholder="e.g. 9876543210"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                            Address <span className="text-text-muted/70">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={localData.address || ''}
                            onChange={(e) => setLocalData({ ...localData, address: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-text-main"
                            placeholder="e.g. 12 Gandhi Nagar"
                        />
                    </div>

                    {/* GST Details */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                GSTIN <span className="text-text-muted/70">(opt)</span>
                            </label>
                            <input
                                type="text"
                                value={localData.gstin || ''}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    const detectedState = getStateFromGSTIN(val);
                                    setLocalData({
                                        ...localData,
                                        gstin: val,
                                        state: detectedState || localData.state || ''
                                    });
                                }}
                                className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono uppercase font-semibold text-text-main"
                                placeholder="GSTIN"
                                maxLength={15}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                State
                            </label>
                            <input
                                type="text"
                                value={localData.state || ''}
                                onChange={(e) => setLocalData({ ...localData, state: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-text-main"
                                placeholder="State"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-card-bg/40 border-t border-card-border/30 flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Discard
                    </button>
                    <button
                        onClick={() => onApprove(localData)}
                        disabled={!localData.name?.trim()}
                        className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check size={16} /> Add Customer
                    </button>
                </div>
            </div>
        );
    }

    // 5. RESTOCK DRAFT CARD
    if (type === 'restock_draft') {
        return (
            <div className="glass-card rounded-[28px] border border-card-border/50 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-transparent/20 rounded-xl flex items-center justify-center">
                        <RefreshCw size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Restock Draft</h3>
                        <p className="text-green-100 text-xs">Review &amp; approve stock addition</p>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Product</label>
                        <input
                            type="text"
                            value={localData.product_name || ''}
                            onChange={e => setLocalData({ ...localData, product_name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-semibold text-text-main"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Quantity to Add</label>
                        <input
                            type="number"
                            value={localData.quantity_to_add || ''}
                            onChange={e => setLocalData({ ...localData, quantity_to_add: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 text-sm border border-card-border/50 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-semibold text-text-main"
                        />
                    </div>
                </div>

                <div className="px-4 py-3 bg-card-bg/40 border-t border-card-border/30 flex gap-3">
                    <button onClick={onDiscard} className="flex-1 py-2 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center justify-center gap-2">
                        <X size={16} /> Cancel
                    </button>
                    <button
                        onClick={() => onApprove(localData)}
                        disabled={!localData.product_name || !localData.quantity_to_add}
                        className="flex-1 py-2 px-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check size={16} /> Confirm Restock
                    </button>
                </div>
            </div>
        );
    }

    // 6. MULTI-ITEM BATCH DRAFT CARD (from photo or bulk AI extraction)
    if (type === 'multi_item_draft') {
        const PURPOSES = [
            { value: 'invoice', label: '🧾 Invoice', color: 'indigo' },
            { value: 'add_stock', label: '📦 Add New Products', color: 'blue' },
            { value: 'restock', label: '🔄 Restock Existing', color: 'green' },
        ];

        const [batchItems, setBatchItems] = useState(localData.items || []);
        const [purpose, setPurpose] = useState(localData.purpose || 'invoice');

        const handleItemChange = (idx, field, val) => {
            const updated = [...batchItems];
            updated[idx] = { ...updated[idx], [field]: val };
            setBatchItems(updated);
        };

        const handleApproveAll = () => {
            onApprove({ ...localData, type: `${purpose}_draft`, items: batchItems, purpose });
        };

        return (
            <div className="glass-card rounded-[28px] border border-card-border/50 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-transparent/20 rounded-xl flex items-center justify-center">
                        <Layers size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Batch Review</h3>
                        <p className="text-indigo-100 text-xs">{batchItems.length} items extracted — review and approve all</p>
                    </div>
                </div>

                {/* Purpose Selector */}
                <div className="px-4 pt-3 pb-2">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">What are these items for?</label>
                    <div className="flex gap-2 flex-wrap">
                        {PURPOSES.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPurpose(p.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${purpose === p.value
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-transparent text-text-main border-card-border/50 hover:border-indigo-300'
                                    }`}
                            >{p.label}</button>
                        ))}
                    </div>
                </div>

                {/* Items Table */}
                <div className="px-4 pb-3 space-y-2">
                    <div className="grid grid-cols-12 text-[10px] font-bold text-text-muted/70 uppercase tracking-wider mb-1 px-1">
                        <span className="col-span-5">Item</span>
                        <span className="col-span-3 text-center">Qty</span>
                        <span className="col-span-3 text-center">Price</span>
                        <span className="col-span-1"></span>
                    </div>
                    {batchItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                            <input
                                className="col-span-5 px-2 py-1.5 text-xs border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none font-medium"
                                value={item.product_name || item.name || ''}
                                onChange={e => handleItemChange(idx, 'product_name', e.target.value)}
                                placeholder="Product"
                            />
                            <div className="col-span-3 flex items-center gap-1">
                                <input
                                    className="w-full px-2 py-1.5 text-xs border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none font-medium text-center"
                                    type="number" min="0"
                                    value={item.quantity || ''}
                                    onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    placeholder="Qty"
                                />
                                <span className="text-[10px] text-text-muted font-bold w-6">{item.unit || 'pcs'}</span>
                            </div>
                            <input
                                className="col-span-3 px-2 py-1.5 text-xs border border-card-border/50 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none font-medium text-center"
                                type="number" min="0"
                                value={item.price || ''}
                                onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                placeholder="₹"
                            />
                            <button
                                onClick={() => setBatchItems(prev => prev.filter((_, i) => i !== idx))}
                                className="col-span-1 flex items-center justify-center text-text-muted/50 hover:text-red-400 transition-colors"
                            ><X size={14} /></button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-card-bg/40 border-t border-card-border/30 flex gap-3">
                    <button onClick={onDiscard} className="py-2 px-3 bg-bg-main/30 border border-card-border/50 text-text-main rounded-lg text-sm font-medium hover:bg-card-bg/40 transition-colors flex items-center gap-1.5">
                        <X size={15} /> Discard
                    </button>
                    <button
                        onClick={handleApproveAll}
                        disabled={batchItems.length === 0}
                        className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Check size={16} /> ✅ Approve All ({batchItems.length} items)
                    </button>
                </div>
            </div>
        );
    }

    // 7. BULK PRODUCT DRAFT CARD (Excel/CSV upload or Photo OCR)
    if (type === 'bulk_product_draft') {
        const [bulkItems, setBulkItems] = useState(localData.items || []);

        const handleBulkItemChange = (idx, field, val) => {
            const updated = [...bulkItems];
            updated[idx] = { ...updated[idx], [field]: val };
            setBulkItems(updated);
        };

        const handleApproveAll = () => {
            onApprove({ ...localData, type: 'bulk_product_draft', items: bulkItems });
        };

        return (
            <div className="glass-card rounded-[28px] border border-card-border/50 shadow-lg overflow-hidden w-full my-2">
                <div className="bg-gradient-to-r from-teal-600 to-emerald-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Layers size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Bulk Item Review</h3>
                        <p className="text-emerald-100 text-xs">{bulkItems.length} items found — please review details</p>
                    </div>
                </div>

                {/* Desktop/Tablet Table View */}
                <div className="hidden sm:block overflow-x-auto p-4 custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-card-border/50">
                                <th className="pb-2">Product Name</th>
                                <th className="pb-2 text-center w-20">Unit</th>
                                <th className="pb-2 text-center w-20">Cost (₹)</th>
                                <th className="pb-2 text-center w-20">Sell (₹)</th>
                                {businessProfile?.is_gst_registered && (
                                    <>
                                        <th className="pb-2 text-center w-16">Tax%</th>
                                        <th className="pb-2 text-center w-20">HSN</th>
                                    </>
                                )}
                                <th className="pb-2 text-center w-20">Stock</th>
                                <th className="pb-2 text-center w-24">Action</th>
                                <th className="pb-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border/30">
                            {bulkItems.map((item, idx) => (
                                <tr key={idx} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <td className="py-2 pr-2">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-medium text-text-main py-1"
                                            value={item.name || ''}
                                            onChange={e => handleBulkItemChange(idx, 'name', e.target.value)}
                                            placeholder="Item Name"
                                        />
                                    </td>
                                    <td className="py-2 px-1">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                            value={item.unit || ''}
                                            onChange={e => handleBulkItemChange(idx, 'unit', e.target.value)}
                                            placeholder="pcs"
                                        />
                                    </td>
                                    <td className="py-2 px-1">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                            type="number" min="0" step="0.01"
                                            value={item.cost_price || ''}
                                            onChange={e => handleBulkItemChange(idx, 'cost_price', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="py-2 px-1">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                            type="number" min="0" step="0.01"
                                            value={item.selling_price || ''}
                                            onChange={e => handleBulkItemChange(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    {businessProfile?.is_gst_registered && (
                                        <>
                                            <td className="py-2 px-1">
                                                <input
                                                    className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                                    type="number" min="0" max="100"
                                                    value={item.tax_percent || ''}
                                                    onChange={e => handleBulkItemChange(idx, 'tax_percent', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="py-2 px-1">
                                                <input
                                                    className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                                    value={item.hsn_code || ''}
                                                    onChange={e => handleBulkItemChange(idx, 'hsn_code', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
                                        </>
                                    )}
                                    <td className="py-2 px-1">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none text-center font-medium text-text-main py-1"
                                            type="number" min="0"
                                            value={item.stock_quantity || ''}
                                            onChange={e => handleBulkItemChange(idx, 'stock_quantity', parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.action === 'restock'
                                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                            }`}>
                                            {item.action === 'restock' ? 'Restock' : 'New'}
                                        </span>
                                    </td>
                                    <td className="py-2 pl-2 text-right">
                                        <button
                                            onClick={() => setBulkItems(prev => prev.filter((_, i) => i !== idx))}
                                            className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile List View */}
                <div className="sm:hidden p-3 flex flex-col gap-3">
                    {bulkItems.map((item, idx) => (
                        <div key={idx} className="bg-card-bg/50 border border-card-border/50 rounded-xl p-3 relative shadow-sm">
                            <button
                                onClick={() => setBulkItems(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 p-1 text-text-muted hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>

                            <div className="flex items-center gap-2 mb-2 pr-6">
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.action === 'restock' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'
                                    }`}>
                                    {item.action === 'restock' ? 'Restock' : 'New'}
                                </span>
                                <input
                                    className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-bold text-text-main py-0.5 text-sm"
                                    value={item.name || ''}
                                    onChange={e => handleBulkItemChange(idx, 'name', e.target.value)}
                                    placeholder="Product Name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-bold">Cost</span>
                                    <div className="flex items-center">
                                        <span className="text-text-muted/70 mr-1">₹</span>
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                            type="number" min="0" step="0.01"
                                            value={item.cost_price || ''}
                                            onChange={e => handleBulkItemChange(idx, 'cost_price', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-bold">Sell</span>
                                    <div className="flex items-center">
                                        <span className="text-text-muted/70 mr-1">₹</span>
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                            type="number" min="0" step="0.01"
                                            value={item.selling_price || ''}
                                            onChange={e => handleBulkItemChange(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-bold">Stock Qty</span>
                                    <input
                                        className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                        type="number" min="0"
                                        value={item.stock_quantity || ''}
                                        onChange={e => handleBulkItemChange(idx, 'stock_quantity', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-bold">Unit</span>
                                    <input
                                        className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                        value={item.unit || ''}
                                        onChange={e => handleBulkItemChange(idx, 'unit', e.target.value)}
                                        placeholder="pcs, kg, etc."
                                    />
                                </div>
                                {businessProfile?.is_gst_registered && (
                                    <>
                                        <div>
                                            <span className="text-[10px] text-text-muted uppercase font-bold">Tax %</span>
                                            <input
                                                className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                                type="number" min="0"
                                                value={item.tax_percent || ''}
                                                onChange={e => handleBulkItemChange(idx, 'tax_percent', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-text-muted uppercase font-bold">HSN Code</span>
                                            <input
                                                className="w-full bg-transparent border-b border-transparent focus:border-teal-500 outline-none font-semibold text-text-main py-0.5"
                                                value={item.hsn_code || ''}
                                                onChange={e => handleBulkItemChange(idx, 'hsn_code', e.target.value)}
                                                placeholder="HSN"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-card-bg/60 border-t border-card-border/30 flex gap-3 backdrop-blur-sm">
                    <button onClick={onDiscard} className="py-2.5 px-4 bg-bg-main/50 border border-card-border text-text-main rounded-xl text-sm font-semibold hover:bg-card-bg/80 transition-colors flex items-center justify-center gap-2">
                        <X size={16} /> Cancel
                    </button>
                    <button
                        onClick={handleApproveAll}
                        disabled={bulkItems.length === 0}
                        className="flex-1 py-2.5 px-4 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Check size={18} /> Finalize & Add All ({bulkItems.length})
                    </button>
                </div>
            </div>
        );
    }

    // 7. REPORT DRAFT CARD (Large lists/tables)
    if (type === 'report_draft') {
        const { title, headers, rows, summary } = localData;
        const safeTitle = String(title || 'report').trim();
        const safeHeaders = Array.isArray(headers) ? headers : [];
        const safeRows = Array.isArray(rows) ? rows : [];

        const csvEscape = (value) => {
            const text = String(value ?? '');
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };

        const getCsvContent = () => {
            const csvHeader = safeHeaders.map(csvEscape).join(',') + '\n';
            const csvRows = safeRows.map((row) => (Array.isArray(row) ? row : [row]).map(csvEscape).join(',')).join('\n');
            return csvHeader + csvRows;
        };

        const handleDownloadCSV = () => {
            try {
                const blob = new Blob([getCsvContent()], { type: 'text/csv;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('hidden', '');
                a.setAttribute('href', url);
                a.setAttribute('download', `${safeTitle.replace(/\s+/g, '_').toLowerCase()}_${new Date().getTime()}.csv`);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                console.error("CSV Download failed:", err);
            }
        };

        const handleDownloadSheet = () => {
            try {
                // Excel opens CSV cleanly and this gives a spreadsheet-friendly file directly.
                const blob = new Blob(["\ufeff" + getCsvContent()], { type: 'application/vnd.ms-excel;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('hidden', '');
                a.setAttribute('href', url);
                a.setAttribute('download', `${safeTitle.replace(/\s+/g, '_').toLowerCase()}_${new Date().getTime()}.xls`);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                console.error('Sheet Download failed:', err);
            }
        };

        const handleDownloadPDF = async () => {
            try {
                const { jsPDF } = await import('jspdf');
                const autoTable = (await import('jspdf-autotable')).default;
                const doc = new jsPDF({ orientation: 'landscape' });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(safeTitle || 'Report', 14, 16);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(summary || '', 14, 24, { maxWidth: 260 });

                autoTable(doc, {
                    startY: 32,
                    head: [safeHeaders],
                    body: safeRows.map((r) => (Array.isArray(r) ? r : [r]).map((c) => (c === null || c === undefined ? '-' : String(c)))),
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229] },
                    styles: { fontSize: 9 },
                });

                doc.save(`${safeTitle.replace(/\s+/g, '_').toLowerCase()}_${new Date().getTime()}.pdf`);
            } catch (err) {
                console.error('PDF Download failed:', err);
            }
        };

        const handleShare = async () => {
            const previewRows = safeRows.slice(0, 5).map((r) => (Array.isArray(r) ? r : [r]).join(' | ')).join('\n');
            const shareText = `${safeTitle}\n${summary || ''}\n\n${safeHeaders.join(' | ')}\n${previewRows}${safeRows.length > 5 ? '\n...and more' : ''}`;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: safeTitle,
                        text: shareText,
                        url: window.location.href
                    });
                } catch (err) {
                    console.log("Share failed:", err);
                }
            } else {
                // Fallback: Copy to clipboard
                navigator.clipboard.writeText(shareText);
                alert("Report summary copied to clipboard!");
            }
        };

        return (
            <div className="glass-card rounded-[28px] overflow-hidden w-full max-w-md md:max-w-2xl mx-auto my-4 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                            <List size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base tracking-tight leading-none">{title || 'Data Report'}</h3>
                            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-1">Generated by Sathi AI</p>
                        </div>
                    </div>
                    <button 
                        onClick={onDiscard}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        title="Close Report"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-0 bg-card-bg">
                    {/* Summary Bar */}
                    <div className="px-5 py-3 bg-indigo-500/5 border-b border-card-border/30">
                        <p className="text-sm font-semibold text-text-main leading-relaxed">
                            {summary}
                        </p>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-bg-main/50 border-b border-card-border/50">
                                    {safeHeaders.map((h, i) => (
                                        <th key={i} className="px-5 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {safeRows.map((row, i) => (
                                    <tr key={i} className="border-b border-card-border/10 hover:bg-indigo-500/5 transition-colors">
                                        {(Array.isArray(row) ? row : [row]).map((cell, j) => (
                                            <td key={j} className="px-5 py-3.5 text-sm font-medium text-text-main whitespace-nowrap">
                                                {cell === null || cell === undefined ? '-' : String(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-bg-main/30 border-t border-card-border/30 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleDownloadCSV}
                            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download CSV
                        </button>
                        <button
                            onClick={handleDownloadSheet}
                            className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download Sheet
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download PDF
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex-1 py-3 px-4 bg-white border border-card-border text-text-main rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-card-bg transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Share size={16} /> Share Report
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;

};

export default ActionCard;

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, ArrowLeft, Volume2, VolumeX, Plus, FileSpreadsheet, Camera } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import ActionCard from '../components/ActionCard';
import { supabase } from '../lib/supabase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const Chat = () => {
    const {
        messages,
        setMessages,
        sendMessage,
        sendImage,
        sendExcel,
        startRecording,
        stopRecording,
        isListening,
        isThinking,
        isMuted,
        toggleMute,
        unlockAudio,
        isPlaying,
        model,
        pendingAttachment,
        setPendingAttachment
    } = useChat();
    const [input, setInput] = useState('');
    const [businessProfile, setBusinessProfile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const timerRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // UI State for Attachment Menu
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const menuRef = useRef(null);
    const isOnline = useOnlineStatus();
    const [localAIReady, setLocalAIReady] = useState(false);
    const autoRecordRef = useRef(false);

    // Auto-start recording if navigated from BottomNav
    useEffect(() => {
        if (location.state?.autoStartRecord && !autoRecordRef.current) {
            autoRecordRef.current = true;
            // Clear the state so it doesn't re-trigger on refresh
            window.history.replaceState({}, document.title);

            // If the user's finger is still exactly on the push-to-talk button
            if (window.__isMicHeld) {
                startRecording();
            }
        }
    }, [location.state, startRecording]);

    // Note: BottomNav is hidden on /chat page (see MainLayout.jsx), so no nav-mic
    // global events are needed here. The in-page mic button handles everything.

    // Check Local AI availability
    useEffect(() => {
        const checkLocalAI = async () => {
            try {
                const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
                const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
                const res = await fetch(`${API_URL}/api/setup/local-models`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.models && data.models.length > 0) {
                        setLocalAIReady(true);
                    }
                }
            } catch (e) {
                console.warn("Local AI check failed:", e);
            }
        };
        checkLocalAI();
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fetch Business Profile on Mount (skip in demo/guest mode)
    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) setBusinessProfile(data);
            }
        };
        fetchProfile();
    }, []);

    // Unlock Audio Context on First User Interaction
    useEffect(() => {
        const handleUnlock = () => {
            unlockAudio();
            window.removeEventListener('touchstart', handleUnlock);
            window.removeEventListener('click', handleUnlock);
        };

        window.addEventListener('touchstart', handleUnlock);
        window.addEventListener('click', handleUnlock);

        return () => {
            window.removeEventListener('touchstart', handleUnlock);
            window.removeEventListener('click', handleUnlock);
        };
    }, [unlockAudio]);

    const handleSend = () => {
        if (!input.trim() && !pendingAttachment) return;
        sendMessage(input, pendingAttachment);
        setInput('');
    };

    const handleApproveAction = async (actionData) => {
        console.log('🚀 Approving Action:', actionData);
        const API_URL = (import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

        // Use a unified type variable for easier matching
        const actionType = actionData.type || actionData.draft_type;

        // ── OFFLINE / LOCAL AI MODE (FALLBACK) ────────────────────────────────
        if (!isOnline && localAIReady) {
            try {
                if (actionType === 'product' || actionType === 'product_draft') {
                    const res = await fetch(`${API_URL}/api/local/products`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: actionData.name,
                            selling_price: actionData.selling_price,
                            cost_price: actionData.cost_price || 0,
                            stock_quantity: actionData.stock_quantity,
                            category: actionData.category || 'General',
                            unit: actionData.unit || 'pcs'
                        })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        { type: 'bot', text: `✅ Product Saved Locally!\n\n📦 ${actionData.name}\n💰 Price: ₹${actionData.selling_price}\n📊 Stock: ${actionData.stock_quantity}` }
                    ]);
                    return;
                }

                if (actionType === 'customer' || actionType === 'customer_draft') {
                    const res = await fetch(`${API_URL}/api/local/customers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: actionData.name,
                            phone: actionData.phone || null,
                            address: actionData.address || null
                        })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        { type: 'bot', text: `✅ Customer Saved Locally!\n\n👤 ${actionData.name}\n📞 ${actionData.phone || 'No Phone'}\n📍 ${actionData.address || 'No Address'}` }
                    ]);
                    return;
                }

                if (actionType === 'invoice' || actionType === 'invoice_draft') {
                    // Calculate totals from items
                    const items = actionData.items || [];
                    const totalAmount = actionData.total_amount ||
                        items.reduce((sum, item) => sum + ((item.price || item.unit_price || 0) * (item.quantity || 1)), 0);

                    const res = await fetch(`${API_URL}/api/local/sales`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customer_name: actionData.customer_name || 'Walk-in Customer',
                            items: items,
                            total_amount: totalAmount,
                            payment_method: actionData.payment_method || 'cash',
                            payment_status: totalAmount > 0 ? 'paid' : 'credit',
                            amount_paid: totalAmount,
                        })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const result = await res.json();
                    const itemsSummary = items.map(i =>
                        `• ${i.product_name || i.name} × ${i.quantity} = ₹${((i.price || i.unit_price || 0) * (i.quantity || 1)).toFixed(2)}`
                    ).join('\n');
                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        {
                            type: 'bot',
                            text: `✅ Bill #${result.id} Saved Locally!\n\n👤 ${actionData.customer_name || 'Walk-in Customer'}\n${itemsSummary}\n\n💰 Total: ₹${totalAmount.toFixed(2)}\n📦 Saved to your offline store.`
                        }
                    ]);
                    return;
                }

                if (actionType === 'payment' || actionType === 'payment_draft') {
                    const res = await fetch(`${API_URL}/api/local/payments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customer_name: actionData.customer_name,
                            amount: actionData.amount,
                            payment_type: actionData.payment_type || 'payment',
                            mode: actionData.mode || 'Cash',
                            note: actionData.note || ''
                        })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const result = await res.json();

                    const isCredit = (actionData.payment_type || 'payment') === 'credit';
                    const emoji = isCredit ? '🔴' : '🟢';
                    const label = isCredit ? 'Due Added' : 'Payment Received';
                    const newBalance = result.new_balance;
                    const balanceMsg = newBalance !== null && newBalance !== undefined
                        ? `\nNew Due Balance: ₹${parseFloat(newBalance).toFixed(2)}`
                        : '';

                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        {
                            type: 'bot',
                            text: `${emoji} ${label} Saved!\n\n👤 ${actionData.customer_name}\n💰 ₹${actionData.amount}\n💳 Mode: ${actionData.mode || 'Cash'}${balanceMsg}\n📦 Saved to your offline store.`
                        }
                    ]);
                    return;
                }

                if (actionType === 'restock' || actionType === 'restock_draft') {
                    const res = await fetch(`${API_URL}/api/local/restock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            product_id: actionData.product_id || null,
                            product_name: actionData.product_name,
                            quantity_to_add: actionData.quantity_to_add
                        })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const result = await res.json();
                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        {
                            type: 'bot',
                            text: `✅ Restocked Locally!\n\n📦 ${result.product?.name || actionData.product_name}\n+${actionData.quantity_to_add} units added to stock.\nNew Stock: ${result.product?.stock_quantity || 'Updated'}`
                        }
                    ]);
                    return;
                }

                // Other draft types not yet supported in local mode
                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: `⚠️ This action requires an internet connection for full processing.`
                }]);
                return;

            } catch (err) {
                console.error('Local save error:', err);
                setMessages(prev => [...prev, { type: 'bot', text: `❌ Failed to save locally: ${err.message}` }]);
                return;
            }
        }

        // ── ONLINE / SUPABASE MODE ────────────────────────────────────────────
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Please login first");

            // 1. INVOICE CREATION
            if (actionData.type === 'invoice_draft') {
                // Find or Create Customer
                let customerId = null;
                if (actionData.customer_name) {
                    // Try fuzzy match first, then exact ilike
                    let cust = null;
                    try {
                        const { data: fuzzyCust } = await supabase.rpc('fuzzy_match_customer', {
                            query: actionData.customer_name.trim(),
                            uid: user.id
                        });
                        if (fuzzyCust && fuzzyCust.length > 0) cust = { id: fuzzyCust[0].id };
                    } catch (_) {
                        // RPC not yet available — fall back to ilike
                        const { data: ilikeCust } = await supabase.from('customers')
                            .select('id').ilike('name', actionData.customer_name.trim()).eq('user_id', user.id).maybeSingle();
                        cust = ilikeCust;
                    }

                    if (cust) {
                        customerId = cust.id;
                    } else {
                        // AUTO-CREATE CUSTOMER
                        const { data: newCust, error: createError } = await supabase.from('customers').insert({
                            user_id: user.id,
                            name: actionData.customer_name.trim(),
                            phone: null,
                            address: null
                        }).select('id').single();
                        if (!createError && newCust) customerId = newCust.id;
                    }
                }

                // Tax-aware Grand Total calculation
                let grandTotal = 0;
                let totalSubtotal = 0;
                let totalTax = 0;

                const enrichedItems = await Promise.all(actionData.items.map(async (item) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const rate = parseFloat(item.price) || 0;
                    const taxPct = parseFloat(item.tax_percent) || 0;
                    const taxAmt = (qty * rate * taxPct) / 100;
                    const lineTotal = qty * rate + taxAmt;
                    totalSubtotal += qty * rate;
                    totalTax += taxAmt;
                    grandTotal += lineTotal;

                    // Find product_id via fuzzy RPC (with ilike fallback)
                    let prodId = null;
                    try {
                        const { data: fp } = await supabase.rpc('fuzzy_match_product', {
                            query: item.product_name,
                            uid: user.id
                        });
                        if (fp && fp.length > 0) prodId = fp[0].id;
                    } catch (_) {
                        const { data: ilp } = await supabase.from('products')
                            .select('id').ilike('name', `%${item.product_name}%`).eq('user_id', user.id).limit(1);
                        if (ilp && ilp.length > 0) prodId = ilp[0].id;
                    }

                    return { ...item, product_id: prodId, line_total: lineTotal };
                }));

                // Create Sale Header
                const { data: sale, error: saleError } = await supabase.from('sales').insert({
                    user_id: user.id,
                    customer_id: customerId,
                    invoice_type: businessProfile?.is_gst_registered ? 'gst' : 'regular',
                    subtotal: totalSubtotal,
                    total_tax_amount: totalTax,
                    total_amount: grandTotal,
                    payment_status: 'paid',
                    created_at: new Date()
                }).select().single();

                if (saleError) throw saleError;

                // Create Sale Items & Decrement Stock
                for (const item of enrichedItems) {
                    await supabase.from('sale_items').insert({
                        user_id: user.id,
                        sale_id: sale.id,
                        product_id: item.product_id || null,
                        quantity: item.quantity,
                        unit_price: item.price || 0,
                        total_price: item.line_total
                    });
                    // Decrement stock only if product was found
                    if (item.product_id) {
                        await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.quantity });
                    }
                }

                setMessages(prev => [
                    ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                    { type: 'bot', text: `✅ Invoice Created! Total: ₹${grandTotal.toFixed(2)}` }
                ]);
            }

            // 2. PRODUCT CREATION
            if (actionData.type === 'product_draft') {
                try {
                    // Check if exact product exists (case insensitive)
                    const { data: existingProd, error: findErr } = await supabase.from('products')
                        .select('*')
                        .ilike('name', actionData.name)
                        .eq('user_id', user.id)
                        .limit(1)
                        .maybeSingle();

                    if (existingProd) {
                        // Product exists, so we treat it as a Restock / Update
                        const addedQty = parseInt(actionData.stock_quantity) || 0;
                        const newStock = parseInt(existingProd.stock_quantity || 0) + addedQty;

                        const { error } = await supabase.from('products').update({
                            selling_price: actionData.selling_price || existingProd.selling_price,
                            cost_price: actionData.cost_price || existingProd.cost_price,
                            stock_quantity: newStock,
                            category: actionData.category || existingProd.category,
                            unit: actionData.unit || existingProd.unit
                        }).eq('id', existingProd.id);
                        if (error) throw error;

                        setMessages(prev => [
                            ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                            {
                                type: 'bot',
                                text: `✅ Product Restocked & Updated!\n\n📦 ${existingProd.name}\n💰 Price: ₹${actionData.selling_price || existingProd.selling_price}\n📈 Added: +${addedQty}\n📊 New Total Stock: ${newStock}`
                            }
                        ]);
                    } else {
                        // Insert new product
                        const { error } = await supabase.from('products').insert({
                            user_id: user.id,
                            name: actionData.name,
                            selling_price: actionData.selling_price,
                            cost_price: actionData.cost_price || 0,
                            stock_quantity: actionData.stock_quantity,
                            category: actionData.category || 'General',
                            unit: actionData.unit || 'pcs'
                        });
                        if (error) throw error;

                        setMessages(prev => [
                            ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                            {
                                type: 'bot',
                                text: `✅ Product Added!\n\n📦 ${actionData.name}\n💰 Price: ₹${actionData.selling_price}\n📊 Stock: ${actionData.stock_quantity}`
                            }
                        ]);
                    }
                } catch (err) {
                    throw err; // Let outer error handler catch it
                }
            }

            // 3. PAYMENT RECORDING
            if (actionData.type === 'payment_draft') {
                try {
                    // Fuzzy match customer — RPC first, ilike fallback
                    let customer = null;
                    try {
                        const { data: fuzzyRes } = await supabase.rpc('fuzzy_match_customer', {
                            query: actionData.customer_name,
                            uid: user.id
                        });
                        if (fuzzyRes && fuzzyRes.length > 0) customer = fuzzyRes[0];
                    } catch (_) {
                        const { data: customers } = await supabase
                            .from('customers').select('id, name, credit_balance')
                            .ilike('name', `%${actionData.customer_name}%`).eq('user_id', user.id).limit(1);
                        if (customers && customers.length > 0) customer = customers[0];
                    }

                    if (!customer) {
                        alert(`Customer "${actionData.customer_name}" not found!`);
                        return;
                    }

                    const amount = Math.abs(parseFloat(actionData.amount) || 0);
                    const isPayment = actionData.payment_type === 'payment';
                    const oldBalance = parseFloat(customer.credit_balance) || 0;

                    // 1. Update Customer Balance via RPC
                    let newBalance = oldBalance;

                    if (isPayment) {
                        const { data: updatedBalance, error: updateError } = await supabase.rpc('receive_payment', {
                            p_user_id: user.id,
                            p_customer_id: customer.id,
                            p_amount: amount
                        });
                        if (updateError) throw updateError;
                        newBalance = updatedBalance;
                    } else {
                        const { data: updatedBalance, error: updateError } = await supabase.rpc('add_customer_credit', {
                            p_user_id: user.id,
                            p_customer_id: customer.id,
                            p_amount: amount
                        });
                        if (updateError) throw updateError;
                        newBalance = updatedBalance;
                    }

                    // 2. Insert Ledger Record (history)
                    try {
                        await supabase.from('customer_ledger').insert({
                            user_id: user.id,
                            customer_id: customer.id,
                            amount,
                            type: isPayment ? 'payment' : 'credit',
                            mode: actionData.mode || 'Cash',
                            note: `${isPayment ? 'Payment received' : 'Credit given'} via AI`
                        });
                    } catch (ledgerErr) {
                        console.warn('Ledger insert failed (table may not exist yet):', ledgerErr);
                    }

                    const action = isPayment ? '✅ Payment Received!' : '📋 Credit Added!';
                    const balanceMsg = newBalance === 0 ? '₹0 (Cleared!)' : `₹${newBalance.toFixed(2)}`;
                    setMessages(prev => [...prev, {
                        type: 'bot',
                        text: `${action}\n\n${isPayment ? 'Received' : 'Added'}: ₹${amount}\nCustomer: ${customer.name}\nPrevious Due: ₹${oldBalance.toFixed(2)}\nNew Due Balance: ${balanceMsg}\nMode: ${actionData.mode}`
                    }]);

                } catch (err) {
                    console.error("Payment Error:", err);
                    alert("Failed to record payment. Please try again.");
                }
                return;
            }

            // 4. CUSTOMER CREATION
            if (actionData.type === 'customer_draft') {
                const { error } = await supabase.from('customers').insert({
                    user_id: user.id,
                    name: actionData.name,
                    phone: actionData.phone,
                    address: actionData.address
                });
                if (error) {
                    alert("Failed to add customer: " + error.message);
                    return;
                }
                setMessages(prev => [
                    ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                    { type: 'bot', text: `✅ Customer Added!\n\n👤 ${actionData.name}\n📞 ${actionData.phone || 'No Phone'}\n📍 ${actionData.address || 'No Address'}` }
                ]);
            }

            // 5. RESTOCK
            if (actionData.type === 'restock_draft') {
                try {
                    // Find product via fuzzy match
                    let prodId = null;
                    let prodName = actionData.product_name;
                    try {
                        const { data: fp } = await supabase.rpc('fuzzy_match_product', {
                            query: actionData.product_name,
                            uid: user.id
                        });
                        if (fp && fp.length > 0) { prodId = fp[0].id; prodName = fp[0].name; }
                    } catch (_) {
                        const { data: ilp } = await supabase.from('products')
                            .select('id, name').ilike('name', `%${actionData.product_name}%`).eq('user_id', user.id).limit(1);
                        if (ilp && ilp.length > 0) { prodId = ilp[0].id; prodName = ilp[0].name; }
                    }

                    if (!prodId) {
                        alert(`Product "${actionData.product_name}" not found! Please add it first.`);
                        return;
                    }

                    await supabase.rpc('increment_stock', { p_id: prodId, qty: actionData.quantity_to_add });

                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        { type: 'bot', text: `✅ Restocked!\n\n📦 ${prodName}\n+${actionData.quantity_to_add} units added to stock.` }
                    ]);
                } catch (err) {
                    console.error('Restock error:', err);
                    alert('Failed to restock: ' + err.message);
                }
            }

            // 6. BULK PRODUCT DRAFT (Image/Excel OCR result)
            if (actionData.type === 'bulk_product_draft') {
                try {
                    const items = actionData.items || [];
                    if (items.length === 0) {
                        alert('No items to process!');
                        return;
                    }

                    let added = 0, restocked = 0, failed = 0;

                    // Process each item — check if exists then insert or restock
                    for (const item of items) {
                        try {
                            const name = (item.name || '').trim();
                            if (!name) { failed++; continue; }

                            // Check if product already exists (case-insensitive)
                            const { data: existing } = await supabase
                                .from('products')
                                .select('id, stock_quantity')
                                .ilike('name', name)
                                .eq('user_id', user.id)
                                .limit(1)
                                .maybeSingle();

                            if (existing) {
                                // Restock existing product
                                const newStock = parseInt(existing.stock_quantity || 0) + parseInt(item.stock_quantity || 0);
                                await supabase.from('products').update({
                                    selling_price: item.selling_price || 0,
                                    cost_price: item.cost_price || 0,
                                    stock_quantity: newStock,
                                    category: item.category || 'General',
                                    unit: item.unit || 'pcs'
                                }).eq('id', existing.id);
                                restocked++;
                            } else {
                                // Add new product
                                const { error } = await supabase.from('products').insert({
                                    user_id: user.id,
                                    name,
                                    selling_price: item.selling_price || 0,
                                    cost_price: item.cost_price || 0,
                                    stock_quantity: item.stock_quantity || 0,
                                    category: item.category || 'General',
                                    unit: item.unit || 'pcs'
                                });
                                if (error) throw error;
                                added++;
                            }
                        } catch (itemErr) {
                            console.warn('Failed to process item:', item.name, itemErr);
                            failed++;
                        }
                    }

                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        {
                            type: 'bot',
                            text: `✅ Bulk Import Done!\n\n📦 ${added} new products added\n🔄 ${restocked} products restocked${failed > 0 ? `\n⚠️ ${failed} items skipped` : ''}\n\nCheck your Inventory to verify!`
                        }
                    ]);
                } catch (err) {
                    console.error('Bulk approval error:', err);
                    alert('Failed to process bulk items: ' + err.message);
                }
                return;
            }

        } catch (error) {
            console.error("Action Error:", error);
            alert("Failed to execute action: " + error.message);
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-bg-main overflow-hidden z-50">
            {/* Ambient Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header (Top) */}
            <header className="flex-none flex items-center gap-2 p-2 px-3 md:px-4 md:py-3 bg-bg-main/80 backdrop-blur-xl border-b border-card-border/30 z-20 sticky top-0 shrink-0">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-card-bg/80 hover:text-indigo-500 transition-colors shrink-0 md:hidden">
                    <ArrowLeft size={20} />
                </button>

                {/* Slim Pill Header */}
                <div className="flex items-center gap-2 md:gap-2.5 bg-card-bg/60 border border-card-border/50 py-1.5 md:py-2 px-3 md:px-4 rounded-full shadow-sm max-w-fit backdrop-blur-md">
                    <img src="/src/assets/logo.svg" alt="DukanSathi" className="w-5 h-5 md:w-6 md:h-6 object-contain md:hidden" />
                    <h2 className="font-heading font-bold text-sm md:text-base text-text-main whitespace-nowrap md:hidden">Dukan Sathi AI</h2>
                    <div className="w-[1px] h-3.5 md:h-4 bg-card-border/80 mx-0.5 md:mx-1 md:hidden"></div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${model === 'phi3:mini' || localAIReady ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : (isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500')} transition-all duration-300`}></div>
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-text-muted mt-[1px]">
                            {model === 'phi3:mini' ? 'Local Compute' : (isOnline ? 'Cloud AI' : 'Offline')}
                        </span>
                    </div>
                </div>
            </header>

            {/* Messages Area (Middle - stretches to fill) */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 z-10 scrollbar-hide relative">
                {messages.map((msg, idx) => {
                    const hasAttachment = msg.attachment && Object.keys(msg.attachment).length > 0;
                    const isUser = msg.type === 'user' || msg.type === 'user-audio';

                    return (
                        <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className={`
                                max-w-[90%] md:max-w-[75%] px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed relative group shadow-sm
                                ${isUser
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'glass-card border border-card-border/50 text-text-main rounded-bl-sm'}
                            `}>
                                {/* Waveform animation for talking */}
                                {msg.text === '🎤 ...' ? (
                                    <div className="flex items-center gap-1.5 h-6">
                                        <div className="w-1.5 bg-current opacity-80 rounded-full h-3 animate-[voice-wave_1s_ease-in-out_infinite]" />
                                        <div className="w-1.5 bg-current opacity-80 rounded-full h-5 animate-[voice-wave_1s_ease-in-out_infinite_100ms]" />
                                        <div className="w-1.5 bg-current opacity-80 rounded-full h-4 animate-[voice-wave_1s_ease-in-out_infinite_200ms]" />
                                        <div className="w-1.5 bg-current opacity-80 rounded-full h-6 animate-[voice-wave_1s_ease-in-out_infinite_300ms]" />
                                        <div className="w-1.5 bg-current opacity-80 rounded-full h-3 animate-[voice-wave_1s_ease-in-out_infinite_400ms]" />
                                    </div>
                                ) : (
                                    <p className={`whitespace-pre-wrap font-medium ${isUser ? 'text-white' : 'text-text-main'}`}>{msg.text}</p>
                                )}

                                {msg.image && (
                                    <div className="mt-2 rounded-xl overflow-hidden shadow-sm">
                                        <img src={msg.image} alt="Attachment" className="w-full object-cover max-h-60" />
                                    </div>
                                )}
                            </div>

                            {/* Timestamp */}
                            <span className="text-[10px] text-text-muted mt-1 px-2 opacity-70 font-medium">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            {/* Attachments (e.g., Invoices, Approvals) */}
                            {hasAttachment && (
                                <div className={`mt-3 w-full animate-in slide-in-from-bottom-2 ${msg.attachment?.draft_type === 'bulk_product' || msg.attachment?.type === 'bulk_product_draft'
                                    ? 'max-w-full'
                                    : 'max-w-[95%] sm:max-w-md md:max-w-xl lg:max-w-2xl'
                                    }`}>
                                    <ActionCard
                                        actionData={msg.attachment}
                                        onDiscard={() => setMessages(prev => prev.map((m, i) => i === idx ? { ...m, attachment: null } : m))}
                                        onApprove={(editedData) => handleApproveAction(editedData)}
                                        businessProfile={businessProfile}
                                    />
                                </div>
                            )}

                            {/* Visual Scan Prompt */}
                            {msg.isImagePrompt && msg.image_url && (
                                <div className="mt-3 glass-card rounded-2xl overflow-hidden border border-indigo-500/20 max-w-[80%] shadow-lg shadow-indigo-500/10">
                                    <img src={msg.image_url} alt="Uploaded" className="w-full object-cover max-h-48" />
                                    <div className="p-3 bg-indigo-500/10 flex items-center justify-center gap-2">
                                        <Mic size={14} className="text-indigo-500 animate-pulse" />
                                        <span className="text-xs font-bold text-indigo-500">Tap Mic to describe this image</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Thinking / Playing Indicators */}
                {(isThinking || isPlaying) && (
                    <div className="flex justify-start animate-in fade-in zoom-in duration-300">
                        <div className="glass-card rounded-3xl rounded-bl-sm px-5 py-4 border border-card-border/50 text-text-muted text-sm flex items-center gap-3">
                            {isThinking ? (
                                <>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></div>
                                    </div>
                                    <span className="font-medium animate-pulse">Thinking...</span>
                                </>
                            ) : (
                                <>
                                    <Volume2 size={16} className="text-indigo-500 animate-pulse" />
                                    <span className="font-medium">Speaking...</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-6" />
                {/* Spacer for fixed footer */}
                <div className="h-20 shrink-0" />
            </main>

            {/* Input Bar (Bottom - firmly locked) */}
            <footer className="fixed bottom-0 left-0 right-0 md:left-64 bg-bg-main/95 backdrop-blur-xl border-t border-card-border/50 z-50">
                <div className="p-2 px-3 md:p-3 md:px-4 w-full flex items-end gap-2 max-w-5xl mx-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">

                    {/* Prefix Icons */}
                    <div className="flex items-center gap-1 shrink-0 pb-1 relative">
                        {/* Attachment Menu Popover */}
                        {showAttachmentMenu && (
                            <div
                                ref={menuRef}
                                className="absolute bottom-[110%] left-0 mb-2 w-48 bg-card-bg rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-card-border overflow-hidden transform transition-all origin-bottom-left z-50 py-1"
                            >
                                <button
                                    onClick={() => {
                                        cameraInputRef.current?.click();
                                        setShowAttachmentMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                        <Camera className="w-4 h-4" />
                                    </div>
                                    <span>Take Photo</span>
                                </button>
                                <button
                                    onClick={() => {
                                        fileInputRef.current?.click();
                                        setShowAttachmentMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                        <ImageIcon className="w-4 h-4" />
                                    </div>
                                    <span>Upload Image</span>
                                </button>
                                <button
                                    onClick={() => {
                                        excelInputRef.current?.click();
                                        setShowAttachmentMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                        <FileSpreadsheet className="w-4 h-4" />
                                    </div>
                                    <span>Upload Excel/CSV</span>
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showAttachmentMenu
                                ? 'bg-indigo-500/10 text-indigo-500'
                                : 'text-text-muted hover:bg-card-bg/80 hover:text-indigo-500'
                                }`}
                            title="Attach File"
                        >
                            <Plus size={20} strokeWidth={1.5} className={`transition-transform duration-200 ${showAttachmentMenu ? 'rotate-45' : ''}`} />
                        </button>
                        <button
                            onClick={toggleMute}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-text-muted hover:bg-card-bg/80 hover:text-indigo-500'}`}
                        >
                            {isMuted ? <VolumeX size={20} strokeWidth={1.5} /> : <Volume2 size={20} strokeWidth={1.5} />}
                        </button>
                    </div>

                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={cameraInputRef}
                        onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])}
                    />
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        ref={excelInputRef}
                        onChange={(e) => e.target.files[0] && sendExcel(e.target.files[0])}
                    />

                    {/* Text Field & Preview Container */}
                    <div className="flex-1 flex flex-col justify-end bg-card-bg/50 border border-card-border rounded-3xl pb-0 shadow-sm overflow-hidden transition-all duration-300">
                        {/* Attachment Preview Area */}
                        {pendingAttachment && (
                            <div className="px-3 pt-3 pb-1 flex items-center gap-2 max-w-full">
                                <div className="relative group bg-black/10 dark:bg-white/10 rounded-xl p-1.5 flex items-center gap-3 pr-4 border border-card-border">
                                    {pendingAttachment.type === 'image' ? (
                                        <img src={pendingAttachment.previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
                                    ) : (
                                        <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-text-main truncate max-w-[120px] md:max-w-[200px]">
                                            {pendingAttachment.file.name}
                                        </p>
                                        <p className="text-[10px] text-text-muted mt-0.5">
                                            {(pendingAttachment.file.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPendingAttachment(null)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                    >
                                        <Plus size={14} className="rotate-45" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (isOnline || localAIReady) handleSend();
                                }
                            }}
                            placeholder={isOnline ? "Message Dukan Sathi..." : "Offline. Using Local AI..."}
                            disabled={!isOnline && !localAIReady}
                            className="w-full bg-transparent text-text-main text-sm md:text-base placeholder-text-muted px-4 py-2.5 md:py-3 focus:outline-none resize-none overflow-hidden min-h-[44px] max-h-[120px] rounded-3xl"
                            rows={1}
                            style={{ height: input ? 'auto' : '44px' }}
                        />
                    </div>

                    {/* Submit / Mic Button */}
                    <div className="shrink-0 pb-0.5">
                        {input.trim() || pendingAttachment ? (
                            <button
                                onClick={handleSend}
                                className="w-[42px] h-[42px] rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-transform active:scale-95"
                            >
                                <Send size={18} className="translate-x-[2px]" />
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (isListening) stopRecording();
                                    else startRecording();
                                }}
                                className={`w-[42px] h-[42px] rounded-full shadow-lg flex items-center justify-center transition-all ${isListening
                                    ? 'bg-red-500 text-white shadow-red-500/40 scale-105 animate-pulse'
                                    : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-500 active:scale-95'
                                    }`}
                            >
                                <Mic size={18} />
                            </button>
                        )}
                    </div>

                </div>
            </footer>
        </div>
    );
};

export default Chat;

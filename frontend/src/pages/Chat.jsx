import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, ArrowLeft, Volume2, VolumeX } from 'lucide-react';
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
        startRecording,
        stopRecording,
        isListening,
        isThinking,
        isMuted,
        toggleMute,
        unlockAudio,
        isPlaying,
        model
    } = useChat();
    const [input, setInput] = useState('');
    const [businessProfile, setBusinessProfile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const timerRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
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

    // Global event listeners for Push-to-Talk from BottomNav
    useEffect(() => {
        const handleMicPress = () => {
            if (!isListening) {
                startRecording();
            }
        };

        const handleMicRelease = () => {
            if (isListening) {
                stopRecording();
            }
        };

        window.addEventListener('nav-mic-press', handleMicPress);
        window.addEventListener('nav-mic-release', handleMicRelease);

        return () => {
            window.removeEventListener('nav-mic-press', handleMicPress);
            window.removeEventListener('nav-mic-release', handleMicRelease);
        };
    }, [isListening, startRecording, stopRecording]);

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
        if (!input.trim()) return;
        sendMessage(input);
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
                            category: actionData.category || 'General'
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
                const { error } = await supabase.from('products').insert({
                    user_id: user.id,
                    name: actionData.name,
                    selling_price: actionData.selling_price,
                    cost_price: actionData.cost_price || 0,
                    stock_quantity: actionData.stock_quantity,
                    category: actionData.category || 'General'
                });
                if (error) throw error;

                setMessages(prev => [
                    // Remove the ActionCard (attachment) from the last AI message
                    ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                    {
                        type: 'bot',
                        text: `✅ Product Added!\n\n📦 ${actionData.name}\n💰 Price: ₹${actionData.selling_price}\n📊 Stock: ${actionData.stock_quantity}`
                    }
                ]);
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

        } catch (error) {
            console.error("Action Error:", error);
            alert("Failed to execute action: " + error.message);
        }
    };

    return (
        <div className="fixed inset-0 md:left-64 flex flex-col bg-bg-main z-50 overflow-hidden min-h-0 overflow-y-clip"> {/* Force clip and absolute fixed bounds to bypass MainLayout margins */}
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Chat Header - Ultra Slim & Sticky */}
            <div className="flex items-center gap-2 p-1.5 sticky top-0 z-30 bg-bg-main/80 backdrop-blur-xl border-b border-card-border/30 transition-all">
                <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg bg-card-bg/40 backdrop-blur-xl border border-card-border flex items-center justify-center text-text-muted hover:text-indigo-500 hover:border-indigo-500/50 transition-all active:scale-95 shadow-sm">
                    <ArrowLeft size={16} />
                </button>
                <div className="flex flex-row items-center gap-3 px-1">
                    <h2 className="font-heading font-black text-lg text-text-main tracking-tight leading-none transition-colors">Dukan Sathi AI</h2>
                    <div className="flex items-center gap-1.5 h-full pt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${model === 'phi3:mini' || localAIReady ? 'bg-amber-500' : (isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} transition-all`}></div>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em] leading-none transition-colors">
                            {model === 'phi3:mini' ? 'Local' : (isOnline ? 'Cloud' : 'Offline')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide relative z-10 pb-0">
                {messages.map((msg, idx) => {
                    const hasAttachment = msg.attachment && Object.keys(msg.attachment).length > 0;
                    const isUser = msg.type === 'user' || msg.type === 'user-audio';

                    return (
                        <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className={`
                                max-w-[95%] md:max-w-[85%] rounded-[28px] px-5 py-3 shadow-xl text-sm leading-relaxed overflow-hidden relative group
                                ${isUser
                                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20'
                                    : 'glass-card text-text-main rounded-tl-none border border-card-border/50 transition-colors'}
                            `}>
                                {/* Inner Glow for User Messages */}
                                {isUser && <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />}

                                {msg.image && (
                                    <div className="rounded-2xl overflow-hidden mb-3 border border-white/10 group-hover:scale-[1.02] transition-transform">
                                        <img src={msg.image} alt="Attachment" className="w-full object-cover" />
                                    </div>
                                )}

                                {msg.text === '🎤 ...' ? (
                                    <div className="flex items-center gap-2 h-6 px-2">
                                        <div className="w-1.5 bg-white/80 rounded-full h-3 animate-[voice-wave_1s_ease-in-out_infinite]" />
                                        <div className="w-1.5 bg-white/80 rounded-full h-5 animate-[voice-wave_1s_ease-in-out_infinite_100ms]" />
                                        <div className="w-1.5 bg-white/80 rounded-full h-4 animate-[voice-wave_1s_ease-in-out_infinite_200ms]" />
                                        <div className="w-1.5 bg-white/80 rounded-full h-6 animate-[voice-wave_1s_ease-in-out_infinite_300ms]" />
                                        <div className="w-1.5 bg-white/80 rounded-full h-3 animate-[voice-wave_1s_ease-in-out_infinite_400ms]" />
                                    </div>
                                ) : (
                                    <p className={`whitespace-pre-wrap font-bold ${isUser ? 'text-white' : 'text-text-main'}`}>{msg.text}</p>
                                )}

                                {/* Timestamp/Meta if needed can go here */}
                                <div className={`text-[9px] mt-1.5 opacity-40 font-black uppercase tracking-tighter ${isUser ? 'text-white' : 'text-text-muted'}`}>
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            {/* Render Attachment as ActionCard */}
                            {hasAttachment && (
                                <div className="mt-4 w-full max-w-[90%] transform hover:scale-[1.01] transition-transform">
                                    <ActionCard
                                        actionData={msg.attachment}
                                        onDiscard={() => setMessages(prev => prev.map((m, i) =>
                                            i === idx ? { ...m, attachment: null } : m
                                        ))}
                                        onApprove={(editedData) => handleApproveAction(editedData)}
                                        businessProfile={businessProfile}
                                    />
                                </div>
                            )}

                            {/* Image prompt indicator */}
                            {msg.isImagePrompt && msg.image_url && (
                                <div className="mt-3 glass-card rounded-2xl overflow-hidden border border-indigo-500/20 max-w-[80%] shadow-lg shadow-indigo-500/5 animate-in zoom-in-95 duration-300">
                                    <img src={msg.image_url} alt="Uploaded" className="w-full object-cover max-h-48" />
                                    <div className="p-3 bg-indigo-500/5 flex items-center justify-center gap-2">
                                        <Mic size={12} className="text-indigo-500 animate-pulse" />
                                        <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Visual Scan Active • Tap Mic to Describe</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} className="h-4" /> {/* Small bottom padding for messages */}

                {isThinking && (
                    <div className="flex justify-start">
                        <div className="glass-card rounded-[28px] rounded-tl-none px-6 py-4 border border-card-border/50 shadow-xl mb-4">
                            <div className="flex space-x-2 items-center h-6">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Floating Bar */}
            {(isThinking || isPlaying) && (
                <div className="absolute top-[68px] left-12 right-12 z-20 flex justify-center pointer-events-none">
                    <div className="px-3 py-1 glass-card rounded-full border border-indigo-500/20 shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4">
                        <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">
                            {isThinking ? "Thinking..." : "Playing..."}
                        </span>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="flex-none bg-bg-main border-t border-card-border/50 pb-[env(safe-area-inset-bottom)] z-20 w-full relative">
                <div className="flex items-center gap-2 px-3 py-3">
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-text-muted hover:text-indigo-500 hover:bg-card-bg/80 rounded-full transition-all"
                        >
                            <ImageIcon size={22} />
                        </button>
                        <button
                            onClick={toggleMute}
                            className={`p-2.5 rounded-full hover:bg-card-bg/80 transition-all ${isMuted ? 'text-red-500' : 'text-text-muted hover:text-indigo-500'}`}
                        >
                            {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} className={isPlaying ? "animate-pulse text-indigo-500" : ""} />}
                        </button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])}
                        className="hidden"
                        accept="image/*"
                    />

                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (isOnline || localAIReady) && handleSend()}
                            placeholder={isOnline ? "Message Sathi..." : "Offline..."}
                            disabled={!isOnline && !localAIReady}
                            className="w-full bg-card-bg/80 backdrop-blur-sm text-text-main placeholder-text-muted/60 font-medium px-5 py-3 rounded-full border border-card-border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-sm text-[16px] transition-all"
                        />
                    </div>

                    <div className="shrink-0 flex items-center pl-1 pr-1">
                        {input.trim() ? (
                            <button onClick={handleSend} className="w-[46px] h-[46px] bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-indigo-500/40 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center">
                                <Send size={20} className="translate-x-[2px]" />
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (isListening) stopRecording();
                                    else startRecording();
                                }}
                                className={`w-[46px] h-[46px] rounded-full shadow-lg transition-all flex items-center justify-center ${isListening
                                    ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse'
                                    : 'bg-indigo-600 text-white shadow-indigo-500/40 hover:bg-indigo-500 active:scale-95'
                                    }`}
                            >
                                <Mic size={20} className={isListening ? "animate-bounce" : ""} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;

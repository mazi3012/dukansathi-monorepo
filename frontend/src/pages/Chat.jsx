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

    // Fetch Business Profile on Mount
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
        <div className="flex flex-col h-[calc(100vh-80px)]"> {/* Minus BottomNav Height */}

            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 bg-white shadow-sm border-b border-slate-100 sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h2 className="font-heading font-bold text-lg text-slate-800">Sathi AI</h2>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${model === 'phi3:mini' || localAIReady ? 'bg-amber-500' : (isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')}`}></span>
                        <span className="text-xs text-slate-500">
                            {model === 'phi3:mini' ? 'Local AI (Offline)' : (isOnline ? 'Online' : (localAIReady ? 'Offline (Local AI)' : 'Offline'))}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => {
                    // Check if message has attachment (from backend)
                    const hasAttachment = msg.attachment && Object.keys(msg.attachment).length > 0;

                    return (
                        <div key={idx} className={`flex flex-col ${msg.type === 'user' || msg.type === 'user-audio' ? 'items-end' : 'items-start'}`}>
                            <div className={`
                                max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm
                                ${msg.type === 'user' || msg.type === 'user-audio'
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'}
                            `}>
                                {msg.image && (
                                    <img src={msg.image} alt="Attachment" className="max-w-full rounded-lg mb-2 border border-white/20" />
                                )}
                                {msg.text === '🎤 ...' ? (
                                    <div className="flex items-center gap-1.5 h-5 px-2">
                                        <div className="w-1 bg-white/80 rounded-full h-2 animate-[pulse_1s_ease-in-out_infinite]" />
                                        <div className="w-1 bg-white/80 rounded-full h-4 animate-[pulse_1s_ease-in-out_infinite_100ms]" />
                                        <div className="w-1 bg-white/80 rounded-full h-3 animate-[pulse_1s_ease-in-out_infinite_200ms]" />
                                        <div className="w-1 bg-white/80 rounded-full h-5 animate-[pulse_1s_ease-in-out_infinite_300ms]" />
                                        <div className="w-1 bg-white/80 rounded-full h-2 animate-[pulse_1s_ease-in-out_infinite_400ms]" />
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                )}
                            </div>

                            {/* Render Attachment as ActionCard */}
                            {hasAttachment && (
                                <ActionCard
                                    actionData={msg.attachment}
                                    onDiscard={() => setMessages(prev => prev.map((m, i) =>
                                        i === idx ? { ...m, attachment: null } : m
                                    ))}
                                    onApprove={(editedData) => handleApproveAction(editedData)}
                                    businessProfile={businessProfile}
                                />
                            )}
                            {/* Image prompt indicator */}
                            {msg.isImagePrompt && msg.image_url && (
                                <div className="mt-2 rounded-xl overflow-hidden border border-indigo-200 max-w-[80%]">
                                    <img src={msg.image_url} alt="Uploaded" className="w-full object-cover max-h-40" />
                                    <p className="text-[10px] text-center text-indigo-500 py-1 bg-indigo-50">📷 Tap mic or type your intent above</p>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />

                {isThinking && (
                    <div className="flex justify-start px-4">
                        <div className="bg-white text-slate-500 border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm inline-block">
                            <div className="flex space-x-1.5 items-center h-5">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Indicator */}
            {(isThinking || isPlaying) && (
                <div className="px-4 py-1 text-xs font-medium text-slate-500 animate-pulse">
                    {isThinking ? "Thinking..." : "Speaking..."}
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <ImageIcon size={24} />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])}
                    className="hidden"
                    accept="image/*"
                />

                <button
                    onClick={toggleMute}
                    className={`p-2 transition-colors relative ${isMuted ? 'text-red-400 hover:text-red-600' : 'text-slate-400 hover:text-indigo-600'}`}
                    title={isMuted ? "Unmute AI" : "Mute AI"}
                >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} className={isPlaying ? "animate-pulse text-indigo-500" : ""} />}
                    {isPlaying && <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />}
                </button>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (isOnline || localAIReady) && handleSend()}
                    placeholder={isOnline ? "Ask anything..." : (localAIReady ? "Ask Local AI..." : "You are offline")}
                    disabled={!isOnline && !localAIReady}
                    className={`flex-1 bg-slate-100 text-slate-800 placeholder-slate-400 px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${!isOnline && localAIReady ? 'ring-2 ring-amber-500/20 bg-amber-50' : ''}`}
                />

                {input.trim() ? (
                    <button onClick={handleSend} className="p-2.5 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition relative overflow-hidden group">
                        <Send size={20} className="relative z-10 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                ) : (
                    <button
                        onClick={() => {
                            if (isListening) stopRecording();
                            else startRecording();
                        }}
                        className={`p-2.5 rounded-full shadow-md transition-all select-none ${isListening
                            ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200 scale-110'
                            : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                            }`}
                    >
                        <Mic size={20} className={isListening ? "animate-bounce" : ""} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Chat;

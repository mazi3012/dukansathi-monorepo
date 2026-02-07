import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import ActionCard from '../components/ActionCard';
import { supabase } from '../lib/supabase';

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
        toggleMute
    } = useChat();
    const [input, setInput] = useState('');
    const [businessProfile, setBusinessProfile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const timerRef = useRef(null);
    const navigate = useNavigate();

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
                    const { data: cust } = await supabase.from('customers')
                        .select('id').ilike('name', actionData.customer_name.trim()).eq('user_id', user.id).maybeSingle();

                    if (cust) {
                        customerId = cust.id;
                    } else {
                        // AUTO-CREATE CUSTOMER
                        const { data: newCust, error: createError } = await supabase.from('customers').insert({
                            user_id: user.id,
                            name: actionData.customer_name.trim(),
                            phone: null, // Phone unknown at this stage
                            address: null
                        }).select('id').single();

                        if (!createError && newCust) {
                            customerId = newCust.id;
                            console.log("Auto-created new customer:", actionData.customer_name);
                        } else {
                            console.error("Failed to auto-create customer:", createError);
                        }
                    }
                }

                // Create Sale Header
                const totalAmount = actionData.items.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0);

                const { data: sale, error: saleError } = await supabase.from('sales').insert({
                    user_id: user.id,
                    customer_id: customerId, // might be null
                    invoice_type: businessProfile?.is_gst_registered ? 'gst' : 'regular', // Use actual profile setting
                    subtotal: totalAmount,
                    total_amount: totalAmount,
                    payment_status: 'paid', // Default to paid for voice actions? Or "credit" if specified? Let's assume paid for quick sales for now.
                    created_at: new Date()
                }).select().single();

                if (saleError) throw saleError;

                // Create Sale Items (Need to verify products exist?)
                // For simplicity, we assume products match via names or just insert as text if supported. 
                // But sale_items usually needs product_id. 
                // Voice loop simplification: Search product by name to get ID.
                for (const item of actionData.items) {
                    const { data: prod } = await supabase.from('products')
                        .select('id, name, selling_price').ilike('name', item.product_name).eq('user_id', user.id).single();

                    await supabase.from('sale_items').insert({
                        user_id: user.id,
                        sale_id: sale.id,
                        product_id: prod?.id,
                        quantity: item.quantity,
                        unit_price: item.price || prod?.selling_price || 0,
                        total_price: item.quantity * (item.price || prod?.selling_price || 0)
                    });

                    // Decrement stock
                    if (prod?.id) {
                        await supabase.rpc('decrement_stock', { p_id: prod.id, qty: item.quantity });
                    }
                }
                alert("✅ Invoice Created Successfully!");
            }

            // 2. PRODUCT CREATION
            if (actionData.type === 'product_draft') {
                const { error } = await supabase.from('products').insert({
                    user_id: user.id,
                    name: actionData.name,
                    selling_price: actionData.selling_price,
                    stock_quantity: actionData.stock_quantity,
                    category: actionData.category || 'General'
                });
                if (error) throw error;
                if (error) throw error;

                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: `✅ Product Added!\n\n📦 ${actionData.name}\n💰 Price: ₹${actionData.selling_price}\n📊 Stock: ${actionData.stock_quantity}`
                }]);

                // Clear action card
                setMessages(prev => {
                    const newMsgs = [...prev];
                    // Logic to remove action card from history if needed, or just append success msg
                    return newMsgs;
                });
            }

            // 3. PAYMENT RECORDING
            if (actionData.type === 'payment_draft') {
                try {
                    // 1. Find the customer
                    const { data: customers, error: searchError } = await supabase
                        .from('customers')
                        .select('id, name, credit_balance')
                        .ilike('name', `%${actionData.customer_name}%`)
                        .eq('user_id', user.id) // Ensure customer belongs to the current user
                        .limit(1);

                    if (searchError || !customers || customers.length === 0) {
                        alert(`Customer "${actionData.customer_name}" not found!`);
                        return;
                    }

                    const customer = customers[0];
                    const amount = parseFloat(actionData.amount) || 0;

                    // 2. Update Credit Balance (Decrement Dues)
                    const newBalance = (parseFloat(customer.credit_balance) || 0) - amount;

                    // 2a. Update Customer Table
                    const { error: updateError } = await supabase
                        .from('customers')
                        .update({ credit_balance: newBalance })
                        .eq('id', customer.id);

                    if (updateError) throw updateError;

                    // 2b. Log Transaction (Optimistic - assuming table exists or we add it later)
                    // For now, logging the successful balance update is key.
                    // We could insert into 'sales' with type 'payment' if we want to track history?
                    // Let's stick to balance update for this MVP step.

                    // 3. Update Chat UI
                    setMessages(prev => [...prev, {
                        type: 'bot',
                        text: `✅ Payment Recorded!\n\nReceived: ₹${amount}\nCustomer: ${customer.name}\nNew Due Balance: ₹${newBalance}\nMode: ${actionData.mode}`
                    }]);

                    // Clear the action card
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        // Find the last message with this action and mark as done/remove actionData
                        // Ideally we just append a success message and user scrolls down.
                        return newMsgs;
                    });

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

                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: `✅ Customer Added!\n\n👤 ${actionData.name}\n📞 ${actionData.phone || 'No Phone'}\n📍 ${actionData.address || 'No Address'}`
                }]);

                // Clear action card
                setMessages(prev => {
                    const newMsgs = [...prev];
                    // Logic to remove action card from history if needed, or just append success msg
                    return newMsgs;
                });
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
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-slate-500">Online</span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => {
                    // Parse Action JSON if present
                    let displayText = msg.text;
                    let actionData = null;

                    if (msg.text && msg.text.includes('$$ACTION_JSON$$')) {
                        try {
                            const parts = msg.text.split('$$ACTION_JSON$$');
                            displayText = parts[0].trim();
                            const jsonPart = parts[1].split('$$END_JSON$$')[0];
                            actionData = JSON.parse(jsonPart);
                        } catch (e) {
                            console.error("Failed to parse action JSON", e);
                        }
                    }

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
                                <p className="whitespace-pre-wrap">{displayText}</p>
                            </div>

                            {/* Render Action Card if exists */}
                            {actionData && (
                                <ActionCard
                                    actionData={actionData}
                                    onDiscard={() => alert("Draft Discarded")}
                                    onApprove={() => handleApproveAction(actionData)}
                                    businessProfile={businessProfile}
                                />
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
                    className={`p-2 transition-colors ${isMuted ? 'text-red-400 hover:text-red-600' : 'text-slate-400 hover:text-indigo-600'}`}
                    title={isMuted ? "Unmute AI" : "Mute AI"}
                >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask anything..."
                    className="flex-1 bg-slate-100 text-slate-800 placeholder-slate-400 px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                {input.trim() ? (
                    <button onClick={handleSend} className="p-2.5 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition">
                        <Send size={20} />
                    </button>
                ) : (
                    <button
                        onMouseDown={() => {
                            timerRef.current = setTimeout(() => {
                                startRecording();
                            }, 500); // Wait 500ms before starting
                        }}
                        onMouseUp={() => {
                            if (timerRef.current) clearTimeout(timerRef.current);
                            if (isListening) stopRecording();
                        }}
                        onTouchStart={() => {
                            timerRef.current = setTimeout(() => {
                                startRecording();
                            }, 500);
                        }}
                        onTouchEnd={() => {
                            if (timerRef.current) clearTimeout(timerRef.current);
                            if (isListening) stopRecording();
                        }}
                        onMouseLeave={() => {
                            if (timerRef.current) clearTimeout(timerRef.current);
                            if (isListening) stopRecording();
                        }}
                        className={`p-2.5 rounded-full shadow-md transition-all select-none ${isListening
                            ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200'
                            : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                            }`}
                    >
                        <Mic size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Chat;

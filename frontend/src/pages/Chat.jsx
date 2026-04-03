import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, ArrowLeft, Volume2, VolumeX, Plus, FileSpreadsheet, Camera, Share2, Download, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../hooks/useChat';
import ActionCard from '../components/ActionCard';
import { supabase } from '../lib/supabase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import logo from '../assets/logo.svg';
import PDFViewer from '../components/PDFViewer';
import { TaxCalculator } from '../utils/gstUtils';
import QRCode from 'qrcode';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Sparkles, Lock } from 'lucide-react';

const formatWhatsAppNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return '91' + cleaned;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    return cleaned;
};

// --- Unified Chat Invoice Template Component ---
const ChatInvoiceCard = ({ msg }) => {
    if (!msg) return null;

    // Parse items_summary into an array if it's a string
    let items = [];
    if (msg.items_summary) {
        items = msg.items_summary.split('\n').filter(line => line.trim());
    }

    const isGst = msg.invoice_type === 'gst';
    const subtotal = parseFloat(msg.subtotal) || 0;
    const cgst = parseFloat(msg.cgst_amount) || 0;
    const sgst = parseFloat(msg.sgst_amount) || 0;
    const igst = parseFloat(msg.igst_amount) || 0;
    const totalTax = cgst + sgst + igst;
    const isOutOfState = msg.is_out_of_state || igst > 0;

    return (
        <div className="w-full bg-card-bg backdrop-blur-md rounded-2xl overflow-hidden border border-card-border shadow-lg relative group transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/30">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-5 py-4 flex justify-between items-center border-b border-card-border/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <FileSpreadsheet size={16} />
                    </div>
                    <span className="font-heading font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
                        {isGst ? "TAX INVOICE" : "BILL OF SUPPLY"}
                    </span>
                    {isGst && <span className="text-[9px] bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">GST</span>}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Invoice No.</span>
                    <span className="text-sm font-mono font-bold text-text-main">#{msg.invoice_id}</span>
                </div>
            </div>

            <div className="p-5">
                {/* To Details */}
                <div className="mb-6 flex justify-between items-start">
                    <div className="text-sm">
                        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Billed To:</p>
                        <p className="font-heading font-bold text-text-main text-base">{msg.customer_name || 'Valued Customer'}</p>
                        {msg.customer_phone && <p className="text-text-muted font-medium mt-0.5">{msg.customer_phone}</p>}
                    </div>
                    <div className="text-right">
                        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Date:</p>
                        <p className="text-sm font-semibold text-text-main">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* Items List */}
                <div className="mb-4 space-y-3">
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2 border-b border-card-border/50 pb-2">Purchase Summary</p>
                    <div className="space-y-3">
                        {items.length > 0 ? (
                            items.map((item, idx) => {
                                // Basic parse of "1. Item Name x Qty"
                                const match = item.match(/^\d+\.\s*(.+?)\s*x\s*(\d+)$/);
                                if (match) {
                                    return (
                                        <div key={idx} className="flex justify-between text-sm items-center py-0.5">
                                            <div className="flex flex-col flex-1 pr-4">
                                                <span className="text-text-main font-semibold line-clamp-1">{match[1]}</span>
                                                <span className="text-[10px] text-text-muted font-bold">Standard Item</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold border border-indigo-500/10">Qty: {match[2]}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return <div key={idx} className="text-sm text-text-main font-medium border-l-2 border-indigo-500/30 pl-3 py-1">{item}</div>;
                            })
                        ) : (
                            <div className="text-sm text-text-muted italic py-2">No items listed.</div>
                        )}
                    </div>
                </div>

                {/* Tax Breakdown — Only for GST invoices */}
                {isGst && totalTax > 0 && (
                    <div className="mb-4 py-3 px-3 rounded-xl bg-indigo-50/20 dark:bg-indigo-500/5 border border-indigo-500/10 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-text-muted">
                            <span>TAXABLE VALUE</span>
                            <span>₹{subtotal.toFixed(2)}</span>
                        </div>
                        {isOutOfState ? (
                            <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                <span>IGST (Inter-State)</span>
                                <span>+ ₹{igst.toFixed(2)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                    <span>CGST (Central)</span>
                                    <span>+ ₹{cgst.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                    <span>SGST (State)</span>
                                    <span>+ ₹{sgst.toFixed(2)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-[10px] font-bold text-text-muted border-t border-indigo-500/10 pt-1.5">
                            <span>TOTAL TAX</span>
                            <span>₹{totalTax.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Total */}
                <div className="pt-4 border-t border-card-border flex justify-between items-center group/total">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-60">Payment Status</span>
                        <span className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${msg.payment_status === 'paid' ? 'text-emerald-500' : (msg.balance_due > 0 && msg.amount_paid > 0 ? 'text-orange-500' : 'text-red-500')}`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${msg.payment_status === 'paid' ? 'bg-emerald-500' : (msg.balance_due > 0 && msg.amount_paid > 0 ? 'bg-orange-500' : 'bg-red-500')}`}></span>
                            {msg.payment_status === 'paid' ? 'Fully Paid' : (msg.balance_due > 0 && msg.amount_paid > 0 ? 'Partially Paid' : 'Balance Due')}
                        </span>
                        {msg.balance_due > 0 && (
                            <span className="text-[10px] font-bold text-text-muted mt-0.5">
                                Pending: ₹{msg.balance_due}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-text-muted">Grand Total</span>
                        <span className="font-heading font-extrabold text-2xl text-indigo-600 dark:text-indigo-400 drop-shadow-sm">₹{msg.grand_total}</span>
                    </div>
                </div>
            </div>

            {/* Premium Pattern Overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none group-hover:bg-indigo-600/10 transition-colors"></div>
        </div>
    );
};

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
        isConnected,
        pendingAttachment,
        setPendingAttachment,
        micPermission,
        camPermission,
        isSecure,
        hasExplicitlyDenied,
        requestMicPermission,
        requestCamPermission
    } = useChat();
    const { tier } = useSubscription();
    const [input, setInput] = useState('');
    const [businessProfile, setBusinessProfile] = useState(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const timerRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // UI State
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [isMicSetupOpen, setIsMicSetupOpen] = useState(false);
    const menuRef = useRef(null);
    const isOnline = useOnlineStatus();
    const autoRecordRef = useRef(false);

    // Auto-start recording if navigated from BottomNav
    useEffect(() => {
        if (location.state?.autoStartRecord && !autoRecordRef.current) {
            autoRecordRef.current = true;
            // Clear the state so it doesn't re-trigger on refresh
            window.history.replaceState({}, document.title);

            // If the user's finger is still exactly on the push-to-talk button
            if (window.__isMicHeld && micPermission === 'granted') {
                startRecording();
            }
        }
    }, [location.state, startRecording, micPermission]);

    // Note: BottomNav is hidden on /chat page (see MainLayout.jsx), so no nav-mic
    // global events are needed here. The in-page mic button handles everything.

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

        // ── ONLINE / SUPABASE MODE ────────────────────────────────────────────
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Please login first");

            // 1. INVOICE CREATION
            if (actionData.type === 'invoice_draft') {
                // Find or Create Customer
                let customerId = null;
                let customerPhone = null;
                if (actionData.customer_name) {
                    // Try fuzzy match first, then exact ilike
                    let cust = null;
                    try {
                        const { data: fuzzyCust } = await supabase.rpc('fuzzy_match_customer', {
                            query: actionData.customer_name.trim(),
                            uid: user.id
                        });
                        if (fuzzyCust && fuzzyCust.length > 0) cust = { id: fuzzyCust[0].id, phone: fuzzyCust[0].phone };
                    } catch (_) {
                        // RPC not yet available — fall back to ilike
                        const { data: ilikeCust } = await supabase.from('customers')
                            .select('id, phone').ilike('name', actionData.customer_name.trim()).eq('user_id', user.id).maybeSingle();
                        cust = ilikeCust;
                    }

                    if (cust) {
                        customerId = cust.id;
                        customerPhone = cust.phone;
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

                // Tax totals will be calculated after enrichedItems

                // Determine tax split & state logic
                // Prioritize the toggle from the ActionCard
                const isGstSession = actionData.invoice_type === 'gst' || (actionData.invoice_type !== 'regular' && businessProfile?.is_gst_registered);
                const sellerGstin = businessProfile?.gstin;
                const buyerGstin = actionData.gstin;
                const placeOfSupply = actionData.state_code; // If specific state code provided

                const enrichedItems = await Promise.all(actionData.items.map(async (item) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const rawRate = parseFloat(item.price ?? item.unit_price) || 0;
                    const hsn = item.hsn_code || "1905"; // Default if missing

                    const forceInterState = actionData.isOutOfState || false;
                    const taxCalc = TaxCalculator.calculate({
                        sellingPrice: rawRate,
                        quantity: qty,
                        hsnCode: hsn,
                        sellerGstin: sellerGstin,
                        buyerGstin: buyerGstin,
                        placeOfSupply: forceInterState ? null : (actionData.state_code || actionData.customer_state || businessProfile?.state_name),
                        forceInterState,
                        taxRate: item.tax_percent !== undefined ? parseFloat(item.tax_percent) : null,
                        isInclusive: item.tax_type === 'inclusive'
                    });

                    // Force 0 tax if not a GST session
                    const cgst = isGstSession ? taxCalc.cgst_amount : 0;
                    const sgst = isGstSession ? taxCalc.sgst_amount : 0;
                    const igst = isGstSession ? taxCalc.igst_amount : 0;
                    const taxTotal = cgst + sgst + igst;

                    // Find product_id
                    let prodId = null;
                    try {
                        const { data: fuzzyProd } = await supabase.rpc('fuzzy_match_product', {
                            query: (item.product_name || item.name).trim(),
                            uid: user.id
                        });
                        if (fuzzyProd && fuzzyProd.length > 0) prodId = fuzzyProd[0].id;
                    } catch (_) {
                        const { data: ilikeProd } = await supabase.from('products')
                            .select('id').ilike('name', (item.product_name || item.name).trim()).eq('user_id', user.id).maybeSingle();
                        if (ilikeProd) prodId = ilikeProd.id;
                    }

                    return {
                        ...item,
                        product_id: prodId,
                        unit_price: rawRate,
                        quantity: qty,
                        hsn_code: isGstSession ? hsn : null,
                        taxable_amount: taxCalc.taxable_value,
                        cgst_amount: cgst,
                        sgst_amount: sgst,
                        igst_amount: igst,
                        tax_percent: isGstSession ? taxCalc.gst_rate : 0,
                        total_amount: taxCalc.taxable_value + taxTotal
                    };
                }));

                // Calculate Totals
                let grandTotal = Math.round((enrichedItems.reduce((sum, i) => sum + i.total_amount, 0) + Number.EPSILON) * 100) / 100;
                let totalSubtotal = enrichedItems.reduce((sum, i) => sum + i.taxable_amount, 0);
                let totalCgst = enrichedItems.reduce((sum, i) => sum + i.cgst_amount, 0);
                let totalSgst = enrichedItems.reduce((sum, i) => sum + i.sgst_amount, 0);
                let totalIgst = enrichedItems.reduce((sum, i) => sum + i.igst_amount, 0);
                let totalTax = totalCgst + totalSgst + totalIgst;

                const status = actionData.payment_status || 'paid';
                // Use amount_paid from ActionCard if provided, otherwise default to full grandTotal if paid
                const amtPaid = actionData.amount_paid !== undefined ? parseFloat(actionData.amount_paid) : (status === 'paid' ? grandTotal : 0);
                const balanceDue = Math.round((Math.max(0, grandTotal - amtPaid) + Number.EPSILON) * 100) / 100;

                // --- Sequential Bill Numbering ---
                const { count, error: countError } = await supabase
                    .from('sales')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                const nextBillNum = (count || 0) + 1;
                const billNumber = `Bill-${nextBillNum}`;

                // Create Sale Header
                const { data: sale, error: saleError } = await supabase.from('sales').insert({
                    user_id: user.id,
                    customer_id: customerId,
                    invoice_type: isGstSession ? 'gst' : 'regular',
                    invoice_number: billNumber,
                    subtotal: totalSubtotal,
                    total_tax_amount: totalTax,
                    cgst_amount: totalCgst,
                    sgst_amount: totalSgst,
                    igst_amount: totalIgst,
                    total_amount: grandTotal,
                    payment_status: status === 'paid' ? 'paid' : (status === 'unpaid' ? 'credit' : 'partial'),
                    amount_paid: amtPaid,
                    balance_due: balanceDue,
                    is_out_of_state: actionData.isOutOfState || false,
                    created_at: new Date()
                }).select().single();

                if (saleError) throw saleError;

                // Handle Balance Due (Udhar/Credit)
                if (balanceDue > 0 && customerId) {
                    // 1. Update Customer Credit Balance
                    const { error: creditError } = await supabase.rpc('add_customer_credit', {
                        p_user_id: user.id,
                        p_customer_id: customerId,
                        p_amount: balanceDue
                    });

                    if (creditError) console.error("Balance update failed:", creditError);

                    // 2. Add to Customer Ledger
                    await supabase.from('customer_ledger').insert({
                        user_id: user.id,
                        customer_id: customerId,
                        amount: balanceDue,
                        type: 'credit',
                        mode: 'Invoice',
                        note: `Pending balance from Invoice #${sale.id.toString().slice(-6)}`
                    });
                }

                // Create Sale Items & Decrement Stock
                for (const item of enrichedItems) {
                    await supabase.from('sale_items').insert({
                        user_id: user.id,
                        sale_id: sale.id,
                        product_id: item.product_id || null,
                        quantity: item.quantity,
                        unit_price: item.unit_price || 0,
                        hsn_code: item.hsn_code || null,
                        taxable_amount: item.taxable_amount || 0,
                        cgst_percent: item.cgst_amount > 0 ? (item.tax_percent / 2) : 0,
                        cgst_amount: item.cgst_amount,
                        sgst_percent: item.sgst_amount > 0 ? (item.tax_percent / 2) : 0,
                        sgst_amount: item.sgst_amount,
                        igst_percent: item.igst_amount > 0 ? item.tax_percent : 0,
                        igst_amount: item.igst_amount,
                        total_price: item.total_amount
                    });
                    // Decrement stock is now handled automatically by a database trigger on sale_items insertion
                    // if (item.product_id) {
                    //     await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.quantity });
                    // }
                }

                // --- PDF GENERATION & UPLOAD ---
                setIsGeneratingPDF(true);
                try {
                    const { jsPDF } = await import('jspdf');
                    const autoTable = (await import('jspdf-autotable')).default;
                    const doc = new jsPDF();
                    const isGst = sale.invoice_type === 'gst';

                    // Helper for Number to Words
                    const numberToWords = (num) => {
                        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
                        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

                        const convert = (n) => {
                            if (n === 0) return '';
                            if (n < 20) return a[n];
                            if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
                            if (n < 1000) return a[Math.floor(n / 100)] + 'hundred ' + convert(n % 100);
                            if (n < 100000) return convert(Math.floor(n / 1000)) + 'thousand ' + convert(n % 1000);
                            if (n < 10000000) return convert(Math.floor(n / 100000)) + 'lakh ' + convert(n % 100000);
                            return convert(Math.floor(n / 10000000)) + 'crore ' + convert(n % 10000000);
                        };

                        const amountArr = parseFloat(num).toFixed(2).split('.');
                        const whole = parseInt(amountArr[0]);
                        const fraction = parseInt(amountArr[1]);

                        let res = convert(whole) + 'Rupees ';
                        if (fraction > 0) {
                            res += 'and ' + convert(fraction) + 'Paise ';
                        }
                        return res.trim() + ' Only';
                    };

                    // Header
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(24);
                    doc.setTextColor(30, 41, 59); // slate-800
                    doc.text(businessProfile?.business_name || "My Shop", 14, 22);

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139); // slate-500
                    let yPos = 30;
                    if (businessProfile?.business_address || businessProfile?.address) {
                        const addr = businessProfile.business_address || businessProfile.address;
                        const addrLines = doc.splitTextToSize(addr, 100);
                        doc.text(addrLines, 14, yPos);
                        yPos += (addrLines.length * 5);
                    }
                    doc.text(`${businessProfile?.city || ''}, ${businessProfile?.state_name || businessProfile?.state || ''} ${businessProfile?.pincode || ''}`, 14, yPos);
                    yPos += 5;
                    if (businessProfile?.phone) { doc.text(`Phone: ${businessProfile.phone}`, 14, yPos); yPos += 5; }
                    if (isGst && businessProfile?.gstin) {
                        doc.setFont(undefined, 'bold');
                        doc.setTextColor(79, 70, 229); // indigo-600
                        doc.text(`GSTIN: ${businessProfile.gstin}`, 14, yPos); yPos += 5;
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(100, 116, 139);
                    }

                    // Invoice Meta
                    doc.setFontSize(18);
                    doc.setTextColor(79, 70, 229);
                    doc.text(isGst ? "TAX INVOICE" : "BILL OF SUPPLY", 200, 22, { align: 'right' });
                    doc.setFontSize(10);
                    doc.setTextColor(148, 163, 184); // slate-400
                    doc.text(`Invoice Number: ${sale.invoice_number || 'Bill-#' + sale.id}`, 200, 30, { align: 'right' });
                    doc.text(`Date: ${new Date(sale.created_at).toLocaleDateString('en-IN')}`, 200, 36, { align: 'right' });
                    if (isGst) {
                        const shopState = (businessProfile?.state_name || businessProfile?.state || '').toLowerCase().trim();
                        const custState = (actionData.customer_state || sale.customers?.state || '').toLowerCase().trim();
                        const isOutOfState = actionData.isOutOfState || (custState && shopState && custState !== shopState);
                        const placeOfSupply = actionData.customer_state || sale.customers?.state || (isOutOfState ? 'Other State' : (businessProfile?.state_name || 'Local'));
                        
                        doc.text(`Place of Supply: ${placeOfSupply}`, 200, 42, { align: 'right' });
                        if (isOutOfState) {
                             doc.text(`IGST Applicable: YES`, 200, 48, { align: 'right' });
                        }
                    }

                    // Bill To
                    yPos = 55;
                    doc.setFontSize(10);
                    doc.setTextColor(148, 163, 184);
                    doc.text("BILLED TO", 14, yPos);
                    yPos += 6;
                    doc.setFontSize(12);
                    doc.setTextColor(30, 41, 59);
                    doc.setFont(undefined, 'bold');
                    doc.text(actionData.customer_name || "Walk-in Customer", 14, yPos);
                    yPos += 5;
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(71, 85, 105);
                    if (actionData.customer_phone || sale.customers?.phone) { 
                        doc.text(actionData.customer_phone || sale.customers?.phone, 14, yPos); 
                        yPos += 5; 
                    }
                    if (actionData.customer_address || sale.customers?.address) {
                        const custAddr = actionData.customer_address || sale.customers?.address;
                        const custAddrLines = doc.splitTextToSize(custAddr, 80);
                        doc.text(custAddrLines, 14, yPos);
                        yPos += (custAddrLines.length * 5);
                    }
                    if (isGst && (actionData.gstin || sale.customers?.gstin)) { 
                        doc.text(`GSTIN: ${actionData.gstin || sale.customers?.gstin}`, 14, yPos); 
                        yPos += 5; 
                    }

                    // Determine if IGST is needed
                    const isOutOfState = actionData.isOutOfState || false;

                    // Table
                    const tableHead = isGst
                        ? [['#', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit Rate', 'Taxable', isOutOfState ? 'IGST Amt' : 'GST Amt', 'Total']]
                        : [['#', 'Description of Goods', 'Qty', 'Unit Rate', 'Total']];

                    const tableBody = enrichedItems.map((item, idx) => {
                        const q = parseFloat(item.quantity) || 0;
                        const taxable = item.taxable_amount || 0;
                        const cgst = item.cgst_amount || 0;
                        const sgst = item.sgst_amount || 0;
                        const igst = item.igst_amount || 0;
                        const totalTaxAmt = cgst + sgst + igst;
                        const total = item.total_amount || 0;

                        if (isGst) {
                            return [
                                idx + 1,
                                item.product_name || item.name || "Item",
                                item.hsn_code || '---',
                                q,
                                (item.unit_price ?? 0).toFixed(2),
                                taxable.toFixed(2),
                                isOutOfState ? `(${item.tax_percent}%) ${igst.toFixed(2)}` : totalTaxAmt.toFixed(2),
                                total.toFixed(2)
                            ];
                        } else {
                            return [
                                idx + 1,
                                item.product_name || item.name || "Item",
                                q,
                                (item.unit_price ?? 0).toFixed(2),
                                total.toFixed(2)
                            ];
                        }
                    });

                    autoTable(doc, {
                        startY: yPos + 5,
                        head: tableHead,
                        body: tableBody,
                        theme: 'striped',
                        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                        bodyStyles: { textColor: [30, 41, 59] },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        margin: { left: 14, right: 14 }
                    });

                    // Totals
                    let finalY = doc.lastAutoTable.finalY + 12;

                    // Support for long invoices without adding pages where possible
                    // But if table ends too low (A4 is 297mm), we might need to nudge things
                    if (finalY > 240) {
                        finalY = doc.lastAutoTable.finalY + 5; // Compact if tight
                    }

                    // Left Side: In Words & Bank Info
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text("AMOUNT IN WORDS", 14, finalY);
                    doc.setFontSize(9);
                    doc.setTextColor(30, 41, 59);
                    doc.setFont(undefined, 'bold');
                    doc.text(numberToWords(sale.total_amount), 14, finalY + 5, { maxWidth: 100 });

                    if (businessProfile?.bank_name) {
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184);
                        doc.text("BANK DETAILS", 14, finalY + 15);
                        doc.setFontSize(9);
                        doc.setTextColor(71, 85, 105);
                        doc.setFont(undefined, 'normal');
                        doc.text(`Bank: ${businessProfile.bank_name} | A/c No: ${businessProfile.bank_account_no}`, 14, finalY + 20);
                        doc.text(`IFSC: ${businessProfile.bank_ifsc}`, 14, finalY + 25);
                    }

                    // Right Side: Summary
                    doc.setFontSize(10);
                    doc.setTextColor(71, 85, 105);
                    const rightAlignX = 200;

                    doc.text(`Taxable Value:`, 140, finalY);
                    doc.text(`Rs. ${totalSubtotal.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

                    if (isGst) {
                        const isOutOfState = totalIgst > 0 || actionData.isOutOfState || false;

                        if (isOutOfState) {
                            doc.text(`IGST:`, 140, finalY + 6);
                            doc.text(`Rs. ${totalIgst.toFixed(2)}`, rightAlignX, finalY + 6, { align: 'right' });
                            finalY += 6;
                        } else {
                            doc.text(`CGST:`, 140, finalY + 6);
                            doc.text(`Rs. ${totalCgst.toFixed(2)}`, rightAlignX, finalY + 6, { align: 'right' });
                            doc.text(`SGST:`, 140, finalY + 12);
                            doc.text(`Rs. ${totalSgst.toFixed(2)}`, rightAlignX, finalY + 12, { align: 'right' });
                            finalY += 12;
                        }
                    }

                    doc.setFontSize(14);
                    doc.setTextColor(79, 70, 229);
                    doc.setFont(undefined, 'bold');
                    doc.text(`Grand Total:`, 140, finalY + 15);
                    doc.text(`Rs. ${grandTotal.toFixed(2)}`, rightAlignX, finalY + 15, { align: 'right' });

                    doc.setFontSize(10);
                    doc.setTextColor(30, 41, 59);
                    doc.setFont(undefined, 'normal');
                    doc.text(`Amount Paid:`, 140, finalY + 22);
                    doc.text(`Rs. ${amtPaid.toFixed(2)}`, rightAlignX, finalY + 22, { align: 'right' });

                    if (balanceDue > 0) {
                        doc.setTextColor(220, 38, 38);
                        doc.text(`Balance Due:`, 140, finalY + 28);
                        doc.text(`Rs. ${balanceDue.toFixed(2)}`, rightAlignX, finalY + 28, { align: 'right' });
                    }

                    // Generate QR String (UPI for payment or Compliance for GST)
                    let qrValue = `GSTIN: ${businessProfile?.gstin || 'N/A'}\nInvoice: ${sale.id}\nAmount: ${grandTotal}\nDate: ${new Date(sale.created_at).toLocaleDateString()}`;

                    if (businessProfile?.upi_id) {
                        const name = encodeURIComponent(businessProfile.business_name || 'Business');
                        const amount = grandTotal;
                        const note = encodeURIComponent(`Inv ${sale.id}`);
                        qrValue = `upi://pay?pa=${businessProfile.upi_id}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
                    }

                    const showQr = businessProfile?.show_qr_on_invoice !== false;
                    let qrY = finalY + 35;
                    if (qrY > 260) qrY = 250;

                    if (showQr) {
                        try {
                            // Native QR Generation using 'qrcode' library
                            const qrDataUrl = await QRCode.toDataURL(qrValue, {
                                margin: 1,
                                width: 200,
                                color: {
                                    dark: '#1e293b', // slate-800
                                    light: '#ffffff'
                                }
                            });
                            
                            // Add native QR image: 20x20 at x=175
                            doc.addImage(qrDataUrl, 'PNG', 175, qrY, 20, 20);
                        } catch (qrErr) {
                            console.warn("Native QR generation failed, falling back to placeholder:", qrErr);
                            doc.setDrawColor(226, 232, 240);
                            doc.rect(175, qrY, 20, 20);
                            doc.setFontSize(5);
                            doc.setTextColor(148, 163, 184);
                            doc.text("SECURE QR", 185, qrY + 12, { align: 'center' });
                        }
                    }

                    // Footer / Signature
                    doc.setFontSize(10);
                    doc.setTextColor(30, 41, 59);
                    doc.text(`For ${businessProfile?.business_name || "Authorized Firm"}`, 200, qrY + 25, { align: 'right' });
                    doc.line(140, qrY + 38, 200, qrY + 38);
                    doc.setFontSize(8);
                    doc.text("Authorized Signatory", 200, qrY + 43, { align: 'right' });

                    doc.setTextColor(150, 150, 150);
                    doc.text("This is a computer generated invoice.", 14, qrY + 43);

                    // Output to blob
                    const pdfBlob = doc.output('blob');

                    // Upload to Supabase Storage
                    const fileName = `${user.id}/invoice_${sale.id}_${Date.now()}.pdf`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('invoices')
                        .upload(fileName, pdfBlob, {
                            contentType: 'application/pdf',
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('PDF Upload Error:', uploadError);
                        throw uploadError;
                    }

                    // Get Signed URL (private bucket — 24h expiry)
                    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                        .from('invoices')
                        .createSignedUrl(fileName, 3600); // 1 hour expiry

                    const pdfUrl = signedUrlData?.signedUrl || '';
                    if (signedUrlError) console.warn('Signed URL warning:', signedUrlError);

                    const successMessage = {
                        type: 'bot',
                        text: `✅ Invoice #${sale.id} Created! Total: ₹${grandTotal.toFixed(2)}`,
                        pdf_url: pdfUrl,
                        customer_phone: customerPhone,
                        customer_name: actionData.customer_name || 'Customer',
                        invoice_id: sale.id,
                        invoice_type: isGstSession ? 'gst' : 'regular',
                        subtotal: totalSubtotal.toFixed(2),
                        cgst_amount: totalCgst.toFixed(2),
                        sgst_amount: totalSgst.toFixed(2),
                        igst_amount: totalIgst.toFixed(2),
                        grand_total: grandTotal.toFixed(2),
                        payment_status: status,
                        amount_paid: amtPaid.toFixed(2),
                        balance_due: balanceDue.toFixed(2),
                        is_out_of_state: actionData.isOutOfState || false,
                        items_summary: enrichedItems.map((item, idx) => `${idx + 1}. ${(item.product_name || item.name || 'Item').substring(0, 15)} x ${item.quantity || 0}`).join('\n')
                    };

                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        successMessage
                    ]);

                    // Save the formatted invoice message to chat history so it persists across reloads
                    try {
                        await supabase.from('chat_history').insert({
                            user_id: user.id,
                            role: 'assistant',
                            message: JSON.stringify(successMessage),
                            created_at: new Date()
                        });
                    } catch (historyErr) {
                        console.warn("Could not save invoice to chat history:", historyErr);
                    }
                } catch (pdfErr) {
                    console.error("PDF Generation/Upload Failed:", pdfErr);
                    // Fallback to basic text success if PDF fails
                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        { type: 'bot', text: `✅ Invoice Created! Total: ₹${grandTotal.toFixed(2)}\n⚠️ Could not generate PDF document.` }
                    ]);
                } finally {
                    setIsGeneratingPDF(false);
                }
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
                            unit: actionData.unit || existingProd.unit,
                            hsn_code: actionData.hsn_code || existingProd.hsn_code,
                            tax_percent: actionData.tax_percent || existingProd.tax_percent,
                            tax_type: actionData.tax_type || existingProd.tax_type,
                            is_gst_applicable: (actionData.tax_percent > 0 || !!actionData.hsn_code) || existingProd.is_gst_applicable
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
                            unit: actionData.unit || 'pcs',
                            hsn_code: actionData.hsn_code || null,
                            tax_percent: actionData.tax_percent || 0,
                            tax_type: actionData.tax_type || 'exclusive',
                            is_gst_applicable: (actionData.tax_percent > 0 || !!actionData.hsn_code)
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

                    // Strict matching: Ask for confirmation if the matched name isn't exactly the same 
                    if (customer.name.toLowerCase().trim() !== actionData.customer_name.toLowerCase().trim()) {
                        const confirmed = window.confirm(`🤖 AI matched "${actionData.customer_name}" to customer "${customer.name}". Apply payment to ${customer.name}?`);
                        if (!confirmed) return;
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
                    address: actionData.address,
                    gstin: actionData.gstin,
                    state: actionData.state
                });
                if (error) {
                    alert("Failed to add customer: " + error.message);
                    return;
                }
                setMessages(prev => [
                    ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                    {
                        type: 'bot',
                        text: `✅ Customer Added!\n\n👤 ${actionData.name}\n📞 ${actionData.phone || 'No Phone'}\n📍 ${actionData.address || 'No Address'}${actionData.gstin ? `\n🔢 GSTIN: ${actionData.gstin}` : ''}${actionData.state ? `\n🗺️ State: ${actionData.state}` : ''}`
                    }
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

            // 7. MEMORY DRAFT
            if (actionData.type === 'memory_draft') {
                try {
                    const { error } = await supabase.from('agent_memory').upsert({
                        user_id: user.id,
                        memory_key: actionData.memory_key,
                        memory_value: actionData.memory_value,
                        updated_at: new Date()
                    }, { onConflict: 'user_id, memory_key' });
                    
                    if (error) {
                        alert("Failed to save memory: " + error.message);
                        return;
                    }

                    setMessages(prev => [
                        ...prev.map(m => m.attachment ? { ...m, attachment: null } : m),
                        { type: 'bot', text: `🧠 Memory Saved!\n\nI will remember: ${actionData.memory_key} = ${actionData.memory_value}` }
                    ]);
                } catch (err) {
                    console.error("Memory save error:", err);
                    alert("Failed to save memory.");
                }
                return;
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
                                    unit: item.unit || 'pcs',
                                    hsn_code: item.hsn_code || null,
                                    tax_percent: item.tax_percent || 0,
                                    tax_type: item.tax_type || 'exclusive',
                                    is_gst_applicable: (item.tax_percent > 0 || !!item.hsn_code)
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
                                    unit: item.unit || 'pcs',
                                    hsn_code: item.hsn_code || null,
                                    tax_percent: item.tax_percent || 0,
                                    tax_type: item.tax_type || 'exclusive',
                                    is_gst_applicable: (item.tax_percent > 0 || !!item.hsn_code)
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

    const handleMicClick = () => {
        if (micPermission !== 'granted') {
            setIsMicSetupOpen(true);
        } else {
            if (isListening) {
                stopRecording();
            } else {
                startRecording();
            }
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-bg-main overflow-hidden z-50">
            {/* Security Guard Overlay (Only for critical errors) */}
            {(!isSecure || (micPermission === 'denied' && hasExplicitlyDenied)) && (
                <div className="absolute inset-x-4 top-20 z-[60] p-6 bg-red-500/10 border border-red-500/20 backdrop-blur-xl rounded-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 ring-4 ring-red-500/10">
                        <Lock size={24} />
                    </div>
                    
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-black text-red-500">
                            {!isSecure ? 'Insecure Context' : 'Microphone Blocked'}
                        </h3>
                        <p className="text-sm text-text-muted max-w-[280px] mx-auto leading-relaxed">
                            {!isSecure 
                                ? 'Chrome requires a secure HTTPS connection (or localhost) to use the Microphone.'
                                : 'Microphone access is blocked in your browser. Follow these steps to fix it:'}
                        </p>
                    </div>

                    {isSecure && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full text-left space-y-3">
                            {/* Desktop Instructions */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 opacity-80">Desktop (PC/Mac)</p>
                                <div className="flex items-start gap-2 text-xs text-text-main leading-snug">
                                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-[10px]">1</div>
                                    <span>Click the <b>Lock</b> icon (🔒) in the address bar.</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-text-main leading-snug">
                                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-[10px]">2</div>
                                    <span>Turn on <b>Microphone</b> (or Reset Permission).</span>
                                </div>
                            </div>

                            <div className="h-px bg-white/10 w-full" />

                            {/* Mobile Instructions */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 opacity-80">Mobile (Android/iPhone)</p>
                                <div className="flex items-start gap-2 text-xs text-text-main leading-snug">
                                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-[10px]">1</div>
                                    <span>Tap the <b>Three Dots (⋮)</b> → <b>Settings</b>.</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-text-main leading-snug">
                                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-[10px]">2</div>
                                    <span>Go to <b>Site Settings</b> → <b>Microphone</b>.</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-text-main leading-snug">
                                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-[10px]">3</div>
                                    <span>Find <b>dukansathi.com</b> and tap <b>Allow</b>.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        {!isSecure ? 'Reload Page' : 'Check Again & Reload'}
                    </button>
                </div>
            )}

            {/* Initial Mic Setup Modal (Contextual) */}
            <AnimatePresence>
                {isMicSetupOpen && isSecure && micPermission === 'prompt' && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMicSetupOpen(false)}
                            className="absolute inset-0 bg-bg-main/60 backdrop-blur-xl"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }} 
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative max-w-xs w-full bg-card-bg border border-card-border rounded-[40px] p-8 shadow-2xl flex flex-col items-center text-center gap-6"
                        >
                            <div className="relative">
                                <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/20 animate-bounce-slow">
                                    <Mic size={40} className="text-white" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-card-bg flex items-center justify-center text-white">
                                    <Sparkles size={14} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-text-main leading-tight tracking-tight">Ready to Talk?</h2>
                                <p className="text-sm text-text-muted">
                                    Dukan Sathi needs microphone access to record sales and manage inventory via voice.
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    const success = await requestMicPermission();
                                    if (success) setIsMicSetupOpen(false);
                                }}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                            >
                                <span className="group-hover:translate-x-0.5 transition-transform uppercase tracking-widest text-[10px]">Enable Microphone</span>
                            </button>
                            
                            <button 
                                onClick={() => setIsMicSetupOpen(false)}
                                className="text-[10px] text-text-muted uppercase tracking-widest font-bold opacity-50 hover:opacity-100 transition-opacity"
                            >
                                Not Now
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Ambient Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header - Always Sticky, Slim on Mobile */}
            <header className="flex-none flex items-center gap-2 px-2 py-1.5 md:px-4 md:py-2.5 bg-bg-main/95 backdrop-blur-xl border-b border-card-border/30 z-50 sticky top-0 shrink-0">
                <button onClick={() => navigate(-1)} className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-card-bg/80 hover:text-indigo-500 transition-colors shrink-0">
                    <ArrowLeft size={18} />
                </button>

                {/* Slim Pill Header */}
                <div className="flex items-center gap-2 bg-card-bg/60 border border-card-border/50 py-1 md:py-1.5 px-3 rounded-full shadow-sm max-w-fit backdrop-blur-md">
                    <img src={logo} alt="DukanSathi" className="w-4 h-4 md:w-5 md:h-5 object-contain" />
                    <h2 className="font-heading font-bold text-xs md:text-sm text-text-main whitespace-nowrap">Dukan Sathi AI</h2>
                    <div className="w-[1px] h-3 md:h-3.5 bg-card-border/80 mx-0.5"></div>
                    <div className="flex items-center gap-1 md:gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${!isConnected ? 'bg-yellow-400 animate-pulse shadow-[0_0_6px_rgba(250,204,21,0.6)]' : (isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-red-500')} transition-all duration-300`}></div>
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-text-muted mt-[1px]">
                            <span className="hidden md:inline">{!isConnected ? 'Connecting...' : (isOnline ? 'Cloud AI Active' : 'Offline')}</span>
                            <span className="inline md:hidden">{!isConnected ? '...' : (isOnline ? 'Live' : 'Off')}</span>
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
                                w-auto max-w-[90%] md:max-w-[75%] px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed relative group shadow-sm
                                ${isUser
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'glass-card border border-card-border/50 text-text-main rounded-bl-sm'}
                                ${msg.pdf_url ? '!max-w-[100%] !w-[100%] sm:!w-[90%] md:!max-w-[85%] !p-2 sm:!p-4' : ''}
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
                                    <p className={`whitespace-pre-wrap font-medium ${isUser ? 'text-white' : 'text-text-main'} ${msg.pdf_url ? 'px-2 pt-1' : ''}`}>{msg.text}</p>
                                )}

                                {msg.image && (
                                    <div className="mt-2 rounded-xl overflow-hidden shadow-sm">
                                        <img src={msg.image} alt="Attachment" className="w-full object-cover max-h-60" />
                                    </div>
                                )}

                                {msg.pdf_url && (
                                    <div className="mt-2 flex flex-col gap-2 w-full">

                                        {/* --- UNIFIED PREMIUM INVOICE TEMPLATE --- */}
                                        <div className="w-full">
                                            <ChatInvoiceCard msg={msg} />
                                        </div>
                                        {/* ----------------------------------- */}

                                        {/* Action Buttons — shared for both mobile and desktop */}
                                        <div className="flex gap-2 px-1 flex-wrap sm:flex-nowrap">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const response = await fetch(msg.pdf_url);
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.download = `Invoice_${msg.invoice_id || Date.now()}.pdf`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        window.URL.revokeObjectURL(url);
                                                    } catch (error) {
                                                        console.error("Download failed:", error);
                                                        alert("Failed to download PDF. Please try opening via the link.");
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 bg-indigo-500/10 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-500/20 transition-colors border border-indigo-500/20 flex-[1_1_100%] sm:flex-1 shadow-sm order-1 sm:order-none"
                                            >
                                                <Download size={16} /> <span className="whitespace-nowrap">Download</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const waMsg = `*Invoice #${msg.invoice_id}*\n*From:* ${businessProfile?.business_name || 'Our Shop'}\n*To:* ${msg.customer_name}\n\n*Items:*\n${msg.items_summary}\n\n*Total Amount: ₹${msg.grand_total}*\n\nView PDF Invoice:\n${msg.pdf_url}`;
                                                    const waLink = msg.customer_phone
                                                        ? `https://wa.me/${formatWhatsAppNumber(msg.customer_phone)}?text=${encodeURIComponent(waMsg)}`
                                                        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
                                                    window.open(waLink, '_blank');
                                                }}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 bg-[#25D366]/10 text-[#25D366] rounded-lg text-sm font-bold hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/20 flex-[1_1_48%] sm:flex-1 shadow-sm order-2 sm:order-none"
                                            >
                                                <MessageCircle size={16} /> <span className="whitespace-nowrap">WhatsApp</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        try {
                                                            const response = await fetch(msg.pdf_url);
                                                            const blob = await response.blob();
                                                            const file = new File([blob], `Invoice_${Date.now()}.pdf`, { type: 'application/pdf' });

                                                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                await navigator.share({
                                                                    files: [file],
                                                                    title: 'Invoice from Dukan Sathi',
                                                                });
                                                                return;
                                                            }
                                                        } catch (fetchErr) {
                                                            console.warn("Could not fetch PDF for sharing as file, falling back to link:", fetchErr);
                                                        }

                                                        if (navigator.share) {
                                                            await navigator.share({
                                                                title: 'Invoice from Dukan Sathi',
                                                                text: 'Here is your invoice.',
                                                                url: msg.pdf_url
                                                            });
                                                        } else {
                                                            navigator.clipboard.writeText(msg.pdf_url);
                                                            alert("Invoice link copied to clipboard!");
                                                        }
                                                    } catch (err) {
                                                        console.log('Error sharing:', err);
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 bg-green-500/10 text-green-600 rounded-lg text-sm font-bold hover:bg-green-500/20 transition-colors border border-green-500/20 flex-[1_1_48%] sm:flex-1 shadow-sm order-3 sm:order-none"
                                            >
                                                <Share2 size={16} /> <span className="whitespace-nowrap">Share</span>
                                            </button>
                                        </div>
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

                {/* PDF Generation Indicator */}
                {isGeneratingPDF && (
                    <div className="flex justify-start animate-in fade-in zoom-in duration-300">
                        <div className="glass-card rounded-3xl rounded-bl-sm px-5 py-4 border border-indigo-500/30 text-indigo-600 text-sm flex items-center gap-3 bg-indigo-50/50 shadow-sm">
                            <FileSpreadsheet size={16} className="animate-pulse" />
                            <span className="font-medium">Generating & Saving Invoice PDF...</span>
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin ml-2"></div>
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
                            disabled={isThinking || !isConnected || tier === 'free'}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showAttachmentMenu
                                ? 'bg-indigo-500/10 text-indigo-500 shadow-inner'
                                : 'text-text-muted hover:bg-card-bg/80 hover:text-indigo-500'
                                } disabled:opacity-30`}
                            title="Attach File"
                        >
                            <Plus size={20} strokeWidth={1.5} className={`transition-transform duration-200 ${showAttachmentMenu ? 'rotate-45' : ''}`} />
                        </button>
                    </div>

                    {/* Content Area: UI Restriction for Free Tier */}
                    {tier === 'free' ? (
                        <div className="flex-1 flex items-center justify-between bg-indigo-500/5 border border-indigo-500/20 rounded-3xl px-4 py-2.5 shadow-inner">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                    <Lock size={14} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">AI is a Pro feature</span>
                                    <span className="text-[10px] text-text-muted truncate">Upgrade for AI Billing & Sathi Assistant</span>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/plans')}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"
                            >
                                <div className="flex items-center gap-1">
                                    Upgrade <Sparkles size={10} fill="currentColor" />
                                </div>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Hidden Inputs */}
                            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])} />
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files[0] && sendImage(e.target.files[0])} />
                            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={excelInputRef} onChange={(e) => e.target.files[0] && sendExcel(e.target.files[0])} />

                            <div className="flex-1 flex flex-col justify-end bg-card-bg/50 border border-card-border rounded-3xl pb-0 shadow-sm overflow-hidden transition-all duration-300 text-left">
                                {pendingAttachment && (
                                    <div className="px-3 pt-2 pb-1 flex items-center gap-2 max-w-full">
                                        <div className="relative group bg-black/10 dark:bg-white/10 rounded-xl p-1.5 flex items-center gap-3 pr-4 border border-card-border">
                                            {pendingAttachment.type === 'image' ? (
                                                <img src={pendingAttachment.previewUrl} alt="Preview" className="w-8 h-8 object-cover rounded-lg" />
                                            ) : (
                                                <div className="w-8 h-8 bg-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center">
                                                    <FileSpreadsheet size={16} />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-medium text-text-main truncate max-w-[120px]">{pendingAttachment.file.name}</p>
                                            </div>
                                            <button onClick={() => setPendingAttachment(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><Plus size={10} className="rotate-45" /></button>
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (isOnline) handleSend();
                                        }
                                    }}
                                    placeholder={!isConnected ? "Connecting..." : (isThinking ? "Thinking..." : "Message...")}
                                    disabled={!isOnline || isThinking}
                                    className="w-full bg-transparent text-text-main caret-indigo-500 text-sm placeholder:text-text-muted px-4 py-2.5 focus:outline-none resize-none overflow-hidden min-h-[44px] max-h-[120px]"
                                    rows={1}
                                    style={{ height: input ? 'auto' : '44px' }}
                                />
                            </div>

                            {/* Submit / Mic Button */}
                            <div className="shrink-0 pb-0.5">
                                {input.trim() || pendingAttachment ? (
                                    <button onClick={handleSend} disabled={isThinking} className="w-[42px] h-[42px] rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"><Send size={18} className="translate-x-[2px]" /></button>
                                ) : (
                                    <button
                                        onClick={handleMicClick}
                                        disabled={isThinking}
                                        className={`w-[42px] h-[42px] rounded-full shadow-lg flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white shadow-red-500/40 scale-105 animate-pulse' : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-500 active:scale-95'} disabled:opacity-50`}
                                    >
                                        <Mic size={18} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default Chat;

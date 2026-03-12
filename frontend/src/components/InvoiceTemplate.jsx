import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Building2 } from 'lucide-react';

const THEMES = {
    classic: {
        container: 'bg-white p-4 sm:p-8 max-w-4xl mx-auto text-slate-800 font-sans print:p-0 print:max-w-none text-xs sm:text-sm shadow-2xl rounded-sm border border-slate-200',
        headerBorder: 'border-b-2 border-slate-900',
        titleColor: 'text-slate-900',
        accentColor: 'text-indigo-600',
        tableHeader: 'bg-slate-900 text-white',
        tableHeaderBorder: 'border-slate-700',
        summaryBg: 'bg-slate-900',
        footerBorder: 'border-t-2 border-slate-900',
    },
    minimal: {
        container: 'bg-white p-6 sm:p-10 max-w-4xl mx-auto text-gray-700 font-serif print:p-0 print:max-w-none text-xs sm:text-sm border border-gray-200',
        headerBorder: 'border-b border-gray-300',
        titleColor: 'text-gray-900',
        accentColor: 'text-gray-600',
        tableHeader: 'bg-gray-100 text-gray-800',
        tableHeaderBorder: 'border-gray-300',
        summaryBg: 'bg-gray-800',
        footerBorder: 'border-t border-gray-300',
    },
    thermal: {
        container: 'bg-white p-2 max-w-[80mm] mx-auto text-black font-mono print:p-0 print:max-w-none text-[10px] border border-dashed border-black',
        headerBorder: 'border-b border-dashed border-black',
        titleColor: 'text-black',
        accentColor: 'text-black',
        tableHeader: 'bg-black text-white',
        tableHeaderBorder: 'border-gray-600',
        summaryBg: 'bg-black',
        footerBorder: 'border-t border-dashed border-black',
    }
};

// --- OPTIMIZED UTILITIES (Moved outside component to avoid recreation) ---

const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
});

const formatCurrency = (amount) => currencyFormatter.format(amount || 0);

const formatDate = (dateString) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

const calcTotalItemTax = (item) => {
    return (parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0) + parseFloat(item.igst_amount || 0));
};

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

    const amountArr = parseFloat(num || 0).toFixed(2).split('.');
    const whole = parseInt(amountArr[0]);
    const fraction = parseInt(amountArr[1]);

    let res = convert(whole) + 'Rupees ';
    if (fraction > 0) {
        res += 'and ' + convert(fraction) + 'Paise ';
    }
    return res.trim() + ' Only';
};

// --- END UTILITIES ---

const InvoiceTemplate = forwardRef(({ sale, items, businessProfile, theme = 'classic' }, ref) => {
    const t = THEMES[theme] || THEMES.classic;
    // Determine if GST is applicable (support both 'regular' standard and 'gst' tax format)
    const isGst = sale.invoice_type === 'gst';

    // Determine if it's IGST (Inter-state) or CGST+SGST (Intra-state)
    const isIgst = parseFloat(sale.igst_amount) > 0;

    // For Bill of Supply (non-GST), the correct total is subtotal minus discount — NO TAX
    const discount = parseFloat(sale.discount_amount) || 0;
    const subtotalNum = parseFloat(sale.subtotal) || 0;
    const displayTotal = isGst
        ? (parseFloat(sale.total_amount) || 0)
        : Math.max(0, subtotalNum - discount);



    // Generate QR String (UPI for payment or Compliance for GST)
    let qrValue;
    if (businessProfile?.upi_id) {
        const name = encodeURIComponent(businessProfile.business_name || 'Business');
        const amount = displayTotal; // Use displayTotal instead of sale.total_amount for accuracy
        const note = encodeURIComponent(`Inv ${sale.id}`);
        qrValue = `upi://pay?pa=${businessProfile.upi_id}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
    } else if (isGst && businessProfile?.gstin) {
        qrValue = `GSTIN: ${businessProfile.gstin}\nInvoice: ${sale.id}\nAmount: ${displayTotal}\nDate: ${new Date(sale.created_at).toLocaleDateString()}`;
    } else {
        qrValue = `Invoice: ${sale.id}\nAmount: ${displayTotal}\nDate: ${new Date(sale.created_at).toLocaleDateString()}`;
    }

    const showQr = businessProfile?.show_qr_on_invoice !== false;

    return (
        <div ref={ref} className={t.container}>
            {/* Header */}
            <div className={`flex flex-col sm:flex-row justify-between items-start ${t.headerBorder} pb-4 sm:pb-6 mb-4 sm:mb-6 gap-4`}>
                <div className="flex-1">
                    <h1 className={`text-xl sm:text-3xl font-black ${t.titleColor} mb-1 sm:mb-2 uppercase tracking-tight`}>
                        {businessProfile?.business_name || "My Shop"}
                    </h1>
                    <div className="text-[10px] sm:text-xs text-slate-600 space-y-0.5 sm:space-y-1">
                        <p className="font-bold text-slate-900">{businessProfile?.business_address || businessProfile?.address}</p>
                        <p>{businessProfile?.city}, {businessProfile?.state_name || businessProfile?.state} {businessProfile?.pincode}</p>
                        {businessProfile?.phone && <p className="font-medium">Phone: <span className="text-slate-900">{businessProfile.phone}</span></p>}
                        {isGst && businessProfile?.gstin && (
                            <p className="font-black text-slate-900 mt-2 border-t border-slate-200 pt-1 flex items-center gap-2">
                                <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-black">GSTIN</span>
                                {businessProfile.gstin}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-2">
                    <h2 className={`text-2xl sm:text-3xl font-black uppercase leading-tight italic ${isGst ? t.accentColor : 'text-slate-400'}`}>
                        {isGst ? "Tax Invoice" : "Bill of Supply"}
                    </h2>
                    <div className="text-right">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Serial Document ID</span>
                            <span className="font-mono font-black text-lg text-slate-900 flex items-center gap-1">
                                <span className="text-slate-300">#</span>{sale.id}
                            </span>
                        </div>
                        <div className="mt-2 text-[9px] sm:text-xs text-slate-500 font-black flex items-center gap-1 sm:justify-end">
                            <span className="opacity-50 uppercase">Date:</span> {formatDate(sale.created_at)}
                        </div>
                        {isGst && (
                            <div className="mt-1 text-[9px] sm:text-xs text-indigo-600 font-black flex items-center gap-1 sm:justify-end uppercase tracking-tighter">
                                <span className="opacity-50">Place of Supply:</span> {sale.customers?.state || sale.customer_state || businessProfile?.state_name || 'Local'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Billing Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 group transition-all hover:bg-slate-100/50">
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-white pb-1.5 flex items-center gap-2">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                        Recipient Identity
                    </h3>
                    <p className="font-black text-base text-slate-900 leading-tight">{(sale.customers?.name || sale.customer_name || 'Counter Sale')}</p>
                    {sale.customers?.phone && <p className="text-xs text-slate-600 font-bold mt-1.5 tracking-wider">{sale.customers.phone}</p>}
                    {(sale.customers?.address || sale.customer_address) && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {sale.customers?.address || sale.customer_address}
                        </p>
                    )}
                    {isGst && (sale.customers?.gstin || sale.customer_gstin) && (
                        <p className="text-[10px] font-black text-indigo-700 mt-3 bg-indigo-100/50 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-indigo-200">
                            <span className="opacity-60">Customer GST:</span>
                            {sale.customers?.gstin || sale.customer_gstin}
                        </p>
                    )}
                </div>
                <div className="p-4 flex flex-col justify-center items-end text-right">
                    <div className="space-y-2">
                        {sale.payment_status === 'paid' && (
                            <div className="flex flex-col items-end">
                                <span className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20">Authenticated Paid</span>
                                <span className="text-[8px] text-emerald-600 font-bold mt-1 uppercase tracking-tighter opacity-70">Payment Protocol: {sale.payment_method || 'Cash'}</span>
                            </div>
                        )}
                        {(sale.payment_status === 'partial' || (sale.payment_status !== 'paid' && sale.balance_due > 0)) && (
                            <div className="flex flex-col items-end">
                                <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl ${sale.amount_paid > 0 ? 'bg-orange-500 shadow-orange-500/20' : 'bg-red-500 shadow-red-500/20'} text-white`}>
                                    {sale.amount_paid > 0 ? 'Deferred Balance' : 'Full Accrual'}
                                </span>
                                <span className="text-[8px] text-red-500 font-bold mt-1 uppercase tracking-tighter opacity-70 italic">Subject to Settlement</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-4 sm:mb-6 border-x border-t border-slate-900 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse min-w-full">
                    <thead>
                        <tr className={`${t.tableHeader} text-[9px] sm:text-[10px]`}>
                            <th className="py-2.5 px-2 font-black border-r border-slate-700 w-8 text-center uppercase">#</th>
                            <th className="py-2.5 px-3 font-black border-r border-slate-700 uppercase">Product Description</th>
                            {isGst && <th className="py-2.5 px-2 font-black border-r border-slate-700 text-center w-16 uppercase">HSN/SAC</th>}
                            <th className="py-2.5 px-2 font-black border-r border-slate-700 text-center w-14 uppercase">Qty</th>
                            <th className="py-2.5 px-2 font-black border-r border-slate-700 text-right w-24 uppercase">Unit Rate</th>
                            {isGst && (
                                <>
                                    <th className="py-2.5 px-2 font-black border-r border-slate-700 text-right w-24 uppercase">Taxable</th>
                                    <th className="py-2.5 px-2 font-black text-right w-20 uppercase">GST%</th>
                                </>
                            )}
                            <th className="py-2.5 px-3 font-black text-right w-28 uppercase">Final Value</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm font-medium">
                        {items.map((item, index) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.unit_price) || 0;
                            const taxableValue = qty * rate;
                            // For non-GST (Bill of Supply), NEVER add tax — item total is just qty × rate
                            const totalTax = isGst ? calcTotalItemTax(item) : 0;
                            const totalAmount = taxableValue + totalTax;
                            
                            // Fixed: gstPct should be 0 for non-GST bills, even if product has a tax rate
                            const gstPct = isGst 
                                ? (item.tax_percent || (taxableValue > 0 ? ((totalTax / taxableValue) * 100).toFixed(0) : 0))
                                : 0;

                            return (
                                <tr key={index} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-2 text-center text-slate-400 border-r border-slate-100 font-bold">{index + 1}</td>
                                    <td className="py-4 px-3 font-black text-slate-900 border-r border-slate-100 uppercase tracking-tighter">
                                        {item.products?.name || item.name || "Item"}
                                    </td>
                                    {isGst && <td className="py-4 px-2 text-center text-slate-600 border-r border-slate-100 font-mono text-[10px]">{item.hsn_code || '---'}</td>}
                                    <td className="py-4 px-2 text-center text-slate-900 font-bold border-r border-slate-100">
                                        {qty} <span className="text-[8px] text-slate-400 uppercase font-black">{item.products?.unit || item.unit || 'pcs'}</span>
                                    </td>
                                    <td className="py-4 px-2 text-right text-slate-600 font-bold border-r border-slate-100 font-mono">{formatCurrency(rate)}</td>
                                    {isGst && (
                                        <>
                                            <td className="py-4 px-2 text-right text-slate-600 font-bold border-r border-slate-100 font-mono">{formatCurrency(taxableValue)}</td>
                                            <td className="py-4 px-2 text-right text-indigo-700 font-black border-r border-slate-100 font-mono text-[10px]">
                                                {gstPct}%
                                            </td>
                                        </>
                                    )}
                                    <td className="py-4 px-3 text-right font-black text-slate-900 font-mono bg-slate-50/30">{formatCurrency(totalAmount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Section */}
            <div className="flex flex-col sm:flex-row justify-between gap-6 mt-4">
                {/* Left: Words, GST Summary & Signature */}
                <div className="flex-1 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fiscal Declaration in Words</p>
                        <p className="text-xs font-black capitalize italic text-slate-900 leading-relaxed tracking-tight">
                            {numberToWords(displayTotal)}
                        </p>
                    </div>

                    {isGst && (
                        <div className="border border-slate-300 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-[9px] border-collapse">
                                <thead className="bg-slate-100 font-black text-slate-900 uppercase">
                                    <tr>
                                        <th className="px-2 py-2 border-r border-slate-300">GST Breakdown</th>
                                        <th className="px-2 py-2 border-r border-slate-300 text-right">Taxable</th>
                                        <th className="px-2 py-2 text-right">Computed Tax</th>
                                    </tr>
                                </thead>
                                <tbody className="font-bold text-slate-700">
                                    {isIgst ? (
                                        <tr>
                                            <td className="px-2 py-1.5 border-r border-slate-200">IGST Output Protocol</td>
                                            <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                            <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.igst_amount)}</td>
                                        </tr>
                                    ) : (
                                        <>
                                            <tr className="border-b border-slate-100">
                                                <td className="px-2 py-1.5 border-r border-slate-200">CGST Output Protocol</td>
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                                <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.cgst_amount)}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-2 py-1.5 border-r border-slate-200">SGST Output Protocol</td>
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                                <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.sgst_amount)}</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Additional Bio/Bank Info if needed */}
                    {(businessProfile?.bank_name || businessProfile?.bank_account_no) && (
                        <div className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-100 flex items-center gap-4">
                            <div className="flex-1">
                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Bank Settlement Node</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] uppercase font-bold text-slate-600">
                                    <p><span className="opacity-50">BANK:</span> {businessProfile.bank_name}</p>
                                    <p><span className="opacity-50">IFSC:</span> {businessProfile.bank_ifsc}</p>
                                    <p className="col-span-2"><span className="opacity-50">ACCOUNT:</span> {businessProfile.bank_account_no}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Grand Totals & QR */}
                <div className="w-full sm:w-[32%] space-y-4">
                    <div className={`${t.summaryBg} p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group`}>
                        {/* Interactive Sparkle Effect Placeholder */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-white/10 transition-all"></div>

                        <div className="space-y-2.5 relative z-10">
                            {/* Show subtotal row only for GST invoices; for Bill of Supply it is the same as grand total */}
                            {isGst && (
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Taxable Value</span>
                                    <span>{formatCurrency(sale.subtotal)}</span>
                                </div>
                            )}

                            {isGst && (
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widests text-indigo-400">
                                    <span>Cumulative Tax</span>
                                    <span>{formatCurrency(sale.total_tax_amount)}</span>
                                </div>
                            )}

                            {parseFloat(sale.discount_amount) > 0 && (
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-emerald-400">
                                    <span>Markdown</span>
                                    <span>-{formatCurrency(sale.discount_amount)}</span>
                                </div>
                            )}

                            <div className="border-t border-slate-700 pt-4 flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 opacity-60">{isGst ? 'Grand Total (incl. GST)' : 'Grand Total'}</span>
                                <span className="text-3xl font-black font-mono tracking-tighter text-indigo-50">{formatCurrency(displayTotal)}</span>
                            </div>

                            <div className="border-t border-slate-700 pt-3 mt-1 flex flex-col gap-1.5 text-[10px] font-bold">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 uppercase tracking-tighter">Settled</span>
                                    <span className="text-emerald-400">{formatCurrency(sale.amount_paid)}</span>
                                </div>
                                {parseFloat(sale.balance_due) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-red-400 uppercase tracking-tighter">Accrued Due</span>
                                        <span className="text-red-400 animate-pulse">{formatCurrency(sale.balance_due)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* QR Code Validation */}
                    {showQr && (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center gap-3">
                            <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                                <QRCodeSVG value={qrValue} size={64} level="H" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-slate-900 uppercase leading-tight tracking-tighter">
                                    {businessProfile?.upi_id ? 'Pay via UPI' : (isGst ? 'Digital Compliance Verified' : 'Scan for Invoice Details')}
                                </p>
                                <p className="text-[8px] text-slate-400 font-bold mt-1 leading-none uppercase">
                                    {businessProfile?.upi_id ? businessProfile.upi_id : (isGst ? 'Scanner protocol: GST-IN-2026-V1' : `Invoice #${sale.id}`)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className={`mt-10 pt-8 ${t.footerBorder} grid grid-cols-2 gap-8 items-end`}>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Terms & Protocols:</p>
                        <ul className="text-[8px] text-slate-500 font-bold list-disc pl-3 space-y-0.5 uppercase tracking-tighter">
                            <li>Goods once sold represent final asset transfer.</li>
                            <li>Electronic document: Digital signature authenticated.</li>
                            <li>Late payment interest: 18% p.a. applies on overdue settlements.</li>
                        </ul>
                    </div>
                    <p className="text-xs text-slate-900 font-black italic tracking-tight">Gratitude for choosing {businessProfile?.business_name || "us"}!</p>
                </div>
                <div className="text-right">
                    <div className="h-24 flex flex-col items-center justify-end">
                        {/* Placeholder for Signature/Stamp */}
                        <div className="relative w-32 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-10 flex items-center justify-center rotate-12">
                                <Building2 size={64} />
                            </div>
                            <span className="text-[8px] text-slate-300 font-black uppercase z-10 italic">Affix Seal Here</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest pt-2 border-t border-slate-900 min-w-[150px]">For <span className="text-indigo-600">{businessProfile?.business_name || "Authorized Entity"}</span></p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.3em]">Authorized Signatory</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InvoiceTemplate;

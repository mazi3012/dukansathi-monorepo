import React, { forwardRef } from 'react';

const InvoiceTemplate = forwardRef(({ sale, items, businessProfile }, ref) => {
    // Determine if GST is applicable
    const isGst = sale.invoice_type === 'gst' || (businessProfile?.is_gst_registered && (sale.total_tax_amount > 0 || sale.invoice_type === 'gst'));

    // Determine if it's IGST (Inter-state) or CGST+SGST (Intra-state)
    // We check if igst_amount is present, or compare states if available
    const isIgst = parseFloat(sale.igst_amount) > 0;

    // Helper to format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    // Helper to format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    // Number to words
    const numberToWords = (num) => {
        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return;
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim();
    };

    return (
        <div ref={ref} className="bg-white p-4 sm:p-8 max-w-4xl mx-auto text-slate-800 font-sans print:p-0 print:max-w-none text-xs sm:text-sm">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4 sm:pb-6 mb-4 sm:mb-6 gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 mb-1 sm:mb-2 uppercase">
                        {businessProfile?.business_name || "My Shop"}
                    </h1>
                    <div className="text-xs text-slate-600 space-y-0.5 sm:space-y-1">
                        <p className="font-bold">{businessProfile?.address}</p>
                        <p>{businessProfile?.city} {businessProfile?.pincode}</p>
                        {businessProfile?.phone && <p className="font-medium">Phone: {businessProfile.phone}</p>}
                        {isGst && businessProfile?.gstin && (
                            <p className="font-black text-slate-900 mt-1 sm:mt-2 border-t border-slate-200 pt-1">GSTIN: {businessProfile.gstin}</p>
                        )}
                    </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-300 uppercase leading-none mb-0 sm:mb-2 italic">
                        {isGst ? "Tax Invoice" : "Bill of Supply"}
                    </h2>
                    <div className="text-right">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Invoice No.</span>
                            <span className="font-mono font-black text-lg text-slate-900 leading-none">#{sale.id}</span>
                        </div>
                        <div className="mt-2 text-[10px] sm:text-xs text-slate-500 font-bold">
                            Date: {formatDate(sale.created_at)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Billing Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">Client Identity</h3>
                    <p className="font-black text-lg text-slate-900 leading-tight">{(sale.customers?.name || sale.customer_name || 'Counter Sale')}</p>
                    {sale.customers?.phone && <p className="text-xs text-slate-500 font-bold mt-1 tracking-wider">{sale.customers.phone}</p>}
                    {sale.customers?.address && <p className="text-xs text-slate-600 mt-1">{sale.customers.address}</p>}
                    {isGst && sale.customers?.gstin && (
                        <p className="text-xs font-black text-indigo-700 mt-2 bg-indigo-50 inline-block px-2 py-0.5 rounded">GSTIN: {sale.customers.gstin}</p>
                    )}
                </div>
                <div className="p-4 flex flex-col justify-end items-end text-right">
                    <div className="space-y-2">
                        {sale.payment_status === 'paid' && (
                            <span className="inline-block bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Fully Paid</span>
                        )}
                        {(sale.payment_status === 'partial' || (sale.payment_status !== 'paid' && sale.balance_due > 0)) && (
                            <span className={`${sale.amount_paid > 0 ? 'bg-orange-500 shadow-orange-500/20' : 'bg-red-500 shadow-red-500/20'} text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg`}>
                                {sale.amount_paid > 0 ? 'Payment Partial' : 'Balance Due'}
                            </span>
                        )}
                    </div>
                    {sale.payment_method && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1 justify-end">
                            Method: <span className="text-slate-900">{sale.payment_method}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-4 sm:mb-8 border border-slate-900 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse min-w-full">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] sm:text-xs">
                            <th className="py-2 px-2 font-black border-r border-slate-700 w-8 text-center">#</th>
                            <th className="py-2 px-3 font-black border-r border-slate-700">Description of Goods</th>
                            {isGst && <th className="py-2 px-2 font-black border-r border-slate-700 text-center w-16">HSN</th>}
                            <th className="py-2 px-2 font-black border-r border-slate-700 text-center w-16">Qty</th>
                            <th className="py-2 px-2 font-black border-r border-slate-700 text-right w-24">Unit Rate</th>
                            {isGst && (
                                <>
                                    <th className="py-2 px-2 font-black border-r border-slate-700 text-right w-24">Taxable</th>
                                    <th className="py-2 px-2 font-black text-right w-24">Tax Amt</th>
                                </>
                            )}
                            <th className="py-2 px-3 font-black text-right w-28">Total</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm font-medium">
                        {items.map((item, index) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.unit_price) || 0;
                            const taxableValue = qty * rate;

                            // Tax logic
                            const totalTax = parseFloat(item.total_tax_amount || 0);
                            const totalAmount = taxableValue + (isGst ? totalTax : 0);

                            return (
                                <tr key={index} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/50">
                                    <td className="py-3 px-2 text-center text-slate-400 border-r border-slate-200 font-bold">{index + 1}</td>
                                    <td className="py-3 px-3 font-black text-slate-900 border-r border-slate-200 uppercase tracking-tight">
                                        {item.products?.name || item.name || "Item"}
                                    </td>
                                    {isGst && <td className="py-3 px-2 text-center text-slate-600 border-r border-slate-200 font-mono text-xs">{item.hsn_code || '-'}</td>}
                                    <td className="py-3 px-2 text-center text-slate-900 font-bold border-r border-slate-200">
                                        {qty} <span className="text-[10px] text-slate-400 uppercase tracking-widest">{item.products?.unit || item.unit || 'pcs'}</span>
                                    </td>
                                    <td className="py-3 px-2 text-right text-slate-600 font-bold border-r border-slate-200 font-mono">{formatCurrency(rate)}</td>
                                    {isGst && (
                                        <>
                                            <td className="py-3 px-2 text-right text-slate-600 font-bold border-r border-slate-200 font-mono">{formatCurrency(taxableValue)}</td>
                                            <td className="py-3 px-2 text-right text-indigo-600 font-black border-r border-slate-200 font-mono">
                                                {formatCurrency(totalTax)}
                                            </td>
                                        </>
                                    )}
                                    <td className="py-3 px-3 text-right font-black text-slate-900 font-mono">{formatCurrency(totalAmount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Section */}
            <div className="flex flex-col sm:flex-row justify-between gap-8 mt-4">
                {/* Left: Words & GST Summary */}
                <div className="flex-1 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">In Words</p>
                        <p className="text-xs font-black capitalize italic text-slate-900 leading-relaxed">
                            {numberToWords(Math.round(sale.total_amount))} Rupees Only
                        </p>
                    </div>

                    {isGst && (
                        <div className="border border-slate-900 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 font-black text-slate-900 uppercase">
                                    <tr>
                                        <th className="px-2 py-1.5 border-r border-slate-300">Tax Type</th>
                                        <th className="px-2 py-1.5 border-r border-slate-300 text-right">Taxable</th>
                                        <th className="px-2 py-1.5 text-right">Tax Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="font-bold">
                                    {isIgst ? (
                                        <tr>
                                            <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600">IGST Output</td>
                                            <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                            <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.igst_amount)}</td>
                                        </tr>
                                    ) : (
                                        <>
                                            <tr className="border-b border-slate-100">
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600">CGST Output</td>
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                                <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.cgst_amount)}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600">SGST Output</td>
                                                <td className="px-2 py-1.5 border-r border-slate-200 text-right">{formatCurrency(sale.subtotal)}</td>
                                                <td className="px-2 py-1.5 text-right text-indigo-700">{formatCurrency(sale.sgst_amount)}</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right: Grand Totals */}
                <div className="w-full sm:w-1/3 space-y-2 bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Net Value</span>
                        <span>{formatCurrency(sale.subtotal)}</span>
                    </div>

                    {isGst && (
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-400">
                            <span>GST Total</span>
                            <span>{formatCurrency(sale.total_tax_amount)}</span>
                        </div>
                    )}

                    {parseFloat(sale.discount_amount) > 0 && (
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-400">
                            <span>Discount</span>
                            <span>-{formatCurrency(sale.discount_amount)}</span>
                        </div>
                    )}

                    <div className="border-t border-slate-700 pt-4 flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Grand Payable Amount</span>
                        <span className="text-3xl font-black font-mono tracking-tighter">{formatCurrency(sale.total_amount)}</span>
                    </div>

                    <div className="border-t border-slate-700 pt-3 mt-2 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>Received</span>
                            <span className="text-emerald-400">{formatCurrency(sale.amount_paid)}</span>
                        </div>
                        {parseFloat(sale.balance_due) > 0 && (
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-red-400">
                                <span>Pending</span>
                                <span className="text-red-500 animate-pulse">{formatCurrency(sale.balance_due)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t-2 border-slate-900 grid grid-cols-2 gap-8 items-end">
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Auth Code: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                    <p className="text-xs text-slate-600 font-bold italic">Thank you for visiting {businessProfile?.business_name || "us"}!</p>
                </div>
                <div className="text-right">
                    <div className="h-20 flex items-center justify-end">
                        {/* Placeholder for Signature/Stamp */}
                        <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-[8px] text-slate-300 font-black uppercase rotate-12">Authorized Seal</div>
                    </div>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest pt-2 border-t border-slate-900">Authorized Signatory</p>
                </div>
            </div>
        </div>
    );
});

export default InvoiceTemplate;

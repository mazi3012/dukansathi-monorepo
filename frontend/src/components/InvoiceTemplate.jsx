import React, { forwardRef } from 'react';

const InvoiceTemplate = forwardRef(({ sale, items, businessProfile }, ref) => {
    const isGst = sale.invoice_type === 'gst' || (businessProfile?.is_gst_registered && sale.invoice_type !== 'regular');

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

    // Number to words (simplified for Indian context - Lakhs/Crores not strictly implemented here, generic English)
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
            <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-4 sm:pb-6 mb-4 sm:mb-6 gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-indigo-900 mb-1 sm:mb-2">
                        {businessProfile?.business_name || "My Shop"}
                    </h1>
                    <div className="text-xs text-slate-600 space-y-0.5 sm:space-y-1">
                        {businessProfile?.address && <p>{businessProfile.address}</p>}
                        {businessProfile?.city && <p>{businessProfile.city}, {businessProfile?.pincode}</p>}
                        {businessProfile?.phone && <p>Phone: {businessProfile.phone}</p>}
                        {businessProfile?.email && <p>Email: {businessProfile.email}</p>}
                        {isGst && businessProfile?.gstin && (
                            <p className="font-semibold text-slate-800 mt-1 sm:mt-2">GSTIN: {businessProfile.gstin}</p>
                        )}
                    </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end border-t sm:border-0 border-slate-100 pt-2 sm:pt-0">
                    <h2 className="text-lg sm:text-2xl font-light text-slate-400 uppercase tracking-widest mb-0 sm:mb-1">
                        {isGst ? "Tax Invoice" : "Receipt"}
                    </h2>
                    <div className="text-right">
                        <p className="font-mono font-bold text-base sm:text-lg text-slate-700">#{sale.id}</p>
                        <p className="text-[10px] sm:text-sm text-slate-500 mt-0 sm:mt-1">Date: {formatDate(sale.created_at)}</p>
                        <div className="mt-2 text-right">
                            {sale.payment_status === 'paid' && (
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">Paid</span>
                            )}
                            {(sale.payment_status === 'partial' || (sale.payment_status !== 'paid' && sale.balance_due > 0)) && (
                                <span className={`${sale.amount_paid > 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'} px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider`}>
                                    {sale.amount_paid > 0 ? 'Partial' : 'Due'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Customer Details */}
            {(sale.customers?.name || sale.customer_name) && (
                <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
                    <p className="font-bold text-lg text-slate-800">{sale.customers?.name || sale.customer_name}</p>
                    {sale.customers?.phone && <p className="text-sm text-slate-600">{sale.customers.phone}</p>}
                    {sale.customers?.address && <p className="text-sm text-slate-600">{sale.customers.address}</p>}
                    {/* Show GSTIN for B2B if available - assuming customer might have it in future */}
                </div>
            )}

            {/* Items Table - Responsive to GST/Non-GST */}
            <div className="mb-4 sm:mb-8 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full border border-slate-200">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-xs">
                            <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 w-8 sm:w-12 text-center">#</th>
                            <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200">Item Description</th>
                            {isGst && <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-center w-16">HSN</th>}
                            <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-center w-12 sm:w-16">Qty</th>
                            <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-right w-20 sm:w-24">Rate</th>
                            {isGst && (
                                <>
                                    <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-right w-24">Taxable</th>
                                    {/* CGST */}
                                    <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-right w-20 bg-slate-100/50">
                                        <div className="flex flex-col"><span className="text-[8px]">CGST</span><span>Amt</span></div>
                                    </th>
                                    {/* SGST */}
                                    <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 border-r border-slate-200 text-right w-20 bg-slate-100/50">
                                        <div className="flex flex-col"><span className="text-[8px]">SGST</span><span>Amt</span></div>
                                    </th>
                                </>
                            )}
                            <th className="py-2 sm:py-3 px-2 font-bold text-slate-600 text-right w-24">Total</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm">
                        {items.map((item, index) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.unit_price) || 0;

                            // Calculation logic based on schema findings (Exclusive Tax)
                            const taxableValue = qty * rate;

                            let taxPercent = 0;
                            if (item.products?.tax_percent) taxPercent = item.products.tax_percent;
                            else if (item.tax_percent) taxPercent = parseFloat(item.tax_percent); // fallback if stored on item

                            // Calculate Tax Amounts
                            // Assuming Intra-state (CGST + SGST) for now as default
                            const totalTaxAmt = (taxableValue * taxPercent) / 100;
                            const cgstAmt = totalTaxAmt / 2;
                            const sgstAmt = totalTaxAmt / 2;
                            const cgstRate = taxPercent / 2;
                            const sgstRate = taxPercent / 2;

                            const totalAmount = taxableValue + totalTaxAmt;

                            return (
                                <tr key={index} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/50">
                                    <td className="py-2 sm:py-3 px-2 text-center text-slate-500 border-r border-slate-200">{index + 1}</td>
                                    <td className="py-2 sm:py-3 px-2 font-medium text-slate-800 border-r border-slate-200">
                                        {item.products?.name || item.name || "Item"}
                                        {/* Mobile view details for Non-GST mode compactness */}
                                        {!isGst && (
                                            <div className="sm:hidden text-[10px] text-slate-400 mt-1">
                                                {formatCurrency(rate)} x {qty}
                                            </div>
                                        )}
                                    </td>
                                    {isGst && <td className="py-2 sm:py-3 px-2 text-center text-slate-500 border-r border-slate-200 font-mono text-xs">{item.hsn_code || '-'}</td>}
                                    <td className="py-2 sm:py-3 px-2 text-center text-slate-600 border-r border-slate-200">
                                        {qty} <span className="text-[10px] text-slate-400 font-bold">{item.products?.unit || item.unit || 'pcs'}</span>
                                    </td>
                                    <td className="py-2 sm:py-3 px-2 text-right text-slate-600 border-r border-slate-200">{formatCurrency(rate)}</td>
                                    {isGst && (
                                        <>
                                            <td className="py-2 sm:py-3 px-2 text-right text-slate-600 border-r border-slate-200">{formatCurrency(taxableValue)}</td>
                                            <td className="py-2 sm:py-3 px-2 text-right text-slate-600 border-r border-slate-200 bg-slate-50/30">
                                                <div className="flex flex-col">
                                                    <span>{formatCurrency(cgstAmt)}</span>
                                                    <span className="text-[9px] text-slate-400">({cgstRate}%)</span>
                                                </div>
                                            </td>
                                            <td className="py-2 sm:py-3 px-2 text-right text-slate-600 border-r border-slate-200 bg-slate-50/30">
                                                <div className="flex flex-col">
                                                    <span>{formatCurrency(sgstAmt)}</span>
                                                    <span className="text-[9px] text-slate-400">({sgstRate}%)</span>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                    <td className="py-2 sm:py-3 px-2 text-right font-bold text-slate-800">{formatCurrency(totalAmount)}</td>
                                </tr>
                            );
                        })}
                        {/* Empty rows filler if needed, but skipping for now */}
                    </tbody>
                </table>
            </div>

            {/* Footer Totals */}
            <div className="flex flex-col sm:flex-row justify-between gap-8 mt-4">
                {/* Left Side: Amount in Words & Tax Summary */}
                <div className="flex-1 space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Amount in Words</p>
                        <p className="text-sm font-semibold capitalize italic text-slate-700">
                            {numberToWords(Math.round(sale.total_amount))} Rupees Only
                        </p>
                    </div>

                    {/* Tax Summary Table for GST */}
                    {isGst && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-3 py-2 border-r border-slate-200">Tax Breakdown</th>
                                        <th className="px-3 py-2 border-r border-slate-200 text-right">Taxable</th>
                                        <th className="px-3 py-2 border-r border-slate-200 text-right">CGST</th>
                                        <th className="px-3 py-2 text-right">SGST</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-slate-700 border-r border-slate-100">Total Tax</td>
                                        <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">{formatCurrency(sale.subtotal)}</td>
                                        <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">{formatCurrency(sale.total_tax_amount / 2)}</td>
                                        <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(sale.total_tax_amount / 2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right Side: Totals */}
                <div className="w-full sm:w-1/3 space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                        <span>Total Amount before Tax</span>
                        <span className="font-medium text-slate-800">{formatCurrency(sale.subtotal)}</span>
                    </div>
                    {isGst && (
                        <>
                            <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                                <span>Add: CGST</span>
                                <span className="font-medium text-slate-800">{formatCurrency(sale.total_tax_amount / 2)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                                <span>Add: SGST</span>
                                <span className="font-medium text-slate-800">{formatCurrency(sale.total_tax_amount / 2)}</span>
                            </div>
                        </>
                    )}
                    {sale.discount_amount > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm text-green-600">
                            <span>Less: Discount</span>
                            <span>-{formatCurrency(sale.discount_amount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg sm:text-xl font-bold text-slate-900 border-t-2 border-slate-800 pt-2 sm:pt-3 my-2">
                        <span>Grand Total</span>
                        <span>{formatCurrency(sale.total_amount)}</span>
                    </div>
                    {/* Amount Paid info */}
                    <div className="flex justify-between text-xs sm:text-sm pt-1 text-slate-600">
                        <span>Amount Paid</span>
                        <span>{formatCurrency(sale.amount_paid)}</span>
                    </div>
                    {sale.balance_due > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm text-red-600 font-bold bg-red-50 p-1 rounded">
                            <span>Balance Due</span>
                            <span>{formatCurrency(sale.balance_due)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Notes */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-center">
                <p className="text-sm text-slate-500 italic mb-2">Thank you for your business!</p>
                <p className="text-xs text-slate-400">Computer Generated Invoice</p>
                <div className="mt-8 flex justify-end">
                    <div className="text-right">
                        <div className="h-16 w-32 border-b border-slate-300 mb-2"></div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Authorized Signatory</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InvoiceTemplate;

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

const SalesInvoiceCard = ({ sale, items, theme = 'modern' }) => {
    if (!sale) return null;

    const isGst = sale.invoice_type === 'gst';
    const subtotal = parseFloat(sale.subtotal) || 0;
    const cgst = parseFloat(sale.cgst_amount) || 0;
    const sgst = parseFloat(sale.sgst_amount) || 0;
    const igst = parseFloat(sale.igst_amount) || 0;
    const totalTax = cgst + sgst + igst;
    const discount = parseFloat(sale.discount_amount) || 0;
    const grandTotal = parseFloat(sale.total_amount) || 0;
    const amountPaid = parseFloat(sale.amount_paid) || 0;
    const balanceDue = parseFloat(sale.balance_due) || 0;
    const isOutOfState = sale.is_out_of_state || igst > 0;

    // Determine payment status
    const getPaymentStatus = () => {
        if (grandTotal <= 0) return { label: 'Paid', color: 'emerald' };
        if (amountPaid >= grandTotal) return { label: 'Fully Paid', color: 'emerald' };
        if (amountPaid > 0) return { label: 'Partially Paid', color: 'orange' };
        return { label: 'Balance Due', color: 'red' };
    };

    const paymentStatus = getPaymentStatus();
    const colorMap = {
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
        red: 'text-red-500 bg-red-500/10 border-red-500/30',
    };

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
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Bill No.</span>
                    <span className="text-sm font-mono font-bold text-text-main">#{sale.id?.toString().slice(-6) || 'N/A'}</span>
                </div>
            </div>

            <div className="p-5">
                {/* To Details */}
                <div className="mb-6 flex justify-between items-start">
                    <div className="text-sm">
                        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Billed To:</p>
                        <p className="font-heading font-bold text-text-main text-base">{sale.customer_name || 'Walk-in Customer'}</p>
                        {sale.customer_phone && <p className="text-text-muted font-medium mt-0.5">{sale.customer_phone}</p>}
                    </div>
                    <div className="text-right">
                        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Date:</p>
                        <p className="text-sm font-semibold text-text-main">
                            {new Date(sale.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Items List */}
                <div className="mb-4 space-y-3">
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2 border-b border-card-border/50 pb-2">Purchase Summary</p>
                    <div className="space-y-3">
                        {items && items.length > 0 ? (
                            items.map((item, idx) => {
                                const itemSubtotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.selling_price) || 0);
                                const itemTotalTax = (parseFloat(item.cgst_amount) || 0) + (parseFloat(item.sgst_amount) || 0) + (parseFloat(item.igst_amount) || 0);
                                return (
                                    <div key={idx} className="flex justify-between text-sm items-center py-0.5 border-b border-card-border/20 pb-2">
                                        <div className="flex flex-col flex-1 pr-4">
                                            <span className="text-text-main font-semibold line-clamp-1">{item.product_name || item.name || 'Item'}</span>
                                            <span className="text-[10px] text-text-muted font-bold">
                                                {item.hsn_code ? `HSN: ${item.hsn_code}` : 'Standard Item'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <span className="text-[10px] text-text-muted">Qty: {item.quantity || 1}</span>
                                                <div className="font-bold text-text-main">₹{itemSubtotal.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
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
                                {cgst > 0 && (
                                    <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                        <span>CGST (Central)</span>
                                        <span>+ ₹{cgst.toFixed(2)}</span>
                                    </div>
                                )}
                                {sgst > 0 && (
                                    <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                                        <span>SGST (State)</span>
                                        <span>+ ₹{sgst.toFixed(2)}</span>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="flex justify-between text-[10px] font-bold text-text-muted border-t border-indigo-500/10 pt-1.5">
                            <span>TOTAL TAX</span>
                            <span>₹{totalTax.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Discount */}
                {discount > 0 && (
                    <div className="mb-4 py-2 px-3 rounded-lg bg-orange-50/20 dark:bg-orange-500/5 border border-orange-500/10">
                        <div className="flex justify-between text-[10px] font-bold text-orange-500">
                            <span>DISCOUNT</span>
                            <span>- ₹{discount.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Total & Payment Status */}
                <div className="pt-4 border-t border-card-border flex justify-between items-center group/total">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-60">Payment Status</span>
                        <span className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${colorMap[paymentStatus.color].split(' ')[0]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${colorMap[paymentStatus.color].split(' ')[0].replace('text-', 'bg-')}`}></span>
                            {paymentStatus.label}
                        </span>
                        {balanceDue > 0 && (
                            <span className="text-[10px] font-bold text-text-muted mt-0.5">
                                Pending: ₹{balanceDue.toFixed(2)}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-text-muted">Grand Total</span>
                        <span className="font-heading font-extrabold text-2xl text-indigo-600 dark:text-indigo-400 drop-shadow-sm">₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Premium Pattern Overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none group-hover:bg-indigo-600/10 transition-colors"></div>
        </div>
    );
};

export default SalesInvoiceCard;

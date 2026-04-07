/**
 * PDF Generator Utility
 * Unified invoice PDF generation for Chat and Sales pages
 * Uses jsPDF + jspdf-autotable for professional invoice formatting
 */

import QRCode from 'qrcode';

export const generateInvoicePDF = async ({
    sale,
    items,
    businessProfile,
    customerData,
    isGst = false,
    isOutOfState = false
}) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();

    // ========== HELPER FUNCTIONS ==========

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

    // ========== CALCULATIONS ==========

    const grandTotal = parseFloat(sale.total_amount) || 0;
    const amtPaid = parseFloat(sale.amount_paid) || 0;
    const balanceDue = parseFloat(sale.balance_due) || 0;
    const subtotal = parseFloat(sale.subtotal) || 0;
    const discount = parseFloat(sale.discount_amount) || 0;
    const totalCgst = parseFloat(sale.cgst_amount) || 0;
    const totalSgst = parseFloat(sale.sgst_amount) || 0;
    const totalIgst = parseFloat(sale.igst_amount) || 0;

    // ========== HEADER - BUSINESS DETAILS ==========

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
    
    if (businessProfile?.phone) {
        doc.text(`Phone: ${businessProfile.phone}`, 14, yPos);
        yPos += 5;
    }
    
    if (isGst && businessProfile?.gstin) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.text(`GSTIN: ${businessProfile.gstin}`, 14, yPos);
        yPos += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
    }

    // ========== INVOICE HEADER ==========

    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text(isGst ? "TAX INVOICE" : "BILL OF SUPPLY", 200, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Invoice Number: ${sale.invoice_number || 'Bill-#' + sale.id}`, 200, 30, { align: 'right' });
    doc.text(`Date: ${new Date(sale.created_at || Date.now()).toLocaleDateString('en-IN')}`, 200, 36, { align: 'right' });
    
    if (isGst) {
        const placeOfSupply = customerData?.state || businessProfile?.state_name || 'Local';
        doc.text(`Place of Supply: ${placeOfSupply}`, 200, 42, { align: 'right' });
        if (isOutOfState) {
            doc.text(`IGST Applicable: YES`, 200, 48, { align: 'right' });
        }
    }

    // ========== BILLED TO ==========

    yPos = 55;
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("BILLED TO", 14, yPos);
    yPos += 6;
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text(customerData?.name || sale.customer_name || "Walk-in Customer", 14, yPos);
    yPos += 5;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(71, 85, 105);
    
    if (customerData?.phone || sale.customer_phone) {
        doc.text(customerData?.phone || sale.customer_phone, 14, yPos);
        yPos += 5;
    }
    
    if (customerData?.address || sale.customers?.address) {
        const custAddr = customerData?.address || sale.customers?.address;
        const custAddrLines = doc.splitTextToSize(custAddr, 80);
        doc.text(custAddrLines, 14, yPos);
        yPos += (custAddrLines.length * 5);
    }
    
    if (isGst && (customerData?.gstin || sale.customers?.gstin)) {
        doc.text(`GSTIN: ${customerData?.gstin || sale.customers?.gstin}`, 14, yPos);
        yPos += 5;
    }

    // ========== ITEMS TABLE ==========

    const tableHead = isGst
        ? [['#', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit Rate', 'Taxable', isOutOfState ? 'IGST Amt' : 'GST Amt', 'Total']]
        : [['#', 'Description of Goods', 'Qty', 'Unit Rate', 'Total']];

    const tableBody = items.map((item, idx) => {
        const qty = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price || item.selling_price) || 0;
        const taxable = parseFloat(item.taxable_amount) || 0;
        const cgst = parseFloat(item.cgst_amount) || 0;
        const sgst = parseFloat(item.sgst_amount) || 0;
        const igst = parseFloat(item.igst_amount) || 0;
        const totalTaxAmt = cgst + sgst + igst;
        const total = parseFloat(item.total_price) || 0;

        if (isGst) {
            return [
                idx + 1,
                item.product_name || item.name || "Item",
                item.hsn_code || '---',
                qty.toFixed(2),
                unitPrice.toFixed(2),
                taxable.toFixed(2),
                isOutOfState ? `${(item.tax_percent || 0).toFixed(0)}% ${igst.toFixed(2)}` : totalTaxAmt.toFixed(2),
                total.toFixed(2)
            ];
        } else {
            return [
                idx + 1,
                item.product_name || item.name || "Item",
                qty.toFixed(2),
                unitPrice.toFixed(2),
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

    // ========== FINANCIAL SUMMARY ==========

    let finalY = doc.lastAutoTable.finalY + 12;

    // Compact if space is tight
    if (finalY > 240) {
        finalY = doc.lastAutoTable.finalY + 5;
    }

    // Left Side: Amount in Words & Bank Info
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("AMOUNT IN WORDS", 14, finalY);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text(numberToWords(grandTotal), 14, finalY + 5, { maxWidth: 100 });

    if (businessProfile?.bank_name) {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("BANK DETAILS", 14, finalY + 15);
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont(undefined, 'normal');
        doc.text(`Bank: ${businessProfile.bank_name} | A/c No: ${businessProfile.bank_account_no || ''}`, 14, finalY + 20);
        doc.text(`IFSC: ${businessProfile.bank_ifsc || ''}`, 14, finalY + 25);
    }

    // Right Side: Amount Breakdown
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const rightAlignX = 200;

    doc.text(`Taxable Value:`, 140, finalY);
    doc.text(`Rs. ${subtotal.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    if (isGst) {
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

    if (discount > 0) {
        doc.text(`Discount:`, 140, finalY + 6);
        doc.text(`- Rs. ${discount.toFixed(2)}`, rightAlignX, finalY + 6, { align: 'right' });
        finalY += 6;
    }

    // Grand Total
    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229);
    doc.setFont(undefined, 'bold');
    doc.text(`Grand Total:`, 140, finalY + 15);
    doc.text(`Rs. ${grandTotal.toFixed(2)}`, rightAlignX, finalY + 15, { align: 'right' });

    // Amount Paid & Balance
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

    // ========== QR CODE ==========

    let qrValue = `GSTIN: ${businessProfile?.gstin || 'N/A'}\nInvoice: ${sale.id}\nAmount: ${grandTotal}\nDate: ${new Date(sale.created_at || Date.now()).toLocaleDateString()}`;

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
            const qrDataUrl = await QRCode.toDataURL(qrValue, {
                margin: 1,
                width: 200,
                color: {
                    dark: '#1e293b', // slate-800
                    light: '#ffffff'
                }
            });
            doc.addImage(qrDataUrl, 'PNG', 175, qrY, 20, 20);
        } catch (qrErr) {
            console.warn("QR generation failed:", qrErr);
            doc.setDrawColor(226, 232, 240);
            doc.rect(175, qrY, 20, 20);
            doc.setFontSize(5);
            doc.setTextColor(148, 163, 184);
            doc.text("SECURE QR", 185, qrY + 12, { align: 'center' });
        }
    }

    // ========== FOOTER ==========

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`For ${businessProfile?.business_name || "Authorized Firm"}`, 200, qrY + 25, { align: 'right' });
    doc.line(140, qrY + 38, 200, qrY + 38);
    doc.setFontSize(8);
    doc.text("Authorized Signatory", 200, qrY + 43, { align: 'right' });

    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated invoice.", 14, qrY + 43);

    // ========== RETURN DOCUMENT ==========

    return doc;
};

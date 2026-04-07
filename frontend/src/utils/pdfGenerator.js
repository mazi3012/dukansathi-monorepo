/**
 * PDF Generator Utility - Format-aware invoice generation
 * Supports A4 (professional), Thermal 80mm, and Thermal 58mm formats
 * Uses jsPDF + jspdf-autotable for professional invoice formatting
 */

import QRCode from 'qrcode';

// Get page configuration based on format
const getPageConfig = (format = 'a4') => {
    const configs = {
        'a4': {
            pageSize: 'a4',
            pageWidth: 210,
            baseMargin: 14,
            fontSize: {
                title: 24,
                header: 10,
                normal: 10,
                small: 8,
                tiny: 6
            },
            maxAddressWidth: 100
        },
        'thermal-80': {
            pageSize: [80, 297],
            pageWidth: 80,
            baseMargin: 5,
            fontSize: {
                title: 12,
                header: 8,
                normal: 8,
                small: 6,
                tiny: 5
            },
            maxAddressWidth: 65
        },
        'thermal-58': {
            pageSize: [58, 297],
            pageWidth: 58,
            baseMargin: 3,
            fontSize: {
                title: 10,
                header: 7,
                normal: 7,
                small: 5,
                tiny: 4
            },
            maxAddressWidth: 45
        }
    };
    return configs[format] || configs['a4'];
};

export const generateInvoicePDF = async ({
    sale,
    items,
    businessProfile,
    customerData,
    isGst = false,
    isOutOfState = false,
    format = 'a4' // 'a4', 'thermal-80', 'thermal-58'
}) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const pageConfig = getPageConfig(format);
    const isThermal = format.startsWith('thermal');

    // Create PDF with appropriate format
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: pageConfig.pageSize === 'a4' ? 'a4' : pageConfig.pageSize
    });

    const m = pageConfig.baseMargin;
    const fs = pageConfig.fontSize;

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

    let yPos = m;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs.title);
    doc.setTextColor(30, 41, 59);
    const businessName = businessProfile?.business_name || "My Shop";
    doc.text(businessName, m, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs.small);
    doc.setTextColor(100, 116, 139);

    if (businessProfile?.business_address || businessProfile?.address) {
        const addr = businessProfile.business_address || businessProfile.address;
        const addrLines = doc.splitTextToSize(addr, pageConfig.maxAddressWidth);
        doc.text(addrLines, m, yPos);
        yPos += (addrLines.length * 3.5);
    }

    const locationLine = `${businessProfile?.city || ''}, ${businessProfile?.state_name || businessProfile?.state || ''} ${businessProfile?.pincode || ''}`.trim();
    if (locationLine.length > 2) {
        doc.text(locationLine, m, yPos);
        yPos += 3.5;
    }

    if (businessProfile?.phone) {
        doc.text(`Ph: ${businessProfile.phone}`, m, yPos);
        yPos += 3.5;
    }

    if (isGst && businessProfile?.gstin) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(fs.small);
        doc.setTextColor(79, 70, 229);
        doc.text(`GSTIN: ${businessProfile.gstin}`, m, yPos);
        yPos += 3.5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
    }

    // Spacing
    yPos += isThermal ? 2 : 4;

    // ========== INVOICE HEADER ==========

    doc.setFontSize(fs.header);
    doc.setTextColor(79, 70, 229);
    const invoiceTitle = isGst ? "TAX INVOICE" : "BILL OF SUPPLY";
    doc.text(invoiceTitle, pageConfig.pageWidth - m, yPos, { align: 'right' });

    doc.setFontSize(fs.small);
    doc.setTextColor(148, 163, 184);
    yPos += 3.5;
    const invoiceNum = `Inv: ${sale.invoice_number || 'Bill-#' + sale.id}`;
    doc.text(invoiceNum, pageConfig.pageWidth - m, yPos, { align: 'right' });

    const dateStr = `Date: ${new Date(sale.created_at || Date.now()).toLocaleDateString('en-IN')}`;
    yPos += 3;
    doc.text(dateStr, pageConfig.pageWidth - m, yPos, { align: 'right' });

    yPos += isThermal ? 2 : 3;

    // ========== BILLED TO ==========

    doc.setFontSize(fs.small);
    doc.setTextColor(148, 163, 184);
    doc.text("BILLED TO", m, yPos);
    yPos += 2.5;

    doc.setFontSize(fs.normal);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    const custName = customerData?.name || sale.customer_name || "Walk-in";
    doc.text(custName, m, yPos);
    yPos += 3;

    doc.setFontSize(fs.small);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(71, 85, 105);

    if (customerData?.phone || sale.customer_phone) {
        const phone = customerData?.phone || sale.customer_phone;
        doc.text(`Ph: ${phone}`, m, yPos);
        yPos += 2.5;
    }

    if (customerData?.address) {
        const custAddr = customerData.address;
        const custAddrLines = doc.splitTextToSize(custAddr, pageConfig.maxAddressWidth);
        doc.text(custAddrLines, m, yPos);
        yPos += (custAddrLines.length * 2.5);
    }

    yPos += isThermal ? 1.5 : 3;

    // ========== ITEMS TABLE ==========

    const tableHead = isGst
        ? [['#', 'Item', 'HSN', isThermal ? 'Q' : 'Qty', isThermal ? 'Rate' : 'Unit Rate', isThermal ? 'Tax' : 'Taxable', isOutOfState ? 'IGST' : 'GST', 'Total']]
        : [['#', 'Item', isThermal ? 'Q' : 'Qty', isThermal ? 'Rate' : 'Unit Rate', 'Total']];

    const tableBody = items.slice(0, isThermal ? 10 : 20).map((item, idx) => {
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
                item.hsn_code || '—',
                qty.toFixed(isThermal ? 0 : 2),
                unitPrice.toFixed(2),
                taxable.toFixed(2),
                isOutOfState ? `${(item.tax_percent || 0).toFixed(0)}% ${igst.toFixed(2)}` : totalTaxAmt.toFixed(2),
                total.toFixed(2)
            ];
        } else {
            return [
                idx + 1,
                item.product_name || item.name || "Item",
                qty.toFixed(isThermal ? 0 : 2),
                unitPrice.toFixed(2),
                total.toFixed(2)
            ];
        }
    });

    autoTable(doc, {
        startY: yPos,
        head: tableHead,
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: fs.small },
        bodyStyles: { textColor: [30, 41, 59], fontSize: fs.small },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: m, right: m },
        cellPadding: isThermal ? 1 : 2
    });

    let finalY = doc.lastAutoTable.finalY + (isThermal ? 2 : 4);

    // ========== FINANCIAL SUMMARY ==========

    doc.setFontSize(fs.small);
    doc.setTextColor(71, 85, 105);
    const rightX = pageConfig.pageWidth - m;
    const labelX = pageConfig.pageWidth * 0.55;

    doc.text(`Taxable:`, labelX, finalY);
    doc.text(`₹${subtotal.toFixed(2)}`, rightX, finalY, { align: 'right' });

    if (isGst) {
        finalY += 2.5;
        if (isOutOfState) {
            doc.text(`IGST:`, labelX, finalY);
            doc.text(`₹${totalIgst.toFixed(2)}`, rightX, finalY, { align: 'right' });
        } else {
            if (totalCgst > 0) {
                doc.text(`CGST:`, labelX, finalY);
                doc.text(`₹${totalCgst.toFixed(2)}`, rightX, finalY, { align: 'right' });
                finalY += 2.5;
            }
            if (totalSgst > 0) {
                doc.text(`SGST:`, labelX, finalY);
                doc.text(`₹${totalSgst.toFixed(2)}`, rightX, finalY, { align: 'right' });
            }
        }
    }

    if (discount > 0) {
        finalY += 2.5;
        doc.text(`Discount:`, labelX, finalY);
        doc.text(`-₹${discount.toFixed(2)}`, rightX, finalY, { align: 'right' });
    }

    finalY += isThermal ? 3 : 4;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(fs.header);
    doc.setTextColor(79, 70, 229);
    doc.text(`Total:`, labelX, finalY);
    doc.text(`₹${grandTotal.toFixed(2)}`, rightX, finalY, { align: 'right' });

    finalY += 2.5;
    doc.setFontSize(fs.small);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`Paid:`, labelX, finalY);
    doc.text(`₹${amtPaid.toFixed(2)}`, rightX, finalY, { align: 'right' });

    if (balanceDue > 0) {
        finalY += 2.5;
        doc.setTextColor(220, 38, 38);
        doc.setFont(undefined, 'bold');
        doc.text(`Balance:`, labelX, finalY);
        doc.text(`₹${balanceDue.toFixed(2)}`, rightX, finalY, { align: 'right' });
    }

    // ========== QR CODE (A4 only) ==========

    if (!isThermal) {
        let qrY = finalY + 6;
        if (qrY > 250) qrY = 245;

        let qrValue = `GSTIN: ${businessProfile?.gstin || 'N/A'}\nInvoice: ${sale.id}\nAmount: ${grandTotal}\nDate: ${new Date(sale.created_at || Date.now()).toLocaleDateString()}`;

        if (businessProfile?.upi_id) {
            const name = encodeURIComponent(businessProfile.business_name || 'Business');
            const amount = grandTotal;
            const note = encodeURIComponent(`Inv ${sale.id}`);
            qrValue = `upi://pay?pa=${businessProfile.upi_id}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
        }

        try {
            const qrDataUrl = await QRCode.toDataURL(qrValue, {
                margin: 1,
                width: 200,
                color: { dark: '#1e293b', light: '#ffffff' }
            });
            doc.addImage(qrDataUrl, 'PNG', 175, qrY, 20, 20);
        } catch (qrErr) {
            console.warn("QR generation failed:", qrErr);
        }

        // Footer
        doc.setFontSize(fs.small);
        doc.setTextColor(30, 41, 59);
        doc.text(`For ${businessProfile?.business_name || "Authorized Firm"}`, rightX, qrY + 25, { align: 'right' });
        doc.line(140, qrY + 28, rightX, qrY + 28);
        doc.setFontSize(fs.tiny);
        doc.text("Authorized Signatory", rightX, qrY + 32, { align: 'right' });
        doc.setTextColor(150, 150, 150);
        doc.text("Computer generated invoice.", m, qrY + 32);
    }

    return doc;
};


// pdfGenerator.js - Unified PDF Generation Utility

export const generateInvoicePDF = async ({ 
    sale, 
    items, 
    businessProfile, 
    customerName,
    customerPhone,
    customerGstin,
    customerState,
    isGst
}) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

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

        const amountArr = parseFloat(num || 0).toFixed(2).split('.');
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
    doc.text(businessProfile?.business_name || "My Store", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    let yPos = 30;
    if (businessProfile?.business_address || businessProfile?.address) {
        doc.text(businessProfile.business_address || businessProfile.address, 14, yPos);
        yPos += 5;
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
    doc.text(`Document ID: #${sale.id}`, 200, 30, { align: 'right' });
    doc.text(`Date: ${new Date(sale.created_at).toLocaleDateString('en-IN')}`, 200, 36, { align: 'right' });
    if (isGst) {
        const placeOfSupply = customerState || sale.customers?.state || businessProfile?.state_name || 'Local';
        doc.text(`Place of Supply: ${placeOfSupply}`, 200, 42, { align: 'right' });
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
    doc.text(customerName || "Walk-in Customer", 14, yPos);
    yPos += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(71, 85, 105);
    if (customerPhone) { doc.text(customerPhone, 14, yPos); yPos += 5; }
    if (isGst && customerGstin) { doc.text(`GSTIN: ${customerGstin}`, 14, yPos); yPos += 5; }

    // Table
    const tableHead = isGst
        ? [['#', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit Rate', 'Taxable', 'GST Amt', 'Total']]
        : [['#', 'Description of Goods', 'Qty', 'Unit Rate', 'Total']];

    const tableBody = items.map((item, idx) => {
        const q = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unit_price) || 0;
        const taxable = parseFloat(item.taxable_amount) || 0;
        const cgst = parseFloat(item.cgst_amount) || 0;
        const sgst = parseFloat(item.sgst_amount) || 0;
        const igst = parseFloat(item.igst_amount) || 0;
        const totalTaxAmt = cgst + sgst + igst;
        const total = parseFloat(item.total_amount || item.total_price) || 0;

        if (isGst) {
            return [
                idx + 1,
                item.product_name || item.name || "Item",
                item.hsn_code || '---',
                q,
                rate.toFixed(2),
                taxable.toFixed(2),
                totalTaxAmt.toFixed(2),
                total.toFixed(2)
            ];
        } else {
            return [
                idx + 1,
                item.product_name || item.name || "Item",
                q,
                rate.toFixed(2),
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
    if (finalY > 240) finalY = doc.lastAutoTable.finalY + 5;

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

    const subtotal = parseFloat(sale.subtotal || sale.taxable_amount) || 0;
    const cgstTotal = parseFloat(sale.cgst_amount) || 0;
    const sgstTotal = parseFloat(sale.sgst_amount) || 0;
    const igstTotal = parseFloat(sale.igst_amount) || 0;
    const grandTotal = parseFloat(sale.total_amount) || 0;
    const amountPaid = parseFloat(sale.amount_paid) || 0;
    const balanceDue = parseFloat(sale.balance_due) || 0;

    doc.text(`Taxable Value:`, 140, finalY);
    doc.text(`Rs. ${subtotal.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    if (isGst) {
        if (igstTotal > 0) {
            doc.text(`IGST:`, 140, finalY + 6);
            doc.text(`Rs. ${igstTotal.toFixed(2)}`, rightAlignX, finalY + 6, { align: 'right' });
        } else {
            doc.text(`CGST:`, 140, finalY + 6);
            doc.text(`Rs. ${cgstTotal.toFixed(2)}`, rightAlignX, finalY + 6, { align: 'right' });
            doc.text(`SGST:`, 140, finalY + 12);
            doc.text(`Rs. ${sgstTotal.toFixed(2)}`, rightAlignX, finalY + 12, { align: 'right' });
            finalY += 6;
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
    doc.text(`Rs. ${amountPaid.toFixed(2)}`, rightAlignX, finalY + 22, { align: 'right' });

    if (balanceDue > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Balance Due:`, 140, finalY + 28);
        doc.text(`Rs. ${balanceDue.toFixed(2)}`, rightAlignX, finalY + 28, { align: 'right' });
    }

    // QR Logic with Dual Provider Fallback
    const qrValue = businessProfile?.upi_id 
        ? `upi://pay?pa=${businessProfile.upi_id}&pn=${encodeURIComponent(businessProfile.business_name || 'Business')}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent(`Inv ${sale.id}`)}`
        : `GSTIN: ${businessProfile?.gstin || 'N/A'}\nInvoice: ${sale.id}\nAmount: ${grandTotal}\nDate: ${new Date(sale.created_at).toLocaleDateString()}`;

    if (businessProfile?.show_qr_on_invoice !== false) {
        let qrY = finalY + 35;
        if (qrY > 260) qrY = 250;

        const tryLoadQR = async (url) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = url;
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
                setTimeout(() => reject(new Error('Timeout')), 6000);
            });
        };

        try {
            // Priority 1: QRServer
            const url1 = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`;
            let qrBase64;
            try {
                qrBase64 = await tryLoadQR(url1);
            } catch (e) {
                console.warn("QRServer failed, trying Google Charts...");
                // Priority 2: Google Charts
                const url2 = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(qrValue)}`;
                try {
                    qrBase64 = await tryLoadQR(url2);
                } catch (e2) {
                    console.warn("Google Charts failed, trying QuickChart...");
                    // Priority 3: QuickChart
                    const url3 = `https://quickchart.io/qr?size=200&text=${encodeURIComponent(qrValue)}`;
                    qrBase64 = await tryLoadQR(url3);
                }
            }
            doc.addImage(qrBase64, 'PNG', 170, qrY, 25, 25);
        } catch (qrErr) {
            console.warn("All QR providers failed:", qrErr);
            doc.setDrawColor(226, 232, 240);
            doc.rect(170, qrY, 25, 25);
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text("SCAN IN APP", 182.5, qrY + 14, { align: 'center' });
        }
    }

    // Signature
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    let sigY = finalY + 60;
    if (sigY > 285) sigY = 280;
    
    doc.text(`For ${businessProfile?.business_name || "Authorized Firm"}`, 200, sigY, { align: 'right' });
    doc.line(140, sigY + 10, 200, sigY + 10);
    doc.setFontSize(8);
    doc.text("Authorized Signatory", 200, sigY + 15, { align: 'right' });
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated invoice.", 14, sigY + 15);

    return doc;
};

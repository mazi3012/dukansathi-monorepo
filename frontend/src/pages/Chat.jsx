import qrcode from 'qrcode';

// ... other imports

const generateQRCode = async (data) => {
  try {
    const qrDataUrl = await qrcode.toDataURL(data);
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null; // return null if QR generation fails
  }
};

const generatePDF = async () => {
  const doc = new jsPDF();
  const qrData = 'Your QR data';
  const qrCode = await generateQRCode(qrData);

  if (qrCode) {
    doc.addImage(qrCode, 'PNG', 15, 40, 180, 160);
  } else {
    doc.text('QR code could not be generated', 15, 40);
  }

  // ... rest of PDF generation logic
  doc.save('document.pdf');
};

// ... other code for the Chat component
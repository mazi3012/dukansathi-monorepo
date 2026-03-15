import React from 'react';
import { jsPDF } from "jspdf";
import QRCode from 'qrcode';

const Chat = () => {
    const generateQRCode = async (text) => {
        try {
            const qrCodeDataURL = await QRCode.toDataURL(text);
            return qrCodeDataURL;
        } catch (err) {
            console.error(err);
        }
    };

    const downloadPDF = async () => {
        const doc = new jsPDF();
        const qrCodeDataURL = await generateQRCode('upi://pay?pa=your_upi_id&pn=your_name&mc=your_mc&tid=your_tid&am=amount&tn=your_note&am=amount&cu=INR&url=https://yourlink.com');

        doc.text("Your QR Code for UPI Payment:", 10, 10);
        doc.addImage(qrCodeDataURL, 'PNG', 10, 20, 50, 50);
        doc.save("upi_qr_payment.pdf");
    };

    return (
        <div>
            <h1>Chat Page</h1>
            <button onClick={downloadPDF}>Download UPI QR</button>
            {/* Other Chat functionalities */}
        </div>
    );
};

export default Chat;
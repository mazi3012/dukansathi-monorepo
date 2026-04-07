import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Share2, Copy, MessageCircle, Mail, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const PrintFormatModal = ({ 
    isOpen, 
    onClose, 
    sale, 
    onPrint, 
    onDownload, 
    isGenerating = false,
    showShare = false,
    onShare = null
}) => {
    const [selectedFormat, setSelectedFormat] = useState('a4'); // 'a4', 'thermal-80', 'thermal-58'
    const [showShareMenu, setShowShareMenu] = useState(false);

    // Load saved format preference
    useEffect(() => {
        const savedFormat = localStorage.getItem('invoicePrintFormat');
        if (savedFormat) setSelectedFormat(savedFormat);
    }, []);

    // Save format preference
    const handleFormatChange = (format) => {
        setSelectedFormat(format);
        localStorage.setItem('invoicePrintFormat', format);
    };

    const formats = {
        'a4': {
            label: 'A4 Paper',
            description: 'Standard 8.27 × 11.69 inches',
            icon: '📄',
            width: '210mm',
            preview: 'h-96'
        },
        'thermal-80': {
            label: 'Thermal 80mm',
            description: '80mm width (standard thermal)',
            icon: '🖨️',
            width: '80mm',
            preview: 'h-96'
        },
        'thermal-58': {
            label: 'Thermal 58mm',
            description: '58mm width (compact thermal)',
            icon: '📠',
            width: '58mm',
            preview: 'h-96'
        }
    };

    const format = formats[selectedFormat];

    const handleShare = async (platform) => {
        const invoiceId = sale?.id || 'Invoice';
        const amount = sale?.total_amount ? `₹${parseFloat(sale.total_amount).toFixed(2)}` : '';
        const customerName = sale?.customer_name || 'Customer';

        const messages = {
            whatsapp: `Hi ${customerName}, your invoice #${invoiceId} is ready. Amount: ${amount}. Please check the attached bill.`,
            email: `Invoice #${invoiceId} - Amount: ${amount}`,
            sms: `Invoice #${invoiceId} ready. Amount: ${amount}. Thank you!`,
            copy: `Invoice #${invoiceId} - Amount: ${amount}`
        };

        try {
            if (platform === 'whatsapp') {
                const message = encodeURIComponent(messages.whatsapp);
                window.open(`https://wa.me/?text=${message}`, '_blank');
            } else if (platform === 'email') {
                const subject = encodeURIComponent(`Invoice #${invoiceId}`);
                const body = encodeURIComponent(`${messages.email}\n\nPlease find the invoice attached.`);
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
            } else if (platform === 'sms') {
                const message = encodeURIComponent(messages.sms);
                window.open(`sms:?body=${message}`, '_blank');
            } else if (platform === 'copy') {
                await navigator.clipboard.writeText(`Invoice #${invoiceId} - ${amount}`);
                toast.success('Invoice details copied to clipboard!');
            }

            if (onShare) {
                onShare(platform);
            }
        } catch (error) {
            toast.error('Share failed');
            console.error('Share error:', error);
        }

        setShowShareMenu(false);
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl bg-card-bg dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-card-border bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                    <div>
                        <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
                            <Printer size={24} className="text-indigo-600" />
                            Print & Share Invoice
                        </h2>
                        <p className="text-sm text-text-muted mt-1">Select format and action</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-card-border rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Format Selection */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-card-border">
                        <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">
                            Select Format
                        </p>

                        <div className="grid grid-cols-1 gap-3 mb-8">
                            {Object.entries(formats).map(([key, fmt]) => (
                                <motion.button
                                    key={key}
                                    onClick={() => handleFormatChange(key)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                        selectedFormat === key
                                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                                            : 'border-card-border bg-card-bg/50 hover:border-indigo-300'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">{fmt.icon}</span>
                                        <div className="flex-1">
                                            <p className="font-bold text-text-main">{fmt.label}</p>
                                            <p className="text-xs text-text-muted mt-1">{fmt.description}</p>
                                        </div>
                                        {selectedFormat === key && (
                                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">
                            Action
                        </p>

                        <div className="space-y-2">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    onPrint(selectedFormat);
                                    onClose();
                                }}
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-400 disabled:opacity-60 transition-all shadow-md"
                            >
                                <Printer size={18} />
                                {isGenerating ? 'Generating...' : 'Print'}
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    onDownload(selectedFormat);
                                    onClose();
                                }}
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:bg-emerald-400 disabled:opacity-60 transition-all shadow-md"
                            >
                                <Download size={18} />
                                {isGenerating ? 'Generating...' : 'Download PDF'}
                            </motion.button>

                            {showShare && (
                                <div className="relative">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowShareMenu(!showShareMenu)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-md"
                                    >
                                        <Share2 size={18} />
                                        Share Invoice
                                    </motion.button>

                                    {/* Share Menu */}
                                    {showShareMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-card-bg border border-card-border rounded-xl shadow-xl overflow-hidden z-10"
                                        >
                                            <button
                                                onClick={() => handleShare('whatsapp')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card-border transition-colors text-left"
                                            >
                                                <MessageCircle size={18} className="text-green-500" />
                                                <span className="text-sm font-semibold">Share via WhatsApp</span>
                                            </button>
                                            <button
                                                onClick={() => handleShare('email')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card-border transition-colors text-left border-t border-card-border"
                                            >
                                                <Mail size={18} className="text-blue-500" />
                                                <span className="text-sm font-semibold">Share via Email</span>
                                            </button>
                                            <button
                                                onClick={() => handleShare('sms')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card-border transition-colors text-left border-t border-card-border"
                                            >
                                                <Phone size={18} className="text-orange-500" />
                                                <span className="text-sm font-semibold">Share via SMS</span>
                                            </button>
                                            <button
                                                onClick={() => handleShare('copy')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card-border transition-colors text-left border-t border-card-border"
                                            >
                                                <Copy size={18} className="text-indigo-500" />
                                                <span className="text-sm font-semibold">Copy Invoice Details</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Format Preview */}
                    <div className="w-80 bg-card-bg/40 p-6 flex flex-col items-center justify-center border-l border-card-border hidden lg:flex">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Preview</p>

                        <div
                            style={{ width: format.width }}
                            className={`bg-white rounded-lg shadow-2xl ${format.preview} overflow-hidden border-4 border-dashed border-indigo-300 flex items-center justify-center`}
                        >
                            <div className="text-center p-4">
                                <span className="text-6xl mb-2 block">{format.icon}</span>
                                <p className="font-bold text-text-main text-sm">{format.label}</p>
                                <p className="text-xs text-text-muted mt-2">{format.width}</p>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-text-muted mb-2">Format Details</p>
                            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-left">
                                <p className="text-xs font-semibold text-indigo-600">
                                    {selectedFormat === 'a4' && '📄 Standard office paper size. Best for filing and professional use.'}
                                    {selectedFormat === 'thermal-80' && '🖨️ Thermal printer (80mm). Perfect for retail, restaurants, and quick printing.'}
                                    {selectedFormat === 'thermal-58' && '📠 Compact thermal (58mm). Space-saving for portable thermal printers.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PrintFormatModal;

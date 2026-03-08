import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit2, ChevronDown, ChevronUp, Loader2, Filter, Download as DownloadIcon, ArrowUpRight, AlertTriangle, Trash2 } from 'lucide-react';
import { InventorySkeleton, HeaderSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { productRepo } from '../lib/db/productRepository';
import { syncEngine } from '../lib/db/syncEngine';
import toast from 'react-hot-toast';

const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); // Changed from 'search' to 'searchTerm'
    const [showModal, setShowModal] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Added for new modal state

    // Full Schema Form State
    const initialFormState = {
        name: '', description: '', sku: '', barcode: '', category: '',
        cost_price: '', selling_price: '', mrp: '', tax_percent: '0',
        stock_quantity: '', min_stock_level: '5', unit: 'pcs',
        expiry_date: '', batch_number: '', warranty_months: '', image: null,
        has_serial_tracking: false, discount: '0',
        cgst_percent: '', sgst_percent: '', igst_percent: '', serial_numbers: '',
        isGst: false, tax_type: 'exclusive', hsn_code: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // Fetch Data on Load
    const fetchData = React.useCallback(async () => {
        try {
            setLoading(true);

            // 1. Get User Profile for GST Strategy (Keep Supabase for Auth/Profile)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);
            }

            // 2. Get Products from SQLite
            const productsData = await productRepo.getAll();
            setProducts(productsData || []);

            // 3. Trigger background sync if online
            if (navigator.onLine) {
                syncEngine.syncAll().then(() => {
                    // Refresh from local DB after sync completes
                    productRepo.getAll().then(data => setProducts(data));
                });
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Auto-refresh when returning to tab (e.g. from Telegram)
        const onFocus = () => fetchData();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchData]);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Image Compression Utility
    const compressImage = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 800;
                    if (width > height && width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.7);
                };
            };
        });
    };

    // Handlers
    const handleAddNew = () => {
        // Default to GST mode if user is registered, else simple
        setFormData({
            ...initialFormState,
            isGst: userProfile?.is_gst_registered || false
        });
        setEditingId(null);
        setShowModal(true);
    };

    const handleEdit = (product) => {
        setFormData({
            ...initialFormState,
            ...product,
            // Map DB fields if they differ slightly, or ensure DB columns match form state
            isGst: product.is_gst_applicable || false,
            tax_percent: product.tax_percent || '0',
            // Ensure numbers are strings for inputs
            stock_quantity: product.stock_quantity || '',
            selling_price: product.selling_price || '',
            cost_price: product.cost_price || '',
            unit: product.unit || 'pcs',
            tax_type: product.tax_type || 'exclusive',
            hsn_code: product.hsn_code || '',
            // Note: Image handling would go here
        });
        setEditingId(product.id);
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            let user = null;
            const { data: authData } = await supabase.auth.getUser();
            user = authData.user;
            if (!user) return alert("Please login first");

            const payload = {
                user_id: user ? user.id : 'anon',
                name: formData.name,
                description: formData.description,
                sku: formData.sku,
                barcode: formData.barcode,
                category: formData.category,
                unit: formData.unit,
                cost_price: parseFloat(formData.cost_price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                mrp: parseFloat(formData.mrp) || 0,
                stock_quantity: parseInt(formData.stock_quantity) || 0,
                min_stock_level: parseInt(formData.min_stock_level) || 0,
                tax_percent: parseFloat(formData.tax_percent) || 0,
                hsn_code: formData.hsn_code,
                expiry_date: formData.expiry_date || null,
                batch_number: formData.batch_number,
                warranty_months: parseInt(formData.warranty_months) || 0,
                is_gst_applicable: formData.isGst,
                tax_type: formData.tax_type,
                image_url: formData.image_url || null
            };

            // Handle Image Upload if new image selected
            if (formData.image instanceof File) {
                toast.loading("Uploading optimized photo...", { id: 'img-up' });
                try {
                    const compressed = await compressImage(formData.image);
                    const uploadFormData = new FormData();
                    uploadFormData.append('file', compressed);

                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/upload-product-image`, {
                        method: 'POST',
                        body: uploadFormData,
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const data = await res.json();
                    if (data.url) {
                        payload.image_url = data.url;
                    }
                    toast.success("Photo uploaded", { id: 'img-up' });
                } catch (imgErr) {
                    console.error("Image upload failed:", imgErr);
                    toast.error("Photo upload failed, saving without photo", { id: 'img-up' });
                }
            }

            let error;
            if (editingId) {
                await productRepo.upsert({ ...payload, id: editingId });
            } else {
                // Generate a temporary BigInt ID for local-first
                const localId = Date.now();
                await productRepo.upsert({ ...payload, id: localId });
            }

            setShowModal(false);
            fetchData(); // Refresh list from local DB

            // Push to cloud immediately if online
            if (navigator.onLine) {
                syncEngine.syncAll();
            }
        } catch (err) {
            console.error("Error saving product:", err);
            alert("Failed to save product. " + err.message);
        }
    };

    const handleDeleteProduct = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure? This delete cannot be undone. Data will be deleted permanently.")) {
            try {
                await productRepo.delete(id);
                toast.success("Product deleted successfully");
                fetchData();
            } catch (err) {
                console.error("Error deleting product:", err);
                toast.error("Failed to delete product. " + err.message);
            }
        }
    };


    return (
        <div className="pb-20 min-h-screen relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Page Title Section - Streamlined */}
            {loading && products.length === 0 ? (
                <HeaderSkeleton />
            ) : (
                <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-10 transition-all duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-110">
                            <Package size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Digital Vault</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors flex items-center gap-2">
                                Assets • {filteredProducts.length} Entries • Live Sync
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-hover:text-indigo-500" size={18} />
                            <input
                                placeholder="Query database..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-[280px] bg-card-bg/40 backdrop-blur-xl border border-card-border p-4 pl-12 rounded-2xl outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-text-main font-bold transition-all text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                        >
                            <Plus size={18} strokeWidth={3} />
                            Initialize Asset
                        </button>
                    </div>
                </header>
            )}

            {/* List */}
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
                {loading && products.length === 0 ? (
                    [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="glass-card rounded-[40px] p-7 h-64 border border-card-border/50 animate-pulse">
                            <div className="flex justify-between mb-6">
                                <div className="w-20 h-20 bg-card-bg rounded-[28px]" />
                                <div className="space-y-2">
                                    <div className="h-6 w-24 bg-card-bg rounded-lg" />
                                    <div className="h-4 w-16 bg-card-bg rounded-lg" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-6 w-3/4 bg-card-bg rounded-lg" />
                                <div className="h-4 w-1/2 bg-card-bg rounded-lg" />
                            </div>
                        </div>
                    ))
                ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-24 glass-card rounded-[40px] border-dashed border-card-border/50">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                            <Package size={40} className="text-indigo-500/40" />
                        </div>
                        <h3 className="text-2xl font-heading font-black text-text-main mb-2 transition-colors">Catalog Flush</h3>
                        <p className="text-text-muted font-bold max-w-sm mx-auto mb-8 transition-colors">No assets discovered in this sector. Synchronize or create a new entry.</p>
                        <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-indigo-500/10 text-indigo-500 font-extrabold rounded-2xl border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:scale-105 active:scale-95">
                            Create First Asset
                        </button>
                    </div>
                ) : (
                    filteredProducts.map((product, index) => {
                        const margin = product.cost_price && product.selling_price
                            ? (((product.selling_price - product.cost_price) / product.cost_price) * 100).toFixed(1)
                            : null;
                        const isLowStock = product.stock_quantity <= (product.min_stock_level || 5);
                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03, duration: 0.5 }}
                                className="glass-card rounded-[40px] p-7 hover:-translate-y-3 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-700 group relative overflow-hidden active:scale-95"
                            >
                                {/* Decorative Glow */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/[0.03] rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-indigo-500/[0.08] transition-all duration-700" />

                                <div className="flex items-start justify-between mb-6 relative z-10">
                                    <div className="w-20 h-20 bg-card-bg/50 backdrop-blur-xl rounded-[28px] flex items-center justify-center border border-card-border/50 shadow-2xl group-hover:border-indigo-500/40 transition-all duration-700 overflow-hidden ring-4 ring-transparent group-hover:ring-indigo-500/5">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <Package size={32} strokeWidth={1.5} className="text-text-muted group-hover:text-indigo-500 transition-colors duration-700" />
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-3xl font-black font-heading text-text-main tracking-tighter transition-colors group-hover:text-indigo-500">₹{product.selling_price}</div>
                                        {margin !== null && (
                                            <div className={`text-[9px] font-black px-3 py-1 rounded-full border mt - 2 flex items-center gap-1.5 backdrop-blur-md transition-all ${parseFloat(margin) > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} `}>
                                                {parseFloat(margin) > 0 ? <ArrowUpRight size={12} strokeWidth={3} /> : <AlertTriangle size={12} />}
                                                {margin}% GAIN
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div>
                                        <h3 className="font-heading font-black text-text-main text-xl tracking-tight truncate transition-colors group-hover:text-indigo-500">{product.name}</h3>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1 transition-colors group-hover:text-text-main/60">{product.category || 'Legacy Catalog'}</p>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-card-border/30">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-text-muted/60 uppercase tracking-widest">Inventory State</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={`w-2.5 h-2.5 rounded-full ${isLowStock ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'} `} />
                                                <span className={`text-base font-black ${isLowStock ? 'text-red-500' : 'text-text-main'} tracking-tighter`}>
                                                    {product.stock_quantity} <span className="text-[10px] text-text-muted uppercase tracking-wider ml-1">{product.unit || 'pcs'}</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleDeleteProduct(product.id, e)}
                                                className="w-12 h-12 rounded-2xl bg-red-500/5 backdrop-blur-xl border border-red-500/10 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/10 transition-all active:scale-90 shadow-lg"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="w-12 h-12 rounded-2xl bg-card-bg/80 backdrop-blur-xl border border-card-border flex items-center justify-center text-text-muted hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all active:scale-90 shadow-lg"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {isLowStock && (
                                        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
                                                <AlertTriangle size={14} className="text-red-500" />
                                            </div>
                                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Low Stock Alert</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* FAB (Mobile Only) */}
            <button
                onClick={handleAddNew}
                className="md:hidden fixed right-4 bottom-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center z-40 active:scale-95 transition-transform"
            >
                <Plus size={28} />
            </button>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setShowModal(false)}
                        />

                        <motion.div
                            initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-bg-main w-full max-w-2xl h-[95vh] sm:h-[90vh] sm:rounded-[40px] rounded-t-[40px] p-8 pointer-events-auto flex flex-col shadow-2xl border border-card-border relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                            <div className="flex justify-between items-center mb-8 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5">
                                        <Package size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black font-heading text-text-main transition-colors tracking-tight">
                                            {editingId ? 'Edit Asset' : 'Manifest Entry'}
                                        </h2>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] transition-colors mt-1">Operational Logistics Interface</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-12 h-12 rounded-2xl bg-card-bg/80 border border-card-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/50 transition-all active:scale-90 shadow-sm"
                                >
                                    <Plus className="rotate-45" size={24} />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 space-y-10 pr-2 pb-8 scrollbar-hide">
                                {/* Basic Info */}
                                <section className="space-y-6">
                                    {/* Product Type Toggle - ONLY SHOW IF USER IS GST REGISTERED */}
                                    {userProfile?.is_gst_registered && (
                                        <div className="bg-card-bg/50 p-1.5 rounded-2xl border border-card-border/50 flex gap-2">
                                            <button
                                                onClick={() => setFormData({ ...formData, isGst: false })}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!formData.isGst ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'} `}
                                            >
                                                Legacy Mode
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, isGst: true })}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.isGst ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main'} `}
                                            >
                                                Compliance Protocol (GST)
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-8 items-start">
                                        {/* Image Upload Area */}
                                        <div className="w-full sm:w-48 shrink-0">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1 mb-3">Neural Imaging</label>
                                            <div
                                                onClick={() => document.getElementById('prod-img').click()}
                                                className="group relative w-full aspect-square rounded-[32px] bg-card-bg/50 border-2 border-dashed border-card-border hover:border-indigo-500/50 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-3 shadow-inner"
                                            >
                                                {formData.image_url || (formData.image instanceof File) ? (
                                                    <>
                                                        <img
                                                            src={formData.image instanceof File ? URL.createObjectURL(formData.image) : formData.image_url}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                            alt="Preview"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Plus className="text-white rotate-45" size={32} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                                            <Package size={24} />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted transition-colors group-hover:text-indigo-500">Capture</span>
                                                    </>
                                                )}
                                                <input
                                                    id="prod-img"
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) setFormData({ ...formData, image: file });
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-6 w-full">
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Asset Designation</label>
                                                <input placeholder="Ex: Quantum Processor X1" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/30 shadow-inner outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Category Domain</label>
                                            <input placeholder="Ex: Hardware" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/30 shadow-inner outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Metric Unit</label>
                                            <div className="relative">
                                                <select
                                                    value={['pcs', 'kg', 'g', 'litre', 'ml', 'dozen', 'box', 'packet', 'metre', 'set'].includes(formData.unit) ? formData.unit : 'other'}
                                                    onChange={e => setFormData({ ...formData, unit: e.target.value === 'other' ? '' : e.target.value })}
                                                    className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main appearance-none cursor-pointer shadow-inner outline-none"
                                                >
                                                    <option value="pcs">Unit [pcs]</option>
                                                    <option value="kg">Mass [kg]</option>
                                                    <option value="g">Mass [g]</option>
                                                    <option value="litre">Volume [l]</option>
                                                    <option value="packet">Packet</option>
                                                    <option value="box">Crate [box]</option>
                                                    <option value="other">Override...</option>
                                                </select>
                                                <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Financials */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-4">
                                        Financial Matrix
                                        <div className="h-px bg-gradient-to-r from-card-border/50 to-transparent flex-1" />
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass-card p-6 rounded-[28px] border-indigo-500/10 bg-indigo-500/[0.02] shadow-inner">
                                            <label className="text-[10px] text-indigo-500/60 font-black uppercase tracking-[0.2em] block mb-3">Acquisition Cost</label>
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-black text-indigo-500/40 tracking-tighter transition-colors">₹</span>
                                                <input type="number" value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} className="bg-transparent border-none p-0 focus:ring-0 font-black text-3xl text-text-main w-full placeholder-text-muted/20 outline-none" placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className="glass-card p-6 rounded-[28px] border-emerald-500/10 bg-emerald-500/[0.02] shadow-inner">
                                            <label className="text-[10px] text-emerald-500/60 font-black uppercase tracking-[0.2em] block mb-3">Market Valuation</label>
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-black text-emerald-500/40 tracking-tighter transition-colors">₹</span>
                                                <input type="number" value={formData.selling_price} onChange={e => setFormData({ ...formData, selling_price: e.target.value })} className="bg-transparent border-none p-0 focus:ring-0 font-black text-3xl text-text-main w-full placeholder-text-muted/20 outline-none" placeholder="0.00" />
                                            </div>
                                        </div>
                                    </div>

                                    {formData.isGst && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-6 glass-card rounded-[32px] border-indigo-500/20 shadow-inner">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Tax Bracket</label>
                                                    <div className="relative">
                                                        <select value={formData.tax_percent} onChange={e => setFormData({ ...formData, tax_percent: e.target.value })} className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main appearance-none cursor-pointer outline-none shadow-inner">
                                                            <option value="0">Zero [0%]</option>
                                                            <option value="5">Micro [5%]</option>
                                                            <option value="12">Standard [12%]</option>
                                                            <option value="18">Primary [18%]</option>
                                                            <option value="28">Premium [28%]</option>
                                                        </select>
                                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">HSN Protocol</label>
                                                    <input placeholder="HSN Code" value={formData.hsn_code} onChange={e => setFormData({ ...formData, hsn_code: e.target.value })} className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main placeholder-text-muted/30 outline-none shadow-inner" />
                                                </div>
                                            </div>

                                            {/* Tax Type Toggle */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Taxation Strategy</label>
                                                <div className="flex bg-card-bg/30 p-1 rounded-2xl border border-card-border/50 gap-1 shadow-inner">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, tax_type: 'exclusive' })}
                                                        className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.tax_type === 'exclusive' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg' : 'text-text-muted hover:text-text-main'} `}
                                                    >
                                                        Exclusive (Price + Tax)
                                                    </button>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, tax_type: 'inclusive' })}
                                                        className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.tax_type === 'inclusive' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg' : 'text-text-muted hover:text-text-main'} `}
                                                    >
                                                        Inclusive (Tax in Price)
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </section>

                                {/* Logistics */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-4">
                                        Neural Logistics
                                        <div className="h-px bg-gradient-to-r from-card-border/50 to-transparent flex-1" />
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Current Inventory</label>
                                            <input type="number" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-2xl text-text-main shadow-inner outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1">Critical Threshold</label>
                                            <input type="number" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main shadow-inner outline-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block ml-1 transition-colors group-focus-within:text-indigo-500">Asset Identity [SKU / Barcode]</label>
                                        <input placeholder="Ex: SKU-NEURAL-882" value={formData.sku || formData.barcode} onChange={e => setFormData({ ...formData, sku: e.target.value, barcode: e.target.value })} className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-text-main shadow-inner outline-none" />
                                    </div>
                                </section>
                            </div>

                            <div className="pt-8 border-t border-card-border/50 mt-4 shrink-0">
                                <button
                                    onClick={handleSave}
                                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                                >
                                    Transmit to Ledger
                                    <ArrowUpRight size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Inventory;

import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit2, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    // Full Schema Form State
    const initialFormState = {
        name: '', description: '', sku: '', barcode: '', category: '',
        cost_price: '', selling_price: '', mrp: '', tax_percent: '0',
        stock_quantity: '', min_stock_level: '5', unit: 'pcs',
        expiry_date: '', batch_number: '', warranty_months: '', image: null,
        has_serial_tracking: false, discount: '0',
        cgst_percent: '', sgst_percent: '', igst_percent: '', serial_numbers: '',
        isGst: false
    };
    const [formData, setFormData] = useState(initialFormState);

    // Fetch Data on Load
    const fetchData = React.useCallback(async () => {
        try {
            setLoading(true);
            // 1. Get User Profile for GST Strategy
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);
            }

            // 2. Get Products
            const { data: productsData, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(productsData || []);
        } catch (error) {
            console.error('Error fetching inventory (Supabase):', error);
            // Fallback to Local API
            try {
                console.log("Attempting to fetch from Local API...");
                const res = await fetch('http://localhost:8000/api/local/products');
                if (res.ok) {
                    const localData = await res.json();
                    setProducts(localData || []);
                    console.log("Loaded products from Local API");
                }
            } catch (localErr) {
                console.error("Error fetching local products:", localErr);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

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
            // Note: Image handling would go here
        });
        setEditingId(product.id);
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Please login first");

            const payload = {
                user_id: user.id,
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
                // Add other mapped fields
            };

            let error;
            if (editingId) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', editingId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('products')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            setShowModal(false);
            fetchData(); // Refresh list
        } catch (err) {
            console.error("Error saving product:", err);
            alert("Failed to save product. " + err.message);
        }
    };

    if (loading && !products.length) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="pb-20 min-h-screen bg-slate-50">

            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm p-4 md:flex md:items-center md:justify-between">
                <h1 className="text-xl font-heading font-bold text-slate-900 mb-3 md:mb-0">Inventory</h1>
                <div className="flex items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search products..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="hidden md:flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={20} /> Add Product
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <Package size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No products found.</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => (
                        <motion.div key={product.id} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                <Package size={20} className="text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-800 truncate">{product.name}</h3>
                                <p className="text-xs text-slate-500">{product.unit || 'pcs'} • Stock: {product.stock_quantity}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-slate-900">₹{product.selling_price}</span>
                                <button onClick={() => handleEdit(product)} className="text-indigo-600 p-1"><Edit2 size={16} /></button>
                            </div>
                        </motion.div>
                    ))
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
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white w-full max-w-lg h-[85vh] sm:h-auto sm:rounded-2xl rounded-t-3xl p-6 pointer-events-auto flex flex-col shadow-2xl relative z-10"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold font-heading text-slate-900">
                                    {editingId ? 'Edit Product' : 'Add New Product'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">Close</button>
                            </div>

                            <div className="overflow-y-auto flex-1 space-y-5 pr-2">
                                {/* Basic Info */}
                                <section className="space-y-3">
                                    {/* Product Type Toggle - ONLY SHOW IF USER IS GST REGISTERED */}
                                    {userProfile?.is_gst_registered && (
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-1 rounded-xl mb-2">
                                            <button
                                                onClick={() => setFormData({ ...formData, isGst: false })}
                                                className={`py-2 text-sm font-bold rounded-lg transition-colors ${!formData.isGst ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                            >
                                                Regular Product
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, isGst: true })}
                                                className={`py-2 text-sm font-bold rounded-lg transition-colors ${formData.isGst ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                            >
                                                GST Product
                                            </button>
                                        </div>
                                    )}

                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Basic Details</h3>

                                    {/* Image Upload */}
                                    <div className="flex gap-4 items-center">
                                        <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 relative overflow-hidden group">
                                            {formData.image ? (
                                                <img src={URL.createObjectURL(formData.image)} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center">
                                                    <span className="text-xs text-slate-400 font-bold block">+ Photo</span>
                                                </div>
                                            )}
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-500 font-bold block mb-1">Product Name <span className="text-red-500">*</span></label>
                                            <input placeholder="Enter Product Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="form-input w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                    </div>

                                    <textarea placeholder="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="form-input w-full p-3 bg-slate-50 rounded-xl border border-slate-200 h-20" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="form-input w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        <input placeholder="Unit (pcs, kg)" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="form-input w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                    </div>
                                </section>

                                {/* Pricing */}
                                <section className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pricing & Tax</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-bold">Cost Price <span className="text-red-500">*</span></label>
                                            <input type="number" value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-bold">Selling Price <span className="text-red-500">*</span></label>
                                            <input type="number" value={formData.selling_price} onChange={e => setFormData({ ...formData, selling_price: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-indigo-900" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-bold">MRP</label>
                                            <input type="number" value={formData.mrp} onChange={e => setFormData({ ...formData, mrp: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                        {formData.isGst && (
                                            <div>
                                                <label className="text-[10px] text-slate-500 font-bold">Tax % <span className="text-red-500">*</span></label>
                                                <select value={formData.tax_percent} onChange={e => setFormData({ ...formData, tax_percent: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                    <option value="0">0%</option>
                                                    <option value="5">5%</option>
                                                    <option value="12">12%</option>
                                                    <option value="18">18%</option>
                                                    <option value="28">28%</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {formData.isGst && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-slate-500 font-bold">HSN Code <span className="text-red-500">*</span></label>
                                                <input placeholder="HSN" value={formData.hsn_code} onChange={e => setFormData({ ...formData, hsn_code: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 font-bold">Barcode</label>
                                                <input placeholder="Scan/Enter" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                            </div>
                                        </div>
                                    )}
                                    {!formData.isGst && (
                                        <div className="grid grid-cols-1 gap-3">
                                            <input placeholder="SKU / Barcode (Optional)" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                    )}
                                </section>

                                {/* Inventory */}
                                <section className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Control</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-bold">Current Stock <span className="text-red-500">*</span></label>
                                            <input type="number" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-bold">Min Level</label>
                                            <input type="number" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                        </div>
                                    </div>

                                    {/* Expiry & Details - Only for GST/Advanced or moved check */}
                                    {formData.isGst && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Expiry Date</label>
                                                <input type="date" value={formData.expiry_date} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Batch Number</label>
                                                <input placeholder="Batch No" value={formData.batch_number} onChange={e => setFormData({ ...formData, batch_number: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* Advanced Details Dropdown */}
                                {formData.isGst && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="w-full flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                        >
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advanced Details</h3>
                                            {showAdvanced ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </button>

                                        <AnimatePresence>
                                            {showAdvanced && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-3 space-y-3 bg-white border-t border-slate-100">

                                                        <div className="space-y-3">
                                                            <div className="flex gap-3 items-center">
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Warranty (Months)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        value={formData.warranty_months}
                                                                        onChange={e => setFormData({ ...formData, warranty_months: e.target.value })}
                                                                        className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2 pt-4">
                                                                    <input
                                                                        type="checkbox"
                                                                        id="serialTracking"
                                                                        checked={formData.has_serial_tracking}
                                                                        onChange={e => setFormData({ ...formData, has_serial_tracking: e.target.checked })}
                                                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                                    />
                                                                    <label htmlFor="serialTracking" className="text-sm font-medium text-slate-700 cursor-pointer">
                                                                        Track Serial/IMEI
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            {formData.has_serial_tracking && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0 }}
                                                                    animate={{ opacity: 1, height: 'auto' }}
                                                                    exit={{ opacity: 0, height: 0 }}
                                                                >
                                                                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Serial Numbers / IMEIs</label>
                                                                    <textarea
                                                                        placeholder="Enter Serial Numbers (comma or new line separated)"
                                                                        value={formData.serial_numbers}
                                                                        onChange={e => setFormData({ ...formData, serial_numbers: e.target.value })}
                                                                        className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm h-20"
                                                                    />
                                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                                        Expected count: {formData.stock_quantity || 0}
                                                                    </p>
                                                                </motion.div>
                                                            )}
                                                        </div>

                                                        {/* Discount & Tax Breakdown */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Discount %</label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={formData.discount}
                                                                    onChange={e => setFormData({ ...formData, discount: e.target.value })}
                                                                    className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="pt-2">
                                                            <label className="text-[10px] text-slate-500 font-bold block mb-2">Tax Breakdown (Optional override)</label>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <input
                                                                    placeholder="CGST %"
                                                                    type="number"
                                                                    value={formData.cgst_percent}
                                                                    onChange={e => setFormData({ ...formData, cgst_percent: e.target.value })}
                                                                    className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-center"
                                                                />
                                                                <input
                                                                    placeholder="SGST %"
                                                                    type="number"
                                                                    value={formData.sgst_percent}
                                                                    onChange={e => setFormData({ ...formData, sgst_percent: e.target.value })}
                                                                    className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-center"
                                                                />
                                                                <input
                                                                    placeholder="IGST %"
                                                                    type="number"
                                                                    value={formData.igst_percent}
                                                                    onChange={e => setFormData({ ...formData, igst_percent: e.target.value })}
                                                                    className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex gap-3">
                                <button onClick={handleSave} className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">
                                    Save Product
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

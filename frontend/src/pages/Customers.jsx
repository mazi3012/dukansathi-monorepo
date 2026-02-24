import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

    const fetchCustomers = React.useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers (Supabase):", err);
            // Fallback to Local API
            try {
                console.log("Attempting to fetch from Local API...");
                const res = await fetch('http://localhost:8000/api/local/customers');
                if (res.ok) {
                    const localData = await res.json();
                    setCustomers(localData || []);
                    console.log("Loaded customers from Local API");
                }
            } catch (localErr) {
                console.error("Error fetching local customers:", localErr);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();

        // Auto-refresh when returning to tab (e.g. from Telegram)
        const onFocus = () => fetchCustomers();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchCustomers]);

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Please login");
            if (!formData.name) return alert("Name is required");

            const { error } = await supabase
                .from('customers')
                .insert([{
                    user_id: user.id,
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    total_spend: 0,
                    credit_balance: 0
                }]);

            if (error) throw error;

            setShowModal(false);
            setFormData({ name: '', phone: '', email: '', address: '' });
            fetchCustomers();
        } catch (err) {
            console.error("Error adding customer:", err);
            alert("Failed to add customer: " + err.message);
        }
    };

    const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="pb-20 min-h-screen bg-slate-50">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 shadow-sm md:flex md:items-center md:justify-between">
                <h1 className="text-xl font-heading font-bold text-slate-900 mb-3 md:mb-0">Customers</h1>
                <div className="flex items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search customers..."
                            className="w-full pl-10 h-10 bg-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>
                    <button onClick={() => setShowModal(true)} className="hidden md:flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                        <Plus size={20} /> Add Customer
                    </button>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Loading customers...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        {search ? "No customers found" : "No customers yet. Add one!"}
                    </div>
                ) : (
                    filtered.map(c => (
                        <Link to={`/customers/${c.id}`} key={c.id}>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="bg-white/60 backdrop-blur-xl p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 flex items-center justify-between mb-3 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200/50 shadow-sm">
                                        {c.name[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 text-lg">{c.name}</h3>
                                        {c.phone && (
                                            <p className="text-sm text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                                                <Phone size={12} /> {c.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-extrabold text-lg ${c.credit_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₹{(c.credit_balance || 0).toLocaleString('en-IN')}
                                    </div>
                                    <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${c.credit_balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {c.credit_balance > 0 ? 'Udhar' : 'Clear'}
                                    </span>
                                </div>
                            </motion.div>
                        </Link>
                    ))
                )}
            </div>

            <button onClick={() => setShowModal(true)} className="md:hidden fixed right-4 bottom-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
                <Plus size={28} />
            </button>

            {/* Add Customer Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setShowModal(false)} />
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            className="bg-white w-full max-w-md rounded-t-3xl p-6 pointer-events-auto relative z-10"
                        >
                            <h2 className="text-lg font-bold mb-4">Add Customer</h2>
                            <div className="space-y-3">
                                <input
                                    placeholder="Name *"
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                                <input
                                    placeholder="Phone"
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                                <input
                                    placeholder="Email (Optional)"
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <input
                                    placeholder="Address (Optional)"
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                                <button onClick={handleSave} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                                    Save Customer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Customers;

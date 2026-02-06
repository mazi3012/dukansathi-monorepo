import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        } finally {
            setLoading(false);
        }
    };

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
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 shadow-sm">
                <h1 className="text-xl font-heading font-bold text-slate-900 mb-3">Customers</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search customers..."
                        className="w-full pl-10 h-10 bg-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                </div>
            </div>

            <div className="p-4 space-y-3">
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
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between mb-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                        {c.name[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{c.name}</h3>
                                        {c.phone && (
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Phone size={10} /> {c.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${c.credit_balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {c.credit_balance < 0 ? `₹${Math.abs(c.credit_balance)}` : `₹${c.credit_balance || 0}`}
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">
                                        {c.credit_balance < 0 ? 'Udhar' : 'Adv'}
                                    </span>
                                </div>
                            </motion.div>
                        </Link>
                    ))
                )}
            </div>

            <button onClick={() => setShowModal(true)} className="fixed right-4 bottom-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
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

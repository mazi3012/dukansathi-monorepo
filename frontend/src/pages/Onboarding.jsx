import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Store, FileText, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const Onboarding = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const [formData, setFormData] = useState({
        business_name: '',
        business_category: 'kirana',
        is_gst_registered: false,
        gstin: '',
    });

    const handleUpdateProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("No user found");

            const updates = {
                id: user.id,
                business_name: formData.business_name,
                business_category: formData.business_category,
                is_gst_registered: formData.is_gst_registered,
                gstin: formData.is_gst_registered ? formData.gstin : null,
                onboarding_completed: true,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);
            if (error) throw error;

            navigate('/'); // Refresh to trigger dashboard redirect
        } catch (error) {
            console.error(error);
            alert("Error updating profile!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col p-6">
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                {/* Progress */}
                <div className="flex gap-2 mb-8">
                    <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
                    <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
                </div>

                <div className="mb-8">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <Store size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {step === 1 ? "Tell us about your Dukan" : "Tax details"}
                    </h1>
                    <p className="text-slate-500">
                        {step === 1 ? "We'll customize the app for your business type." : "Enable GST features if applicable."}
                    </p>
                </div>

                {step === 1 ? (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Business Name</label>
                            <input
                                value={formData.business_name}
                                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                placeholder="e.g. Sharma Kirana Store"
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Business Category</label>
                            <div className="grid grid-cols-1 gap-3">
                                {['kirana', 'medical', 'hardware'].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setFormData({ ...formData, business_category: cat })}
                                        className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${formData.business_category === cat
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                                            }`}
                                    >
                                        <span className="capitalize font-bold">{cat}</span>
                                        {formData.business_category === cat && <Check size={20} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!formData.business_name}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mt-8 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="font-bold text-slate-900">Are you GST Registered?</span>
                                <div
                                    onClick={() => setFormData({ ...formData, is_gst_registered: !formData.is_gst_registered })}
                                    className={`w-14 h-8 rounded-full p-1 transition-colors ${formData.is_gst_registered ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${formData.is_gst_registered ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </label>
                            <p className="text-xs text-slate-500 mt-2">
                                If enabled, we will show tax fields in invoices and inventory.
                            </p>
                        </div>

                        {formData.is_gst_registered && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">GSTIN Number</label>
                                <input
                                    value={formData.gstin}
                                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                                    placeholder="22AAAAA0000A1Z5"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono uppercase"
                                />
                            </motion.div>
                        )}

                        <button
                            onClick={handleUpdateProfile}
                            disabled={loading || (formData.is_gst_registered && !formData.gstin)}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mt-8 hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="animate-spin" size={20} />}
                            Complete Setup
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;

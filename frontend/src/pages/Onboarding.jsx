import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Store, FileText, Check, MapPin, CreditCard, ShieldCheck, ChevronRight, ChevronLeft, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStateFromGSTIN, validateGSTIN } from '../utils/gstUtils';

const Onboarding = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [gstinError, setGstinError] = useState('');

    const [formData, setFormData] = useState({
        business_name: '',
        business_category: 'kirana',
        business_address: '',
        city: '',
        state_name: '',
        pincode: '',
        is_gst_registered: false,
        gstin: '',
        state_code: '',
        bank_name: '',
        bank_account_no: '',
        bank_ifsc: '',
        upi_id: '',
        show_qr_on_invoice: true
    });

    const handleUpdateProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("No user found");

            const updates = {
                id: user.id,
                ...formData,
                onboarding_completed: true,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);
            if (error) throw error;

            navigate('/');
        } catch (error) {
            console.error(error);
            alert("Error updating profile!");
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const steps = [
        { id: 1, title: 'Identity', icon: Store, desc: 'Your business core' },
        { id: 2, title: 'Location', icon: MapPin, desc: 'Where you operate' },
        { id: 3, title: 'Taxation', icon: ShieldCheck, desc: 'Compliance status' },
        { id: 4, title: 'Payments', icon: CreditCard, desc: 'Billing & payouts' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
            <div className="max-w-xl w-full">
                {/* Progress Header */}
                <div className="mb-12">
                    <div className="flex justify-between mb-4">
                        {steps.map((s) => (
                            <div key={s.id} className="flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl ${step >= s.id ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white text-slate-300'}`}>
                                    <s.icon size={20} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-indigo-600' : 'text-slate-300'}`}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            className="h-full bg-indigo-600"
                            initial={{ width: '25%' }}
                            animate={{ width: `${(step / 4) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Build your identity</h2>
                                    <p className="text-slate-500 font-medium">Let's start with the basics of your dukan.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Business Name</label>
                                        <input
                                            value={formData.business_name}
                                            onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                            placeholder="Ex: Sharma Kirana Store"
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-800 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Business Category</label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {['kirana', 'medical', 'hardware'].map((cat) => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setFormData({ ...formData, business_category: cat })}
                                                    className={`p-4 rounded-2xl border-2 text-center transition-all ${formData.business_category === cat
                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-500/10'
                                                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                                                        }`}
                                                >
                                                    <span className="capitalize font-black text-xs uppercase tracking-tight">{cat}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={nextStep}
                                    disabled={!formData.business_name}
                                    className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-20"
                                >
                                    Proceed to Location
                                    <ChevronRight size={18} />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Where's your HQ?</h2>
                                    <p className="text-slate-500 font-medium">This address will appear on your professional invoices.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Primary Address</label>
                                        <textarea
                                            value={formData.business_address}
                                            onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                                            placeholder="Enter full shop address..."
                                            rows={2}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-800 transition-all resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">City</label>
                                            <input
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="City"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Pincode</label>
                                            <input
                                                value={formData.pincode}
                                                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                                placeholder="6 Digits"
                                                maxLength={6}
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">State / UT</label>
                                        <input
                                            value={formData.state_name}
                                            onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
                                            placeholder="Ex: Maharashtra"
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={prevStep} className="flex-1 py-5 border-2 border-slate-100 rounded-[24px] font-black uppercase tracking-widest text-[10px] text-slate-400 flex items-center justify-center gap-2">
                                        <ChevronLeft size={16} /> Back
                                    </button>
                                    <button onClick={nextStep} className="flex-[2] py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                                        Tax Compliance <ChevronRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Tax configuration</h2>
                                    <p className="text-slate-500 font-medium">Enable GST features to generate Tax Invoices.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-200">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-slate-900 uppercase tracking-tight">GST Registration</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Toggle if you have GSTIN</span>
                                            </div>
                                            <div
                                                onClick={() => setFormData({ ...formData, is_gst_registered: !formData.is_gst_registered })}
                                                className={`w-14 h-8 rounded-full p-1 transition-colors ${formData.is_gst_registered ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${formData.is_gst_registered ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </label>
                                    </div>

                                    {formData.is_gst_registered && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center ml-1">
                                                    <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">GSTIN Number</label>
                                                    {formData.state_code && (
                                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-3 py-1 rounded-full uppercase italic">
                                                            {getStateFromGSTIN(formData.gstin)}
                                                        </span>
                                                    )}
                                                </div>
                                                <input
                                                    value={formData.gstin}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase();
                                                        const detectedState = getStateFromGSTIN(val);
                                                        setFormData({
                                                            ...formData,
                                                            gstin: val,
                                                            state_code: detectedState ? val.substring(0, 2) : ''
                                                        });
                                                        // Validate on change (only show error after 15 chars typed)
                                                        if (val.length === 15) {
                                                            const result = validateGSTIN(val);
                                                            setGstinError(result.valid ? '' : result.error);
                                                        } else if (val.length > 0 && val.length < 15) {
                                                            setGstinError('');
                                                        }
                                                    }}
                                                    placeholder="22AAAAA0000A1Z5"
                                                    maxLength={15}
                                                    className={`w-full p-5 bg-slate-50 border rounded-2xl focus:bg-white outline-none font-mono font-bold text-lg uppercase tracking-wider ${gstinError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'}`}
                                                />
                                                {gstinError && (
                                                    <p className="text-red-500 text-xs font-bold mt-1 ml-1">{gstinError}</p>
                                                )}
                                                {formData.gstin?.length === 15 && !gstinError && formData.state_name && getStateFromGSTIN(formData.gstin) && formData.state_name.toLowerCase() !== getStateFromGSTIN(formData.gstin).toLowerCase() && (
                                                    <p className="text-amber-600 text-xs font-bold mt-1 ml-1 bg-amber-50 px-2 py-1 rounded-lg">
                                                        ⚠️ State mismatch: GSTIN says "{getStateFromGSTIN(formData.gstin)}" but you entered "{formData.state_name}"
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {!formData.is_gst_registered && (
                                        <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 flex items-start gap-4">
                                            <ShieldCheck className="text-amber-500 shrink-0" />
                                            <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                                By proceeding without GST, your invoices will be generated as <span className="underline italic">"Bill of Supply"</span> as per Indian regulations.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={prevStep} className="flex-1 py-5 border-2 border-slate-100 rounded-[24px] font-black uppercase tracking-widest text-[10px] text-slate-400 flex items-center justify-center gap-2">
                                        <ChevronLeft size={16} /> Back
                                    </button>
                                    <button
                                        onClick={nextStep}
                                        disabled={(formData.is_gst_registered && !formData.gstin) || gstinError}
                                        className="flex-[2] py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-20"
                                    >
                                        Payment Setup <ChevronRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Final touch</h2>
                                    <p className="text-slate-500 font-medium">Add bank details to receive payments directly.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">UPI ID (PhonePe/GPay) [Optional]</label>
                                            <input
                                                value={formData.upi_id}
                                                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                                                placeholder="mobile@upi (Linked to bank)"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Bank Name</label>
                                            <input
                                                value={formData.bank_name}
                                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                placeholder="Ex: HDFC Bank"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Account No</label>
                                                <input
                                                    value={formData.bank_account_no}
                                                    onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                                                    placeholder="A/c ID"
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold font-mono"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">IFSC Code</label>
                                                <input
                                                    value={formData.bank_ifsc}
                                                    onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                                                    placeholder="IFSC"
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={prevStep} className="flex-1 py-5 border-2 border-slate-100 rounded-[24px] font-black uppercase tracking-widest text-[10px] text-slate-400 flex items-center justify-center gap-2">
                                        <ChevronLeft size={16} /> Back
                                    </button>
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={loading}
                                        className="flex-[2] py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/40 hover:scale-105 transition-all"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                        Launch My Shop
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;

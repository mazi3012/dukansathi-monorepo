import React from 'react';
import { Shield, FileText, RefreshCcw, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

const TermsPolicy = () => {
    return (
        <div className="pb-12 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-text-main">Terms & Policies</h1>
                <p className="text-sm text-text-muted mt-2">
                    Please read the following carefully. By using Dukan Sathi, you agree to these terms. 
                    These policies are compliant with the Information Technology Act, 2000, and standard regulations in India.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PolicyCard icon={FileText} title="Terms of Service" />
                <PolicyCard icon={Shield} title="Privacy Policy" />
                <PolicyCard icon={RefreshCcw} title="Refund & Cancellation" />
                <PolicyCard icon={Mail} title="Contact Us" />
            </div>

            <div className="glass-card rounded-3xl p-6 md:p-8 space-y-10 border border-card-border overflow-hidden">
                
                {/* 1. Terms of Service */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
                        <FileText size={20} /> Terms of Service
                    </h2>
                    <div className="text-sm text-text-muted space-y-3 leading-relaxed">
                        <p>
                            <strong>1. Acceptance of Terms:</strong> By accessing and using Dukan Sathi ("the Application"), you accept and agree to be bound by the terms and provisions of this agreement.
                        </p>
                        <p>
                            <strong>2. Description of Service:</strong> Dukan Sathi provides shop management, billing, and inventory tracking tools specifically designed for Indian retailers. We utilize Artificial Intelligence to facilitate voice-based interactions.
                        </p>
                        <p>
                            <strong>3. User Responsibilities:</strong> You are responsible for maintaining the confidentiality of your account login information and are fully responsible for all activities that occur under your account. 
                            The accuracy of the inventory and ledger records is your responsibility.
                        </p>
                        <p>
                            <strong>4. Limitation of Liability:</strong> In no event shall Dukan Sathi, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                        </p>
                    </div>
                </section>

                <div className="h-px bg-card-border/50" />

                {/* 2. Privacy Policy */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
                        <Shield size={20} /> Privacy Policy
                    </h2>
                    <div className="text-sm text-text-muted space-y-3 leading-relaxed">
                        <p>
                            <strong>1. Data Collection:</strong> We collect personal information such as your name, email address, phone number, and shop details when you register. We also collect transactional and inventory data that you input into the system.
                        </p>
                        <p>
                            <strong>2. Audio & Voice Data:</strong> To provide voice AI capabilities, audio commands may be temporarily processed by third-party AI providers (e.g., Google, Sarvam). Audio is not permanently stored or used to train third-party models without explicit anonymization.
                        </p>
                        <p>
                            <strong>3. Data Security & Localization:</strong> We take the security of your data seriously. We adhere to industry standards and the impending Digital Personal Data Protection Act (DPDP), ensuring appropriate measures are in place. All core user data is securely hosted and isolated via Supabase.
                        </p>
                        <p>
                            <strong>4. Third-Party Services:</strong> We use Razorpay for payment processing. We do not store any sensitive credit card or UPI pin information on our servers.
                        </p>
                    </div>
                </section>

                <div className="h-px bg-card-border/50" />

                {/* 3. Refund & Cancellation */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
                        <RefreshCcw size={20} /> Refund & Cancellation Policy
                    </h2>
                    <div className="text-sm text-text-muted space-y-3 leading-relaxed">
                        <p>
                            <strong>1. Non-Refundable Credits:</strong> Purchases of AI credits or subscription tiers are generally final and non-refundable once the credits have been successfully credited to your account or the subscription has been activated.
                        </p>
                        <p>
                            <strong>2. Technical Issues:</strong> If a technical issue on our application prevents the allocation of credits after a successful payment deduction, please contact our support team. Refunds for failed transactions will be automatically processed by Razorpay and credited back to the original payment source within <strong>5-7 business days</strong>.
                        </p>
                        <p>
                            <strong>3. Cancellation:</strong> You may cancel your account at any time. Upon cancellation, any remaining credits will be forfeited, and no prorated refunds will be issued.
                        </p>
                    </div>
                </section>

                <div className="h-px bg-card-border/50" />

                {/* 4. Contact Us */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
                        <Mail size={20} /> Contact Us
                    </h2>
                    <div className="text-sm text-text-muted space-y-3 leading-relaxed">
                        <p>
                            If you have any questions about these Terms, the Privacy Policy, or the Refund Policy, please do not hesitate to contact us.
                        </p>
                        <div className="bg-card-bg/50 p-4 rounded-xl border border-card-border inline-block">
                            <p><strong>Email:</strong> support@dukansathi.com</p>
                            <p><strong>Operating Address:</strong> India</p>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};

const PolicyCard = ({ icon: Icon, title }) => (
    <motion.div 
        whileHover={{ scale: 1.02 }}
        className="glass-card flex items-center gap-3 p-4 rounded-2xl border border-card-border"
    >
        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
            <Icon size={20} />
        </div>
        <span className="font-bold text-text-main text-sm">{title}</span>
    </motion.div>
);

export default TermsPolicy;

import { motion } from 'framer-motion';
import { Check, Zap, Building2 } from 'lucide-react';

const plans = [
    {
        id: 'audit',
        icon: Zap,
        label: 'Single Audit',
        tagline: 'One-Time 15-Dimension Stress Test',
        price: 'On Demand',
        priceNote: 'No subscription required',
        color: 'violet',
        accentColor: '#7c3aed',
        glowColor: 'rgba(124,58,237,0.25)',
        features: [
            'Full 15-dimension diagnostic scan',
            'Self-correcting Critic Agent loop',
            'Confidence-scored evidence report',
            'Strategic Blindspot detection',
            'Exportable McKinsey-grade Markdown report',
            'Radar Chart & visual scorecard',
        ],
        cta: 'Start Free Audit',
        highlight: false,
    },
    {
        id: 'enterprise',
        icon: Building2,
        label: 'Enterprise Seat',
        tagline: 'Continuous 24-Hour Strategy Monitoring',
        price: 'Custom',
        priceNote: 'Contact for enterprise pricing',
        color: 'gold',
        accentColor: '#d97706',
        glowColor: 'rgba(217,119,6,0.25)',
        features: [
            'Everything in Single Audit',
            'Agents re-crawl your business every 24 hours',
            'Live Strategy Scorecard dashboard',
            'Automated contradiction alerts',
            'Multi-seat team access',
            'Dedicated enterprise SLA & onboarding',
        ],
        cta: 'Contact Sales',
        highlight: true,
    },
];

export function PricingSection() {
    return (
        <section className="relative py-32 px-4">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(124,58,237,0.06) 0%, transparent 70%)'
            }} />

            <div className="max-w-5xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <p className="text-xs tracking-[0.3em] uppercase text-violet-400 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        The Offering
                    </p>
                    <h2 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        Choose Your
                        <span className="text-gradient-main"> Intelligence Layer</span>
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        From a single diagnostic audit to an always-on strategy engine that never sleeps.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plans.map((plan, i) => {
                        const Icon = plan.icon;
                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.15 }}
                                className="glass-card p-8 flex flex-col gap-6 relative overflow-hidden"
                                style={{
                                    boxShadow: plan.highlight ? `0 0 60px ${plan.glowColor}` : 'none',
                                    border: plan.highlight ? `1px solid ${plan.accentColor}40` : undefined,
                                }}
                            >
                                {plan.highlight && (
                                    <div className="absolute top-5 right-5 text-xs px-3 py-1 rounded-full font-semibold"
                                        style={{ background: `${plan.accentColor}30`, color: plan.accentColor, fontFamily: 'Space Grotesk, sans-serif' }}>
                                        Most Powerful
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl" style={{ background: `${plan.accentColor}20` }}>
                                        <Icon className="w-6 h-6" style={{ color: plan.accentColor }} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{plan.label}</h3>
                                        <p className="text-sm text-gray-400 mt-1">{plan.tagline}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{plan.price}</p>
                                    <p className="text-xs text-gray-500 mt-1">{plan.priceNote}</p>
                                </div>

                                <ul className="space-y-3 flex-1">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                                            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.accentColor }} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:opacity-90 hover:translate-y-[-2px]"
                                    style={{
                                        background: plan.highlight
                                            ? `linear-gradient(135deg, ${plan.accentColor}, ${plan.accentColor}aa)`
                                            : `${plan.accentColor}20`,
                                        color: plan.highlight ? '#fff' : plan.accentColor,
                                        border: `1px solid ${plan.accentColor}40`,
                                        fontFamily: 'Space Grotesk, sans-serif',
                                    }}
                                >
                                    {plan.cta}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

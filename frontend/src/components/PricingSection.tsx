import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2 } from 'lucide-react';

const CONTACT_EMAIL = 'irfan@teachmeai.in';

const plans = [
    {
        id: 'free',
        icon: Zap,
        label: 'Single Audit',
        tagline: 'See what your strategy looks like today',
        price: '$0',
        priceNote: 'No account required',
        badge: null,
        accentColor: '#7c3aed',
        glowColor: 'rgba(124,58,237,0.18)',
        highlight: false,
        features: [
            'One on-demand audit per session',
            'Full 20-dimension analysis',
            'Executive report + 90-day roadmap',
            'Stress test simulator',
            'PDF export',
            'Powered by VelocityCSO watermark',
        ],
        cta: 'Start Free Audit',
        ctaHref: '#audit',
        ctaMailto: null,
    },
    {
        id: 'growth',
        icon: Rocket,
        label: 'Strategy Engine',
        tagline: 'Your business context. Any market, any lens, on demand.',
        price: '$499',
        priceNote: 'per month — 14-day custom trial available',
        badge: 'Most Popular',
        accentColor: '#a78bfa',
        glowColor: 'rgba(167,139,250,0.22)',
        highlight: true,
        features: [
            'Persistent strategy profile configured to your business',
            'Unlimited on-demand strategy runs',
            'Variable lenses: market, geography, customer persona',
            'Time-horizon modeling (short, mid, long term)',
            'Scenario comparison across multiple runs',
            'Stress test with custom scenarios',
            'Scheduled reports (weekly or monthly cadence)',
            'PDF + email delivery',
            'Run history and comparative reporting',
        ],
        cta: 'Request 14-Day Trial',
        ctaHref: null,
        ctaMailto: `mailto:${CONTACT_EMAIL}?subject=VelocityCSO%2014-Day%20Trial%20Request&body=Hi%2C%0A%0AI%27m%20interested%20in%20a%2014-day%20trial%20of%20the%20VelocityCSO%20Strategy%20Engine.%0A%0ACompany%3A%20%0AName%3A%20%0AEmail%3A%20`,
    },
    {
        id: 'enterprise',
        icon: Building2,
        label: 'Private Strategy Instance',
        tagline: 'A dedicated agent pipeline, deployed for your organization.',
        price: 'Custom',
        priceNote: 'Tailored to your organization',
        badge: null,
        accentColor: '#f59e0b',
        glowColor: 'rgba(245,158,11,0.18)',
        highlight: false,
        features: [
            'Everything in Strategy Engine',
            'Private deployed instance — isolated compute',
            'Fully bespoke agent configuration',
            'Custom dimensions beyond the core 20',
            'Industry-specific scoring rubrics',
            'Internal data ingestion (financials, CRM, market data)',
            'Multi-user access with team seats',
            'White-labeled reports with your branding',
            'API + webhook delivery to your systems',
            'Dedicated onboarding, SLA & account management',
        ],
        cta: 'Contact Sales',
        ctaHref: null,
        ctaMailto: `mailto:${CONTACT_EMAIL}?subject=Enterprise%20Account%20Needed&body=Hi%2C%0A%0AWe%27re%20interested%20in%20a%20private%20VelocityCSO%20enterprise%20instance.%0A%0AOrganization%3A%20%0AName%3A%20%0AEmail%3A%20%0AUse%20case%3A%20`,
    },
];

export function PricingSection() {
    return (
        <section id="offerings" className="relative py-32 px-4 bg-[#050814] overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-violet-600/5 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-xs tracking-[0.4em] uppercase text-violet-400 mb-4 font-bold"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        The Offering
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        Your Strategy Engine,<br />
                        <span className="text-gradient-main">Configured for You.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        viewport={{ once: true }}
                        className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
                    >
                        Start with a free audit. Move to a persistent agent that knows your business
                        and runs any strategic question — any market, any lens, on demand.
                    </motion.p>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {plans.map((plan, i) => {
                        const Icon = plan.icon;
                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.12 }}
                                className="relative flex flex-col rounded-2xl p-8 gap-6 overflow-hidden"
                                style={{
                                    background: plan.highlight
                                        ? 'rgba(167,139,250,0.06)'
                                        : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${plan.accentColor}${plan.highlight ? '50' : '25'}`,
                                    boxShadow: plan.highlight ? `0 0 60px ${plan.glowColor}` : 'none',
                                }}
                            >
                                {/* Badge */}
                                {plan.badge && (
                                    <div
                                        className="absolute top-5 right-5 text-[10px] px-3 py-1 rounded-full font-bold tracking-wide"
                                        style={{
                                            background: `${plan.accentColor}25`,
                                            color: plan.accentColor,
                                            fontFamily: 'Space Grotesk, sans-serif',
                                        }}
                                    >
                                        {plan.badge}
                                    </div>
                                )}

                                {/* Icon + Label */}
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl flex-shrink-0" style={{ background: `${plan.accentColor}18` }}>
                                        <Icon className="w-5 h-5" style={{ color: plan.accentColor }} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                            {plan.label}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1 leading-snug">{plan.tagline}</p>
                                    </div>
                                </div>

                                {/* Price */}
                                <div>
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                            {plan.price}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{plan.priceNote}</p>
                                </div>

                                {/* Divider */}
                                <div className="h-px w-full" style={{ background: `${plan.accentColor}20` }} />

                                {/* Features */}
                                <ul className="space-y-2.5 flex-1">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                                            <Check
                                                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                                                style={{ color: plan.accentColor }}
                                            />
                                            <span className="leading-snug">{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                {plan.ctaHref ? (
                                    <a
                                        href={plan.ctaHref}
                                        className="w-full py-3.5 rounded-xl font-semibold text-sm text-center transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 block"
                                        style={{
                                            background: `${plan.accentColor}22`,
                                            color: plan.accentColor,
                                            border: `1px solid ${plan.accentColor}40`,
                                            fontFamily: 'Space Grotesk, sans-serif',
                                        }}
                                    >
                                        {plan.cta}
                                    </a>
                                ) : (
                                    <a
                                        href={plan.ctaMailto!}
                                        className="w-full py-3.5 rounded-xl font-semibold text-sm text-center transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 block"
                                        style={{
                                            background: plan.highlight
                                                ? `linear-gradient(135deg, ${plan.accentColor}cc, ${plan.accentColor}88)`
                                                : `${plan.accentColor}22`,
                                            color: plan.highlight ? '#0a0a0f' : plan.accentColor,
                                            border: `1px solid ${plan.accentColor}50`,
                                            fontFamily: 'Space Grotesk, sans-serif',
                                        }}
                                    >
                                        {plan.cta}
                                    </a>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    viewport={{ once: true }}
                    className="text-center text-xs text-gray-600 mt-10"
                >
                    All paid tiers include a custom strategy profile configured to your business.
                    Enterprise instances are deployed on isolated infrastructure — your data never touches shared compute.
                </motion.p>
            </div>
        </section>
    );
}

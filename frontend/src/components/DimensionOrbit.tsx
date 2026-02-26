import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, useScroll, Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

const dimensions = [
    { name: 'TAM Viability', category: 'Market', color: '#a78bfa', desc: 'How large and accessible is your addressable market?' },
    { name: 'Target Precision', category: 'Market', color: '#a78bfa', desc: 'How crisply is your sweet-spot customer defined?' },
    { name: 'Trend Adoption', category: 'Market', color: '#a78bfa', desc: 'Are macro trends tailwinds or headwinds for this model?' },
    { name: 'Competitive Defensibility', category: 'Strategy', color: '#818cf8', desc: 'How hard is this to replicate in 18 months?' },
    { name: 'Model Innovation', category: 'Strategy', color: '#818cf8', desc: 'Does the approach create a new category or copy one?' },
    { name: 'Flywheel Potential', category: 'Strategy', color: '#818cf8', desc: 'Does winning create momentum for further winning?' },
    { name: 'Pricing Power', category: 'Commercial', color: '#34d399', desc: 'Can you raise prices without losing core customers?' },
    { name: 'CAC/LTV Ratio', category: 'Commercial', color: '#34d399', desc: 'Does the acquisition math hold under real conditions?' },
    { name: 'Market Entry Speed', category: 'Commercial', color: '#34d399', desc: 'How quickly can you own your initial beachhead?' },
    { name: 'Execution Speed', category: 'Operations', color: '#6ee7b7', desc: 'How fast can the team ship under competitive pressure?' },
    { name: 'Scalability', category: 'Operations', color: '#6ee7b7', desc: 'Does the model strain at 10x revenue?' },
    { name: 'ESG Posture', category: 'Operations', color: '#6ee7b7', desc: 'How resilient is this model to regulatory and social shifts?' },
    { name: 'ROI Projection', category: 'Finance', color: '#fbbf24', desc: 'Does the model reach healthy margins at scale?' },
    { name: 'Risk Tolerance', category: 'Finance', color: '#fbbf24', desc: 'How does this survive a 10% market contraction?' },
    { name: 'Capital Efficiency', category: 'Finance', color: '#fbbf24', desc: 'Is the burn rate aligned with the growth ambition?' },
];

function DimensionPanel({ index, total }: { index: number; total: number }) {
    const dim = dimensions[index];
    const scroll = useScroll();
    const meshRef = useRef<THREE.Mesh>(null);

    const angle = (index / total) * Math.PI * 2;
    const radius = 5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 5;

    useFrame(() => {
        if (!meshRef.current) return;
        const offset = scroll.offset;
        const t = (index / total) - offset * 1.5;
        meshRef.current.position.z = z + offset * 20;
        meshRef.current.position.x = x * (1 - offset);
        meshRef.current.rotation.y = angle * 0.3 * (1 - offset);
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, Math.min(1, 1 - Math.abs(t) * 3));
    });

    return (
        <Float speed={1.5} floatIntensity={0.3}>
            <mesh ref={meshRef} position={[x, (index % 3 - 1) * 1.8, z]}>
                <planeGeometry args={[3.2, 1.8]} />
                <meshBasicMaterial
                    color={dim.color}
                    transparent
                    opacity={0.08}
                    side={THREE.DoubleSide}
                />
                <Text
                    position={[0, 0.45, 0.01]}
                    fontSize={0.18}
                    color={dim.color}
                    anchorX="center"
                    font="/fonts/SpaceGrotesk-SemiBold.woff"
                >
                    {dim.name}
                </Text>
                <Text
                    position={[0, 0.1, 0.01]}
                    fontSize={0.11}
                    color="#9ca3af"
                    anchorX="center"
                    maxWidth={2.8}
                >
                    {dim.category}
                </Text>
                <Text
                    position={[0, -0.25, 0.01]}
                    fontSize={0.105}
                    color="#e5e7eb"
                    anchorX="center"
                    maxWidth={2.8}
                >
                    {dim.desc}
                </Text>
            </mesh>
        </Float>
    );
}

function Scene() {
    return (
        <ScrollControls pages={3} damping={0.2}>
            <group>
                {dimensions.map((_, i) => (
                    <DimensionPanel key={i} index={i} total={dimensions.length} />
                ))}
            </group>
        </ScrollControls>
    );
}

export function DimensionOrbit() {
    return (
        <section className="relative" style={{ height: '300vh' }}>
            {/* Sticky canvas container */}
            <div className="sticky top-0 h-screen overflow-hidden">
                {/* Label */}
                <div className="absolute z-10 top-16 left-1/2 -translate-x-1/2 text-center">
                    <motion.p
                        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 1 }}
                        className="text-xs tracking-[0.3em] uppercase text-violet-400 mb-3"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        The Intelligence Engine
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
                        className="text-4xl md:text-5xl font-bold text-white"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        15 Dimensions.<br />
                        <span className="text-gradient-main">Zero Guesswork.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }}
                        className="text-gray-400 mt-4 text-sm max-w-sm mx-auto"
                    >
                        Scroll to navigate through every dimension our agents interrogate on your behalf.
                    </motion.p>
                </div>

                <Canvas camera={{ position: [0, 0, 8], fov: 60 }} style={{ pointerEvents: 'none' }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <Scene />
                </Canvas>
            </div>
        </section>
    );
}

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface ScorecardProps {
    dimensions: Record<string, number>;
    /** Optional: baseline scores shown as ghost layer behind stressed scores */
    originalDimensions?: Record<string, number>;
    onAreaClick: (area: string) => void;
}

export const DiagnosticScorecard = ({ dimensions, originalDimensions, onAreaClick }: ScorecardProps) => {
    // Merge keys from both sets to ensure consistent axis labels
    const allKeys = originalDimensions
        ? Array.from(new Set([...Object.keys(dimensions), ...Object.keys(originalDimensions)]))
        : Object.keys(dimensions);

    const data = allKeys.map(key => ({
        subject: key,
        Stressed: dimensions[key] ?? 50,
        Original: originalDimensions ? (originalDimensions[key] ?? 50) : undefined,
        // Flag dimensions that dropped >20 points for amber pulse
        dropped: originalDimensions
            ? (originalDimensions[key] ?? 50) - (dimensions[key] ?? 50) > 20
            : false,
        fullMark: 100,
    }));

    const isStressMode = !!originalDimensions;

    return (
        <div className="w-full h-[420px] mt-4 rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-sm font-semibold text-center mb-3 uppercase tracking-widest"
                style={{ color: isStressMode ? '#f97316' : '#a855f7' }}>
                {isStressMode ? '⚡ Stressed Dimension Matrix' : '15-Dimension Strategy Matrix'}
            </h3>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={({ payload, x, y, cx, cy, ...rest }: any) => {
                            const entry = data.find(d => d.subject === payload.value);
                            const isDropped = entry?.dropped;
                            return (
                                <text
                                    {...rest}
                                    x={x} y={y} cx={cx} cy={cy}
                                    fontSize={10}
                                    fill={isDropped ? '#f59e0b' : 'rgba(255,255,255,0.65)'}
                                    fontWeight={isDropped ? '600' : '400'}
                                    textAnchor="middle"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => onAreaClick(payload.value)}
                                >
                                    {isDropped ? `⚠ ${payload.value}` : payload.value}
                                </text>
                            );
                        }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    {/* Ghost layer — original baseline scores */}
                    {isStressMode && (
                        <Radar
                            name="Baseline"
                            dataKey="Original"
                            stroke="rgba(168,85,247,0.25)"
                            fill="rgba(168,85,247,0.08)"
                            fillOpacity={0.3}
                            strokeDasharray="4 2"
                            isAnimationActive={false}
                        />
                    )}

                    {/* Foreground — stressed or normal scores */}
                    <Radar
                        name={isStressMode ? 'Stressed' : 'Score'}
                        dataKey="Stressed"
                        stroke={isStressMode ? '#f97316' : '#a855f7'}
                        fill={isStressMode ? '#ef4444' : '#a855f7'}
                        fillOpacity={isStressMode ? 0.35 : 0.55}
                        isAnimationActive={true}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};


import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface ScorecardProps {
    dimensions: Record<string, number>;
    onAreaClick: (area: string) => void;
}

export const DiagnosticScorecard = ({ dimensions, onAreaClick }: ScorecardProps) => {
    const data = Object.keys(dimensions).map(key => ({
        subject: key,
        A: dimensions[key],
        fullMark: 100,
    }));

    return (
        <div className="w-full h-[400px] mt-8 bg-savvy-bg bg-opacity-50 rounded-xl p-4">
            <h3 className="text-xl font-bold text-savvy-purple mb-4 text-center">15-Dimension Strategy Matrix</h3>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="rgba(255,255,255,0.2)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                        onClick={(e) => onAreaClick(e.value)}
                        style={{ cursor: 'pointer' }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Score"
                        dataKey="A"
                        stroke="#A855F7"
                        fill="#A855F7"
                        fillOpacity={0.6}
                        isAnimationActive={true}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

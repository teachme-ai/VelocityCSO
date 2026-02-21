import React, { useState } from 'react';
import { AgentOrbs } from './components/AgentOrbs';
import { DiagnosticScorecard } from './components/DiagnosticScorecard';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import axios from 'axios';

// The production backend is served on the same host since the Vite build is in the public folder.
// A local hardcoded URL could optionally be used for dev.
const API_URL = import.meta.env.VITE_API_URL || '/analyze';

function App() {
  const [context, setContext] = useState('');
  const [status, setStatus] = useState<'idle' | 'market' | 'finance' | 'cso'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context) return;

    setResult(null);
    setError('');
    setStatus('market');

    // Simulate progression of the agents for UI polish
    setTimeout(() => setStatus('finance'), 2500);
    setTimeout(() => setStatus('cso'), 5000);

    try {
      const response = await axios.post(API_URL, { business_context: context });

      // Attempt to parse out the JSON block from the `report` string returning from the API.
      // Often the API returns a string containing markdown, plus the JSON. Sometimes just raw JSON.
      // Let's assume the backend now returns raw JSON or parses it correctly.
      let parsedReport;
      try {
        parsedReport = typeof response.data.report === 'string'
          ? JSON.parse(response.data.report.replace(/```json/g, '').replace(/```/g, '').trim())
          : response.data.report;
      } catch (parseErr) {
        // Fallback: If parsing fails, just display the raw text
        parsedReport = { analysis_markdown: response.data.report, dimensions: {} };
      }

      setResult(parsedReport);
      setStatus('idle');
    } catch (err: any) {
      console.error(err);
      setError('Failed to analyze strategy. Make sure the backend is running.');
      setStatus('idle');
    }
  };

  const handleAreaClick = (area: string) => {
    // Scroll to the specific area in the markdown or highlight
    console.log(`Clicked on dimension: ${area}`);
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col gap-8">

      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-savvy-purple to-savvy-green">
          Velocity CSO
        </h1>
        <div className="text-sm font-medium px-4 py-2 glass-panel rounded-full text-savvy-gold">
          McKinsey-Grade Agentic Intelligence
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Pod */}
        <div className="lg:col-span-5 glass-panel p-6 flex flex-col gap-6 h-fit">
          <div>
            <h2 className="text-xl font-semibold mb-2">Initialize Strategy Matrix</h2>
            <p className="text-gray-400 text-sm">Enter the specific constraints, market, and mechanics of the business you want to stress-test.</p>
          </div>

          <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
            <textarea
              className="w-full h-48 bg-black/20 border border-savvy-border rounded-lg p-4 text-white focus:outline-none focus:border-savvy-purple transition-colors resize-none"
              placeholder="e.g. We are building a SaaS platform for automating compliance in European fin-tech, generating $1M ARR via inbound marketing, but struggling with >6mo sales cycles..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={status !== 'idle'}
            />
            <button
              type="submit"
              disabled={status !== 'idle' || !context}
              className="w-full py-3 bg-gradient-to-r from-savvy-purple to-savvy-green text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              Execute Diagnostic Loop <ChevronRight className="w-5 h-5" />
            </button>
          </form>

          {status !== 'idle' && <AgentOrbs status={status} />}
          {error && <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">{error}</div>}
        </div>

        {/* Results Area */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {result ? (
            <div className="glass-panel p-6 overflow-hidden flex flex-col gap-6">

              {/* Scorecard */}
              {result.dimensions && Object.keys(result.dimensions).length > 0 && (
                <DiagnosticScorecard dimensions={result.dimensions} onAreaClick={handleAreaClick} />
              )}

              {/* Blindspots Alert */}
              {result.confidence_score && result.confidence_score < 70 && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/50 rounded-lg flex items-start gap-4">
                  <ShieldAlert className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-orange-400 font-semibold">Strategic Blindspot Detected</h4>
                    <p className="text-orange-200 text-sm mt-1">
                      Our critic loop flagged this analysis with a confidence score of {result.confidence_score}.
                      Check the reasoning for contradictions or missing empirical data.
                    </p>
                  </div>
                </div>
              )}

              {/* Report Output */}
              <div className="border-t border-savvy-border pt-6">
                <h3 className="text-lg font-semibold mb-4 text-savvy-green">Executive Synthesis</h3>
                <div
                  className="prose prose-invert max-w-none text-sm text-gray-300"
                // Note: In real production, use marked/dompurify to render markdown. 
                // For a quick MVP, presenting it directly in pre-wrap or basic rendering:
                >
                  <pre className="whitespace-pre-wrap font-sans mt-4">{result.analysis_markdown || JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel p-6 h-full flex items-center justify-center text-gray-500">
              <p>Awaiting intelligence input...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

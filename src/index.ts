import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import admin from 'firebase-admin';
import { ChiefStrategyAgent } from './coordinator.js';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

const chief = new ChiefStrategyAgent();

app.post('/analyze', async (req, res) => {
    try {
        const { business_context, stress_test } = req.body;

        if (!business_context) {
            return res.status(400).json({ error: 'business_context is required' });
        }

        // Append stress test command if enabled
        const finalContext = stress_test
            ? business_context + "\n\nCRITICAL DIRECTIVE: The user has enabled STRESS TEST mode. You MUST conduct a highly conservative financial and operational stress test. Lower ROI projections by 30%, assume a 10% market dip, and maximize risk factors. Score all dimensions much more strictly."
            : business_context;

        const report = await chief.analyze(finalContext);

        // Save to Firestore (Wrapped in try/catch for local dev without credentials)
        let docId = 'local-dev-id';
        try {
            const docRef = await db.collection('enterprise_strategy_reports').add({
                business_context,
                report,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            docId = docRef.id;
        } catch (dbError: any) {
            console.warn('[Warning] Failed to save to Firestore (likely missing local credentials). Returning report anyway.');
            console.error(dbError.message);
        }

        res.json({
            id: docId,
            report,
        });
    } catch (error: any) {
        console.error('Error analyzing business:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Catch-all route to serve the React SPA for any unhandled GET requests
// Note: Express v5 requires '/{*path}' syntax (bare '*' is no longer valid)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});

import express from 'express';
import admin from 'firebase-admin';
import { ChiefStrategyAgent } from './coordinator.js';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

const chief = new ChiefStrategyAgent();

app.post('/analyze', async (req, res) => {
    const { business_context } = req.body;

    if (!business_context) {
        return res.status(400).json({ error: 'business_context is required' });
    }

    try {
        const report = await chief.analyze(business_context);

        // Save to Firestore
        const docRef = await db.collection('enterprise_strategy_reports').add({
            business_context,
            report,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            id: docRef.id,
            report,
        });
    } catch (error: any) {
        console.error('Error analyzing business:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});

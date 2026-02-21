import admin from 'firebase-admin';
import { log } from './logger.js';

export interface SpecialistOutput {
    analysis_markdown?: string;
    confidence_score?: number;
    data_sources?: string[];
    dimensions?: Record<string, number>;
}

export interface AuditMemory {
    reportId: string;
    businessContext: string;
    groundedContext: string;           // Discovery findings
    specialistOutputs: Record<string, SpecialistOutput>; // keyed by agent name
    dimensionScores: Record<string, number>; // merged 15-dimension scores
    report: string;                    // Final Markdown report
    stressTest: boolean;
    createdAt: number;
}

const REPORTS = 'enterprise_strategy_reports';

/**
 * Persist the full audit memory after a completed run.
 * Writes to: enterprise_strategy_reports/{reportId}
 * with dimension scores and specialist outputs as subcollection.
 */
export async function saveAuditMemory(
    reportId: string,
    data: Omit<AuditMemory, 'createdAt'>
): Promise<void> {
    try {
        const db = admin.firestore();

        // Update the report document with structured memory fields
        await db.collection(REPORTS).doc(reportId).set({
            business_context: data.businessContext,
            fingerprint: data.businessContext.trim().slice(0, 80).toLowerCase(),
            grounded_context: data.groundedContext,
            dimension_scores: data.dimensionScores,
            report: data.report,
            stress_test: data.stressTest,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Write specialist outputs as a subcollection for querying
        const batch = db.batch();
        for (const [agentName, output] of Object.entries(data.specialistOutputs)) {
            const ref = db
                .collection(REPORTS)
                .doc(reportId)
                .collection('specialist_outputs')
                .doc(agentName);
            batch.set(ref, {
                ...output,
                agent: agentName,
                saved_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();

        log({
            severity: 'INFO',
            message: 'Audit memory saved to Firestore',
            agent_id: 'memory_service',
            report_id: reportId,
            dimension_count: Object.keys(data.dimensionScores).length,
            specialist_count: Object.keys(data.specialistOutputs).length,
        });
    } catch (err: any) {
        log({ severity: 'WARNING', message: 'Failed to save audit memory', error: err.message, report_id: reportId });
    }
}

/**
 * Load a previously saved audit by report ID.
 * Used by GET /report/:id to restore the Radar Chart without re-running.
 */
export async function loadAuditMemory(reportId: string): Promise<AuditMemory | null> {
    try {
        const db = admin.firestore();
        const doc = await db.collection(REPORTS).doc(reportId).get();

        if (!doc.exists) return null;

        const data = doc.data()!;

        // Load specialist outputs from subcollection
        const specialistSnap = await db
            .collection(REPORTS)
            .doc(reportId)
            .collection('specialist_outputs')
            .get();

        const specialistOutputs: Record<string, SpecialistOutput> = {};
        specialistSnap.forEach(d => {
            specialistOutputs[d.id] = d.data() as SpecialistOutput;
        });

        return {
            reportId,
            businessContext: data.business_context || '',
            groundedContext: data.grounded_context || '',
            specialistOutputs,
            dimensionScores: data.dimension_scores || {},
            report: data.report || '',
            stressTest: data.stress_test || false,
            createdAt: data.created_at?.toMillis() ?? Date.now(),
        };
    } catch (err: any) {
        log({ severity: 'WARNING', message: 'Failed to load audit memory', error: err.message, report_id: reportId });
        return null;
    }
}

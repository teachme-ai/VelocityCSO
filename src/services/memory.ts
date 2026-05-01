import admin from 'firebase-admin';
import { log } from './logger.js';

export interface SpecialistOutput {
    analysis_markdown?: string;
    confidence_score?: number;
    data_sources?: string[];
    missing_signals?: string[];
    dimensions?: Record<string, number | null>;
    richDimensions?: Record<string, any>;
}

export interface AuditMemory {
    reportId: string;
    businessContext: string;
    groundedContext: string;
    specialistOutputs: Record<string, SpecialistOutput>;
    specialistMetadata?: any[];
    confidenceTriad?: { evidenceConfidence: number; analyticalConfidence: number; decisionConfidence: number };
    clarifierExchange?: { question: string; answer: string; turnNumber: number }[];
    sector?: string | null;
    orgScale?: string | null;
    urlSource?: string | null;
    documentFilename?: string | null;
    roadmap?: string;
    dimensionScores: Record<string, number | null>;
    richDimensions: Record<string, any>;
    report: string;
    stressTest: boolean;
    moatRationale?: string;
    orgName?: string;
    frameworks?: Record<string, any>;
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

        // Report document is already created fully populated in index.ts

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
            richDimensions: data.rich_dimensions || {},
            report: data.report || '',
            roadmap: data.roadmap || '',
            stressTest: data.stress_test || false,
            moatRationale: data.moat_rationale || '',
            orgName: data.org_name || '',
            frameworks: data.frameworks ?? {},
            clarifierExchange: data.clarifier_exchange || [],
            specialistMetadata: data.specialist_metadata || [],
            confidenceTriad: data.confidence_triad || null,
            sector: data.sector || null,
            orgScale: data.org_scale || null,
            urlSource: data.url_source || null,
            documentFilename: data.document_filename || null,
            createdAt: data.created_at?.toMillis() ?? Date.now(),
        };
    } catch (err: any) {
        log({ severity: 'WARNING', message: 'Failed to load audit memory', error: err.message, report_id: reportId });
        return null;
    }
}

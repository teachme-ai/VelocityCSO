import { vi, beforeEach } from 'vitest';

// ── Firestore mock ────────────────────────────────────────────────────────────
vi.mock('../services/memory.js', () => ({
    saveAuditMemory: vi.fn().mockResolvedValue(undefined),
    loadAuditMemory: vi.fn().mockResolvedValue(null),
    saveAuditReport: vi.fn().mockResolvedValue(undefined),
    getAuditReport: vi.fn().mockResolvedValue(null),
}));

// ── Firebase Admin mock ───────────────────────────────────────────────────────
vi.mock('firebase-admin', () => {
    const mockAuth = {
        verifyIdToken: vi.fn(),
    };
    const mockFirestore = {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        add: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
        update: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({ docs: [] }),
    };

    return {
        default: {
            initializeApp: vi.fn(),
            auth: vi.fn(() => mockAuth),
            firestore: vi.fn(() => mockFirestore),
        },
        auth: vi.fn(() => mockAuth),
        firestore: vi.fn(() => mockFirestore),
    };
});

// ── Google ADK runner mock ────────────────────────────────────────────────────
vi.mock('@google/adk', () => ({
    LlmAgent: vi.fn().mockImplementation((config: any) => ({
        ...config,
        _isAgent: true,
        name: config.name,
        tools: config.tools || [],
    })),
    InMemoryRunner: vi.fn().mockImplementation(() => ({
        sessionService: {
            createSession: vi.fn().mockResolvedValue({}),
        },
        runAsync: vi.fn().mockImplementation(async function* () {
            yield { author: 'mock_agent', content: { parts: [{ text: '{"mock": "response"}' }] } };
        }),
    })),
    isFinalResponse: vi.fn().mockReturnValue(true),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

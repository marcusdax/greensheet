import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore } from '../../root-store';

describe('documents-slice', () => {
  beforeEach(() => {
    useRootStore.setState((state: any) => {
      state.documents.documents = [];
    });
  });

  it('accepts an OCR document and records status as accepted', () => {
    const documents = useRootStore.getState().documents;
    documents.addDocument({
      fileName: 'sca-report.pdf',
      entityType: 'lot',
      entityId: 'lot_001',
      status: 'proposed',
    });

    // Get the generated document ID - re-read from store after mutation
    const docId = useRootStore.getState().documents.documents[0].id;

    documents.acceptOcrDocument({
      documentId: docId,
      ocrResultId: 'ocr_001',
      entityId: 'lot_001',
      entityType: 'lot',
      fields: { cupScore: 82.75, moistureContent: 10.2 },
      confidenceScores: { cupScore: 0.95, moistureContent: 0.91 },
    });

    // Re-read from store after mutation
    const state = useRootStore.getState();
    expect(state.documents.documents[0].status).toBe('accepted');
    expect(state.documents.documents[0].extractedFields?.cupScore).toBe(82.75);
    expect(state.documents.documents[0].confidenceScores?.cupScore).toBe(0.95);
  });

  it('rejects a document', () => {
    const documents = useRootStore.getState().documents;
    documents.addDocument({
      fileName: 'contract.pdf',
      entityType: 'contract',
      entityId: 'contract_001',
      status: 'proposed',
    });

    const docId = useRootStore.getState().documents.documents[0].id;
    documents.rejectDocument(docId);

    const state = useRootStore.getState();
    expect(state.documents.documents[0].status).toBe('rejected');
  });
});
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

    // Get the generated document ID
    const docId = documents.documents[0].id;

    documents.acceptOcrDocument({
      documentId: docId,
      ocrResultId: 'ocr_001',
      entityId: 'lot_001',
      entityType: 'lot',
      fields: { cupScore: 82.75, moistureContent: 10.2 },
      confidenceScores: { cupScore: 0.95, moistureContent: 0.91 },
    });

    expect(documents.documents[0].status).toBe('accepted');
    expect(documents.documents[0].extractedFields?.cupScore).toBe(82.75);
    expect(documents.documents[0].confidenceScores?.cupScore).toBe(0.95);
  });

  it('rejects a document', () => {
    const documents = useRootStore.getState().documents;
    documents.addDocument({
      fileName: 'contract.pdf',
      entityType: 'contract',
      entityId: 'contract_001',
      status: 'proposed',
    });

    const docId = documents.documents[0].id;
    documents.rejectDocument(docId);

    expect(documents.documents[0].status).toBe('rejected');
  });
});
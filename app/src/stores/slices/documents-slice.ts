import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type DocumentStatus = 'draft' | 'proposed' | 'accepted' | 'rejected';
export type DocumentEntityType = 'lot' | 'contract' | 'qc' | 'profile';

export interface DocumentRecord {
  id: string;
  fileName: string;
  entityType: DocumentEntityType;
  entityId: string;
  status: DocumentStatus;
  ocrResultId?: string;
  confidenceScores?: Record<string, number>;
  extractedFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsSliceState {
  documents: DocumentRecord[];
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  acceptOcrDocument: (input: { documentId: string; ocrResultId: string; entityId: string; entityType: DocumentEntityType; fields: Record<string, unknown>; confidenceScores: Record<string, number> }) => void;
  rejectDocument: (documentId: string) => void;
}

export const createDocumentsSlice = (set: any) => {
  return {
    documents: [],
    addDocument: (doc) => set((state) => {
      state.documents.documents.push({
        id: `doc_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...doc,
      });
    }),
    acceptOcrDocument: (input) => set((state) => {
      const doc = state.documents.documents.find((d) => d.id === input.documentId);
      if (doc) {
        doc.status = 'accepted';
        doc.ocrResultId = input.ocrResultId;
        doc.extractedFields = input.fields;
        doc.confidenceScores = input.confidenceScores;
        doc.entityId = input.entityId;
        doc.entityType = input.entityType;
        doc.updatedAt = new Date().toISOString();
      }
    }),
    rejectDocument: (documentId) => set((state) => {
      const doc = state.documents.documents.find((d) => d.id === documentId);
      if (doc) {
        doc.status = 'rejected';
        doc.updatedAt = new Date().toISOString();
      }
    }),
  };
};
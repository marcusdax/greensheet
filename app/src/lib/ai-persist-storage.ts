import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { AiSlice } from '../stores/slices/ai-slice';

export const AI_STORAGE_KEY = 'greensheet:ai';

const SALT = 'odasi-ai-v1';

function stringToBytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function xorBytes(bytes: Uint8Array): Uint8Array {
  const saltBytes = stringToBytes(SALT);
  return Uint8Array.from(bytes, (byte, i) => byte ^ saltBytes[i % saltBytes.length]);
}

function bytesToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function obfuscate(input: string): string {
  return bytesToBase64(xorBytes(stringToBytes(input)));
}

export function deobfuscate(input: string): string {
  return bytesToString(xorBytes(base64ToBytes(input)));
}

export const aiPersistStorage: PersistStorage<AiSlice> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;

    try {
      const deobfuscated = deobfuscate(raw);
      const parsed = JSON.parse(deobfuscated) as StorageValue<AiSlice>['state'];
      return { state: parsed };
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    localStorage.setItem(name, obfuscate(JSON.stringify(value.state)));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

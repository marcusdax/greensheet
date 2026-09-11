import '@testing-library/jest-dom/vitest';

// jsdom does not implement Element.scrollTo
if (typeof Element !== 'undefined') {
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? function () {};
}

// Mock localStorage for jsdom
if (typeof localStorage === 'undefined') {
  const localStorageMock = (function () {
    let store = {};
    return {
      getItem: function (key) {
        return store[key] || null;
      },
      setItem: function (key, value) {
        store[key] = value.toString();
      },
      removeItem: function (key) {
        delete store[key];
      },
      clear: function () {
        store = {};
      }
    };
  })();
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    enumerable: true,
    writable: true
  });
}


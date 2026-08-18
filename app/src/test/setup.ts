import '@testing-library/jest-dom/vitest';

// jsdom does not implement Element.scrollTo
if (typeof Element !== 'undefined') {
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? function () {};
}


import "@testing-library/jest-dom";

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = function () {};

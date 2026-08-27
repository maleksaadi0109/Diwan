import "@testing-library/jest-dom";

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = function () {};

// Mock HTMLMediaElement methods for jsdom
window.HTMLMediaElement.prototype.load = function () {};
window.HTMLMediaElement.prototype.play = function () {
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.pause = function () {};

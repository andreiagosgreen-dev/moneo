import { beforeEach, vi } from "vitest";

// Ensure localStorage is available in both jsdom and node environments
let store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};

// Define for global (Node environment)
if (typeof global !== "undefined") {
  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

// Define for window (jsdom environment)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

beforeEach(() => {
  // Clear localStorage before each test
  store = {};
  vi.restoreAllMocks();
});

/// <reference types="vite-plugin-pwa/client" />

declare global {
  namespace App {
    interface Error {
      message: string;
    }

    interface PageData {
      title?: string;
    }
  }
}

export {};

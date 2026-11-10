/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
/** Exposed by the Electron preload script; absent in a normal browser. */
interface Window {
  sonoraDesktop?: {
    /** Native "choose folder" dialog. Resolves to the path, or null if cancelled. */
    chooseFolder: () => Promise<string | null>;
  };
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_DEFAULT_FIREBASE_DB?: string;
  readonly VITE_DEFAULT_ROOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

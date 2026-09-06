/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALBUM_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

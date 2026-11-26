/// <reference types="vite/client" />

/** Versão do package.json, injetada pelo `define` do vite.config.ts. */
declare const __VERSAO_KLASS__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

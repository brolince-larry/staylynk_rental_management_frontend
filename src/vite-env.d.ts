/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_REVERB_HOST?: string
  readonly VITE_REVERB_PORT?: string
  readonly VITE_REVERB_SCHEME?: 'http' | 'https' | string
  readonly VITE_MEDIA_CDN_URL?: string
  readonly VITE_PROPERTY_VIDEO_MAX_UPLOAD_KB?: string
  readonly PROPERTY_VIDEO_MAX_UPLOAD_KB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

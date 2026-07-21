// src/lib/echo.ts
// Lazy singleton for Laravel Echo (Reverb/Pusher).
// Call getEcho(token) to get the instance; it is created once and reused.
// Call destroyEcho() on logout to close the WS connection.
// If VITE_REVERB_APP_KEY is missing or blank, all calls are silently no-ops.

import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { reverbConfig, apiBaseUrl } from '@/config/env'

declare global {
  interface Window { Pusher: typeof Pusher }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _echo: Echo<any> | null = null
let _token: string | null = null
let initCount = 0

const DEBUG_PREFIX = '[realtime]'

function debug(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  if (data) console.debug(DEBUG_PREFIX, message, data)
  else console.debug(DEBUG_PREFIX, message)
}

function resolveAppKey(): string | null {
  const raw = import.meta.env.VITE_REVERB_APP_KEY as string | undefined
  const trimmed = raw?.trim() ?? ''
  // Treat empty string or the placeholder 'app-key' as unconfigured
  return trimmed.length > 0 && trimmed !== 'app-key' ? trimmed : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEcho(token: string): Echo<any> | null {
  const appKey = resolveAppKey()
  if (!appKey) return null          // Reverb not configured — silent no-op
  if (_echo && _token === token) return _echo

  if (_echo && _token !== token) {
    debug('token changed; reconnecting Echo')
    _echo.disconnect()
    _echo = null
  }

  window.Pusher = Pusher

  // Silence Pusher's own console output in dev when the server isn't running
  Pusher.logToConsole = false

  const tls = reverbConfig.scheme === 'https'

  _echo = new Echo({
    broadcaster: 'reverb',
    key: appKey,
    wsHost: reverbConfig.host,
    wsPort: tls ? 443 : reverbConfig.port,
    wssPort: tls ? reverbConfig.port : 443,
    forceTLS: tls,
    disableStats: true,
    enabledTransports: tls ? ['wss'] : ['ws'],
    authEndpoint: `${apiBaseUrl}/broadcasting/auth`,
    auth: { headers: { Authorization: `Bearer ${token}` } },
  })
  _token = token
  initCount += 1
  debug('Echo initialized', {
    initCount,
    authEndpoint: `${apiBaseUrl}/broadcasting/auth`,
    wsHost: reverbConfig.host,
    wsPort: tls ? 443 : reverbConfig.port,
    transport: tls ? 'wss' : 'ws',
  })

  return _echo
}

export function destroyEcho(): void {
  if (_echo) debug('Echo disconnect')
  _echo?.disconnect()
  _echo = null
  _token = null
}

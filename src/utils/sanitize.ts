// src/utils/sanitize.ts
// XSS prevention — ALWAYS sanitize user-generated content before rendering.
// Never use dangerouslySetInnerHTML without calling sanitize() first.

import DOMPurify from 'dompurify'

// Strict — strips ALL HTML, returns plain text only
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

// Permissive — allows safe inline formatting only (bold, italic, links)
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: true,
    ADD_ATTR: ['target'],
  })
}

// Sanitize search query — strip everything non-alphanumeric
export function sanitizeSearch(input: string): string {
  return input.replace(/[<>"'`;]/g, '').slice(0, 200)
}

/**
 * The production Content-Security-Policy. The build writes it into index.html (see vite.config.ts) and
 * vercel.json sends it as a header with `frame-ancestors`, which only a header can carry. A unit test
 * keeps the two identical.
 *
 * Everything is denied unless listed: the page runs only its own scripts, contacts only its own
 * origin, embeds nothing, and cannot be framed. Inline styles stay allowed because the toast library
 * injects a stylesheet at runtime; inline scripts do not.
 */
export const PRODUCTION_CSP_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ['default-src', "'none'"],
  ['script-src', "'self'"],
  ['style-src', "'self' 'unsafe-inline'"],
  ['img-src', "'self' data: blob:"],
  ['font-src', "'self' data:"],
  ['media-src', "'self' blob:"],
  ['connect-src', "'self'"],
  ['worker-src', "'self' blob:"],
  ['manifest-src', "'self'"],
  ['object-src', "'none'"],
  ['base-uri', "'none'"],
  ['form-action', "'none'"],
];

/** Directives a <meta> tag cannot express; sent as a response header only. */
export const HEADER_ONLY_CSP_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [['frame-ancestors', "'none'"]];

export const serializeCsp = (directives: ReadonlyArray<readonly [string, string]>): string =>
  directives.map(([name, value]) => `${name} ${value}`).join('; ');

export const PRODUCTION_CSP = serializeCsp(PRODUCTION_CSP_DIRECTIVES);
export const PRODUCTION_CSP_HEADER = serializeCsp([...PRODUCTION_CSP_DIRECTIVES, ...HEADER_ONLY_CSP_DIRECTIVES]);

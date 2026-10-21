/** Utilidades HTTP comunes a las Edge Functions (sin dependencias de Deno: se testean en Node). */

/** Cabeceras CORS: solo se refleja el origen si está en la lista permitida. */
export function corsHeaders(request: Request, allowedOrigins: readonly string[]): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  });
  const origin = request.headers.get('Origin');
  if (origin !== null && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set(
      'Access-Control-Allow-Headers',
      request.headers.get('Access-Control-Request-Headers') ??
        'authorization, x-client-info, apikey, content-type',
    );
  }
  return headers;
}

/** true si la petición viene de un navegador con un origen no permitido. */
export function isForbiddenOrigin(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && !allowedOrigins.includes(origin);
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? null;
}

export function jsonResponse(status: number, body: unknown, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

/** Lista de orígenes permitidos a partir de ALLOWED_ORIGINS («a,b,c»). */
export function parseAllowedOrigins(value: string | undefined): string[] {
  const list = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return list.length > 0 ? list : ['http://localhost:5173'];
}

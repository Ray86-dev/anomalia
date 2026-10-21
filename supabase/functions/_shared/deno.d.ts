// Shim mínimo del runtime de Deno para comprobar tipos con tsc (tsconfig.functions.json).
// Solo declara lo que usamos; en Supabase el runtime real aporta la API completa.
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

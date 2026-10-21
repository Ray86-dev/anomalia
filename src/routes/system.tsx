import { ui } from '@shared/generated/content.ts';
import { isRouteErrorResponse, Link, Outlet, useRouteError } from 'react-router';
import { Notice } from '../ui/Notice.tsx';
import { Screen } from '../ui/Screen.tsx';

/** Raíz de todas las rutas. */
export function AppLayout() {
  return <Outlet />;
}

export function Loading() {
  return (
    <Screen title={ui.app.titulo}>
      <p role="status">{ui.app.cargando}</p>
    </Screen>
  );
}

export function NotFound() {
  return (
    <Screen kicker={ui.app.titulo} title={ui.app.paginaNoEncontrada}>
      <Link className="btn" to="/">
        {ui.app.volverInicio}
      </Link>
    </Screen>
  );
}

/** Error al cargar una ruta: típicamente un archivo que ya no existe tras un despliegue. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <Screen kicker={ui.app.titulo} title={ui.app.errorInesperado}>
      <Notice tone="error">{ui.app.errorCarga}</Notice>
      <button
        className="btn"
        type="button"
        onClick={() => {
          window.location.reload();
        }}
      >
        {ui.app.recargar}
      </button>
    </Screen>
  );
}

/** Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. */
export function ConfigError() {
  return (
    <Screen kicker={ui.app.titulo} title={ui.app.errorInesperado}>
      <Notice tone="error">{ui.app.errorConfiguracion}</Notice>
    </Screen>
  );
}

import { createBrowserRouter } from 'react-router';
import { StudentHome } from './routes/alumno/StudentHome.tsx';
import { AppLayout, Loading, NotFound, RouteError } from './routes/system.tsx';

// La ruta del alumnado va en el bundle inicial; consola y centro se cargan bajo demanda
// para que los móviles del alumnado no descarguen código que no usan.
export const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: AppLayout,
      ErrorBoundary: RouteError,
      HydrateFallback: Loading,
      children: [
        { index: true, Component: StudentHome },
        {
          path: 'consola',
          lazy: async () => ({
            Component: (await import('./routes/consola/ConsoleRoute.tsx')).default,
          }),
        },
        {
          path: 'centro',
          lazy: async () => ({
            Component: (await import('./routes/centro/ControlCenter.tsx')).default,
          }),
        },
        { path: '*', Component: NotFound },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

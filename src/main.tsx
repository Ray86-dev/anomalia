import { ui } from '@shared/generated/content.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { installChunkReload } from './lib/chunk-reload.ts';
import { clientEnv } from './lib/env.ts';
import { router } from './router.tsx';
import { ConfigError } from './routes/system.tsx';
import './styles/tokens.css';
import './styles/base.css';

installChunkReload();
document.title = ui.app.titulo;

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {clientEnv === null ? <ConfigError /> : <RouterProvider router={router} />}
  </StrictMode>,
);

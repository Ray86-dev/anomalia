import type { ReactNode } from 'react';

type NoticeProps = {
  readonly tone?: 'info' | 'error';
  readonly children: ReactNode;
};

/** Aviso accesible: los errores se anuncian de inmediato (role="alert"). */
export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

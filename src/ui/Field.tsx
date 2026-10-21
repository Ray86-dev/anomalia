import { useId, type InputHTMLAttributes } from 'react';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  readonly label: string;
  readonly help?: string;
};

/** Campo de formulario con etiqueta y ayuda asociadas para lectores de pantalla. */
export function Field({ label, help, ...input }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={help === undefined ? undefined : helpId} {...input} />
      {help !== undefined && (
        <p id={helpId} className="help">
          {help}
        </p>
      )}
    </div>
  );
}

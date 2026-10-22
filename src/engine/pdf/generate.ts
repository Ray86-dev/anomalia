/**
 * Generación del expediente en el navegador. Este módulo se importa bajo demanda: con él
 * llegan pdf-lib y fontkit, solo cuando el alumno pulsa «Generar».
 */
import { buildDossierPdf, type DossierPdfInput } from './dossier.ts';

export type DossierSources = {
  readonly fonts: { readonly regular: string; readonly bold: string };
  /** Imagen del final (WebP o lo que sea): se convierte a JPEG porque pdf-lib no lee WebP. */
  readonly image: { readonly url: string; readonly credit: string } | null;
};

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

const IMAGE_MAX_WIDTH = 700;

/** La imagen como JPEG, o `null` si no se puede (el PDF se genera igualmente sin ella). */
async function asJpeg(url: string): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const scale = Math.min(1, IMAGE_MAX_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
    return blob === null ? null : new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generateDossierPdf(
  input: DossierPdfInput,
  sources: DossierSources,
): Promise<Uint8Array> {
  const [regular, bold, jpeg] = await Promise.all([
    download(sources.fonts.regular),
    download(sources.fonts.bold),
    sources.image === null ? null : asJpeg(sources.image.url),
  ]);
  const image =
    jpeg === null || sources.image === null ? null : { jpeg, credit: sources.image.credit };
  return buildDossierPdf(input, { regular, bold }, image);
}

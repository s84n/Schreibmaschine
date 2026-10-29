import { PAGE } from '../state/Document';

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportPng(page: HTMLCanvasElement): void {
  page.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    download(url, `schreibmaschine_${stamp()}.png`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

/** PDF im A4-Format; jsPDF wird erst bei Bedarf nachgeladen. */
export async function exportPdf(page: HTMLCanvasElement): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'cm', format: 'a4' });
  pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE.widthCm, PAGE.heightCm);
  pdf.save(`schreibmaschine_${stamp()}.pdf`);
}

export function exportText(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  download(url, `schreibmaschine_${stamp()}.txt`);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

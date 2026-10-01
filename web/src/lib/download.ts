/** Preuzimanje teksta kao fajla (backup, spašen oštećen zapis). Izdvojeno da ga koriste i izvoz i traka oštećenog stanja. */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

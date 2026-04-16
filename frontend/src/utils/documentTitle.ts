export function setDocumentTitle(section?: string) {
  document.title = section ? `${section} · SelAkCRM` : 'SelAkCRM';
}

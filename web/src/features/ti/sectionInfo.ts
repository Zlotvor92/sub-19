export type DotState = true | 'warn' | false | null;

export interface SectionInfo {
  visible: boolean;
  summary: string;
  dot: DotState;
  /** Sekcija se otvara sama (traži radnju). */
  open: boolean;
}

/** Datum i vreme za prikaz u podešavanjima; nevažeće daje prazan tekst. */
export const dt = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sr-RS');
};

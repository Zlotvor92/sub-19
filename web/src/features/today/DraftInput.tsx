import { useState, type InputHTMLAttributes } from 'react';

/* POLJE KOJE SE KUCA: lokalni tekst, upis u store na svaku promenu. Tekst se vraća iz store-a samo kad se STVARNO razlikuje
   od onoga što je upisano (`normalize`) — inače bi „8," odmah postalo „8" i zarez bi se nemoguće ukucao. Spoljna promena
   (uvoz sa Strave dok je ekran otvoren) se tako ipak vidi. */
export function useDraft(
  value: string,
  normalize: (raw: string) => string
): [string, (raw: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  /* Izvedeno stanje tokom iscrtavanja (ne u efektu): vrednost iz store-a se promenila. */
  if (seen !== value) {
    setSeen(value);
    if (normalize(draft) !== value) setDraft(value);
  }
  return [draft, setDraft];
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  normalize: (raw: string) => string;
  onCommit: (raw: string) => void;
  onBlurCommit?: () => void;
};

export function DraftInput({ value, normalize, onCommit, onBlurCommit, ...rest }: Props) {
  const [draft, setDraft] = useDraft(value, normalize);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={onBlurCommit}
    />
  );
}

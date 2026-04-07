export const NOTES_STORAGE_KEY = 'notes';

export type Note = { id: number; text: string };

function parseNotes(raw: string | null): Note[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === 'string') {
      return (parsed as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map((text, i) => ({ id: i + 1, text }));
    }
    const out: Note[] = [];
    for (let i = 0; i < parsed.length; i += 1) {
      const x = parsed[i];
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      if (typeof o.text !== 'string') continue;
      const id =
        typeof o.id === 'number' && Number.isFinite(o.id) ? o.id : i + 1;
      out.push({ id, text: o.text });
    }
    return out;
  } catch {
    return [];
  }
}

export function readNotes(): Note[] {
  return parseNotes(localStorage.getItem(NOTES_STORAGE_KEY));
}

export function writeNotes(notes: Note[]): void {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export function nextNoteId(notes: Note[]): number {
  if (notes.length === 0) return 1;
  return Math.max(...notes.map((n) => n.id)) + 1;
}

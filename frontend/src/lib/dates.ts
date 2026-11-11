// The backend stores UTC times without a zone marker; read them as UTC, show them in local time.
export function parseServerDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

export const formatDate = (value: string) => parseServerDate(value).toLocaleDateString();
export const formatDateTime = (value: string) => parseServerDate(value).toLocaleString();

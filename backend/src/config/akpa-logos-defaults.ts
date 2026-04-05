/**
 * Domyślne adresy i dane logowania do logotypów AKPA.
 * a) Główna oferta: https://logotypy.akpa.pl/logotypy-tv
 * b) Ostatnie rebrandingi: https://logotypy.akpa.pl/nowe-logotypy/
 */
export const AKPA_LOGOS_DEFAULTS = {
  /** Główna lokalizacja – logotypy wszystkich kanałów z aktualnej oferty. */
  BASE_URL: 'https://logotypy.akpa.pl/logotypy-tv',
  USER: 'logotypy_tv',
  PASSWORD: 'logos_2024@',

  /** Ostatnie rebrandingi – gdy w głównej lokalizacji brak logo. */
  NEW_BASE_URL: 'https://logotypy.akpa.pl/nowe-logotypy',
  NEW_USER: 'nowe_logotypy',
  NEW_PASSWORD: 'zmiany2019a1',
} as const;

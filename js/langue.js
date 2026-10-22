// Langue de l'application (REX n° 1, § 9) : français, anglais ou espagnol.
// Le choix fait dans le Profil (gardé sur le téléphone) passe avant le réglage du téléphone ;
// sans l'un ni l'autre, l'application est en français.

export const LANGUES = ['fr', 'en', 'es'];

const CLE = 'spice-trail:langue';

function langueChoisie() {
  try {
    const enregistree = localStorage.getItem(CLE);
    if (LANGUES.includes(enregistree)) return enregistree;
  } catch { /* stockage indisponible : réglage du téléphone */ }
  for (const l of navigator.languages || [navigator.language]) {
    const code = String(l || '').slice(0, 2).toLowerCase();
    if (LANGUES.includes(code)) return code;
  }
  return 'fr';
}

/** Langue de l'interface pour toute la visite. */
export const langue = langueChoisie();

/** Change la langue (Profil, Réglages) : le choix est gardé, puis la page se recharge dans la nouvelle langue. */
export function changerLangue(nouvelle) {
  if (!LANGUES.includes(nouvelle) || nouvelle === langue) return;
  try {
    localStorage.setItem(CLE, nouvelle);
  } catch { /* stockage indisponible : la langue ne pourra pas être gardée */ }
  location.reload();
}

/** Nom d'un pays dans la langue de l'interface, d'après son code ISO à deux lettres (secours : nom donné). */
export function nomPays(code, secours) {
  try {
    return new Intl.DisplayNames([langue], { type: 'region' }).of(String(code).toUpperCase()) || secours;
  } catch {
    return secours;   // navigateur sans Intl.DisplayNames
  }
}

/** Nombre écrit à la manière de la langue : 1.5 → « 1,5 » (fr, es) ou « 1.5 » (en). */
export const nombreLocal = (x, decimales = 1) => new Intl.NumberFormat(langue, { maximumFractionDigits: decimales }).format(x);

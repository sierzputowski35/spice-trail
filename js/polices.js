// Polices des écritures d'origine (chinois, hindi, thaï, japonais, coréen, arabe, tifinagh…).
// Chaque pays indique sa police dans ses données (champ « police » de data/pays.json) :
// elle n'est téléchargée qu'au moment où l'on a besoin de ce pays, jamais au démarrage.
// Un pays à deux écritures (Maroc : arabe et tifinagh) donne une liste de polices.

const ADRESSE_POLICES = 'https://fonts.googleapis.com/css2';
const dejaChargees = new Set();

/** Langue des morceaux de noms écrits en tifinagh (amazigh), au milieu des noms arabes du Maroc. */
export const LANGUE_TIFINAGH = 'zgh';

/** Langues écrites de droite à gauche (attribut dir="rtl" sur le nom d'origine). */
const DROITE_A_GAUCHE = new Set(['ar', 'arc', 'dv', 'fa', 'he', 'ps', 'ur', 'yi']);
// Une transcription en alphabet latin (« ar-Latn ») se lit de gauche à droite
export const ecritDeDroiteAGauche = (langue) => {
  const [base, ...precisions] = String(langue || '').split('-');
  return DROITE_A_GAUCHE.has(base) && !precisions.includes('Latn');
};

/**
 * Charge la ou les polices d'un pays (une seule fois) et les applique à ses noms d'origine.
 * Les noms d'origine portent l'attribut lang du pays (ou « zgh » pour le tifinagh) :
 * la règle ajoutée leur donne la police.
 */
export function chargerPolice(pays) {
  if (!pays?.police || !pays.langue || dejaChargees.has(pays.code)) return;
  dejaChargees.add(pays.code);
  const polices = [].concat(pays.police).filter(Boolean);
  if (!polices.length) return;

  const lien = document.createElement('link');
  lien.rel = 'stylesheet';
  lien.href = `${ADRESSE_POLICES}?${polices.map((p) => `family=${encodeURIComponent(p).replace(/%20/g, '+')}:wght@400;700`).join('&')}&display=swap`;
  document.head.append(lien);

  // Les polices du pays d'abord, puis les polices habituelles de l'application en secours
  const familles = polices.map((p) => `"${p.replace(/"/g, '')}"`).join(', ');
  const cibles = [pays.langue, ...(polices.length > 1 ? [LANGUE_TIFINAGH] : [])]
    .map((l) => `[lang="${CSS.escape(l)}"]`).join(', ');
  let regles = document.getElementById('polices-pays');
  if (!regles) {
    regles = document.createElement('style');
    regles.id = 'polices-pays';
    document.head.append(regles);
  }
  regles.append(`${cibles} {
  --font-origine: ${familles}, var(--font-body);
  --font-origine-titre: ${familles}, var(--font-display);
  font-family: var(--font-origine);
}
`);
}

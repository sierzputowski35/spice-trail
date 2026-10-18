// Polices des écritures d'origine (chinois, hindi, thaï, japonais, coréen, arabe…).
// Chaque pays indique sa police dans ses données (champ « police » de data/pays.json) :
// elle n'est téléchargée qu'au moment où l'on a besoin de ce pays, jamais au démarrage.

const ADRESSE_POLICES = 'https://fonts.googleapis.com/css2';
const dejaChargees = new Set();

/** Langues écrites de droite à gauche (attribut dir="rtl" sur le nom d'origine). */
const DROITE_A_GAUCHE = new Set(['ar', 'arc', 'dv', 'fa', 'he', 'ps', 'ur', 'yi']);
export const ecritDeDroiteAGauche = (langue) => DROITE_A_GAUCHE.has(String(langue || '').split('-')[0]);

/**
 * Charge la police d'un pays (une seule fois) et l'applique à ses noms d'origine.
 * Les noms d'origine portent l'attribut lang du pays : la règle ajoutée leur donne la police.
 */
export function chargerPolice(pays) {
  if (!pays?.police || !pays.langue || dejaChargees.has(pays.code)) return;
  dejaChargees.add(pays.code);

  const lien = document.createElement('link');
  lien.rel = 'stylesheet';
  lien.href = `${ADRESSE_POLICES}?family=${encodeURIComponent(pays.police).replace(/%20/g, '+')}:wght@400;700&display=swap`;
  document.head.append(lien);

  // La police du pays d'abord, puis les polices habituelles de l'application en secours
  const famille = `"${pays.police.replace(/"/g, '')}"`;
  let regles = document.getElementById('polices-pays');
  if (!regles) {
    regles = document.createElement('style');
    regles.id = 'polices-pays';
    document.head.append(regles);
  }
  regles.append(`[lang="${CSS.escape(pays.langue)}"] {
  --font-origine: ${famille}, var(--font-body);
  --font-origine-titre: ${famille}, var(--font-display);
  font-family: var(--font-origine);
}
`);
}

// Couleur d'un pays (venue de ses données) et assombrissement automatique pour la lisibilité.
// Les autres teintes du pays (fond, voisins, mode sombre…) sont déduites dans css/tokens.css.

// Luminance relative d'une couleur [r, g, b] (formule WCAG)
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const versRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const versHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Contraste entre une couleur et le blanc (de 1 à 21). */
export function contrasteAvecBlanc(hex) {
  return 1.05 / (luminance(versRgb(hex)) + 0.05);
}

/** Assombrit la couleur jusqu'à ce qu'un texte blanc y soit lisible (contraste 4,5:1). */
export function versionLisible(hex) {
  let rgb = versRgb(hex);
  for (let i = 0; i < 20 && 1.05 / (luminance(rgb) + 0.05) < 4.5; i++) {
    rgb = rgb.map((v) => Math.round(v * 0.92));
  }
  return versHex(rgb);
}

const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Fond clair le plus défavorable du thème sombre (--surface-2), lu dans css/tokens.css. */
let fondSombre = null;
function lireFondSombre() {
  if (fondSombre || typeof document === 'undefined') return fondSombre;
  const sonde = document.createElement('span');
  sonde.dataset.theme = 'dark';
  document.documentElement.append(sonde);
  const valeur = getComputedStyle(sonde).getPropertyValue('--surface-2').trim();
  sonde.remove();
  if (/^#[0-9a-f]{6}$/i.test(valeur)) fondSombre = versRgb(valeur);
  return fondSombre;
}

/**
 * Version éclaircie pour le mode sombre (titres et liens colorés sur fond sombre) :
 * 70 % de la couleur et 30 % de blanc, et davantage de blanc si c'est nécessaire
 * pour atteindre 4,5:1 (couleurs très foncées comme l'indigo du Japon).
 */
export function versionSombre(hex) {
  const couleur = versRgb(hex);
  const fond = lireFondSombre();
  const melange = (part) => couleur.map((v) => Math.round(v * (1 - part) + 255 * part));
  let part = 0.3;
  while (fond && part < 0.95 && contraste(melange(part), fond) < 4.5) part += 0.05;
  return versHex(melange(part));
}

/** Applique la couleur d'un pays à toute la page. */
export function appliquerCouleurPays(hex) {
  const style = document.documentElement.style;
  style.setProperty('--accent-l', hex);
  style.setProperty('--accent-strong', versionLisible(hex));
  style.setProperty('--accent-d', versionSombre(hex));
}

/** Revient aux couleurs communes (globe, recherche…). */
export function retirerCouleurPays() {
  const style = document.documentElement.style;
  style.removeProperty('--accent-l');
  style.removeProperty('--accent-strong');
  style.removeProperty('--accent-d');
}

/**
 * Couleur de la barre d'état du téléphone : celle du fond de l'écran affiché.
 * variable : '--home' (globe), '--country-bg' (pays, recette) ou '--bg' (listes).
 */
export function mettreAJourBarreEtat(variable) {
  const balise = document.querySelector('meta[name="theme-color"]');
  if (!balise) return;
  // La variable peut être un mélange de couleurs : on la fait calculer par le navigateur
  const sonde = document.createElement('span');
  sonde.style.cssText = `position:absolute;visibility:hidden;color:var(${variable})`;
  document.body.append(sonde);
  const calculee = getComputedStyle(sonde).color;
  sonde.remove();
  // Un mélange peut revenir sous la forme « color(srgb …) » : on le convertit en rgb() en peignant un point
  const pinceau = document.createElement('canvas').getContext('2d');
  pinceau.fillStyle = calculee;
  pinceau.fillRect(0, 0, 1, 1);
  const [r, g, b] = pinceau.getImageData(0, 0, 1, 1).data;
  balise.content = `rgb(${r}, ${g}, ${b})`;
}

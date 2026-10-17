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

/** Applique la couleur d'un pays à toute la page. */
export function appliquerCouleurPays(hex) {
  const style = document.documentElement.style;
  style.setProperty('--accent-l', hex);
  style.setProperty('--accent-strong', versionLisible(hex));
}

/** Revient aux couleurs communes (globe, recherche…). */
export function retirerCouleurPays() {
  const style = document.documentElement.style;
  style.removeProperty('--accent-l');
  style.removeProperty('--accent-strong');
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

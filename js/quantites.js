// Calcul et affichage des quantités selon le nombre de portions.
// Règles d'arrondi : cahier des charges, § 3.4.
// En anglais, les mesures américaines s'ajoutent à côté des grammes et des litres (REX n° 1, § 9).

import { textes } from './textes.js';
import { nombreLocal } from './langue.js';

/** Nombre écrit à la manière de la langue, avec au plus `decimales` chiffres après la virgule : 1.5 → « 1,5 » ou « 1.5 » */
const nombre = (x, decimales = 1) => nombreLocal(x, decimales);

/** Au quart le plus proche, en fraction : 1.3 → « 1 ¼ », 0.5 → « ½ » */
function auQuart(x) {
  const v = Math.max(0.25, Math.round(x * 4) / 4);
  const entier = Math.floor(v);
  const fraction = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[v - entier];
  if (!fraction) return String(entier);
  return entier ? `${entier} ${fraction}` : fraction;
}

/** Mesure américaine d'un poids en grammes : onces, ou livres au-delà d'une livre (rien sous 5 g). */
function poidsUS(grammes) {
  const us = textes.unites.us;
  if (grammes < 5) return '';
  const onces = grammes / 28.35;
  if (onces >= 16) return `${nombre(onces / 16)} ${us.lb}`;
  return `${onces < 2 ? nombre(onces) : auQuart(onces)} ${us.oz}`;
}

/** Mesure américaine d'un volume en millilitres : cuillères à café, à soupe, ou tasses. */
function volumeUS(ml) {
  const us = textes.unites.us;
  if (ml < 15) return `${auQuart(ml / 4.93)} ${us.tsp}`;
  if (ml < 60) return `${auQuart(ml / 14.79)} ${us.tbsp}`;
  const tasses = ml / 236.6;
  return `${auQuart(tasses)} ${Math.round(tasses * 4) / 4 > 1 ? us.cups : us.cup}`;
}

/** Ajoute la mesure américaine entre parenthèses, si la langue le demande. */
const avecUS = (texte, us) => (textes.unites.mesuresUS && us ? `${texte} (${us})` : texte);

/** Températures des étapes : « 180 °C » devient « 180 °C (355 °F) » si la langue le demande. */
export function avecFahrenheit(texte) {
  if (!textes.unites.mesuresUS || !texte) return texte;
  return texte.replace(/(\d+)([\s\u00a0\u202f]*°[\s\u00a0\u202f]*C)\b/g, (tout, celsius) =>
    `${tout} (${Math.round((celsius * 9 / 5 + 32) / 5) * 5} °F)`);
}

/** Au demi le plus proche, minimum ½ : 1.4 → « 1 ½ », 0.2 → « ½ » */
function auDemi(x) {
  const v = Math.max(0.5, Math.round(x * 2) / 2);
  const entier = Math.floor(v);
  if (v % 1 === 0) return String(entier);
  return entier ? `${entier} ½` : '½';
}

/** Texte d'une quantité dans son unité, après arrondi. */
export function formaterQuantite(quantite, unite) {
  let q = quantite;
  let u = unite;
  if (u === 'kg') { q *= 1000; u = 'g'; }
  if (u === 'l') { q *= 1000; u = 'ml'; }

  if (u === 'g') {
    if (q >= 1000) return avecUS(`${nombre(q / 1000)} kg`, poidsUS(q));
    if (q < 1) return `${nombre(q)} g`;
    if (q < 20) return avecUS(`${Math.round(q)} g`, poidsUS(q));
    return avecUS(`${Math.round(q / 5) * 5} g`, poidsUS(q));
  }
  if (u === 'ml') {
    if (q >= 1000) return avecUS(`${nombre(q / 1000)} l`, volumeUS(q));
    if (q >= 100) return avecUS(`${Math.round(q / 10)} cl`, volumeUS(q));
    return avecUS(`${Math.max(5, Math.round(q / 5) * 5)} ml`, volumeUS(q));
  }
  if (u === 'pièce') return auDemi(q);
  if (u === 'pincée') {
    const v = Math.max(1, Math.round(q));
    return `${v} ${v > 1 ? textes.unites.pincees : textes.unites.pincee}`;
  }
  // c. à café, c. à soupe, et toute autre unité : au demi le plus proche, nom de l'unité dans la langue
  return `${auDemi(q)} ${textes.unites.noms[u] || u}`;
}

/** Quantité d'un ingrédient pour un nombre de portions donné. */
export const quantitePour = (ingredient, portions, portionsDeBase) =>
  formaterQuantite(ingredient.quantite * (portions / portionsDeBase), ingredient.unite);

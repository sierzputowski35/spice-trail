// Calcul et affichage des quantités selon le nombre de portions.
// Règles d'arrondi : cahier des charges, § 3.4.

import { textes } from './textes.js';

/** Nombre à la française, avec au plus `decimales` chiffres après la virgule : 1.5 → « 1,5 » */
const nombre = (x, decimales = 1) => String(Math.round(x * 10 ** decimales) / 10 ** decimales).replace('.', ',');

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
    if (q >= 1000) return `${nombre(q / 1000)} kg`;
    if (q < 1) return `${nombre(q)} g`;
    if (q < 20) return `${Math.round(q)} g`;
    return `${Math.round(q / 5) * 5} g`;
  }
  if (u === 'ml') {
    if (q >= 1000) return `${nombre(q / 1000)} l`;
    if (q >= 100) return `${Math.round(q / 10)} cl`;
    return `${Math.max(5, Math.round(q / 5) * 5)} ml`;
  }
  if (u === 'pièce') return auDemi(q);
  if (u === 'pincée') {
    const v = Math.max(1, Math.round(q));
    return `${v} ${v > 1 ? textes.unites.pincees : textes.unites.pincee}`;
  }
  // c. à café, c. à soupe, et toute autre unité : au demi le plus proche
  return `${auDemi(q)} ${u}`;
}

/** Quantité d'un ingrédient pour un nombre de portions donné. */
export const quantitePour = (ingredient, portions, portionsDeBase) =>
  formaterQuantite(ingredient.quantite * (portions / portionsDeBase), ingredient.unite);

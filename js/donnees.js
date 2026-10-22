// Chargement de la liste des pays (data/pays.json) et des fichiers pays, à la demande.
// Chaque fichier n'est téléchargé qu'une fois par session, puis gardé en mémoire.

import { chargerPolice } from './polices.js';
import { annoterNomsCourts } from './outils.js';
import { langue, nomPays } from './langue.js';

const memoire = new Map();

function charger(chemin) {
  if (!memoire.has(chemin)) {
    const promesse = fetch(chemin).then((reponse) => {
      if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status}`);
      return reponse.json();
    });
    // En cas d'échec, on oublie la promesse pour pouvoir réessayer
    promesse.catch(() => memoire.delete(chemin));
    memoire.set(chemin, promesse);
  }
  return memoire.get(chemin);
}

/**
 * Liste des pays disponibles : [{ code, nom, couleur, fichier, fichiers? }], noms dans la langue de l'interface,
 * dans l'ordre alphabétique de cette langue. « fichiers » donne les contenus traduits ({ en: …, es: … }).
 */
let listeTraduite;
export function chargerListePays() {
  listeTraduite ??= charger('data/pays.json').then((liste) => (langue === 'fr' ? liste : liste
    .map((pays) => ({ ...pays, nom: nomPays(pays.code, pays.nom) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, langue))));
  return listeTraduite;
}

/** Contours du monde (TopoJSON, identifiants = codes ISO numériques) */
export const chargerMonde = () => charger('data/geo/monde-110m.json');

/** Table code ISO numérique → code à deux lettres (« 156 » → « CN ») */
export const chargerCodesIso = () => charger('data/geo/codes-iso.json');

/** Contours détaillés du monde (1/50 000 000), pour le zoom du globe : chargés au premier zoom au-delà de ×2. */
export const chargerMondeDetaille = () => charger('data/geo/monde-50m.json');

/** Drapeau d'un pays pour le globe : fond et emblème déjà placés (outils/preparer_drapeaux.mjs). */
export const chargerDrapeau = (code) => charger(`data/geo/drapeaux/${code}.json`);

/**
 * Contenus d'un pays (fiches et recettes), traduits dans la langue de l'interface s'ils existent,
 * sinon en français (avec le nom du pays dans la langue de l'interface). Sa police se charge en même temps.
 */
export function chargerPays(pays) {
  chargerPolice(pays);
  const traduits = pays.fichiers?.[langue];
  return charger(traduits || pays.fichier).then((contenus) => {
    if (!traduits && langue !== 'fr') contenus.pays.nom = pays.nom;
    return annoterNomsCourts(contenus);
  });
}

/** Contours des régions culinaires d'un pays */
export const chargerRegions = (code) => charger(`data/geo/regions/${code}.json`);

/**
 * Retrouve une recette dans tous les pays disponibles (lien direct vers une recette).
 * Les fichiers pays sont chargés en parallèle, une seule fois.
 * Renvoie { pays, contenus, recette } ou null.
 */
export async function trouverRecette(id, listePays) {
  const tous = await Promise.all(listePays.map(async (pays) => ({ pays, contenus: await chargerPays(pays) })));
  const trouve = tous.find(({ contenus }) => contenus.recettes[id]);
  return trouve ? { ...trouve, recette: trouve.contenus.recettes[id] } : null;
}

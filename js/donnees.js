// Chargement de la liste des pays (data/pays.json) et des fichiers pays, à la demande.
// Chaque fichier n'est téléchargé qu'une fois par session, puis gardé en mémoire.

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

/** Liste des pays disponibles : [{ code, nom, couleur, fichier }] */
export const chargerListePays = () => charger('data/pays.json');

/** Contours du monde (TopoJSON, identifiants = codes ISO numériques) */
export const chargerMonde = () => charger('data/geo/monde-110m.json');

/** Table code ISO numérique → code à deux lettres (« 156 » → « CN ») */
export const chargerCodesIso = () => charger('data/geo/codes-iso.json');

/** Contenus d'un pays (fiches et recettes) */
export const chargerPays = (pays) => charger(pays.fichier);

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

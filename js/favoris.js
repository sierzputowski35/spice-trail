// Favoris enregistrés sur l'appareil (recettes et lieux), sans compte.
// Si le stockage est indisponible (navigation privée…), les favoris restent en mémoire
// le temps de la visite, sans erreur.

import { textes } from './textes.js';
import { echapper, carteRecette, nomCourt, ICONE_SUITE } from './outils.js';

const CLE = 'favoris-v1';

let favoris = { recettes: [], lieux: [] };
try {
  const enregistres = JSON.parse(localStorage.getItem(CLE));
  if (enregistres && Array.isArray(enregistres.recettes) && Array.isArray(enregistres.lieux)) favoris = enregistres;
} catch { /* stockage indisponible : on garde la liste vide */ }

function enregistrer() {
  try {
    localStorage.setItem(CLE, JSON.stringify(favoris));
  } catch { /* stockage indisponible ou plein : les favoris restent valables jusqu'à la fermeture */ }
}

/** Identifiant d'un lieu : « cn/sichuan », « cn/sichuan/chengdu », « cn » */
export const cleLieu = (code, region, ville) => [code, region, ville].filter(Boolean).join('/');

export const estFavori = (type, id) => favoris[type].includes(id);

/** Ajoute ou retire un favori ; renvoie vrai s'il est maintenant en favori. */
export function basculerFavori(type, id) {
  const liste = favoris[type];
  const position = liste.indexOf(id);
  if (position >= 0) liste.splice(position, 1);
  else liste.push(id);
  enregistrer();
  return position < 0;
}

export const listeFavoris = (type) => [...favoris[type]];

/* ---------- Écran Favoris ---------- */

/**
 * Crée l'écran Favoris : recettes et lieux enregistrés, de tous les pays.
 * options.chargerTout() : promesse de [{ pays, contenus }] ; options.surRecette(id), options.surLieu(adresse)
 */
export function creerEcranFavoris(conteneur, { chargerTout, surRecette, surLieu }) {
  const t = textes.favoris;
  const repere = conteneur.querySelector('#tabbar');
  (repere || conteneur).insertAdjacentHTML(repere ? 'beforebegin' : 'beforeend', `
    <section class="screen" id="favoris" hidden aria-labelledby="favoris-titre">
      <div class="screen-pad">
        <h1 id="favoris-titre" tabindex="-1">${t.titre}</h1>
        <p class="lead">${t.chapo}</p>
        <div class="favoris-liste" id="favoris-liste"></div>
      </div>
    </section>`);
  const ecran = conteneur.querySelector('#favoris');
  const liste = ecran.querySelector('#favoris-liste');

  /** Retrouve un lieu enregistré (« cn/sichuan/chengdu ») dans les pays chargés. */
  function retrouverLieu(cle, paysCharges) {
    const [code, region, ville] = cle.split('/');
    const trouve = paysCharges.find(({ pays }) => pays.code === code);
    if (!trouve) return null;
    const { pays, contenus } = trouve;
    if (ville) return contenus.villes[ville] ? { cle, nom: contenus.villes[ville].nom, sousTitre: textes.recherche.lieuVille(nomCourt(contenus.regions[region]?.nom), pays.nom) } : null;
    if (region) return contenus.regions[region] ? { cle, nom: contenus.regions[region].nom, sousTitre: textes.recherche.lieuRegion(pays.nom) } : null;
    return { cle, nom: pays.nom, sousTitre: textes.recherche.lieuPays };
  }

  async function remplir() {
    if (!favoris.recettes.length && !favoris.lieux.length) {
      liste.innerHTML = `<p class="empty">${t.vide}</p>`;
      return;
    }
    liste.innerHTML = `<p class="empty">${t.chargement}</p>`;
    let paysCharges;
    try {
      paysCharges = await chargerTout();
    } catch (erreur) {
      console.error(erreur);
      liste.innerHTML = `<p class="empty" role="alert">${textes.erreurs.chargement}</p>`;
      return;
    }
    // Une recette ou un lieu disparu des données est simplement ignoré
    const recettes = favoris.recettes
      .map((id) => paysCharges.find(({ contenus }) => contenus.recettes[id]))
      .map((trouve, i) => trouve && { recette: trouve.contenus.recettes[favoris.recettes[i]], pays: trouve.pays })
      .filter(Boolean);
    const lieux = favoris.lieux.map((cle) => retrouverLieu(cle, paysCharges)).filter(Boolean);

    let html = '';
    if (recettes.length) html += `<p class="section-label">${t.recettes}</p><ul class="list">${recettes.map((e) => carteRecette(e.recette, e.pays)).join('')}</ul>`;
    if (lieux.length) {
      html += `<p class="section-label">${t.lieux}</p><ul class="list">${lieux.map((l) => `<li><button class="item" data-lieu="#/${echapper(l.cle)}">
        <span class="min"><span class="t">${echapper(nomCourt(l.nom))}</span><br><span class="o">${echapper(l.sousTitre)}</span></span>
        ${ICONE_SUITE}</button></li>`).join('')}</ul>`;
    }
    liste.innerHTML = html || `<p class="empty">${t.vide}</p>`;
  }

  liste.addEventListener('click', (evenement) => {
    const recette = evenement.target.closest('[data-recette]');
    if (recette) surRecette(recette.dataset.recette);
    const lieu = evenement.target.closest('[data-lieu]');
    if (lieu) surLieu(lieu.dataset.lieu);
  });

  return {
    afficher() {
      const dejaVisible = !ecran.hidden;
      ecran.hidden = false;
      remplir();
      if (!dejaVisible) ecran.querySelector('h1').focus({ preventScroll: true });
    },
    cacher() {
      ecran.hidden = true;
    },
  };
}

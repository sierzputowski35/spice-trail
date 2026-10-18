// Recherche dans tous les pays : recettes (noms, ingrédients, lieux d'origine), lieux et produits.
// Sans tenir compte des accents ni des majuscules. Filtres combinables sur les recettes.

import { textes } from './textes.js';
import { echapper, attributLangue, carteRecette, dureeTotale, teintePays, ICONE_SUITE, nomLieu } from './outils.js';

const ICONE_LOUPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

/** « Phở Bò », « PHO bo » → « pho bo » : sans accents, sans majuscules. */
export function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')            // vietnamien : đ n'est pas un « d accentué » pour Unicode
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’‘]/g, "'");
}

// Filtres : chacun garde les recettes qui le respectent ; ils se combinent
const FILTRES = {
  vegetarien: (r) => r.regimes?.includes('vegetarien') || r.regimes?.includes('vegan'),
  vegan: (r) => r.regimes?.includes('vegan'),
  facile: (r) => r.difficulte === 'facile',
  doux: (r) => !r.piquant,
  rapide: (r) => dureeTotale(r) + (r.temps.repos || 0) <= 30,
};

/**
 * Prépare tout ce qui peut être trouvé, pour tous les pays disponibles.
 * paysCharges : [{ pays, contenus }]
 */
export function construireIndex(paysCharges) {
  const recettes = [];
  const lieux = [];
  const produits = [];
  const dejaVus = new Set();

  for (const { pays, contenus } of paysCharges) {
    for (const r of Object.values(contenus.recettes)) {
      const region = contenus.regions[r.origine.region];
      const ville = contenus.villes[r.origine.ville];
      // transcription_officielle : non affichée, elle permet de trouver « phat thai » comme « pad thai »
      const mots = [r.nom, r.nom_origine, r.transcription_officielle, pays.nom, region?.nom, ville?.nom, ...(r.ingredients || []).map((i) => i.nom)];
      recettes.push({ recette: r, pays, texte: normaliser(mots.join(' | ')) });
    }

    lieux.push({ niveau: 'pays', lieu: contenus.pays, pays, contenus });
    for (const region of Object.values(contenus.regions)) lieux.push({ niveau: 'region', lieu: region, pays, contenus });
    for (const ville of Object.values(contenus.villes)) lieux.push({ niveau: 'ville', lieu: ville, pays, contenus });

    const sources = [contenus.pays, ...Object.values(contenus.regions), ...Object.values(contenus.villes)];
    for (const source of sources) {
      for (const produit of source.produits_typiques || []) {
        const cle = `${pays.code}:${normaliser(produit.nom)}`;
        if (dejaVus.has(cle)) continue;
        dejaVus.add(cle);
        produits.push({ produit, pays, texte: normaliser([produit.nom, produit.nom_origine, produit.description].join(' | ')) });
      }
    }
  }
  for (const l of lieux) l.texte = normaliser([l.lieu.nom, l.lieu.nom_local].join(' | '));
  return { recettes, lieux, produits };
}

/** Résultats d'une recherche : { recettes, lieux, produits }. */
export function chercher(index, requete, filtresActifs) {
  const mot = normaliser(requete.trim());
  const correspond = (texte) => !mot || texte.includes(mot);
  let recettes = index.recettes.filter((e) => correspond(e.texte));
  for (const nom of filtresActifs) recettes = recettes.filter((e) => FILTRES[nom](e.recette));
  // Lieux et produits : seulement pour un mot cherché, sans filtre (les filtres portent sur les recettes)
  const autres = mot && !filtresActifs.size;
  return {
    recettes,
    lieux: autres ? index.lieux.filter((e) => correspond(e.texte)) : [],
    produits: autres ? index.produits.filter((e) => correspond(e.texte)) : [],
  };
}

/**
 * Crée l'écran de recherche.
 * options.chargerTout()       : promesse de [{ pays, contenus }] pour tous les pays
 * options.adresseLieu(entree) : adresse d'un lieu trouvé
 * options.surRecette(id), options.surLieu(adresse)
 */
export function creerEcranRecherche(conteneur, { chargerTout, adresseLieu, surRecette, surLieu }) {
  const t = textes.recherche;
  const repere = conteneur.querySelector('#tabbar');
  (repere || conteneur).insertAdjacentHTML(repere ? 'beforebegin' : 'beforeend', `
    <section class="screen" id="recherche" hidden aria-labelledby="recherche-titre">
      <div class="screen-pad">
        <h1 id="recherche-titre" tabindex="-1">${t.titre}</h1>
        <p class="lead">${t.chapo}</p>
        <div class="search-box" role="search">
          ${ICONE_LOUPE}
          <input id="recherche-champ" type="search" aria-label="${t.champ}" placeholder="${t.exemple}" autocomplete="off" enterkeyhint="search">
        </div>
        <div class="filters" role="group" aria-label="${t.filtres}">
          ${Object.keys(FILTRES).map((f) => `<button data-filtre="${f}" aria-pressed="false">${t.filtre[f]}</button>`).join('')}
        </div>
        <p class="visually-hidden" id="recherche-annonce" role="status" aria-live="polite"></p>
        <div id="recherche-resultats"></div>
      </div>
    </section>`);

  const ecran = conteneur.querySelector('#recherche');
  const champ = ecran.querySelector('#recherche-champ');
  const resultats = ecran.querySelector('#recherche-resultats');
  const annonce = ecran.querySelector('#recherche-annonce');
  const filtresActifs = new Set();
  let index = null;
  let minuterieAnnonce;

  function lieuHtml(e) {
    const regionDeVille = e.niveau === 'ville' ? e.contenus.regions[e.lieu.region] : null;
    const sousTitre = e.niveau === 'pays' ? t.lieuPays
      : e.niveau === 'region' ? t.lieuRegion(e.pays.nom)
        : t.lieuVille(nomLieu(regionDeVille), e.pays.nom);
    return `<li><button class="item" data-lieu="${echapper(adresseLieu(e))}">
      <span class="min"><span class="t">${echapper(nomLieu(e.lieu))}</span><br><span class="o">${echapper(sousTitre)}</span></span>
      ${ICONE_SUITE}</button></li>`;
  }

  const produitHtml = ({ produit, pays }) => `<li${teintePays(pays)}><div class="item"><span class="min">
      <span class="t">${echapper(produit.nom)}</span>${produit.label ? `<span class="badge">${echapper(produit.label)}</span>` : ''}<br>
      <span class="o"${attributLangue(pays.langue)}>${echapper(produit.nom_origine || '')}</span>
      <span class="d">${echapper(produit.description)}</span></span></div></li>`;

  function afficherResultats() {
    if (!index) {
      resultats.innerHTML = `<p class="empty">${t.chargement}</p>`;
      return;
    }
    const { recettes, lieux, produits } = chercher(index, champ.value, filtresActifs);
    let html = '';
    if (recettes.length) html += `<p class="section-label">${t.recettes(recettes.length)}</p><ul class="list">${recettes.map((e) => carteRecette(e.recette, e.pays)).join('')}</ul>`;
    if (lieux.length) html += `<p class="section-label">${t.lieux}</p><ul class="list">${lieux.map(lieuHtml).join('')}</ul>`;
    if (produits.length) html += `<p class="section-label">${t.produits}</p><ul class="list">${produits.map(produitHtml).join('')}</ul>`;
    resultats.innerHTML = html || `<p class="empty">${echapper(t.aucunResultat(champ.value.trim()))}</p>`;
    // Annonce pour les lecteurs d'écran, après une courte pause de frappe
    clearTimeout(minuterieAnnonce);
    const total = recettes.length + lieux.length + produits.length;
    minuterieAnnonce = setTimeout(() => { annonce.textContent = t.annonce(total); }, 600);
  }

  champ.addEventListener('input', afficherResultats);
  ecran.querySelector('.filters').addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-filtre]');
    if (!bouton) return;
    const nom = bouton.dataset.filtre;
    if (filtresActifs.has(nom)) filtresActifs.delete(nom);
    else filtresActifs.add(nom);
    bouton.setAttribute('aria-pressed', filtresActifs.has(nom));
    afficherResultats();
  });
  resultats.addEventListener('click', (evenement) => {
    const recette = evenement.target.closest('[data-recette]');
    if (recette) surRecette(recette.dataset.recette);
    const lieu = evenement.target.closest('[data-lieu]');
    if (lieu) surLieu(lieu.dataset.lieu);
  });

  return {
    async afficher() {
      const dejaVisible = !ecran.hidden;
      ecran.hidden = false;
      if (!dejaVisible) champ.focus({ preventScroll: true });
      afficherResultats();
      if (!index) {
        // Tous les pays se chargent en arrière-plan à la première ouverture
        try {
          index = construireIndex(await chargerTout());
          afficherResultats();
        } catch (erreur) {
          console.error(erreur);
          resultats.innerHTML = `<p class="empty" role="alert">${textes.erreurs.chargement}</p>`;
        }
      }
    },
    cacher() {
      ecran.hidden = true;
    },
  };
}

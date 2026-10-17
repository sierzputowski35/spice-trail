// Panneau de fiche (pays, région, ville) : trois positions, poignée,
// onglets Histoire, Plats, Produits, Recettes, favori du lieu.

import { textes } from './textes.js';
import { echapper, attributLangue, vignette, photoVerifiee, carteRecette, nomCourt } from './outils.js';
import { cleLieu, estFavori, basculerFavori } from './favoris.js';
import { exploserPiments } from './animations.js';

const ONGLETS = ['histoire', 'plats', 'produits', 'recettes'];
const ICONE_FAVORI = '<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

/**
 * Crée le panneau dans l'écran de l'application.
 * options.scene()             : élément qui sert de repère pour les hauteurs (#stage)
 * options.surRecette(id)      : toucher d'une recette
 * options.surMessage(texte)   : message à afficher
 */
export function creerPanneau(conteneur, { scene, surRecette, surMessage }) {
  const t = textes.panneau;
  // Placé avant la barre d'onglets, pour un ordre de lecture logique au clavier
  const repere = conteneur.querySelector('#tabbar');
  (repere || conteneur).insertAdjacentHTML(repere ? 'beforebegin' : 'beforeend', `
    <section class="sheet" id="sheet" hidden aria-label="${t.nom}">
      <button class="handle" id="poignee" aria-label="${t.poignee}"></button>
      <div class="sheet-head">
        <div>
          <span class="sticker accent tilt-l" id="fiche-etiquette"></span>
          <h2 id="fiche-titre"></h2>
          <div class="local" id="fiche-local"></div>
        </div>
        <button class="round fav" id="fiche-favori" aria-pressed="false">${ICONE_FAVORI}</button>
      </div>
      <div class="tabs" role="tablist" aria-label="${t.rubriques}">
        ${ONGLETS.map((o) => `<button role="tab" id="onglet-${o}" data-onglet="${o}" aria-controls="fiche-contenu">${t.onglets[o]}</button>`).join('')}
      </div>
      <div class="sheet-body" id="fiche-contenu" role="tabpanel" tabindex="0"></div>
    </section>`);

  const panneau = conteneur.querySelector('#sheet');
  const $ = (selecteur) => panneau.querySelector(selecteur);
  const contenu = $('#fiche-contenu');

  let fiche = null;        // { pays, contenus, niveau, region, ville }
  let onglet = 'histoire';
  let position = 'mid';

  /* ---------- Positions : réduit, mi-hauteur, plein écran ---------- */

  function hauteurPour(pos) {
    const hauteur = scene().getBoundingClientRect().height;
    if (pos === 'full') return 64;
    if (pos === 'peek') return hauteur - 150;
    return Math.round(hauteur * 0.5);
  }

  function placer(pos) {
    position = pos;
    panneau.style.setProperty('--sheet-top', `${hauteurPour(pos)}px`);
    conteneur.classList.toggle('sheet-full', pos === 'full');
    // En plein écran, la barre d'onglets est masquée : elle ne doit plus être atteignable
    const barre = conteneur.querySelector('#tabbar');
    if (barre) barre.inert = pos === 'full';
  }

  // Tirer la poignée déplace le panneau ; un simple toucher bascule mi-hauteur / plein écran
  const poignee = $('#poignee');
  let departY = 0;
  let departHaut = 0;
  let hautCourant = 0;
  let aGlisse = false;
  poignee.addEventListener('pointerdown', (evenement) => {
    departY = evenement.clientY;
    departHaut = panneau.getBoundingClientRect().top - scene().getBoundingClientRect().top;
    hautCourant = departHaut;
    aGlisse = false;
    panneau.classList.add('dragging');
    try {
      poignee.setPointerCapture(evenement.pointerId);
    } catch { /* pointeur déjà relâché : le glissement continue sans capture */ }
  });
  poignee.addEventListener('pointermove', (evenement) => {
    if (!panneau.classList.contains('dragging')) return;
    const ecart = evenement.clientY - departY;
    if (Math.abs(ecart) > 4) aGlisse = true;
    hautCourant = Math.max(56, departHaut + ecart);
    panneau.style.setProperty('--sheet-top', `${hautCourant}px`);
  });
  const lacher = () => {
    if (!panneau.classList.contains('dragging')) return;
    panneau.classList.remove('dragging');
    if (!aGlisse) return;   // simple toucher : géré par le clic ci-dessous
    const plusProche = ['full', 'mid', 'peek']
      .map((pos) => [pos, Math.abs(hauteurPour(pos) - hautCourant)])
      .sort((a, b) => a[1] - b[1])[0][0];
    placer(plusProche);
  };
  poignee.addEventListener('pointerup', lacher);
  poignee.addEventListener('pointercancel', lacher);
  poignee.addEventListener('click', () => {
    if (aGlisse) { aGlisse = false; return; }
    placer(position === 'full' ? 'mid' : 'full');
  });

  /* ---------- Onglets ---------- */

  function choisirOnglet(nouveau, avecFocus = false) {
    onglet = nouveau;
    for (const bouton of panneau.querySelectorAll('[role="tab"]')) {
      const actif = bouton.dataset.onglet === onglet;
      bouton.setAttribute('aria-selected', actif);
      bouton.tabIndex = actif ? 0 : -1;
      if (actif && avecFocus) bouton.focus();
    }
    contenu.setAttribute('aria-labelledby', `onglet-${onglet}`);
    remplir();
    contenu.scrollTop = 0;
  }

  const listeOnglets = panneau.querySelector('[role="tablist"]');
  listeOnglets.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-onglet]');
    if (bouton) choisirOnglet(bouton.dataset.onglet);
  });
  // Flèches gauche / droite pour passer d'un onglet à l'autre au clavier
  listeOnglets.addEventListener('keydown', (evenement) => {
    const sens = { ArrowRight: 1, ArrowLeft: -1 }[evenement.key];
    if (!sens) return;
    evenement.preventDefault();
    const i = (ONGLETS.indexOf(onglet) + sens + ONGLETS.length) % ONGLETS.length;
    choisirOnglet(ONGLETS[i], true);
  });

  /* ---------- Contenu ---------- */

  const lieu = () => (fiche.niveau === 'ville' ? fiche.contenus.villes[fiche.ville]
    : fiche.niveau === 'region' ? fiche.contenus.regions[fiche.region]
      : fiche.contenus.pays);
  const langue = () => fiche.pays.langue;
  const cleFavori = () => cleLieu(fiche.pays.code, fiche.region, fiche.ville);

  function recettesDuNiveau() {
    const recettes = Object.values(fiche.contenus.recettes);
    if (fiche.niveau === 'ville') return recettes.filter((r) => r.origine.ville === fiche.ville);
    if (fiche.niveau === 'region') return recettes.filter((r) => r.origine.region === fiche.region);
    return recettes.filter((r) => (r.mis_en_avant || []).includes('pays'));
  }

  function ongletHistoire(l) {
    let html = `<div class="prose">${l.histoire || `<p>${t.textesAVenir}</p>`}</div>`;
    if (l.en_savoir_plus) {
      html += `<button class="more-btn" id="plus" aria-expanded="false" aria-controls="plus-texte">${t.enSavoirPlus}</button>
        <div class="prose plus-texte" id="plus-texte" hidden>${l.en_savoir_plus}</div>`;
    }
    if (l.legendes) html += `<aside class="legend-box prose"><h3>${t.ceQuOnRaconte}</h3>${l.legendes}</aside>`;
    return html;
  }

  function ongletPlats(l) {
    const plats = l.plats_emblematiques || [];
    return `<p class="section-label">${t.platsEmblematiques}</p><ul class="list">${plats.map((p) => {
      const recette = p.recette && fiche.contenus.recettes[p.recette];
      const interieur = `${vignette(p.nom_origine, langue(), photoVerifiee(recette))}
        <span class="min"><span class="t">${echapper(p.nom)}</span><br><span class="o"${attributLangue(langue())}>${echapper(p.nom_origine)}</span>
        <span class="d">${echapper(p.resume || '')}</span>
        ${recette ? `<span class="chips"><span class="chip accent">${t.voirLaRecette}</span></span>` : ''}</span>`;
      return `<li>${recette ? `<button class="item" data-recette="${echapper(p.recette)}">${interieur}</button>` : `<div class="item">${interieur}</div>`}</li>`;
    }).join('')}</ul>`;
  }

  function ongletProduits(l) {
    const produits = l.produits_typiques || [];
    let html = `<p class="section-label">${t.produitsTypiques}</p><ul class="list">${produits.map((p) => `<li><div class="item"><span class="min">
        <span class="t">${echapper(p.nom)}</span>${p.label ? `<span class="badge">${echapper(p.label)}</span>` : ''}<br>
        <span class="o"${attributLangue(langue())}>${echapper(p.nom_origine || '')}</span>
        <span class="d">${echapper(p.description)}</span></span></div></li>`).join('')}</ul>`;
    if (fiche.niveau === 'ville' && l.lieux_gourmands?.length) {
      html += `<p class="section-label">${t.lieuxGourmands}</p><ul class="list">${l.lieux_gourmands.map((g) => `<li><div class="item"><span class="min">
        <span class="t">${echapper(g.nom)}</span><span class="d">${echapper(g.description)}</span></span></div></li>`).join('')}</ul>`;
    }
    return html;
  }

  function ongletRecettes(l) {
    const recettes = recettesDuNiveau();
    if (!recettes.length) {
      // Explication propre à un lieu, si la fiche en fournit une (champ message_recettes)
      return `<div class="empty">${t.aucuneRecette}${l.message_recettes ? ' ' + echapper(l.message_recettes) : ''}</div>`;
    }
    return `<p class="section-label">${t.nombreRecettes(recettes.length)}</p><ul class="list">${recettes.map((r) => carteRecette(r, fiche.pays)).join('')}</ul>`;
  }

  function remplir() {
    if (!fiche) return;
    const l = lieu();
    const constructeurs = { histoire: ongletHistoire, plats: ongletPlats, produits: ongletProduits, recettes: ongletRecettes };
    contenu.innerHTML = constructeurs[onglet](l);
  }

  contenu.addEventListener('click', (evenement) => {
    const recette = evenement.target.closest('[data-recette]');
    if (recette) {
      surRecette(recette.dataset.recette);
      return;
    }
    const plus = evenement.target.closest('#plus');
    if (plus) {
      const texte = contenu.querySelector('#plus-texte');
      texte.hidden = !texte.hidden;
      plus.setAttribute('aria-expanded', !texte.hidden);
      plus.textContent = texte.hidden ? t.enSavoirPlus : t.reduire;
    }
  });

  /* ---------- Favori du lieu ---------- */

  const boutonFavori = $('#fiche-favori');
  function afficherFavori() {
    const nom = nomCourt(lieu().nom);
    const actif = estFavori('lieux', cleFavori());
    boutonFavori.setAttribute('aria-pressed', actif);
    boutonFavori.setAttribute('aria-label', actif ? textes.favoris.retirerLieu(nom) : textes.favoris.ajouterLieu(nom));
  }
  boutonFavori.addEventListener('click', () => {
    const actif = basculerFavori('lieux', cleFavori());
    afficherFavori();
    if (actif) exploserPiments(boutonFavori);
    surMessage(actif ? textes.favoris.ajoute : textes.favoris.retire);
  });

  /* ---------- Affichage ---------- */

  /** Montre la fiche d'un lieu. À chaque nouveau lieu : onglet Histoire, panneau à mi-hauteur. */
  function afficher(nouvelleFiche) {
    const nouveauLieu = !fiche || cleLieu(fiche.pays.code, fiche.region, fiche.ville)
      !== cleLieu(nouvelleFiche.pays.code, nouvelleFiche.region, nouvelleFiche.ville);
    fiche = nouvelleFiche;
    const l = lieu();

    $('#fiche-etiquette').textContent = fiche.niveau === 'ville'
      ? t.etiquetteVille(nomCourt(fiche.contenus.regions[fiche.region].nom))
      : fiche.niveau === 'region' ? t.etiquetteRegion : t.etiquettePays;
    $('#fiche-titre').textContent = nomCourt(l.nom);
    const local = $('#fiche-local');
    local.textContent = l.nom_local || '';
    if (langue()) local.lang = langue();
    afficherFavori();

    const etaitCache = panneau.hidden;
    panneau.hidden = false;
    if (nouveauLieu || etaitCache) {
      placer('mid');
      choisirOnglet('histoire');
    } else {
      remplir();
    }
  }

  function cacher() {
    panneau.hidden = true;
    conteneur.classList.remove('sheet-full');
    const barre = conteneur.querySelector('#tabbar');
    if (barre) barre.inert = false;
  }

  return {
    afficher,
    cacher,
    /** Haut du panneau à mi-hauteur : la carte se place au-dessus. */
    hautMilieu: () => hauteurPour('mid'),
    redimensionner: () => { if (!panneau.hidden) placer(position); },
  };
}

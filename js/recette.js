// Écran recette : en-tête au drapeau, étiquettes, portions, ingrédients groupés,
// liens entre recettes, étapes et minuteurs, conseils, « Ce qu'on raconte ».

import { textes } from './textes.js';
import { quantitePour, avecFahrenheit } from './quantites.js';
import { echapper, attributLangue, elementOrigine, ecritureOrigine, langueEcriture, langueRecette, estCjk, photoVerifiee, piments, duree, nomLieu } from './outils.js';
import { estFavori, basculerFavori } from './favoris.js';
import { exploserPiments } from './animations.js';

const ICONES = {
  alerte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  retour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  favori: '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  moins: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  minuteur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
};

/** « 10 min » → 600 ; « 30 s » → 30 ; « 1 h 30 » → 5400 (en secondes) */
export function dureeEnSecondes(texte) {
  const valeurs = { h: 3600, min: 60, s: 1 };
  let total = 0;
  for (const [, nombre, unite] of String(texte).matchAll(/([\d.,]+)\s*(h|min|s)\b/g)) {
    total += parseFloat(nombre.replace(',', '.')) * valeurs[unite];
  }
  // « 1 h 30 » : les minutes sans unité après les heures
  const heuresMinutes = String(texte).match(/(\d+)\s*h\s*(\d+)\s*$/);
  if (heuresMinutes) total += parseInt(heuresMinutes[2], 10) * 60;
  return Math.round(total);
}

/** Durée d'un minuteur, avec les temps longs en heures : « 90 min » → « 1 h 30 », « 720 min » → « 12 h ». */
export function libelleDuree(texte) {
  const secondes = dureeEnSecondes(texte);
  if (secondes < 3600 || secondes % 60) return String(texte);
  return duree(secondes / 60);
}

/** 125 → « 2:05 » ; 3725 → « 1 h 02:05 » */
function compteARebours(secondes) {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const ms = `${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
  return h ? `${h} h ${ms}` : ms;
}

/**
 * Crée l'écran recette.
 * options.surLieu(niveau)    : toucher d'une étiquette d'origine ('ville', 'region' ou 'pays')
 * options.surRetour()        : bouton retour
 * options.surRecette(id)     : toucher d'un ingrédient qui renvoie vers une autre recette
 * options.surMessage(texte)  : message à afficher
 */
export function creerEcranRecette(conteneur, { surLieu, surRetour, surRecette, surMessage }) {
  const t = textes.recette;
  const repere = conteneur.querySelector('#tabbar');
  (repere || conteneur).insertAdjacentHTML(repere ? 'beforebegin' : 'beforeend',
    `<section class="screen" id="recette" hidden aria-label="${t.nom}"></section>`);
  const ecran = conteneur.querySelector('#recette');

  let fiche = null;       // { pays, contenus, recette }
  let portions = 0;
  // Minuteurs en cours, gardés même si l'on quitte la recette : clé « recette:étape »
  const minuteurs = new Map();

  /* ---------- Construction ---------- */

  function enTete() {
    const { pays, contenus, recette: r } = fiche;
    const langue = langueRecette(r, pays);
    const ecriture = ecritureOrigine(r.nom_origine);
    const lang = attributLangue(langueEcriture(ecriture, langue));
    const origine = [];
    if (r.origine.ville && contenus.villes[r.origine.ville]) origine.push(['ville', nomLieu(contenus.villes[r.origine.ville])]);
    if (r.origine.region && contenus.regions[r.origine.region]) origine.push(['region', nomLieu(contenus.regions[r.origine.region])]);
    origine.push(['pays', pays.nom]);
    const favori = estFavori('recettes', r.id);
    // Adresse complète : dans une variable CSS, un chemin relatif serait lu depuis le dossier css/
    const drapeau = new URL(`drapeaux/${pays.code}.svg`, document.baseURI).href;
    return `
      <header class="r-top flag" style="--drapeau: url('${echapper(drapeau)}')">
        <span class="big${estCjk(ecriture) ? '' : ' lat'}"${lang} aria-hidden="true">${echapper(ecriture)}</span>
        <button class="round back" data-action="retour" aria-label="${textes.navigation.retour}">${ICONES.retour}</button>
        <button class="round fav" data-action="favori" aria-pressed="${favori}"
          aria-label="${echapper(favori ? t.retirerFavori(r.nom) : t.ajouterFavori(r.nom))}">${ICONES.favori}</button>
        <nav class="origin" aria-label="${t.origine}">${origine.map(([niveau, nom]) => `<button data-lieu="${niveau}">${echapper(nom)}</button>`).join('')}</nav>
        <h1 tabindex="-1">${echapper(r.nom)}</h1>
        ${elementOrigine(r.nom_origine, langue, 'div', pays.langue)}
      </header>`;
  }

  function etiquettes() {
    const r = fiche.recette;
    const temps = [[t.preparation, r.temps.preparation], [t.cuisson, r.temps.cuisson]];
    if (r.temps.repos) temps.push([t.repos, r.temps.repos]);
    const regimes = (r.regimes || []).map((x) => `<span class="chip">${t.regimes[x] || echapper(x)}</span>`).join('');
    const saisons = (r.saison || []).map((x) => t.saisons[x] || x).join(', ');
    return `
      <dl class="meta">
        ${temps.map(([nom, minutes]) => `<div><dt>${nom}</dt><dd>${duree(minutes)}</dd></div>`).join('')}
        <div><dt>${t.difficulteTitre}</dt><dd>${t.difficulte[r.difficulte] || ''}</dd></div>
        <div class="${r.piquant ? 'hot' : ''}"><dt>${t.piquantTitre}</dt><dd>${r.piquant ? piments(r.piquant) + ' ' : ''}${t.piquant[r.piquant] || ''}</dd></div>
      </dl>
      <div class="chips r-chips">${regimes}${saisons ? `<span class="chip">${echapper(t.saison(saisons))}</span>` : ''}</div>`;
  }

  const textePortions = () => `${portions} ${fiche.recette.portions_unite || t.portionsParDefaut}`;

  function ingredients() {
    const { contenus, recette: r } = fiche;
    const groupes = [];
    r.ingredients.forEach((ingredient, index) => {
      const nom = ingredient.groupe || '';
      let groupe = groupes.find((g) => g.nom === nom);
      if (!groupe) groupes.push((groupe = { nom, lignes: [] }));
      groupe.lignes.push([ingredient, index]);
    });
    const ligne = ([i, index]) => {
      const lien = i.recette && contenus.recettes[i.recette];
      const nom = lien
        ? `<button class="ing-link" data-recette="${echapper(i.recette)}" aria-label="${echapper(t.voirRecetteLiee(i.nom))}">${echapper(i.nom)} <span aria-hidden="true">→</span></button>`
        : echapper(i.nom);
      return `<li><span class="n">${nom}${i.substitution ? `<span class="sub">${echapper(t.sinon(i.substitution))}</span>` : ''}</span>
        <span class="q" data-ingredient="${index}">${echapper(quantitePour(i, portions, r.portions))}</span></li>`;
    };
    return `
      <section class="r-sec">
        <div class="row-between">
          <h2>${t.ingredients}</h2>
          <div class="stepper" role="group" aria-label="${t.portions}">
            <button data-action="moins" aria-label="${t.moins}">${ICONES.moins}</button>
            <output id="portions" aria-live="polite">${echapper(textePortions())}</output>
            <button class="plus" data-action="plus" aria-label="${t.plus}">${ICONES.plus}</button>
          </div>
        </div>
        ${r.securite ? `<aside class="alerte" role="note" aria-labelledby="alerte-titre">${ICONES.alerte}
          <div><p class="alerte-titre" id="alerte-titre">${t.securite}</p><p>${avecFahrenheit(echapper(r.securite))}</p></div></aside>` : ''}
        ${groupes.map((g) => `<div class="ing">${g.nom ? `<h3>${echapper(g.nom)}</h3>` : ''}<ul>${g.lignes.map(ligne).join('')}</ul></div>`).join('')}
      </section>`;
  }

  function etapes() {
    const r = fiche.recette;
    return `<section class="r-sec"><h2>${t.etapes}</h2><ol class="steps">${r.etapes.map((e, n) => `<li><div>${avecFahrenheit(e.texte)}${e.minuteur
      ? `<br><button class="timer" data-minuteur="${n}" data-duree="${echapper(e.minuteur)}" aria-pressed="false">${ICONES.minuteur}<span>${echapper(t.minuteur(libelleDuree(e.minuteur)))}</span></button>`
      : ''}</div></li>`).join('')}</ol></section>`;
  }

  /** Photo vérifiée en bandeau sous l'en-tête ; sans photo, l'en-tête suffit (nom d'origine en filigrane). */
  function photo() {
    const chemin = photoVerifiee(fiche.recette);
    return chemin
      ? `<figure class="r-photo"><img src="${echapper(chemin)}" alt="${echapper(fiche.recette.nom)}" width="1200" height="800" loading="lazy" decoding="async"></figure>`
      : '';
  }

  function construire() {
    const r = fiche.recette;
    ecran.innerHTML = `${enTete()}${photo()}
      <div class="screen-pad r-corps">
        ${etiquettes()}
        ${ingredients()}
        ${r.ustensiles?.length ? `<section class="r-sec"><h2>${t.ustensiles}</h2><div class="chips">${r.ustensiles.map((u) => `<span class="chip">${echapper(u)}</span>`).join('')}</div></section>` : ''}
        ${etapes()}
        ${r.conseils ? `<section class="r-sec"><h2>${t.conseils}</h2><div class="tip prose">${avecFahrenheit(r.conseils)}</div></section>` : ''}
        ${r.legendes ? `<aside class="legend-box prose"><h3>${textes.panneau.ceQuOnRaconte}</h3>${r.legendes}</aside>` : ''}
      </div>`;
    for (const bouton of ecran.querySelectorAll('[data-minuteur]')) afficherMinuteur(bouton);
  }

  /* ---------- Portions ---------- */

  function changerPortions(ecart) {
    const r = fiche.recette;
    const nouveau = portions + ecart;
    if (nouveau < 1 || nouveau > Math.max(20, r.portions * 3)) return;
    portions = nouveau;
    ecran.querySelector('#portions').textContent = textePortions();
    for (const q of ecran.querySelectorAll('[data-ingredient]')) {
      q.textContent = quantitePour(r.ingredients[q.dataset.ingredient], portions, r.portions);
      // Petit « saut » des quantités (désactivé si le téléphone demande moins d'animations)
      q.classList.remove('bump');
      void q.offsetWidth;
      q.classList.add('bump');
    }
  }

  /* ---------- Minuteurs ---------- */

  const cleMinuteur = (bouton) => `${fiche.recette.id}:${bouton.dataset.minuteur}`;

  function afficherMinuteur(bouton) {
    const m = minuteurs.get(cleMinuteur(bouton));
    const libelle = bouton.querySelector('span');
    bouton.classList.toggle('running', Boolean(m));
    bouton.setAttribute('aria-pressed', Boolean(m));
    if (m) libelle.textContent = compteARebours(Math.max(0, Math.round((m.fin - Date.now()) / 1000)));
    else if (!bouton.dataset.fini) libelle.textContent = t.minuteur(libelleDuree(bouton.dataset.duree));
  }

  function basculerMinuteur(bouton) {
    const cle = cleMinuteur(bouton);
    const enCours = minuteurs.get(cle);
    delete bouton.dataset.fini;
    if (enCours) {
      clearInterval(enCours.intervalle);
      minuteurs.delete(cle);
      afficherMinuteur(bouton);
      surMessage(t.minuteurArrete);
      return;
    }
    const secondes = dureeEnSecondes(bouton.dataset.duree);
    if (!secondes) return;
    const m = { fin: Date.now() + secondes * 1000 };
    m.intervalle = setInterval(() => {
      // Le bouton peut avoir été redessiné (retour sur la recette) : on le cherche à chaque fois
      const visible = fiche && `${fiche.recette.id}` === cle.split(':')[0]
        ? ecran.querySelector(`[data-minuteur="${cle.split(':')[1]}"]`) : null;
      if (Date.now() >= m.fin) {
        clearInterval(m.intervalle);
        minuteurs.delete(cle);
        if (visible) {
          visible.dataset.fini = 'oui';
          afficherMinuteur(visible);
          visible.querySelector('span').textContent = t.termine;
        }
        surMessage(t.minuteurFini);
        return;
      }
      if (visible) afficherMinuteur(visible);
    }, 1000);
    minuteurs.set(cle, m);
    afficherMinuteur(bouton);
    surMessage(t.minuteurLance(libelleDuree(bouton.dataset.duree)));
  }

  /* ---------- Actions ---------- */

  ecran.addEventListener('click', (evenement) => {
    const cible = evenement.target.closest('button');
    if (!cible) return;
    const action = cible.dataset.action;
    if (action === 'retour') surRetour();
    else if (action === 'moins') changerPortions(-1);
    else if (action === 'plus') changerPortions(1);
    else if (action === 'favori') {
      const r = fiche.recette;
      const actif = basculerFavori('recettes', r.id);
      cible.setAttribute('aria-pressed', actif);
      cible.setAttribute('aria-label', actif ? t.retirerFavori(r.nom) : t.ajouterFavori(r.nom));
      if (actif) exploserPiments(cible);
      surMessage(actif ? textes.favoris.ajoute : textes.favoris.retire);
    } else if (cible.dataset.lieu) surLieu(cible.dataset.lieu);
    else if (cible.dataset.recette) surRecette(cible.dataset.recette);
    else if (cible.dataset.minuteur) basculerMinuteur(cible);
  });

  return {
    /** Affiche une recette : { pays, contenus, recette } */
    afficher(nouvelleFiche) {
      const memeRecette = fiche?.recette.id === nouvelleFiche.recette.id && !ecran.hidden;
      fiche = nouvelleFiche;
      if (memeRecette) return;
      portions = fiche.recette.portions;
      construire();
      ecran.hidden = false;
      ecran.scrollTop = 0;
      ecran.querySelector('h1').focus({ preventScroll: true });
    },
    cacher() {
      ecran.hidden = true;
    },
    estVisible: () => !ecran.hidden,
  };
}

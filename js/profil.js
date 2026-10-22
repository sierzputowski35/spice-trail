// Profil (REX n° 1, § 8) : carnet de voyage enregistré sur le téléphone, sans compte.
// Une seule clé : « spice-trail:profil » = { visites: [{ code, date }], recettes: [id], jours: [AAAA-MM-JJ] }.
// Si le stockage est indisponible (navigation privée…), le carnet reste en mémoire le temps de la visite.
//
// Définitions validées : un pays est VISITÉ quand sa carte a été ouverte au moins une fois, ou que la
// roulette s'est arrêtée dessus ; une recette est DÉCOUVERTE quand elle a été ouverte, ou proposée par la roulette.

import { textes } from './textes.js';
import { echapper, ICONE_SUITE } from './outils.js';
import { versionLisible } from './couleurs.js';

const CLE = 'spice-trail:profil';

let profil = { visites: [], recettes: [], jours: [] };
try {
  const enregistre = JSON.parse(localStorage.getItem(CLE));
  if (enregistre && Array.isArray(enregistre.visites) && Array.isArray(enregistre.recettes) && Array.isArray(enregistre.jours)) {
    profil = enregistre;
  }
} catch { /* stockage indisponible : carnet vide */ }

function enregistrer() {
  try {
    localStorage.setItem(CLE, JSON.stringify(profil));
  } catch { /* stockage indisponible ou plein : le carnet reste valable jusqu'à la fermeture */ }
}

/** Date du jour sur le téléphone, au format AAAA-MM-JJ. */
function jourLocal(date = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** L'application est ouverte aujourd'hui (série de jours). */
export function noterJour() {
  const aujourdhui = jourLocal();
  if (profil.jours.includes(aujourdhui)) return;
  profil.jours.push(aujourdhui);
  enregistrer();
}

/** Visite d'un pays ; renvoie vrai si c'est la première (nouveau tampon). */
export function noterVisite(code) {
  if (profil.visites.some((v) => v.code === code)) return false;
  profil.visites.push({ code, date: jourLocal() });
  enregistrer();
  return true;
}

/** Recette découverte ; renvoie vrai si c'est la première fois. */
export function noterRecette(id) {
  if (profil.recettes.includes(id)) return false;
  profil.recettes.push(id);
  enregistrer();
  return true;
}

/**
 * Jours consécutifs où l'application a été ouverte, jusqu'à aujourd'hui.
 * Une série interrompue repart simplement à 1 (jamais de message culpabilisant).
 */
export function serieDeJours() {
  const jours = new Set(profil.jours);
  const date = new Date();
  let n = 0;
  while (jours.has(jourLocal(date))) {
    n += 1;
    date.setDate(date.getDate() - 1);
  }
  return Math.max(n, 1);
}

/* ---------- Écran Profil ---------- */

const ICONE_FLAMME = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1c.6 2.4 3.8 3.9 3.8 7.6A3.8 3.8 0 0 1 8 12.5a3.8 3.8 0 0 1-3.8-3.9C4.2 6.5 5.6 5.4 6 3.7c.9 1 1 2.2.9 3C8.3 5.6 8.6 3.4 8 1Z"/></svg>';

/**
 * Crée l'écran Profil : passeport culinaire (série, chiffres, progression, tampons) et recettes découvertes.
 * options.listePays : pays disponibles ; options.chargerTout() : promesse de [{ pays, contenus }] ;
 * options.surRecette(id) : ouvrir une recette.
 */
export function creerEcranProfil(conteneur, { listePays, chargerTout, surRecette }) {
  const t = textes.profil;
  const repere = conteneur.querySelector('#tabbar');
  repere.insertAdjacentHTML('beforebegin', `
    <section class="screen" id="profil" hidden aria-labelledby="profil-titre">
      <header class="profil-entete">
        <span class="sticker tilt-l">${t.etiquette}</span>
        <h1 id="profil-titre" tabindex="-1">${t.titre}</h1>
      </header>
      <div class="screen-pad">
        <section class="carte-profil" aria-labelledby="passeport-titre">
          <div class="carte-profil-haut">
            <h2 id="passeport-titre">${t.passeport}</h2>
            <span class="serie" id="profil-serie">${ICONE_FLAMME}<span></span></span>
          </div>
          <div class="chiffres">
            <p><b id="profil-pays">0</b><span id="profil-pays-texte"></span></p>
            <p><b id="profil-recettes">0</b><span id="profil-recettes-texte"></span></p>
          </div>
          <div class="progression" role="progressbar" aria-labelledby="profil-pays-texte" aria-valuemin="0" id="profil-progression"><i></i></div>
          <ul class="tampons" id="profil-tampons"></ul>
        </section>
        <section class="carte-profil" aria-labelledby="decouvertes-titre">
          <h2 id="decouvertes-titre">${t.recettesDecouvertes}</h2>
          <ul class="list" id="profil-liste-recettes"></ul>
        </section>
      </div>
    </section>`);
  const ecran = conteneur.querySelector('#profil');
  const $ = (s) => ecran.querySelector(s);
  // Ce qui était affiché la dernière fois : un chiffre qui augmente « saute », un nouveau tampon s'imprime
  let dejaVu = { pays: null, recettes: null, tampons: new Set() };

  function sauter(element, valeur, avant) {
    element.textContent = valeur;
    if (avant !== null && valeur > avant) {
      element.classList.remove('saute');
      void element.offsetWidth;
      element.classList.add('saute');
    }
  }

  async function remplir() {
    const visites = new Set(profil.visites.map((v) => v.code));
    const nbPays = listePays.filter((p) => visites.has(p.code)).length;
    $('#profil-serie span').textContent = t.serie(serieDeJours());
    sauter($('#profil-pays'), nbPays, dejaVu.pays);
    $('#profil-pays-texte').textContent = t.paysSur(listePays.length);
    sauter($('#profil-recettes'), profil.recettes.length, dejaVu.recettes);
    $('#profil-recettes-texte').textContent = t.recettesTexte(profil.recettes.length);
    const progression = $('#profil-progression');
    progression.setAttribute('aria-valuemax', listePays.length);
    progression.setAttribute('aria-valuenow', nbPays);
    progression.querySelector('i').style.width = `${(100 * nbPays) / listePays.length}%`;

    // Tampons : pays visités d'abord (dans l'ordre des visites), puis ceux qui restent à découvrir
    const ordre = [...profil.visites.map((v) => listePays.find((p) => p.code === v.code)).filter(Boolean),
      ...listePays.filter((p) => !visites.has(p.code))];
    $('#profil-tampons').innerHTML = ordre.map((p) => (visites.has(p.code)
      ? `<li class="tampon${dejaVu.pays !== null && !dejaVu.tampons.has(p.code) ? ' nouveau' : ''}">
          <span class="disque" style="--couleur-tampon: ${versionLisible(p.couleur)}" aria-hidden="true">${echapper(p.code.toUpperCase())}</span>
          <span class="nom">${echapper(p.nom)}</span></li>`
      : `<li class="tampon a-decouvrir"><span class="disque" aria-hidden="true">?</span><span class="nom">${t.aDecouvrir}</span></li>`)).join('');
    dejaVu = { pays: nbPays, recettes: profil.recettes.length, tampons: visites };

    // Recettes découvertes : pastille à la couleur du pays, nom du plat et pays
    const liste = $('#profil-liste-recettes');
    if (!profil.recettes.length) {
      liste.innerHTML = `<li><p class="empty">${t.aucuneRecette}</p></li>`;
      return;
    }
    let paysCharges;
    try {
      paysCharges = await chargerTout();
    } catch (erreur) {
      console.error(erreur);
      liste.innerHTML = `<li><p class="empty" role="alert">${textes.erreurs.chargement}</p></li>`;
      return;
    }
    liste.innerHTML = [...profil.recettes].reverse().map((id) => {
      const trouve = paysCharges.find(({ contenus }) => contenus.recettes[id]);
      if (!trouve) return '';   // recette disparue des données : ignorée
      const r = trouve.contenus.recettes[id];
      return `<li><button class="item" data-recette="${echapper(id)}">
        <span class="pastille-pays" style="--couleur-tampon: ${versionLisible(trouve.pays.couleur)}" aria-hidden="true"></span>
        <span class="min"><span class="t">${echapper(r.nom)}</span><br><span class="o">${echapper(trouve.pays.nom)}</span></span>
        ${ICONE_SUITE}</button></li>`;
    }).join('');
  }

  ecran.addEventListener('click', (evenement) => {
    const recette = evenement.target.closest('[data-recette]');
    if (recette) surRecette(recette.dataset.recette);
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

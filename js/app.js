// Démarrage de l'application : état, navigation, adresses des écrans.

import { textes } from './textes.js';
import { chargerListePays, chargerMonde, chargerCodesIso, chargerPays, chargerRegions, trouverRecette } from './donnees.js';
import { creerGlobe } from './globe.js';
import { creerCarte } from './carte.js';
import { appliquerCouleurPays, retirerCouleurPays, mettreAJourBarreEtat } from './couleurs.js';
import { creerPanneau } from './panneau.js';
import { creerEcranRecette } from './recette.js';
import { creerEcranRecherche } from './recherche.js';
import { creerEcranFavoris } from './favoris.js';
import { creerEcranAPropos } from './apropos.js';
import { remplacerImagesManquantes, nomLieu } from './outils.js';

const $ = (selecteur) => document.querySelector(selecteur);

const ICONES = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  moins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  fermer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  aPropos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  retour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  explorer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  rechercher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  favoris: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
};

const echapper = (texte) => String(texte).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Où l'on se trouve : 'globe', 'pays', 'region' ou 'ville'
const etat = { vue: 'globe', pays: null, contenus: null, region: null, ville: null };
let globe;
let carte;
let panneau;
let ecranRecette;
let recetteOuverte = null;   // { pays, contenus, recette } quand l'écran recette est affiché
// Écrans plein cadre sans recette : nom dans l'adresse → écran, titre et onglet du bas
const listes = {};           // rempli au démarrage : { recherche, favoris, 'a-propos' }
let listeOuverte = null;     // 'recherche', 'favoris', 'a-propos' ou null
let derniereExploration = '#/';   // pour revenir à la carte avec l'onglet Explorer

/** Construit les éléments fixes de l'écran (textes venant de textes.js). */
function construireEcran(listePays) {
  const t = textes.accueil;
  $('#app').innerHTML = `
    <div id="topbar">
      <button class="round" id="retour" aria-label="${textes.navigation.retour}" hidden>${ICONES.retour}</button>
      <nav class="crumbs" id="crumbs" aria-label="${textes.navigation.filAriane}" hidden></nav>
      <span class="spacer"></span>
      <button class="round" id="bouton-a-propos" aria-label="${textes.aPropos.ouvrir}">${ICONES.aPropos}</button>
    </div>

    <div id="stage">
      <div class="couche"><svg id="globe"></svg></div>
      <div class="couche" inert><svg id="map" class="fade"></svg></div>
    </div>

    <div id="zoom-globe">
      <button class="round" id="zoom-retour" aria-label="${textes.globe.zoomRetour}">${ICONES.fermer}</button>
      <div class="zoom-boutons">
        <button class="round" id="zoom-plus" aria-label="${textes.globe.zoomPlus}">${ICONES.plus}</button>
        <button class="round" id="zoom-moins" aria-label="${textes.globe.zoomMoins}">${ICONES.moins}</button>
      </div>
      <div class="zoom-jauge" aria-hidden="true"><i id="zoom-niveau"></i></div>
    </div>

    <div id="intro">
      <span class="sticker tilt-l">${t.etiquette}</span>
      <h1>${textes.nomApplication.split(' ').map(echapper).join('<br>')}</h1>
      <p>${t.invitation}</p>
    </div>

    <nav class="tabbar" id="tabbar" aria-label="${textes.onglets.navigation}">
      <button data-onglet="explorer" aria-current="page">${ICONES.explorer}${textes.onglets.explorer}</button>
      <button data-onglet="rechercher">${ICONES.rechercher}${textes.onglets.rechercher}</button>
      <button data-onglet="favoris">${ICONES.favoris}${textes.onglets.favoris}</button>
    </nav>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

/** Petit message en bas de l'écran, qui disparaît seul. */
let minuterieMessage;
function afficherMessage(texte) {
  const message = $('#toast');
  message.textContent = texte;
  message.classList.add('on');
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => message.classList.remove('on'), 2200);
}

/** Zone libre pour la carte : entre le bandeau du haut et le panneau de fiche à mi-hauteur. */
function zoneCarte() {
  const { width } = $('#stage').getBoundingClientRect();
  return { x0: 12, y0: 72, x1: width - 12, y1: Math.max(72 + 120, panneau.hautMilieu() - 12) };
}

/* ---------- Affichage selon l'état ---------- */

function afficherBandeau() {
  const surCarte = etat.vue !== 'globe';
  $('#retour').hidden = !surCarte;
  $('#crumbs').hidden = !surCarte;
  if (!surCarte) return;

  const niveaux = [['globe', textes.navigation.monde], ['pays', etat.pays.nom]];
  if (etat.region) niveaux.push(['region', nomLieu(etat.contenus.regions[etat.region])]);
  if (etat.ville) niveaux.push(['ville', nomLieu(etat.contenus.villes[etat.ville])]);
  $('#crumbs').innerHTML = niveaux.map(([niveau, nom], i) => (i === niveaux.length - 1
    ? `<span aria-current="page">${echapper(nom)}</span>`
    : `<button data-niveau="${niveau}">${echapper(nom)}</button><span class="sep" aria-hidden="true">›</span>`)).join('');
  // Le niveau courant reste visible même si le fil d'Ariane déborde
  $('#crumbs').scrollLeft = $('#crumbs').scrollWidth;
}

function afficher() {
  $('#app').dataset.view = etat.vue;
  afficherBandeau();
  if (etat.vue === 'globe') {
    panneau.cacher();
    return;
  }
  carte.afficher({ region: etat.region, ville: etat.ville });
  panneau.afficher({ pays: etat.pays, contenus: etat.contenus, niveau: etat.vue, region: etat.region, ville: etat.ville });
}

/* ---------- Navigation : une adresse par écran ----------
   #/                      globe
   #/cn                    pays
   #/cn/sichuan            région
   #/cn/sichuan/chengdu    ville
   #/recette/mapo-tofu     recette
   #/recherche             recherche
   #/favoris               favoris
   #/a-propos              à propos
   L'adresse décide de l'écran : toucher la carte change l'adresse, et le bouton
   retour du téléphone (ou un lien partagé) affiche le bon écran. */

let listePays = [];
let codesIso = {};
const parcours = [];             // adresses visitées dans l'application, dans l'ordre
let fileAttente = Promise.resolve();
let premierAffichage = true;     // un lien ouvert directement s'affiche sans animation

const adresseActuelle = () => location.hash || '#/';

function adresseDe({ pays, region, ville }) {
  return '#/' + [pays?.code, region, ville].filter(Boolean).join('/');
}

/** Va à une adresse (ajoutée à l'historique du téléphone). */
function naviguer(adresse) {
  if (adresse !== adresseActuelle()) location.hash = adresse;
}

/** Corrige l'adresse affichée sans créer d'étape dans l'historique. */
function corrigerAdresse(adresse) {
  history.replaceState(null, '', adresse);
  parcours[parcours.length - 1] = adresse;
}

function montrerAccueil(visible) {
  $('#intro').hidden = !visible;
  $('#zoom-globe').hidden = !visible;
}

function mettreAJourTitre() {
  if (recetteOuverte) {
    document.title = `${recetteOuverte.recette.nom} · ${textes.nomApplication}`;
    return;
  }
  if (listeOuverte) {
    document.title = `${listes[listeOuverte].titre} · ${textes.nomApplication}`;
    return;
  }
  const morceaux = [];
  if (etat.ville) morceaux.push(nomLieu(etat.contenus.villes[etat.ville]));
  if (etat.region) morceaux.push(nomLieu(etat.contenus.regions[etat.region]));
  if (etat.pays) morceaux.push(etat.pays.nom);
  morceaux.push(textes.nomApplication);
  document.title = morceaux.join(' · ');
}

async function allerAuGlobe() {
  if (etat.vue === 'globe') return;
  Object.assign(etat, { vue: 'globe', pays: null, contenus: null, region: null, ville: null });
  retirerCouleurPays();
  $('#map').classList.add('fade');
  $('#map').parentElement.inert = true;
  montrerAccueil(true);
  afficher();
  await globe.revenir();
}

/** Entre dans un pays : envol depuis le globe, ou changement direct de pays. */
async function entrerDansPays(pays, immediat) {
  const depuisLeGlobe = etat.vue === 'globe';
  const chargement = Promise.all([chargerPays(pays), chargerRegions(pays.code)]);
  if (depuisLeGlobe) {
    montrerAccueil(false);
    await globe.envolerVersCode(pays.code, immediat);   // les données se chargent pendant l'envol
  }
  const [contenus, topoRegions] = await chargement;
  const codeNumerique = Object.keys(codesIso).find((n) => codesIso[n] === pays.code.toUpperCase());
  Object.assign(etat, { vue: 'pays', pays, contenus, region: null, ville: null });
  appliquerCouleurPays(pays.couleur);
  carte.chargerPays(pays, contenus, topoRegions, codeNumerique);
  $('#map').classList.remove('fade');
  $('#map').parentElement.inert = false;
  return depuisLeGlobe;
}

/** Affiche l'écran correspondant à une adresse. */
async function appliquerAdresse(adresse) {
  // Une adresse plus récente attend déjà : inutile d'afficher celle-ci
  if (adresse !== adresseActuelle()) return;
  const immediat = premierAffichage;
  premierAffichage = false;
  const [code, region, ville] = adresse.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

  if (listes[code]) {
    ouvrirListe(code);
    return;
  }
  if (code === 'recette' && region) {
    if (await ouvrirRecette(region)) return;
    corrigerAdresse('#/');
  }
  fermerEcrans();
  choisirOnglet('explorer');

  if (!code || code === 'recette') {
    derniereExploration = '#/';
    await allerAuGlobe();
    mettreAJourTitre();
    return;
  }
  // Adresse inconnue (ou écran pas encore construit) : retour au globe
  const pays = listePays.find((p) => p.code === code);
  if (!pays) {
    corrigerAdresse('#/');
    await allerAuGlobe();
    mettreAJourTitre();
    return;
  }

  let entreDepuisLeGlobe = false;
  if (etat.pays?.code !== code) {
    try {
      entreDepuisLeGlobe = await entrerDansPays(pays, immediat);
    } catch (erreur) {
      console.error(erreur);
      afficherMessage(textes.erreurs.chargement);
      corrigerAdresse('#/');
      if (etat.vue === 'globe') {
        // L'envol a eu lieu mais le pays n'a pas pu être chargé : on réaffiche le globe
        montrerAccueil(true);
        await globe.revenir();
      } else {
        await allerAuGlobe();
      }
      mettreAJourTitre();
      return;
    }
  }

  // Région ou ville inconnue : on garde la partie valide de l'adresse
  const regionValide = region && etat.contenus.regions[region] ? region : null;
  const villeFiche = ville && etat.contenus.villes[ville];
  const villeValide = regionValide && villeFiche && villeFiche.region === regionValide ? ville : null;
  const vue = villeValide ? 'ville' : regionValide ? 'region' : 'pays';
  Object.assign(etat, { vue, region: regionValide, ville: villeValide });
  const adresseValide = adresseDe(etat);
  if (adresseValide !== adresse) corrigerAdresse(adresseValide);

  derniereExploration = adresseDe(etat);
  afficher();
  mettreAJourTitre();
  if (entreDepuisLeGlobe) $('#retour').focus();
}

/** Barre d'état du téléphone à la couleur du fond de l'écran affiché. */
function colorerBarreEtat() {
  if (listeOuverte) mettreAJourBarreEtat('--bg');
  else if (recetteOuverte || etat.vue !== 'globe') mettreAJourBarreEtat('--country-bg');
  else mettreAJourBarreEtat('--home');
}

/** Suit les changements d'adresse, un à la fois et dans l'ordre. */
function surChangementAdresse() {
  const adresse = adresseActuelle();
  // Retour en arrière du téléphone : on retrouve l'adresse précédente du parcours
  if (parcours.length > 1 && parcours[parcours.length - 2] === adresse) parcours.pop();
  else parcours.push(adresse);
  fileAttente = fileAttente.then(() => appliquerAdresse(adresse)).then(colorerBarreEtat);
}

/* ---------- Écrans plein cadre (recette, recherche) et barre d'onglets ---------- */

/** Écran plein cadre ouvert : ce qui est dessous n'est plus atteignable au clavier. */
function couvrirLaCarte(couvert) {
  for (const selecteur of ['#topbar', '#stage', '#sheet']) $(selecteur).inert = couvert;
}

function choisirOnglet(nom) {
  for (const bouton of document.querySelectorAll('#tabbar [data-onglet]')) {
    if (bouton.dataset.onglet === nom) bouton.setAttribute('aria-current', 'page');
    else bouton.removeAttribute('aria-current');
  }
}

/** Ferme les écrans plein cadre et retrouve la couleur du pays affiché dessous. */
function cacherListes(sauf = null) {
  for (const [nom, liste] of Object.entries(listes)) if (nom !== sauf) liste.ecran.cacher();
  listeOuverte = sauf;
}

function fermerEcrans() {
  if (!recetteOuverte && !listeOuverte) return;
  recetteOuverte = null;
  ecranRecette.cacher();
  cacherListes();
  couvrirLaCarte(false);
  if (etat.pays) appliquerCouleurPays(etat.pays.couleur);
  else retirerCouleurPays();
}

/** Écran Rechercher, Favoris ou À propos. */
function ouvrirListe(nom) {
  recetteOuverte = null;
  ecranRecette.cacher();
  cacherListes(nom);
  couvrirLaCarte(true);
  // À propos ne change pas l'onglet du bas : on reste dans la rubrique d'où l'on vient
  if (listes[nom].onglet) choisirOnglet(listes[nom].onglet);
  listes[nom].ecran.afficher();
  mettreAJourTitre();
}

/** Fermer À propos : écran précédent, ou la carte si l'on est arrivé par un lien. */
function fermerAPropos() {
  if (parcours.length > 1) history.back();
  else naviguer(derniereExploration);
}

/** Tous les pays disponibles, chargés en parallèle (recherche, favoris). */
const chargerTousLesPays = () => Promise.all(listePays.map(async (pays) => ({ pays, contenus: await chargerPays(pays) })));

/** Adresse d'un lieu trouvé par la recherche. */
function adresseLieu({ niveau, lieu, pays }) {
  if (niveau === 'ville') return adresseDe({ pays, region: lieu.region, ville: lieu.id });
  if (niveau === 'region') return adresseDe({ pays, region: lieu.id });
  return adresseDe({ pays });
}

async function ouvrirRecette(id) {
  let trouve = etat.contenus?.recettes[id] ? { pays: etat.pays, contenus: etat.contenus, recette: etat.contenus.recettes[id] } : null;
  if (!trouve) {
    try {
      trouve = await trouverRecette(id, listePays);
    } catch (erreur) {
      console.error(erreur);
      afficherMessage(textes.erreurs.chargement);
    }
  }
  if (!trouve) return false;
  cacherListes();
  recetteOuverte = trouve;
  appliquerCouleurPays(trouve.pays.couleur);
  couvrirLaCarte(true);
  ecranRecette.afficher(trouve);
  mettreAJourTitre();
  return true;
}

/** Adresse d'un lieu d'origine de la recette ouverte : 'ville', 'region' ou 'pays'. */
function adresseOrigine(niveau) {
  const { pays, contenus, recette } = recetteOuverte;
  const { region, ville } = recette.origine;
  const regionValide = region && contenus.regions[region] ? region : null;
  if (niveau === 'ville' && ville && contenus.villes[ville]) return adresseDe({ pays, region: contenus.villes[ville].region, ville });
  if (niveau !== 'pays' && regionValide) return adresseDe({ pays, region: regionValide });
  return adresseDe({ pays });
}

/** Retour depuis une recette : écran précédent, ou lieu d'origine si l'on est arrivé par un lien. */
function quitterRecette() {
  if (parcours.length > 1) history.back();
  else naviguer(adresseOrigine('ville'));
}

const ouvrirRecetteDepuis = (id) => naviguer(`#/recette/${encodeURIComponent(id)}`);

const allerAuPays = () => naviguer(adresseDe({ pays: etat.pays }));
const allerALaRegion = (id) => naviguer(adresseDe({ pays: etat.pays, region: id }));
const allerALaVille = (id) => naviguer(adresseDe({ pays: etat.pays, region: etat.contenus.villes[id].region, ville: id }));

/** Bouton retour de l'application : remonte d'un niveau. */
function remonter() {
  const parent = etat.vue === 'ville' ? adresseDe({ pays: etat.pays, region: etat.region })
    : etat.vue === 'region' ? adresseDe({ pays: etat.pays })
      : '#/';
  // Si l'on vient de ce niveau, on recule dans l'historique (comme le bouton du téléphone)
  if (parcours.length > 1 && parcours[parcours.length - 2] === parent) history.back();
  else naviguer(parent);
}

/* ---------- Démarrage ---------- */

async function demarrer() {
  const app = $('#app');
  app.dataset.view = 'globe';
  try {
    const [liste, monde, codes] = await Promise.all([chargerListePays(), chargerMonde(), chargerCodesIso()]);
    listePays = liste;
    codesIso = codes;
    construireEcran(listePays);
    remplacerImagesManquantes();

    globe = creerGlobe($('#globe'), {
      monde,
      codes,
      listePays,
      surPaysDisponible: (pays) => naviguer(adresseDe({ pays })),
      surPaysBientot: (nom) => afficherMessage(textes.globe.bientot(nom)),
      // Plein écran du globe (REX n° 1, § 5.2) : les barres s'effacent, bouton × et jauge apparaissent
      surPleinEcran: (actif) => $('#app').classList.toggle('globe-plein', actif),
      surZoom: (niveau, maximum) => { $('#zoom-niveau').style.height = `${((Math.log(niveau) / Math.log(maximum)) * 100).toFixed(1)}%`; },
    });
    $('#zoom-plus').addEventListener('click', () => globe.zoomerPlus());
    $('#zoom-moins').addEventListener('click', () => globe.zoomerMoins());
    $('#zoom-retour').addEventListener('click', () => globe.dezoomer());
    panneau = creerPanneau($('#app'), {
      scene: () => $('#stage'),
      surRecette: ouvrirRecetteDepuis,
      surMessage: afficherMessage,
    });
    listes.recherche = {
      titre: textes.recherche.titre,
      onglet: 'rechercher',
      ecran: creerEcranRecherche($('#app'), {
        chargerTout: chargerTousLesPays,
        adresseLieu,
        surRecette: ouvrirRecetteDepuis,
        surLieu: naviguer,
      }),
    };
    listes.favoris = {
      titre: textes.favoris.titre,
      onglet: 'favoris',
      ecran: creerEcranFavoris($('#app'), {
        chargerTout: chargerTousLesPays,
        surRecette: ouvrirRecetteDepuis,
        surLieu: naviguer,
      }),
    };
    listes['a-propos'] = {
      titre: textes.aPropos.titre,
      ecran: creerEcranAPropos($('#app'), { surFermer: fermerAPropos, listePays }),
    };
    ecranRecette = creerEcranRecette($('#app'), {
      surLieu: (niveau) => naviguer(adresseOrigine(niveau)),
      surRetour: quitterRecette,
      surRecette: ouvrirRecetteDepuis,
      surMessage: afficherMessage,
    });
    carte = creerCarte($('#map'), {
      monde,
      codes,
      zone: zoneCarte,
      surRegion: allerALaRegion,
      surVille: allerALaVille,
      surMessage: afficherMessage,
    });

    $('#retour').addEventListener('click', remonter);
    $('#bouton-a-propos').addEventListener('click', () => naviguer('#/a-propos'));
    $('#tabbar').addEventListener('click', (evenement) => {
      const onglet = evenement.target.closest('[data-onglet]')?.dataset.onglet;
      if (onglet === 'explorer') naviguer(derniereExploration);
      else if (onglet === 'rechercher') naviguer('#/recherche');
      else if (onglet === 'favoris') naviguer('#/favoris');
    });
    $('#crumbs').addEventListener('click', (evenement) => {
      const niveau = evenement.target.closest('[data-niveau]')?.dataset.niveau;
      if (niveau === 'globe') naviguer('#/');
      else if (niveau === 'pays') allerAuPays();
      else if (niveau === 'region') allerALaRegion(etat.region);
    });

    // Taille de l'écran qui change (rotation du téléphone, fenêtre redimensionnée)
    new ResizeObserver(() => {
      globe.redimensionner();
      panneau.redimensionner();
      carte.redimensionner();
    }).observe($('#stage'));
    addEventListener('hashchange', surChangementAdresse);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', colorerBarreEtat);

    // Installation sur l'écran d'accueil (le service worker ne met rien en cache)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((erreur) => console.warn('Service worker non installé', erreur));
    }
    surChangementAdresse();
    await fileAttente;
    document.documentElement.dataset.app = 'pret';
  } catch (erreur) {
    console.error(erreur);
    app.innerHTML = `<p class="empty" role="alert" style="margin:20px">${textes.erreurs.chargement}</p>`;
  }
}

demarrer();

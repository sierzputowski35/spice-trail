// Globe 3D (D3, projection orthographique) : rotation automatique et au doigt,
// pays disponibles colorés et scintillants, « Bientôt disponible » pour les autres,
// drapeau au survol et au toucher, envol vers un pays et retour.

import { textes } from './textes.js';
import { nomPays } from './langue.js';
import { chargerDrapeau, chargerMondeDetaille, chargerRegions } from './donnees.js';

const d3 = window.d3;
const topojson = window.topojson;

const VITESSE = 7.2;          // rotation automatique, en degrés par seconde
const REPRISE = 6000;         // reprise de la rotation après 6 s sans contact
const SEUIL_GLISSEMENT = 6;   // au-delà de 6 px, un toucher devient un glissement
const DUREE_DRAPEAU = 650;    // drapeau affiché avant l'envol
const DUREE_ENVOL = 1000;     // rotation et zoom vers le pays
const DUREE_FONDU = 450;      // bascule du globe vers la carte
const DUREE_RETOUR = 900;     // dézoom au retour sur le globe
const ZOOM_ENVOL = 2.6;
// Zoom façon Google Earth (REX n° 1, § 5)
const ZOOM_MIN = 1;
const ZOOM_MAX = 12;
const PLEIN_ECRAN_DEBUT = 1.5;   // au-delà, le globe passe en plein écran
const PLEIN_ECRAN_FIN = 1.2;     // en dessous (doigts relâchés), retour à l'accueil normal
const ZOOM_DETAIL = 3;           // contours détaillés à partir de ×3 (chargés dès ×2)
const ZOOM_REGIONS = [4, 8];     // régions culinaires : invisibles à ×4, entières à ×8
const ZOOM_CHARGER_REGIONS = 3;  // fichier des régions chargé dès que le pays approche du centre
const ZOOM_ENTRER = 4;           // étiquette « Entrer » à partir de ×4, entrée automatique à ×12
const ZOOM_BOUTON = 1.8;
// Roulette « Surprends-moi » (REX n° 1, § 6)
const DUREE_ROULETTE = 5000;     // 5 s, ralentissement « puissance 4 »
const TOURS_ROULETTE = 3;        // au moins 3 tours complets vers l'est
const ZOOM_ROULETTE = 1.35;      // léger zoom, sans passer en plein écran
const PAS_VIBRATION = 30;        // une petite vibration tous les 30° (Android)         // boutons + et − : ×1,8 en 0,42 s
const DUREE_ZOOM_BOUTON = 420;
const DUREE_DEZOOM = 700;        // bouton × : retour au globe entier
const DUREE_GLISSE = 380;        // passage en plein écran : le globe glisse jusqu'au centre
const AMORTI_ELAN = 420;         // élan : amortissement exp(−dt / 420 ms)
const ARRET_ELAN = 0.0015;       // élan arrêté sous 0,0015 °/ms
// Vignette du drapeau (REX n° 1, § 3.5) : vrai drapeau 40 × 27, cadre de 3 px, pointe vers le bas
const VIGNETTE = { largeur: 40, hauteur: 27, cadre: 3, ecart: 12, pointe: 8 };

const mouvementReduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const attendre = (ms) => new Promise((fin) => setTimeout(fin, ms));

/** Nom d'un pays de la carte du monde, dans la langue de l'interface. */
function nomFrancais(pays, codes) {
  const code = codes[String(pays.id)];
  const secours = textes.paysSansCode[pays.properties.name] || pays.properties.name;
  return code ? nomPays(code, secours) : secours;
}

/**
 * Dessine le globe dans un <svg>.
 * options.surPaysDisponible(pays) : toucher d'un pays disponible (pays de data/pays.json)
 * options.surPaysBientot(nom)     : toucher d'un autre pays (nom en français)
 */
export function creerGlobe(svgElement, { monde, codes, listePays, surPaysDisponible, surPaysBientot, surPleinEcran, surZoom, surPaysAuCentre, surEntree, surFinSurprise }) {
  const disponibles = new Map(listePays.map((p) => [p.code.toUpperCase(), p]));
  const paysDisponible = (f) => disponibles.get(codes[String(f.id)]);
  const pays = topojson.feature(monde, monde.objects.countries).features;

  const projection = d3.geoOrthographic().clipAngle(90).precision(0.4).rotate([-60, -18, 0]);
  const chemin = d3.geoPath(projection);
  const svg = d3.select(svgElement)
    .attr('role', 'group')
    .attr('aria-label', textes.globe.description);

  // Dessin hybride (REX n° 1, § 5.6 : fluidité au zoom) :
  // - sur une TOILE (canvas), sous le SVG : ombre, sphère, méridiens et pays « Bientôt disponible »,
  //   simple décor, redessiné très vite ;
  // - en SVG : les pays disponibles, qui restent de vrais boutons (clavier, lecteurs d'écran, survol, drapeaux).
  const toile = document.createElement('canvas');
  toile.className = 'globe-fond';
  toile.setAttribute('aria-hidden', 'true');
  svgElement.before(toile);
  const contexte = toile.getContext('2d');
  const crayon = d3.geoPath(projection, contexte);
  const meridiens = d3.geoGraticule10();
  const autresPays = pays.filter((f) => !paysDisponible(f));
  // Couleurs de la toile : les jetons de css/tokens.css, relus quand le thème change
  let couleurs = {};
  function lireCouleurs() {
    const style = getComputedStyle(svgElement);
    const jeton = (nom) => style.getPropertyValue(nom).trim();
    couleurs = { encre: jeton('--shadow-ink'), ocean: jeton('--ocean'), ligne: jeton('--ocean-line'), terre: jeton('--land-soon') };
  }
  lireCouleurs();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { lireCouleurs(); dessiner(); });
  new MutationObserver(() => { lireCouleurs(); dessiner(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const traces = svg.append('g').selectAll('path').data(pays.filter(paysDisponible)).join('path')
    .attr('class', 'country has')
    .style('fill', (f) => paysDisponible(f).couleur)
    .on('click', (evenement, f) => toucher(f, evenement.currentTarget));
  traces.append('title').text((f) => nomFrancais(f, codes));

  const tracesDisponibles = traces;

  // Toucher d'un pays « Bientôt disponible » (dessiné sur la toile) : retrouvé par sa position sur le globe
  svgElement.addEventListener('click', (evenement) => {
    if (evenement.target !== svgElement || !surGlobe) return;
    const pt = versSvg(evenement.clientX, evenement.clientY);
    if (!surSphere(pt)) return;
    const lieu = projection.invert(pt);
    const f = lieu && autresPays.find((x) => d3.geoContains(x, lieu));
    if (f) toucher(f, null);
  });

  // Zones tactiles de 44 px autour des pays disponibles (le Vietnam est très étroit).
  // Placées sous les pays disponibles mais au-dessus des autres : un toucher juste à côté
  // du pays l'ouvre quand même, sans jamais masquer un autre pays disponible.
  const cibles = svg.append('g').attr('aria-hidden', 'true').selectAll('circle')
    .data(pays.filter(paysDisponible)).join('circle')
    .attr('class', 'globe-cible')
    .attr('r', 22)
    .attr('data-cible-de', (f) => `pays-${paysDisponible(f).code}`)
    .on('click', (evenement, f) => toucher(f, tracesDisponibles.filter((x) => x === f).node()));
  const groupeDisponibles = svg.append('g');
  tracesDisponibles.each(function () { groupeDisponibles.node().append(this); });
  // Scintillement (REX n° 1) : un voile par pays disponible, chacun à son rythme
  // (2,6 à 4,4 s, départ décalé), pour que les pays ne clignotent jamais ensemble
  const voiles = svg.append('g').attr('aria-hidden', 'true').selectAll('path')
    .data(pays.filter(paysDisponible)).join('path')
    .attr('class', 'scintille')
    .style('--duree', () => `${(2.6 + Math.random() * 1.8).toFixed(2)}s`)
    .style('--decalage', () => `${(-Math.random() * 4.4).toFixed(2)}s`);
  // Régions culinaires pendant le zoom (REX n° 1, § 5.4) : leurs limites en lignes blanches fines
  const coucheRegions = svg.append('g').attr('class', 'regions-zoom').attr('aria-hidden', 'true');
  const limitesRegions = new Map();   // code du pays → limites entre ses régions (MultiLineString)
  const regionsDemandees = new Set();
  function chargerLimitesRegions(code) {
    if (regionsDemandees.has(code)) return;
    regionsDemandees.add(code);
    chargerRegions(code)
      .then((topo) => {
        limitesRegions.set(code, topojson.mesh(topo, topo.objects.regions, (a, b) => a !== b));
        dessiner();
      })
      .catch(() => regionsDemandees.delete(code));   // sans connexion : on réessaiera
  }

  // Drapeaux affichés (au-dessus des pays, sans jamais bloquer les touchers)
  const coucheDrapeaux = svg.append('g').attr('class', 'drapeaux').attr('aria-hidden', 'true');
  const drapeauxAffiches = new Set();
  const donneesDrapeaux = new Map();
  // Plus grande terre de chaque pays : la vignette se pose au-dessus d'elle (pas au-dessus de l'Alaska)
  const terres = new Map();
  const terrePrincipale = (f) => {
    if (!terres.has(f)) {
      const g = f.geometry;
      const polygones = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      const aire = (c) => d3.geoArea({ type: 'Polygon', coordinates: c });
      terres.set(f, { type: 'Polygon', coordinates: polygones.reduce((a, b) => (aire(b) > aire(a) ? b : a)) });
    }
    return terres.get(f);
  };
  tracesDisponibles.attr('data-cible', (f) => `pays-${paysDisponible(f).code}`);
  const centres = new Map(pays.filter(paysDisponible).map((f) => [f, d3.geoCentroid(f)]));
  tracesDisponibles
    // Survol à la souris : le pays se remplit de son drapeau
    .on('mouseenter', (evenement, f) => { if (surGlobe) afficherDrapeau(evenement.currentTarget, f, true); })
    .on('mouseleave', (evenement, f) => { if (f !== paysEnVol) afficherDrapeau(evenement.currentTarget, f, false); })
    // Clavier : le globe pivote vers le pays qui a le focus
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (f) => textes.globe.ouvrirPays(paysDisponible(f).nom))
    .on('focus', (evenement, f) => tournerVers(f))
    .on('keydown', (evenement, f) => {
      if (evenement.key === 'Enter' || evenement.key === ' ') {
        evenement.preventDefault();
        toucher(f, evenement.currentTarget);
      }
    });

  /**
   * Drapeau d'un pays (REX n° 1, § 3) : le FOND remplit tout le pays et l'EMBLÈME officiel,
   * à ses vraies proportions, est placé au cœur du pays ; tous deux suivent la rotation.
   * Les formes sont préparées à l'avance (data/geo/drapeaux/<code>.json).
   */
  function afficherDrapeau(element, f, visible) {
    d3.select(element).classed('flagged', visible);
    if (!visible) {
      drapeauxAffiches.delete(f);
      dessinerDrapeaux();
      return;
    }
    drapeauxAffiches.add(f);
    const { code } = paysDisponible(f);
    if (donneesDrapeaux.has(code)) {
      dessinerDrapeaux();
      return;
    }
    chargerDrapeau(code)
      .then((donnees) => { donneesDrapeaux.set(code, donnees); dessinerDrapeaux(); })
      .catch(() => { /* sans connexion : le pays garde sa couleur */ });
  }

  /** Une image placée par trois coins (haut gauche, haut droit, bas gauche) en latitude/longitude. */
  function placerImage(image, coins) {
    const [p0, p1, p2] = coins.map((c) => projection(c));
    const largeur = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const hauteur = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) || 1;
    const matrice = [(p1[0] - p0[0]) / largeur, (p1[1] - p0[1]) / largeur, (p2[0] - p0[0]) / hauteur, (p2[1] - p0[1]) / hauteur, p0[0], p0[1]];
    image
      .attr('width', largeur)
      .attr('height', hauteur)
      .attr('transform', `matrix(${matrice.join(' ')})`);
  }

  function dessinerDrapeaux() {
    const [lambda, phi] = projection.rotate();
    const surFaceVisible = (point) => d3.geoDistance(point, [-lambda, -phi]) < Math.PI / 2 - 0.05;
    const affiches = [...drapeauxAffiches].filter((f) => donneesDrapeaux.has(paysDisponible(f).code));
    const groupes = coucheDrapeaux.selectAll('g.drapeau')
      .data(affiches, (f) => paysDisponible(f).code)
      .join((entree) => {
        const g = entree.append('g').attr('class', 'drapeau');
        g.each(function (f) {
          const { code } = paysDisponible(f);
          const donnees = donneesDrapeaux.get(code);
          const groupe = d3.select(this);
          const idCoupe = `drapeau-coupe-${code}`;
          groupe.append('clipPath').attr('id', idCoupe).append('path');
          const dessin = groupe.append('g').attr('clip-path', `url(#${idCoupe})`);
          dessin.selectAll('path.fond').data(donnees.fond || []).join('path')
            .attr('class', 'fond')
            .style('fill', (forme) => forme.c);   // couleurs officielles du drapeau, lues dans les données
          if (donnees.fondImage) {
            dessin.append('image').attr('class', 'fond-image').attr('href', donnees.fondImage.href).attr('preserveAspectRatio', 'none');
          }
          if (donnees.embleme) {
            dessin.append('image').attr('class', 'embleme').attr('href', donnees.embleme.href).attr('preserveAspectRatio', 'none');
          }
          groupe.append('path').attr('class', 'drapeau-contour');
          const vignette = groupe.append('g').attr('class', 'vignette');
          vignette.append('rect').attr('class', 'vignette-ombre');
          vignette.append('polygon').attr('class', 'vignette-pointe');
          vignette.append('rect').attr('class', 'vignette-cadre');
          vignette.append('image').attr('class', 'vignette-drapeau')
            .attr('href', `drapeaux/${code}.svg`).attr('preserveAspectRatio', 'xMidYMid slice');
        });
        return g;
      });

    groupes.each(function (f) {
      const groupe = d3.select(this);
      const donnees = donneesDrapeaux.get(paysDisponible(f).code);
      const trace = chemin(forme(f));
      groupe.attr('display', trace ? null : 'none');
      if (!trace) return;
      groupe.select('clipPath path').attr('d', trace);
      groupe.select('.drapeau-contour').attr('d', trace);
      groupe.selectAll('path.fond').attr('d', (forme) => chemin({ type: 'Polygon', coordinates: [forme.d] }));
      if (donnees.fondImage) placerImage(groupe.select('.fond-image'), donnees.fondImage.coins);
      const ancreVisible = surFaceVisible(donnees.ancre);
      if (donnees.embleme) {
        const embleme = groupe.select('.embleme');
        const coinsVisibles = donnees.embleme.coins.every(surFaceVisible);
        embleme.attr('display', coinsVisibles ? null : 'none');
        if (coinsVisibles) placerImage(embleme, donnees.embleme.coins);
      }
      // Vignette au-dessus du pays, alignée sur l'emblème ; cachée quand l'emblème passe derrière le globe
      const vignette = groupe.select('.vignette').attr('display', ancreVisible ? null : 'none');
      if (!ancreVisible) return;
      const { largeur, hauteur, cadre, ecart, pointe } = VIGNETTE;
      const [cx] = projection(donnees.ancre);
      const [[, haut]] = chemin.bounds(terrePrincipale(f));
      const x = cx - largeur / 2;
      const y = Math.max(4, haut - hauteur - ecart);
      vignette.select('.vignette-ombre').attr('x', x + 3).attr('y', y + 3).attr('width', largeur).attr('height', hauteur).attr('rx', 3);
      vignette.select('.vignette-cadre').attr('x', x).attr('y', y).attr('width', largeur).attr('height', hauteur).attr('rx', 3);
      vignette.select('.vignette-pointe').attr('points', [[cx - 6, y + hauteur - 1], [cx + 6, y + hauteur - 1], [cx, y + hauteur + pointe]].map((p) => p.join(',')).join(' '));
      vignette.select('.vignette-drapeau').attr('x', x + cadre).attr('y', y + cadre)
        .attr('width', largeur - 2 * cadre).attr('height', hauteur - 2 * cadre);
    });
  }

  let echelle = 200;
  let surGlobe = true;   // faux pendant l'envol et tant qu'on est dans un pays
  let paysEnVol = null;  // le pays vers lequel on s'envole garde son drapeau jusqu'au bout

  function dessiner() {
    // Seuls les pays visibles sont dessinés (au zoom, la plupart sont hors de l'écran)
    const [lambdaVue, phiVue] = projection.rotate();
    const vue = [-lambdaVue, -phiVue];
    // Rayon (en radians) de la partie du globe à l'écran : du centre du globe au coin le plus éloigné
    const [tx, ty] = projection.translate();
    const coin = Math.max(...[[0, 0], [largeur, 0], [0, hauteur], [largeur, hauteur]].map(([cx, cy]) => Math.hypot(cx - tx, cy - ty)));
    const rayonVue = Math.asin(Math.min(1, coin / projection.scale())) + 0.02;
    const estVisible = (g) => {
      const { centre, rayon } = cercle(g);
      return d3.geoDistance(centre, vue) - rayon <= rayonVue;
    };
    const traceVisible = (f) => {
      const g = forme(f);
      return estVisible(g) ? chemin(g) : null;
    };
    dessinerFond(estVisible);
    traces.attr('d', traceVisible);
    dessinerRegions(vue, estVisible);
    voiles.attr('d', traceVisible);
    signalerPaysAuCentre();
    if (drapeauxAffiches.size) dessinerDrapeaux();
    // Une zone tactile n'existe que si le pays est sur la face visible du globe
    const [lambda, phi] = projection.rotate();
    cibles.each(function (f) {
      const centre = centres.get(f);
      const visible = d3.geoDistance(centre, [-lambda, -phi]) < Math.PI / 2 - 0.02;
      const [x, y] = projection(centre);
      this.setAttribute('cx', x);
      this.setAttribute('cy', y);
      this.style.display = visible ? '' : 'none';
    });
  }

  // Taille de la zone du globe (mise à jour au redimensionnement et au passage en plein écran)
  let largeur = 400;
  let hauteur = 400;
  // Après la roulette, le globe remonte : le pays tiré reste visible au-dessus du bouton et de la carte de résultat
  let globeRemonte = false;
  const centreEcran = () => (plein ? [largeur / 2, hauteur / 2] : [largeur / 2, hauteur * (globeRemonte ? 0.36 : 0.53)]);

  function mesurer() {
    const { width, height } = svgElement.getBoundingClientRect();
    largeur = width;
    hauteur = height;
  }

  /** Régions culinaires des pays disponibles proches du centre, de plus en plus visibles avec le zoom. */
  function dessinerRegions(vue, estVisible) {
    const [debut, fin] = ZOOM_REGIONS;
    const opacite = Math.max(0, Math.min(1, (zoom - debut) / (fin - debut)));
    if (zoom > ZOOM_CHARGER_REGIONS) {
      for (const f of tracesDisponibles.data()) {
        const { centre, rayon } = cercle(f);
        if (d3.geoDistance(centre, vue) < rayon + 0.1) chargerLimitesRegions(paysDisponible(f).code);
      }
    }
    const montrees = opacite > 0
      ? tracesDisponibles.data().filter((f) => limitesRegions.has(paysDisponible(f).code) && estVisible(f)) : [];
    coucheRegions.attr('opacity', opacite)
      .selectAll('path')
      .data(montrees, (f) => paysDisponible(f).code)
      .join('path')
      .attr('class', 'limites-regions')
      .attr('d', (f) => chemin(limitesRegions.get(paysDisponible(f).code)));
  }

  /** Pays disponible au centre de l'écran (plein écran, à partir de ×4) : l'application montre « Entrer ». */
  let paysAuCentre = null;
  let entreeEnCours = false;
  function chercherPaysAuCentre() {
    if (!plein || zoom < ZOOM_ENTRER || entreeEnCours) return null;
    const lieu = projection.invert(centreEcran());
    const f = lieu && tracesDisponibles.data().find((x) => d3.geoContains(forme(x), lieu));
    return f ? paysDisponible(f) : null;
  }
  function signalerPaysAuCentre() {
    const p = chercherPaysAuCentre();
    if (p === paysAuCentre) return;
    paysAuCentre = p;
    surPaysAuCentre?.(p);
  }
  /** Entrée dans le pays du centre (bouton « Entrer », ou zoom ×12). */
  function entrer() {
    const p = chercherPaysAuCentre();
    if (!p || entreeEnCours) return;
    entreeEnCours = true;
    elan = null;
    molette = null;
    svg.interrupt('zoom');
    paysAuCentre = null;
    surPaysAuCentre?.(null);
    surEntree?.(p);
  }

  /* ---------- Roulette « Surprends-moi » (REX n° 1, § 6) ---------- */
  let rouletteEnCours = false;
  let drapeauRoulette = null;   // pays où la roulette s'est arrêtée : son drapeau reste jusqu'au prochain contact
  /** Premier contact après la roulette : le drapeau s'efface, la carte de résultat se ferme, le globe redescend. */
  function effacerDrapeauRoulette() {
    if (!drapeauRoulette && !globeRemonte) return;
    const f = drapeauRoulette;
    drapeauRoulette = null;
    if (f) afficherDrapeau(tracesDisponibles.filter((x) => x === f).node(), f, false);
    if (globeRemonte) {
      globeRemonte = false;
      glisserVers(centreEcran());
      surFinSurprise?.();
    }
  }

  /** Le globe glisse jusqu'à une nouvelle place à l'écran (0,38 s). */
  function glisserVers(arrivee) {
    if (mouvementReduit()) {
      projection.translate(arrivee);
      dessiner();
      return;
    }
    const trajet = d3.interpolate(projection.translate(), arrivee);
    svg.transition('glisse').duration(DUREE_GLISSE).ease(d3.easeCubicOut)
      .tween('glisse', () => (t) => { projection.translate(trajet(t)); dessiner(); });
  }

  /**
   * Au moins trois tours vers l'est, puis ralentissement jusqu'au pays (5 s), avec un léger zoom ;
   * à l'arrivée, son drapeau et sa vignette. Mouvement réduit : arrivée immédiate.
   */
  async function lancerRoulette(code) {
    const f = tracesDisponibles.data().find((x) => paysDisponible(x).code === code);
    if (!f || !surGlobe || rouletteEnCours || plein) return false;
    rouletteEnCours = true;
    effacerDrapeauRoulette();
    pause();
    elan = null;
    molette = null;
    svg.interrupt('zoom');
    // Point d'arrivée : l'emblème du drapeau (ou le centre du pays)
    let cible = d3.geoCentroid(f);
    try { cible = (await chargerDrapeau(code)).ancre || cible; } catch { /* sans connexion : centre du pays */ }
    const [lambda0, phi0] = projection.rotate();
    let lambda1 = -cible[0];
    while (lambda1 < lambda0 + 360 * TOURS_ROULETTE) lambda1 += 360;
    const rotation = d3.interpolate([lambda0, phi0], [lambda1, -cible[1]]);
    const [z0, z1] = [zoom, Math.min(zoom > ZOOM_ROULETTE ? zoom : ZOOM_ROULETTE, PLEIN_ECRAN_DEBUT)];
    globeRemonte = true;
    const translation = d3.interpolate(projection.translate(), centreEcran());
    const etape = (t) => {
      const [l, p] = rotation(t);
      projection.rotate([l, p, 0]);
      projection.translate(translation(Math.min(1, t * 4)));   // le globe remonte dès le début de la roulette
      zoom = z0 + (z1 - z0) * t;
      projection.scale(echelle * zoom);
      dessiner();
    };
    if (mouvementReduit()) {
      etape(1);
    } else {
      let dernierCran = Math.floor(lambda0 / PAS_VIBRATION);
      await new Promise((fin) => {
        svg.transition('roulette').duration(DUREE_ROULETTE).ease(d3.easePolyOut.exponent(4))
          .tween('roulette', () => (t) => {
            etape(t);
            const cran = Math.floor(projection.rotate()[0] / PAS_VIBRATION);
            if (cran !== dernierCran) {
              dernierCran = cran;
              if (t < 0.9) navigator.vibrate?.(4);
            }
          })
          .on('end interrupt', fin);
      });
      etape(1);
    }
    surZoom?.(zoom, ZOOM_MAX);
    rouletteEnCours = false;
    pause();
    drapeauRoulette = f;
    afficherDrapeau(tracesDisponibles.filter((x) => x === f).node(), f, true);
    return true;
  }

  /** Toile : ombre, sphère, méridiens et pays « Bientôt disponible », en une seule passe. */
  function dessinerFond(estVisible) {
    const ratio = window.devicePixelRatio || 1;
    const [w, h] = [Math.round(largeur * ratio), Math.round(hauteur * ratio)];
    if (toile.width !== w || toile.height !== h) {
      toile.width = w;
      toile.height = h;
    }
    contexte.setTransform(ratio, 0, 0, ratio, 0, 0);
    contexte.clearRect(0, 0, largeur, hauteur);
    const [x, y] = projection.translate();
    const rayon = projection.scale();
    contexte.beginPath();
    contexte.arc(x + 7, y + 9, rayon, 0, 2 * Math.PI);
    contexte.fillStyle = couleurs.encre;
    contexte.fill();
    contexte.beginPath();
    crayon({ type: 'Sphere' });
    contexte.fillStyle = couleurs.ocean;
    contexte.fill();
    contexte.beginPath();
    crayon(meridiens);
    contexte.lineWidth = 0.8;
    contexte.strokeStyle = couleurs.ligne;
    contexte.stroke();
    contexte.beginPath();
    for (const f of autresPays) {
      const g = forme(f);
      if (estVisible(g)) crayon(g);
    }
    contexte.fillStyle = couleurs.terre;
    contexte.fill();
    contexte.lineWidth = 0.6;
    contexte.strokeStyle = couleurs.ocean;
    contexte.stroke();
    contexte.beginPath();
    crayon({ type: 'Sphere' });
    contexte.lineWidth = 3;
    contexte.strokeStyle = couleurs.encre;
    contexte.stroke();
  }

  // Un seul dessin par image affichée : sur un téléphone lent, le doigt envoie plusieurs mouvements par image
  let dessinPrevu = false;
  function demanderDessin() {
    if (dessinPrevu) return;
    dessinPrevu = true;
    requestAnimationFrame(() => { dessinPrevu = false; dessiner(); });
  }

  function redimensionner() {
    mesurer();
    // En plein écran, le globe garde sa taille : seule sa place change
    if (!plein) echelle = Math.max(80, Math.min(largeur * 0.46, (hauteur - 190) * 0.5));
    projection.translate(centreEcran());
    if (surGlobe) projection.scale(echelle * zoom);
    dessiner();
  }

  /* ---------- Zoom, façon Google Earth (REX n° 1, § 5) ---------- */
  let zoom = 1;
  let plein = false;
  let mondeDetaille = null;   // contours 1/50 000 000, par identifiant de pays
  let chargementDetail = null;
  const forme = (f) => (zoom >= ZOOM_DETAIL && mondeDetaille?.get(f.id)) || f;
  // Cercle qui contient un pays (centre et rayon en radians) : pour ne dessiner que les pays visibles
  const cercles = new WeakMap();
  function cercle(g) {
    if (!cercles.has(g)) {
      const centre = d3.geoCentroid(g);
      let rayon = 0;
      d3.geoStream(g, { point: (lon, lat) => { rayon = Math.max(rayon, d3.geoDistance(centre, [lon, lat])); }, lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} });
      cercles.set(g, { centre, rayon });
    }
    return cercles.get(g);
  }

  function chargerDetail() {
    if (chargementDetail) return;
    chargementDetail = chargerMondeDetaille()
      .then((topo) => {
        mondeDetaille = new Map(topojson.feature(topo, topo.objects.countries).features.map((f) => [f.id, f]));
        dessiner();
      })
      .catch(() => { chargementDetail = null; });   // sans connexion : on garde les contours simples
  }

  const surSphere = ([x, y]) => {
    const [tx, ty] = projection.translate();
    return Math.hypot(x - tx, y - ty) < projection.scale() * 0.98;
  };
  const versSvg = (x, y) => {
    const r = svgElement.getBoundingClientRect();
    return [x - r.left, y - r.top];
  };

  /** Tourne le globe pour que le lieu « geo » se retrouve sous le point « pt » de l'écran. */
  function placerSous(geo, pt) {
    for (let i = 0; i < 5; i += 1) {
      if (!surSphere(pt)) return;
      const ici = projection.invert(pt);
      if (!ici) return;
      const [lambda, phi] = projection.rotate();
      let dl = ici[0] - geo[0];
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      projection.rotate([lambda + dl, Math.max(-89, Math.min(89, phi + (ici[1] - geo[1]))), 0]);
    }
  }

  /** Plein écran (et retour), sans saut : le globe garde sa taille et glisse jusqu'au centre. */
  function pleinEcran(actif) {
    if (actif === plein) return;
    const avant = svgElement.getBoundingClientRect();
    const [tx, ty] = projection.translate();
    const surEcran = [avant.left + tx, avant.top + ty];
    plein = actif;
    if (actif && globeRemonte) {
      globeRemonte = false;
      drapeauRoulette = null;
      surFinSurprise?.();
    }
    surPleinEcran?.(actif);   // l'application range les barres : la zone du globe change
    mesurer();
    const apres = svgElement.getBoundingClientRect();
    const depart = [surEcran[0] - apres.left, surEcran[1] - apres.top];
    const arrivee = centreEcran();
    if (mouvementReduit()) {
      projection.translate(arrivee);
      dessiner();
      return;
    }
    const trajet = d3.interpolate(depart, arrivee);
    projection.translate(depart);
    svg.transition('glisse').duration(DUREE_GLISSE).ease(d3.easeCubicOut)
      .tween('glisse', () => (t) => { projection.translate(trajet(t)); dessiner(); });
  }

  /** Zoom vers un point de l'écran : le lieu sous le doigt (ou le curseur) y reste. */
  function zoomerVers(k, pt, geo) {
    if (entreeEnCours) return;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));
    if (!plein && zoom > PLEIN_ECRAN_DEBUT) pleinEcran(true);
    else if (plein && zoom < PLEIN_ECRAN_FIN && !glissement) pleinEcran(false);
    projection.scale(echelle * zoom);
    // Contours détaillés : déjà assez de points, inutile de les affiner (bien plus fluide au zoom)
    projection.precision(zoom >= ZOOM_DETAIL && mondeDetaille ? 0 : 0.4);
    if (geo && plein) placerSous(geo, pt);
    if (zoom > 2) chargerDetail();
    demanderDessin();
    surZoom?.(zoom, ZOOM_MAX);
    if (zoom >= ZOOM_MAX - 0.05) entrer();
  }

  /** Zoom animé (boutons + et −, bouton ×). */
  function zoomerAnime(k, duree, courbe) {
    if (rouletteEnCours) return;
    const pt = centreEcran();
    const geo = surSphere(pt) ? projection.invert(pt) : null;
    const depart = zoom;
    const arrivee = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));
    elan = null;
    molette = null;
    if (mouvementReduit()) {
      zoomerVers(arrivee, pt, geo);
      return;
    }
    svg.interrupt('zoom').transition('zoom').duration(duree).ease(courbe)
      .tween('zoom', () => (t) => zoomerVers(depart * (arrivee / depart) ** t, pt, geo));
  }

  /* ---------- Gestes : glisser (avec élan), pincer, molette ---------- */
  const pointeurs = new Map();
  let glissement = false;     // un doigt (ou la souris) est posé sur le globe
  let depart = null;          // début du glissement : position et rotation
  let pince = null;           // début du pincement : écart des doigts, zoom, lieu entre les doigts
  let annulerClic = false;    // un glissement ou un pincement n'est jamais pris pour un toucher
  let vitesse = [0, 0];
  let dernier = null;
  let elan = null;
  let molette = null;

  const milieu = () => {
    const [a, b] = [...pointeurs.values()];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const ecart = () => {
    const [a, b] = [...pointeurs.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  };
  const reprendreGlissement = () => {
    const [p] = [...pointeurs.values()];
    depart = { x: p[0], y: p[1], rotation: projection.rotate() };
    dernier = { t: performance.now(), rotation: projection.rotate() };
    vitesse = [0, 0];
  };

  svgElement.addEventListener('pointerdown', (evenement) => {
    if (!surGlobe || entreeEnCours || rouletteEnCours || evenement.button > 0) return;
    effacerDrapeauRoulette();
    pointeurs.set(evenement.pointerId, [evenement.clientX, evenement.clientY]);
    pause();
    elan = null;
    molette = null;
    svg.interrupt('zoom');
    if (pointeurs.size === 1) {
      glissement = true;
      annulerClic = false;
      reprendreGlissement();
    } else if (pointeurs.size === 2) {
      const m = versSvg(...milieu());
      pince = { ecart: ecart(), zoom, geo: surSphere(m) ? projection.invert(m) : null };
      annulerClic = true;
    }
  });

  window.addEventListener('pointermove', (evenement) => {
    if (!pointeurs.has(evenement.pointerId) || !surGlobe) return;
    pointeurs.set(evenement.pointerId, [evenement.clientX, evenement.clientY]);
    if (pointeurs.size >= 2 && pince) {
      zoomerVers(pince.zoom * (ecart() / pince.ecart), versSvg(...milieu()), pince.geo);
      return;
    }
    if (pointeurs.size !== 1 || !depart) return;
    // La vitesse de rotation dépend du zoom : plus on est près, plus elle est précise
    const k = 75 / projection.scale();
    const dx = evenement.clientX - depart.x;
    const dy = evenement.clientY - depart.y;
    if (Math.hypot(dx, dy) > SEUIL_GLISSEMENT) annulerClic = true;
    projection.rotate([depart.rotation[0] + dx * k, Math.max(-89, Math.min(89, depart.rotation[1] - dy * k)), 0]);
    demanderDessin();
    const maintenant = performance.now();
    const dt = maintenant - dernier.t;
    if (dt > 0) {
      const r = projection.rotate();
      vitesse = [0.7 * vitesse[0] + (0.3 * (r[0] - dernier.rotation[0])) / dt, 0.7 * vitesse[1] + (0.3 * (r[1] - dernier.rotation[1])) / dt];
      dernier = { t: maintenant, rotation: r };
    }
  });

  const relacher = (evenement) => {
    if (!pointeurs.delete(evenement.pointerId)) return;
    if (pointeurs.size < 2) pince = null;
    if (pointeurs.size === 1) reprendreGlissement();
    if (pointeurs.size > 0) return;
    glissement = false;
    depart = null;
    pause();
    // Lancer le globe : il continue sur sa lancée, puis ralentit
    if (!mouvementReduit() && dernier && performance.now() - dernier.t < 80 && Math.hypot(...vitesse) > 0.01) elan = { v: vitesse.slice() };
    if (plein && zoom < PLEIN_ECRAN_FIN) pleinEcran(false);
  };
  window.addEventListener('pointerup', relacher);
  window.addEventListener('pointercancel', relacher);
  // Un glissement ou un pincement ne déclenche jamais le toucher d'un pays
  svgElement.addEventListener('click', (evenement) => {
    if (!annulerClic) return;
    evenement.stopPropagation();
    evenement.preventDefault();
    annulerClic = false;
  }, true);

  // Molette (ordinateur) : zoom doux vers le curseur
  svgElement.addEventListener('wheel', (evenement) => {
    if (!surGlobe || entreeEnCours || rouletteEnCours) return;
    evenement.preventDefault();
    pause();
    const pt = versSvg(evenement.clientX, evenement.clientY);
    const maintenant = performance.now();
    if (!molette || maintenant - molette.t > 250) molette = { cible: zoom, pt, geo: surSphere(pt) ? projection.invert(pt) : null };
    molette.t = maintenant;
    molette.pt = pt;
    molette.cible = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, molette.cible * Math.exp(-evenement.deltaY * 0.002)));
  }, { passive: false });

  // Une seule horloge : molette, élan, rotation automatique
  let enRotation = true;
  let minuterieReprise;
  let precedent = null;
  const minuterie = d3.timer((ecoule) => {
    const dt = precedent === null ? 0 : Math.min(48, ecoule - precedent);
    precedent = ecoule;
    if (!surGlobe) return;
    if (molette && Math.abs(molette.cible - zoom) > 0.002) {
      zoomerVers(zoom + (molette.cible - zoom) * Math.min(1, dt / 70), molette.pt, molette.geo);
      return;
    }
    if (elan && !glissement) {
      const [lambda, phi] = projection.rotate();
      projection.rotate([lambda + elan.v[0] * dt, Math.max(-89, Math.min(89, phi + elan.v[1] * dt)), 0]);
      const amorti = Math.exp(-dt / AMORTI_ELAN);
      elan.v = [elan.v[0] * amorti, elan.v[1] * amorti];
      if (Math.hypot(...elan.v) < ARRET_ELAN) elan = null;
      dessiner();
      return;
    }
    // Rotation automatique : arrêtée dès que le zoom dépasse ×1,05, et si le téléphone demande moins d'animations
    if (!enRotation || glissement || rouletteEnCours || zoom > 1.05 || mouvementReduit()) return;
    const [lambda, phi, gamma] = projection.rotate();
    projection.rotate([lambda + (VITESSE * dt) / 1000, phi, gamma]);
    dessiner();
  });

  function pause() {
    enRotation = false;
    clearTimeout(minuterieReprise);
    minuterieReprise = setTimeout(() => { enRotation = true; }, REPRISE);
  }

  /** Anime la projection vers une rotation et une échelle (immédiat si mouvement réduit). */
  function animer(rotation, echelleCible, duree, courbe, immediat = false) {
    const r = d3.interpolate(projection.rotate(), rotation);
    const s = d3.interpolate(projection.scale(), echelleCible);
    if (immediat || mouvementReduit()) {
      projection.rotate(r(1)).scale(s(1));
      dessiner();
      return Promise.resolve();
    }
    return new Promise((fin) => {
      let termine = false;
      const terminer = (positionFinale) => {
        if (termine) return;
        termine = true;
        if (positionFinale) {
          projection.rotate(r(1)).scale(s(1));
          dessiner();
        }
        fin();
      };
      const transition = svg.transition().duration(duree).ease(courbe)
        .tween('vue', () => (t) => { projection.rotate(r(t)).scale(s(t)); dessiner(); });
      transition.on('end', () => terminer(true));
      // Coupée par une autre animation : celle-ci prend le relais, sans saut
      transition.on('interrupt cancel', () => terminer(false));
      // Sécurité : un onglet en arrière-plan peut suspendre les animations ; on ne bloque jamais
      setTimeout(() => {
        if (termine) return;
        terminer(true);
        svg.interrupt();
      }, duree + 400);
    });
  }

  function tournerVers(f) {
    if (!surGlobe) return;
    pause();
    const [lon, lat] = d3.geoCentroid(f);
    animer([-lon, -lat, 0], projection.scale(), 600, d3.easeCubicInOut);
  }

  function toucher(f, element) {
    if (!surGlobe) return;
    pause();
    const p = paysDisponible(f);
    if (p) navigator.vibrate?.(10);   // REX n° 1, § 7 : petite vibration au toucher d'un pays disponible (Android)
    if (p) surPaysDisponible?.(p);
    else surPaysBientot?.(nomFrancais(f, codes));
  }

  /** Drapeau, puis rotation et zoom vers le pays, puis fondu du globe. */
  async function envolerVers(f, element, immediat = false) {
    if (paysEnVol) return;
    paysEnVol = f;
    surGlobe = false;
    drapeauRoulette = null;
    globeRemonte = false;
    elan = null;
    molette = null;
    svg.interrupt('zoom');
    if (plein) {
      plein = false;
      surPleinEcran?.(false);
      mesurer();
      projection.translate(centreEcran());
    }
    // Les autres pays reprennent leur couleur (un survol en cours, par exemple)
    tracesDisponibles.filter((x) => x !== f).each(function (x) { afficherDrapeau(this, x, false); });
    const reduit = immediat || mouvementReduit();
    afficherDrapeau(element, f, true);
    if (!reduit) await attendre(DUREE_DRAPEAU);
    const [lon, lat] = d3.geoCentroid(f);
    await animer([-lon, -lat, 0], echelle * ZOOM_ENVOL, DUREE_ENVOL, d3.easeCubicInOut, reduit);
    svgElement.classList.add('fade');
    toile.classList.add('fade');
    svgElement.parentElement.inert = true;   // le globe caché n'est plus atteignable au clavier
    if (!reduit) await attendre(DUREE_FONDU);
    afficherDrapeau(element, f, false);
    paysEnVol = null;
  }

  return {
    redimensionner,

    /** Envol vers un pays (immediat : sans animation, pour un lien ouvert directement). */
    envolerVersCode(code, immediat = false) {
      const element = tracesDisponibles.filter((f) => paysDisponible(f).code === code).node();
      return element ? envolerVers(d3.select(element).datum(), element, immediat) : Promise.resolve();
    },

    /** Retour sur le globe : réapparition et dézoom. */
    async revenir() {
      svgElement.classList.remove('fade');
      toile.classList.remove('fade');
      svgElement.parentElement.inert = false;
      zoom = 1;
      entreeEnCours = false;
      projection.precision(0.4);
      surZoom?.(zoom, ZOOM_MAX);
      await animer(projection.rotate(), echelle, DUREE_RETOUR, d3.easeCubicOut);
      surGlobe = true;
      enRotation = true;
    },

    /** Boutons + et − : ×1,8 vers le centre de l'écran. */
    zoomerPlus() { if (surGlobe) zoomerAnime(zoom * ZOOM_BOUTON, DUREE_ZOOM_BOUTON, d3.easeCubicOut); },
    zoomerMoins() { if (surGlobe) zoomerAnime(zoom / ZOOM_BOUTON, DUREE_ZOOM_BOUTON, d3.easeCubicOut); },
    /** Bouton « Entrer » : entrée dans le pays au centre de l'écran. */
    entrer,
    /** Roulette « Surprends-moi » vers un pays ; résolue à l'arrivée (faux si elle n'a pas pu tourner). */
    lancerRoulette,

    /** Position à l'écran de l'emblème d'un pays (départ de l'éclat de piments), ou null s'il n'est pas visible. */
    async positionEmbleme(code) {
      const f = tracesDisponibles.data().find((x) => paysDisponible(x).code === code);
      if (!f) return null;
      let point = d3.geoCentroid(f);
      try { point = (await chargerDrapeau(code)).ancre || point; } catch { /* centre du pays */ }
      const [lambda, phi] = projection.rotate();
      if (d3.geoDistance(point, [-lambda, -phi]) > Math.PI / 2 - 0.05) return null;
      const [x, y] = projection(point);
      const cadre = svgElement.getBoundingClientRect();
      return [cadre.left + x, cadre.top + y];
    },
    /** Bouton × du plein écran : retour au globe entier. */
    dezoomer() { if (surGlobe) zoomerAnime(1, DUREE_DEZOOM, d3.easeCubicInOut); },

    arreter() {
      minuterie.stop();
      clearTimeout(minuterieReprise);
    },
  };
}

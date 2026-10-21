// Globe 3D (D3, projection orthographique) : rotation automatique et au doigt,
// pays disponibles colorés et scintillants, « Bientôt disponible » pour les autres,
// drapeau au survol et au toucher, envol vers un pays et retour.

import { textes } from './textes.js';
import { chargerDrapeau } from './donnees.js';

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
// Vignette du drapeau (REX n° 1, § 3.5) : vrai drapeau 40 × 27, cadre de 3 px, pointe vers le bas
const VIGNETTE = { largeur: 40, hauteur: 27, cadre: 3, ecart: 12, pointe: 8 };

const mouvementReduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const attendre = (ms) => new Promise((fin) => setTimeout(fin, ms));

/** Nom français d'un pays de la carte du monde. */
function nomFrancais(pays, codes) {
  const code = codes[String(pays.id)];
  try {
    if (code) return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code);
  } catch { /* navigateur sans Intl.DisplayNames : nom de secours ci-dessous */ }
  return textes.paysSansCode[pays.properties.name] || pays.properties.name;
}

/**
 * Dessine le globe dans un <svg>.
 * options.surPaysDisponible(pays) : toucher d'un pays disponible (pays de data/pays.json)
 * options.surPaysBientot(nom)     : toucher d'un autre pays (nom en français)
 */
export function creerGlobe(svgElement, { monde, codes, listePays, surPaysDisponible, surPaysBientot }) {
  const disponibles = new Map(listePays.map((p) => [p.code.toUpperCase(), p]));
  const paysDisponible = (f) => disponibles.get(codes[String(f.id)]);
  const pays = topojson.feature(monde, monde.objects.countries).features;

  const projection = d3.geoOrthographic().clipAngle(90).precision(0.4).rotate([-60, -18, 0]);
  const chemin = d3.geoPath(projection);
  const svg = d3.select(svgElement)
    .attr('role', 'group')
    .attr('aria-label', textes.globe.description);

  const ombre = svg.append('circle').attr('class', 'globe-shadow');
  const sphere = svg.append('path').attr('class', 'sphere').datum({ type: 'Sphere' });
  const meridiens = svg.append('path').attr('class', 'grat').datum(d3.geoGraticule10());
  const traces = svg.append('g').selectAll('path').data(pays).join('path')
    .attr('class', (f) => (paysDisponible(f) ? 'country has' : 'country'))
    .style('fill', (f) => paysDisponible(f)?.couleur ?? null)
    .on('click', (evenement, f) => toucher(f, evenement.currentTarget));
  traces.append('title').text((f) => nomFrancais(f, codes));

  const tracesDisponibles = traces.filter(paysDisponible);

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
      const trace = chemin(f);
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
    const [x, y] = projection.translate();
    ombre.attr('cx', x + 7).attr('cy', y + 9).attr('r', projection.scale());
    sphere.attr('d', chemin);
    meridiens.attr('d', chemin);
    traces.attr('d', chemin);
    voiles.attr('d', chemin);
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

  function redimensionner() {
    const { width, height } = svgElement.getBoundingClientRect();
    echelle = Math.max(80, Math.min(width * 0.46, (height - 190) * 0.5));
    projection.translate([width / 2, height * 0.53]);
    if (surGlobe) projection.scale(echelle);
    dessiner();
  }

  // Rotation automatique (désactivée si le téléphone demande moins d'animations)
  let enRotation = true;
  let minuterieReprise;
  let precedent = null;
  const minuterie = d3.timer((ecoule) => {
    const dt = precedent === null ? 0 : (ecoule - precedent) / 1000;
    precedent = ecoule;
    if (!enRotation || !surGlobe || mouvementReduit()) return;
    const [lambda, phi, gamma] = projection.rotate();
    projection.rotate([lambda + VITESSE * Math.min(dt, 0.1), phi, gamma]);
    dessiner();
  });

  function pause() {
    enRotation = false;
    clearTimeout(minuterieReprise);
    minuterieReprise = setTimeout(() => { enRotation = true; }, REPRISE);
  }

  // Rotation au doigt et à la souris. Un glissement n'est jamais pris pour un toucher.
  svg.call(d3.drag()
    .clickDistance(SEUIL_GLISSEMENT)
    .filter((evenement) => surGlobe && !evenement.button)
    .on('start', pause)
    .on('drag', (evenement) => {
      const k = 75 / projection.scale();
      const [lambda, phi, gamma] = projection.rotate();
      projection.rotate([lambda + evenement.dx * k, Math.max(-75, Math.min(75, phi - evenement.dy * k)), gamma]);
      dessiner();
    })
    .on('end', pause));

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
    if (p) surPaysDisponible?.(p);
    else surPaysBientot?.(nomFrancais(f, codes));
  }

  /** Drapeau, puis rotation et zoom vers le pays, puis fondu du globe. */
  async function envolerVers(f, element, immediat = false) {
    if (paysEnVol) return;
    paysEnVol = f;
    surGlobe = false;
    // Les autres pays reprennent leur couleur (un survol en cours, par exemple)
    tracesDisponibles.filter((x) => x !== f).each(function (x) { afficherDrapeau(this, x, false); });
    const reduit = immediat || mouvementReduit();
    afficherDrapeau(element, f, true);
    if (!reduit) await attendre(DUREE_DRAPEAU);
    const [lon, lat] = d3.geoCentroid(f);
    await animer([-lon, -lat, 0], echelle * ZOOM_ENVOL, DUREE_ENVOL, d3.easeCubicInOut, reduit);
    svgElement.classList.add('fade');
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
      svgElement.parentElement.inert = false;
      await animer(projection.rotate(), echelle, DUREE_RETOUR, d3.easeCubicOut);
      surGlobe = true;
      enRotation = true;
    },

    arreter() {
      minuterie.stop();
      clearTimeout(minuterieReprise);
    },
  };
}

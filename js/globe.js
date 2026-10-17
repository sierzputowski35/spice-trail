// Globe 3D (D3, projection orthographique) : rotation automatique et au doigt,
// pays disponibles colorés et pulsants, « Bientôt disponible » pour les autres,
// drapeau au survol et au toucher, envol vers un pays et retour.

import { textes } from './textes.js';

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

  // Drapeaux (drapeaux/<code>.svg), préparés dès le départ pour s'afficher sans délai
  const defs = svg.append('defs');
  for (const p of listePays) {
    defs.append('pattern')
      .attr('id', `drapeau-${p.code}`)
      .attr('patternContentUnits', 'objectBoundingBox')
      .attr('width', 1).attr('height', 1)
      .append('image')
      .attr('href', `drapeaux/${p.code}.svg`)
      .attr('width', 1).attr('height', 1)
      .attr('preserveAspectRatio', 'xMidYMid slice');
  }

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

  function afficherDrapeau(element, f, visible) {
    const p = paysDisponible(f);
    d3.select(element)
      .classed('flagged', visible)
      .style('fill', visible ? `url(#drapeau-${p.code})` : p.couleur);
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

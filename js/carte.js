// Carte plate du pays : pays voisins, régions culinaires, villes, zoom sur une région.
// Ce module dessine ; c'est app.js qui décide où l'on se trouve (pays, région, ville).

import { textes } from './textes.js';
import { nomCourt } from './outils.js';

const d3 = window.d3;
const topojson = window.topojson;

const DUREE_ZOOM = 650;
const ZOOM_MAX = 6;

const mouvementReduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nom d'une ville sans fiche, tiré de son identifiant (« can-tho » → « Can tho ») */
const nomDepuisIdentifiant = (id) => (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, ' ');

/**
 * Prépare la carte dans un <svg>.
 * options.zone()               : rectangle libre pour la carte { x0, y0, x1, y1 }
 * options.surRegion(id)        : toucher d'une région culinaire
 * options.surVille(id)         : toucher d'une ville qui a une fiche
 * options.surMessage(texte)    : message à afficher (région ou ville sans fiche)
 */
export function creerCarte(svgElement, { monde, codes, zone, surRegion, surVille, surMessage }) {
  const tousLesPays = topojson.feature(monde, monde.objects.countries).features;
  const svg = d3.select(svgElement).attr('role', 'group');
  const groupeZoom = svg.append('g');
  const coucheVoisins = groupeZoom.append('g');
  const coucheProvinces = groupeZoom.append('g');   // provinces sans fiche
  // Zones tactiles de 44 px autour du nom de chaque région, SOUS les régions :
  // elles n'attrapent que les touchers tombés à côté (mer, provinces sans fiche), jamais une autre région
  const coucheCibles = groupeZoom.append('g').attr('aria-hidden', 'true');
  const coucheRegions = groupeZoom.append('g');
  const coucheNoms = groupeZoom.append('g').attr('aria-hidden', 'true');
  const coucheVilles = groupeZoom.append('g');

  const projection = d3.geoMercator();
  const chemin = d3.geoPath(projection);

  let contenus = null;          // fiches du pays (data/pays/<code>.json)
  let regions = [];             // contours des régions (et « autre »)
  let toutesRegions = null;
  let etat = { region: null, ville: null };
  let echelle = 1;

  const aUneFiche = (f) => f.properties.r !== 'autre' && contenus.regions[f.properties.r];
  const nomRegion = (id) => nomCourt(contenus.regions[id].nom);
  const nomVille = (v) => (contenus.villes[v.id] ? nomCourt(contenus.villes[v.id].nom) : v.nom || nomDepuisIdentifiant(v.id));

  function activerAuClavier(selection, action) {
    selection
      .attr('tabindex', 0)
      .attr('role', 'button')
      .on('keydown', (evenement, d) => {
        if (evenement.key === 'Enter' || evenement.key === ' ') {
          evenement.preventDefault();
          action(d);
        }
      });
  }

  function toucherRegion(f) {
    if (aUneFiche(f)) surRegion(f.properties.r);
    else surMessage(textes.carte.regionSansFiche);
  }

  function toucherVille(v) {
    if (contenus.villes[v.id]) surVille(v.id);
    else surMessage(textes.carte.villeBientot);
  }

  /** Charge un pays : ses contenus, le contour de ses régions, ses voisins. */
  function chargerPays(pays, donneesPays, topoRegions, codeNumerique) {
    contenus = donneesPays;
    regions = topojson.feature(topoRegions, topoRegions.objects.regions).features;
    toutesRegions = { type: 'FeatureCollection', features: regions };
    etat = { region: null, ville: null };
    svg.attr('aria-label', textes.carte.description(pays.nom));

    coucheVoisins.selectAll('path')
      .data(tousLesPays.filter((f) => String(f.id) !== codeNumerique))
      .join('path')
      .attr('class', 'm-country');

    coucheProvinces.selectAll('path')
      .data(regions.filter((f) => !aUneFiche(f)), (f) => pays.code + f.properties.r)
      .join('path')
      .attr('class', 'm-prov')
      .on('click', (evenement, f) => toucherRegion(f));
    coucheRegions.selectAll('path')
      .data(regions.filter(aUneFiche), (f) => pays.code + f.properties.r)
      .join('path')
      .attr('class', 'm-reg')
      .attr('data-cible', (f) => f.properties.r)
      .attr('aria-label', (f) => nomRegion(f.properties.r))
      .on('click', (evenement, f) => toucherRegion(f))
      .call(activerAuClavier, toucherRegion);
    coucheCibles.selectAll('circle')
      .data(regions.filter(aUneFiche), (f) => pays.code + f.properties.r)
      .join('circle')
      .attr('class', 'm-cible')
      .attr('data-cible-de', (f) => f.properties.r)
      .on('click', (evenement, f) => toucherRegion(f));

    coucheNoms.selectAll('text')
      .data(regions.filter(aUneFiche), (f) => pays.code + f.properties.r)
      .join('text')
      .attr('class', 'm-label')
      .attr('text-anchor', 'middle')
      .text((f) => nomRegion(f.properties.r));

    redimensionner();
  }

  function redimensionner() {
    if (!contenus) return;
    const z = zone();
    projection.fitExtent([[z.x0, z.y0], [z.x1, z.y1]], toutesRegions);
    coucheVoisins.selectAll('path').attr('d', chemin);
    coucheProvinces.selectAll('path').attr('d', chemin);
    coucheRegions.selectAll('path').attr('d', chemin);
    coucheCibles.selectAll('circle').each(function (f) {
      const [x, y] = chemin.centroid(f);
      const { dx = 0, dy = 0 } = f.properties;
      this.setAttribute('cx', x + dx);
      this.setAttribute('cy', y + dy);
    });
    coucheNoms.selectAll('text').attr('transform', (f) => {
      const [x, y] = chemin.centroid(f);
      const { dx = 0, dy = 0 } = f.properties;
      return `translate(${x + dx},${y + 4 + dy})`;
    });
    afficher(etat, false);
  }

  /** Montre le pays entier, une région (zoom) ou une ville (dans sa région). */
  function afficher(nouvelEtat, anime = true) {
    etat = { region: nouvelEtat.region || null, ville: nouvelEtat.ville || null };
    let k = 1;
    let tx = 0;
    let ty = 0;
    const cible = etat.region && regions.find((f) => f.properties.r === etat.region);
    if (cible) {
      const z = zone();
      const [[x0, y0], [x1, y1]] = chemin.bounds(cible);
      k = Math.min(ZOOM_MAX, 0.8 * Math.min((z.x1 - z.x0) / (x1 - x0), (z.y1 - z.y0) / (y1 - y0)));
      tx = (z.x0 + z.x1) / 2 - k * (x0 + x1) / 2;
      ty = (z.y0 + z.y1) / 2 - k * (y0 + y1) / 2;
    }
    echelle = k;
    const transformation = `translate(${tx},${ty}) scale(${k})`;
    if (anime && !mouvementReduit()) {
      groupeZoom.transition().duration(DUREE_ZOOM).ease(d3.easeCubicInOut).attr('transform', transformation);
    } else {
      groupeZoom.interrupt().attr('transform', transformation);
    }

    coucheNoms.selectAll('text')
      .style('font-size', `${11 / k}px`)
      .style('stroke-width', `${3 / k}px`)
      .style('opacity', etat.region ? 0 : 1);
    coucheRegions.selectAll('path')
      .classed('sel', (f) => f.properties.r === etat.region)
      .classed('dim', (f) => Boolean(etat.region) && f.properties.r !== etat.region);
    coucheCibles.selectAll('circle').attr('r', 22 / k);

    dessinerVilles();
  }

  function dessinerVilles() {
    const villes = etat.region ? contenus.regions[etat.region].villes || [] : [];
    const groupes = coucheVilles.selectAll('g.m-city')
      .data(villes, (v) => v.id)
      .join((entree) => {
        const g = entree.append('g').attr('class', 'm-city');
        g.append('circle').attr('class', 'm-hit').attr('data-cible-de', (v) => `ville-${v.id}`);   // zone tactile de 44 px, invisible
        g.append('circle').attr('class', 'm-dot');
        g.append('text').attr('aria-hidden', 'true');
        return g;
      });
    groupes
      .attr('data-cible', (v) => `ville-${v.id}`)
      .classed('soon', (v) => !contenus.villes[v.id])
      .classed('on', (v) => v.id === etat.ville)
      .attr('aria-label', (v) => (contenus.villes[v.id] ? nomVille(v) : textes.carte.villeSansFiche(nomVille(v))))
      .attr('aria-current', (v) => (v.id === etat.ville ? 'location' : null))
      .attr('transform', (v) => `translate(${projection(v.point).join(',')})`)
      .on('click', (evenement, v) => toucherVille(v))
      .call(activerAuClavier, toucherVille);
    groupes.select('.m-hit').attr('r', 22 / echelle);
    groupes.select('.m-dot').attr('r', 7 / echelle);
    groupes.select('text')
      .attr('x', 11 / echelle)
      .attr('y', 4 / echelle)
      .style('font-size', `${13 / echelle}px`)
      .style('stroke-width', `${3 / echelle}px`)
      .text(nomVille);
  }

  return { chargerPays, afficher, redimensionner };
}

// Carte plate du pays : pays voisins, régions culinaires, villes, zoom sur une région.
// Ce module dessine ; c'est app.js qui décide où l'on se trouve (pays, région, ville).

import { textes } from './textes.js';
import { nomLieu } from './outils.js';

const d3 = window.d3;
const topojson = window.topojson;

const DUREE_ZOOM = 650;
const ZOOM_MAX = 6;

const mouvementReduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Projection de la carte d'un pays, d'après data/geo/regions/<code>.json :
 * Mercator par défaut, conique (Albers) pour un grand pays comme les États-Unis.
 */
function creerProjection(reglages) {
  if (reglages?.type === 'conique') {
    return d3.geoConicEqualArea().parallels(reglages.paralleles).rotate(reglages.rotation || [0, 0]);
  }
  return d3.geoMercator();
}

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
  const coucheEncart = groupeZoom.append('g').attr('aria-hidden', 'true');   // cadre des régions éloignées
  const coucheProvinces = groupeZoom.append('g');   // provinces sans fiche
  // Zones tactiles de 44 px autour du nom de chaque région, SOUS les régions :
  // elles n'attrapent que les touchers tombés à côté (mer, provinces sans fiche), jamais une autre région
  const coucheCibles = groupeZoom.append('g').attr('aria-hidden', 'true');
  const coucheRegions = groupeZoom.append('g');
  const coucheNoms = groupeZoom.append('g').attr('aria-hidden', 'true');
  const coucheVilles = groupeZoom.append('g');

  let projection = d3.geoMercator();
  let chemin = d3.geoPath(projection);
  // Parties très éloignées (Okinawa, Alaska, Hawaï) : chacune dans son encart, avec sa propre projection
  const estEnEncart = (f) => Boolean(f?.properties.encart);
  let encarts = new Map();      // nom → { projection, chemin, parties, cadre }
  let encartsEnBas = false;
  const cheminDe = (f) => (estEnEncart(f) ? encarts.get(f.properties.encart).chemin : chemin);

  let contenus = null;          // fiches du pays (data/pays/<code>.json)
  let regions = [];             // contours des régions (et « autre »)
  let toutesRegions = null;
  let etat = { region: null, ville: null };
  let echelle = 1;

  const aUneFiche = (f) => f.properties.r !== 'autre' && contenus.regions[f.properties.r];
  // Une région peut avoir une partie en encart (l'Alaska dans l'Ouest) : la partie principale porte
  // le nom, la zone tactile et le zoom ; la partie en encart se touche aussi, mais n'est pas répétée au clavier
  const partiePrincipale = (r) => regions.find((f) => f.properties.r === r && !estEnEncart(f))
    || regions.find((f) => f.properties.r === r);
  const estPrincipale = (f) => partiePrincipale(f.properties.r) === f;
  const cle = (code) => (f) => code + f.properties.r + (f.properties.encart || '');
  const nomRegion = (id) => nomLieu(contenus.regions[id]);
  const nomVille = (v) => (contenus.villes[v.id] ? nomLieu(contenus.villes[v.id]) : v.nom || nomDepuisIdentifiant(v.id));

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
    projection = creerProjection(topoRegions.projection);
    chemin = d3.geoPath(projection);
    encarts = new Map();
    for (const f of regions.filter(estEnEncart)) {
      const nom = f.properties.encart;
      if (!encarts.has(nom)) {
        const p = creerProjection(topoRegions.projections_encarts?.[nom]);
        encarts.set(nom, { projection: p, chemin: d3.geoPath(p), parties: [], cadre: null });
      }
      encarts.get(nom).parties.push(f);
    }
    toutesRegions = { type: 'FeatureCollection', features: regions.filter((f) => !estEnEncart(f)) };
    encartsEnBas = Boolean(topoRegions.encarts_en_bas);
    etat = { region: null, ville: null };
    svg.attr('aria-label', textes.carte.description(pays.nom));

    coucheVoisins.selectAll('path')
      .data(tousLesPays.filter((f) => String(f.id) !== codeNumerique))
      .join('path')
      .attr('class', 'm-country');

    coucheProvinces.selectAll('path')
      .data(regions.filter((f) => !aUneFiche(f)), cle(pays.code))
      .join('path')
      .attr('class', 'm-prov')
      .on('click', (evenement, f) => toucherRegion(f));
    coucheRegions.selectAll('path')
      .data(regions.filter(aUneFiche), cle(pays.code))
      .join('path')
      .attr('class', 'm-reg')
      .attr('data-cible', (f) => f.properties.r)
      .attr('data-encart', (f) => f.properties.encart || null)
      .attr('aria-label', (f) => nomRegion(f.properties.r))
      .on('click', (evenement, f) => toucherRegion(f))
      .call(activerAuClavier, toucherRegion)
      // Partie en encart d'une région déjà présente (Alaska) : touchable, mais une seule fois au clavier
      .attr('tabindex', (f) => (estPrincipale(f) ? 0 : -1))
      .attr('aria-hidden', (f) => (estPrincipale(f) ? null : 'true'));
    coucheCibles.selectAll('circle')
      .data(regions.filter(aUneFiche).filter(estPrincipale), cle(pays.code))
      .join('circle')
      .attr('class', 'm-cible')
      .attr('data-cible-de', (f) => f.properties.r)
      .on('click', (evenement, f) => toucherRegion(f));

    coucheNoms.selectAll('text')
      .data(regions.filter(aUneFiche).filter(estPrincipale), cle(pays.code))
      .join('text')
      .attr('class', 'm-label')
      .attr('text-anchor', 'middle')
      .text((f) => nomRegion(f.properties.r));

    redimensionner();
  }

  function redimensionner() {
    if (!contenus) return;
    const z = zone();
    // Encarts : environ un tiers de la largeur chacun, dans les coins de la carte les plus libres
    // (en bas à gauche de préférence, comme sur les cartes japonaises et américaines)
    const [largeurEncart, hauteurEncart] = [(z.x1 - z.x0) * 0.32, (z.y1 - z.y0) * 0.26];
    // Pays large (États-Unis) : une bande est réservée en bas pour les encarts, la carte remonte
    const bas = encarts.size && encartsEnBas ? z.y1 - hauteurEncart - 8 : z.y1;
    projection.fitExtent([[z.x0, z.y0], [z.x1, bas]], toutesRegions);
    const cadres = [];
    for (const encart of encarts.values()) {
      const cadre = encartsEnBas
        ? { x: z.x0 + 4 + cadres.length * (largeurEncart + 8), y: z.y1 - hauteurEncart, l: largeurEncart, h: hauteurEncart }
        : coinLibre(z, largeurEncart, hauteurEncart, cadres);
      encart.projection.fitExtent([[cadre.x + 10, cadre.y + 10], [cadre.x + cadre.l - 10, cadre.y + cadre.h - 10]],
        { type: 'FeatureCollection', features: encart.parties });
      encart.cadre = cadre;
      cadres.push(cadre);
    }
    coucheEncart.selectAll('rect').data(cadres).join('rect')
      .attr('class', 'm-encart')
      .attr('x', (c) => c.x).attr('y', (c) => c.y).attr('width', (c) => c.l).attr('height', (c) => c.h)
      .attr('rx', 10);
    coucheVoisins.selectAll('path').attr('d', chemin);
    coucheProvinces.selectAll('path').attr('d', (f) => cheminDe(f)(f));
    coucheRegions.selectAll('path').attr('d', (f) => cheminDe(f)(f));
    coucheCibles.selectAll('circle').each(function (f) {
      const [x, y] = cheminDe(f).centroid(f);
      const { dx = 0, dy = 0 } = f.properties;
      this.setAttribute('cx', x + dx);
      this.setAttribute('cy', y + dy);
    });
    coucheNoms.selectAll('text').attr('transform', (f) => {
      const [x, y] = cheminDe(f).centroid(f);
      const { dx = 0, dy = 0 } = f.properties;
      return `translate(${x + dx},${y + 4 + dy})`;
    });
    afficher(etat, false);
  }

  /**
   * Coin de la zone qui recouvre le moins de terres du pays (points des contours projetés),
   * sans chevaucher les encarts déjà placés.
   */
  function coinLibre(z, l, h, dejaPlaces = []) {
    const chevauche = (c) => dejaPlaces.some((d) => c.x < d.x + d.l && d.x < c.x + l && c.y < d.y + d.h && d.y < c.y + h);
    const coins = [
      { x: z.x0 + 4, y: z.y1 - h },          // bas gauche (préféré)
      { x: z.x0 + 12 + l, y: z.y1 - h },     // en bas, à droite du premier encart
      { x: z.x0 + 4, y: z.y0 },              // haut gauche
      { x: z.x1 - l - 4, y: z.y1 - h },      // bas droite
      { x: z.x1 - l - 4, y: z.y0 },          // haut droite
    ].filter((c) => !chevauche(c) && (dejaPlaces.length || c.x === z.x0 + 4 || c.x === z.x1 - l - 4));
    const points = [];
    for (const f of toutesRegions.features) {
      d3.geoStream(f, projection.stream({ point: (x, y) => points.push([x, y]), lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} }));
    }
    const recouvrement = (c) => points.filter(([x, y]) => x >= c.x && x <= c.x + l && y >= c.y && y <= c.y + h).length;
    const meilleur = coins.reduce((m, c) => (recouvrement(c) < recouvrement(m) ? c : m));
    return { ...meilleur, l, h };
  }

  /** Montre le pays entier, une région (zoom) ou une ville (dans sa région). */
  function afficher(nouvelEtat, anime = true) {
    etat = { region: nouvelEtat.region || null, ville: nouvelEtat.ville || null };
    let k = 1;
    let tx = 0;
    let ty = 0;
    const cible = etat.region && partiePrincipale(etat.region);
    if (cible) {
      const z = zone();
      const [[x0, y0], [x1, y1]] = cheminDe(cible).bounds(cible);
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
    const positions = villes.map(positionVille);
    const groupes = coucheVilles.selectAll('g.m-city')
      .data(villes, (v) => v.id)
      .join((entree) => {
        const g = entree.append('g').attr('class', 'm-city');
        g.append('clipPath').attr('id', (v) => `zone-ville-${v.id}`).append('path');
        g.append('circle').attr('class', 'm-hit').attr('data-cible-de', (v) => `ville-${v.id}`)   // zone tactile de 44 px, invisible
          .attr('clip-path', (v) => `url(#zone-ville-${v.id})`);
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
      .attr('transform', (v, i) => `translate(${positions[i].join(',')})`)
      .on('click', (evenement, v) => toucherVille(v))
      .call(activerAuClavier, toucherVille);
    groupes.select('.m-hit').attr('r', 22 / echelle);
    groupes.select('.m-dot').attr('r', 7 / echelle);
    groupes.select('text')
      .style('font-size', `${13 / echelle}px`)
      .style('stroke-width', `${3 / echelle}px`)
      .text(nomVille);
    separerVillesProches(groupes, villes, positions);
  }

  /**
   * Position d'une ville à l'écran : dans l'encart dont elle fait partie (Anchorage dans celui
   * de l'Alaska, Naha dans celui d'Okinawa), sinon sur la carte principale.
   * La ville est dans un encart si elle tombe dans le rectangle de ses terres (à 0,5° près :
   * une ville côtière peut tomber juste en mer une fois les contours allégés).
   */
  function positionVille(v) {
    const [lon, lat] = v.point;
    for (const encart of encarts.values()) {
      const dedans = encart.parties.some((f) => {
        const [[x0, y0], [x1, y1]] = d3.geoBounds(f);
        const dansLongitudes = x0 <= x1 ? lon >= x0 - 0.5 && lon <= x1 + 0.5 : lon >= x0 - 0.5 || lon <= x1 + 0.5;
        return dansLongitudes && lat >= y0 - 0.5 && lat <= y1 + 0.5;
      });
      if (dedans) return encart.projection(v.point);
    }
    return projection(v.point);
  }

  /**
   * Villes proches l'une de l'autre (Osaka et Kobe…) :
   * - celles qui ont une fiche passent devant celles qui n'en ont pas ;
   * - les zones tactiles se partagent : un toucher va à la ville la plus proche du doigt ;
   * - chaque nom se place du côté libre du point (droite, gauche, dessus, dessous).
   */
  function separerVillesProches(groupes, villes, points) {
    groupes.sort((a, b) => Boolean(contenus.villes[a.id]) - Boolean(contenus.villes[b.id]));
    if (!points.length) return;

    const k = echelle;
    const indice = new Map(villes.map((v, i) => [v.id, i]));
    const r = 23 / k;
    groupes.each(function (v) {
      const i = indice.get(v.id);
      const [x, y] = points[i];
      // Carré de la zone tactile, coupé à mi-chemin de chaque ville voisine
      let zone = [[-r, -r], [r, -r], [r, r], [-r, r]];
      points.forEach(([ax, ay], j) => {
        if (j !== i) zone = garderCoteProche(zone, ax - x, ay - y);
      });
      d3.select(this).select('clipPath path')
        .attr('d', zone.length ? `M${zone.map(([zx, zy]) => `${zx},${zy}`).join('L')}Z` : null);
    });

    // Placement des noms, villes à fiche d'abord
    const rayonPoint = 9 / k;
    const hauteur = 14 / k;
    const positions = [
      { ancre: 'start', x: 11 / k, y: 4 / k },
      { ancre: 'end', x: -11 / k, y: 4 / k },
      { ancre: 'middle', x: 0, y: -12 / k },
      { ancre: 'middle', x: 0, y: 21 / k },
    ];
    const boite = ([px, py], p, largeur) => {
      const x0 = p.ancre === 'start' ? px + p.x : p.ancre === 'end' ? px + p.x - largeur : px - largeur / 2;
      return { x0, x1: x0 + largeur, y0: py + p.y - hauteur * 0.8, y1: py + p.y + hauteur * 0.2 };
    };
    const recouvre = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const obstacles = points.map(([x, y]) => ({ x0: x - rayonPoint, x1: x + rayonPoint, y0: y - rayonPoint, y1: y + rayonPoint }));
    const ordre = groupes.nodes().slice().reverse();   // devant en premier
    for (const noeud of ordre) {
      const v = d3.select(noeud).datum();
      const texte = noeud.querySelector('text');
      const largeur = texte.getComputedTextLength() || 0;
      const point = points[indice.get(v.id)];
      const autres = obstacles.filter((o, j) => j !== indice.get(v.id));
      const cout = (p) => autres.reduce((s, o) => s + recouvre(boite(point, p, largeur), o), 0);
      const meilleure = positions.reduce((m, p) => (cout(p) < cout(m) - 1e-9 ? p : m));
      texte.setAttribute('text-anchor', meilleure.ancre);
      texte.setAttribute('x', meilleure.x);
      texte.setAttribute('y', meilleure.y);
      obstacles.push(boite(point, meilleure, largeur));
    }
  }

  /** Garde la partie d'un polygone (autour de 0,0) plus proche de 0,0 que du point (ax, ay). */
  function garderCoteProche(polygone, ax, ay) {
    const c = (ax * ax + ay * ay) / 2;
    const dedans = ([x, y]) => x * ax + y * ay <= c;
    const resultat = [];
    polygone.forEach((p, n) => {
      const q = polygone[(n + 1) % polygone.length];
      if (dedans(p)) resultat.push(p);
      if (dedans(p) !== dedans(q)) {
        const t = (c - (p[0] * ax + p[1] * ay)) / ((q[0] - p[0]) * ax + (q[1] - p[1]) * ay);
        resultat.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    });
    return resultat;
  }

  return { chargerPays, afficher, redimensionner };
}

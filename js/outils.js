// Petits outils d'affichage partagés par les écrans (fiches, recettes, recherche, favoris).

import { textes } from './textes.js';
import { versionLisible } from './couleurs.js';

/** Protège un texte avant de l'insérer dans du HTML. */
export const echapper = (texte) => String(texte ?? '')
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** « Sichuan (avec Chongqing) » → « Sichuan » */
export const nomCourt = (nom) => String(nom || '').replace(/\s*\(.*\)\s*/, '');

/** « 麻婆豆腐 (mápó dòufu) » → « 麻婆豆腐 » : le nom dans son écriture d'origine. */
export const ecritureOrigine = (nom) => String(nom || '').split(' (')[0].trim();

export const estCjk = (texte) => /[\u3400-\u9fff]/.test(texte);

/** Attribut lang pour un nom d'origine (vide si la langue est inconnue). */
export const attributLangue = (langue) => (langue ? ` lang="${echapper(langue)}"` : '');

/**
 * Photo d'une recette, seulement si l'expert cuisine l'a vérifiée (image_verifiee: true).
 * Sinon : null, et l'affichage de remplacement est utilisé.
 */
export const photoVerifiee = (recette) => (recette?.image_verifiee === true && recette.image
  ? `images/recettes/${recette.image}` : null);

/** Texte de remplacement d'une vignette : 2 caractères chinois, ou le premier mot. */
function texteVignette(nomOrigine) {
  const texte = ecritureOrigine(nomOrigine);
  return estCjk(texte) ? { texte: texte.slice(0, 2), latin: false } : { texte: texte.split(' ')[0], latin: true };
}

/**
 * Vignette d'un plat : la photo vérifiée si elle existe, sinon le nom d'origine
 * sur la couleur du pays (affichage de remplacement, définitif).
 */
export function vignette(nomOrigine, langue, photo = null) {
  const { texte, latin } = texteVignette(nomOrigine);
  const classe = `thumb${latin ? ' lat' : ''}`;
  if (photo) {
    // Si la photo ne se charge pas, remplacerImagesManquantes() remet le texte de remplacement
    return `<span class="${classe} avec-photo"${attributLangue(langue)} aria-hidden="true"><img src="${echapper(photo)}" alt="" width="62" height="62"
      loading="lazy" decoding="async" data-remplacement="${echapper(texte)}"></span>`;
  }
  return `<span class="${classe}"${attributLangue(langue)} aria-hidden="true">${echapper(texte)}</span>`;
}

/**
 * Une photo vérifiée introuvable (fichier absent, connexion coupée) ne laisse jamais
 * d'image cassée : la vignette reprend son texte, le bandeau de recette disparaît.
 * À appeler une fois au démarrage.
 */
export function remplacerImagesManquantes() {
  document.addEventListener('error', (evenement) => {
    const image = evenement.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.dataset.remplacement !== undefined) {
      const vignetteParent = image.parentElement;
      vignetteParent.classList.remove('avec-photo');
      vignetteParent.textContent = image.dataset.remplacement;
    } else if (image.closest('.r-photo')) {
      image.closest('.r-photo').remove();
    }
  }, true);
}

export const piment = (plein) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1.5c-.6.2-.9.8-.8 1.4-2 .2-3.4 1.5-3.9 3.6-.6 2.6-2.3 5.1-4.6 6.9 4 .6 8.6-1.4 10.3-5.2.9-2 .6-3.8-.6-4.8.2-.7 0-1.4-.4-1.9z" fill="${plein ? 'var(--accent)' : 'none'}" stroke="var(--accent)" stroke-width="1.1" opacity="${plein ? 1 : 0.45}"/></svg>`;

/** Piquant de 0 à 3, en petits piments. */
export const piments = (n) => `<span class="pepper" role="img" aria-label="${textes.recette.piquantSur3(n)}">${[1, 2, 3].map((i) => piment(i <= n)).join('')}</span>`;

/** 75 → « 1 h 15 » ; 40 → « 40 min » */
export function duree(minutes) {
  if (!minutes) return textes.recette.dureeVide;
  if (minutes < 60) return `${minutes} min`;
  const reste = minutes % 60;
  return `${Math.floor(minutes / 60)} h${reste ? ' ' + String(reste).padStart(2, '0') : ''}`;
}

export const dureeTotale = (recette) => (recette.temps.preparation || 0) + (recette.temps.cuisson || 0);

export const ICONE_SUITE = '<svg class="go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/**
 * Attribut style qui donne à un élément la couleur de son pays (vignettes, piments),
 * pour les listes qui mélangent plusieurs pays (recherche, favoris).
 */
export const teintePays = (pays) => ` data-teinte-pays style="--accent-l: ${echapper(pays.couleur)}; --accent-strong: ${versionLisible(pays.couleur)}"`;

/** Carte d'une recette dans une liste : vignette, nom, nom d'origine, difficulté, durée, piquant. */
export const carteRecette = (r, pays) => `<li${teintePays(pays)} data-pays="${echapper(pays.code)}"><button class="item" data-recette="${echapper(r.id)}">
    ${vignette(r.nom_origine, pays.langue, photoVerifiee(r))}
    <span class="min"><span class="t">${echapper(r.nom)}</span><br><span class="o"${attributLangue(pays.langue)}>${echapper(r.nom_origine)}</span>
    <span class="chips"><span class="chip">${textes.recette.difficulte[r.difficulte] || ''}</span><span class="chip">${duree(dureeTotale(r))}</span>${r.piquant ? `<span class="chip hot">${piments(r.piquant)}</span>` : ''}</span></span>
    ${ICONE_SUITE}</button></li>`;

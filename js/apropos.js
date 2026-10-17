// Écran « À propos » : présentation, méthode, frontières, version, mentions et licences.

import { textes } from './textes.js';
import { echapper } from './outils.js';

const ICONE_FERMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** options.surFermer() : bouton de fermeture */
export function creerEcranAPropos(conteneur, { surFermer }) {
  const t = textes.aPropos;
  const mention = (m) => `<li><strong>${echapper(m.nom)}</strong> : ${echapper(m.texte)}${m.lien
    ? ` <a class="zone-tactile" href="${echapper(m.lien)}" target="_blank" rel="noopener" aria-label="${echapper(t.lienExterne(m.nom))}">${echapper(new URL(m.lien).hostname)}</a>`
    : ''}</li>`;

  const repere = conteneur.querySelector('#tabbar');
  (repere || conteneur).insertAdjacentHTML(repere ? 'beforebegin' : 'beforeend', `
    <section class="screen" id="a-propos" hidden aria-labelledby="a-propos-titre">
      <div class="screen-pad">
        <div class="row-between">
          <h1 id="a-propos-titre" tabindex="-1">${t.titre}</h1>
          <button class="round" data-action="fermer" aria-label="${t.fermer}">${ICONE_FERMER}</button>
        </div>
        <div class="prose a-propos">
          <p>${t.presentation(echapper(textes.nomApplication))}</p>
          <h2>${t.methodeTitre}</h2>
          <ul>${t.methode.map((ligne) => `<li>${echapper(ligne)}</li>`).join('')}</ul>
          <h2>${t.cartesTitre}</h2>
          <p>${echapper(t.frontieres)}</p>
          <h2>${t.versionTitre}</h2>
          <p>${echapper(t.version)}</p>
          <h2>${t.mentionsTitre}</h2>
          <ul>${t.mentions.map(mention).join('')}</ul>
        </div>
      </div>
    </section>`);

  const ecran = conteneur.querySelector('#a-propos');
  ecran.querySelector('[data-action="fermer"]').addEventListener('click', surFermer);

  return {
    afficher() {
      const dejaVisible = !ecran.hidden;
      ecran.hidden = false;
      if (!dejaVisible) {
        ecran.scrollTop = 0;
        ecran.querySelector('h1').focus({ preventScroll: true });
      }
    },
    cacher() {
      ecran.hidden = true;
    },
  };
}

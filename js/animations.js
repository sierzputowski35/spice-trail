// Explosion de piments quand on ajoute un favori.
// Désactivée si le téléphone demande de réduire les animations.

import { piment } from './outils.js';

const NOMBRE = 9;

/** Fait jaillir 9 petits piments autour d'un élément (bouton favori). */
export function exploserPiments(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!element.animate) return;   // navigateur trop ancien : pas d'explosion, aucune erreur
  const cadre = element.getBoundingClientRect();
  const x = cadre.left + cadre.width / 2 - 11;
  const y = cadre.top + cadre.height / 2 - 11;
  for (let i = 0; i < NOMBRE; i++) {
    const eclat = document.createElement('div');
    eclat.className = 'burst';
    eclat.setAttribute('aria-hidden', 'true');
    eclat.innerHTML = piment(true).replace('<svg ', '<svg width="22" height="22" ');
    eclat.style.left = `${x}px`;
    eclat.style.top = `${y}px`;
    document.body.append(eclat);
    const angle = (Math.PI * 2 * i) / NOMBRE + Math.random() * 0.4;
    const distance = 46 + Math.random() * 30;
    eclat.animate([
      { transform: 'translate(0, 0) scale(.4) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(1) rotate(${Math.random() * 360 - 180}deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(.2, .8, .3, 1)' })
      .onfinish = () => eclat.remove();
  }
}

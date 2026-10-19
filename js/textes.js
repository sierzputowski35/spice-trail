// Tous les textes d'interface, en français.
// C'est le seul endroit du code où figure le nom de l'application.

export const textes = {
  nomApplication: 'Spice Trail',

  accueil: {
    etiquette: 'Explorer le monde',
    invitation: 'Faites tourner le globe et touchez un pays pour découvrir sa cuisine.',
    legendeDisponible: 'À explorer',
    legendeBientot: 'Bientôt disponible',
  },

  globe: {
    description: 'Globe terrestre. Faites-le tourner du doigt et touchez un pays.',
    ouvrirPays: (nom) => `Découvrir la cuisine : ${nom}`,
    bientot: (nom) => `${nom} · Bientôt disponible`,
  },

  // Pays de la carte du monde sans code ISO : leur nom en français
  paysSansCode: {
    'N. Cyprus': 'Chypre du Nord',
    Somaliland: 'Somaliland',
    Kosovo: 'Kosovo',
  },

  navigation: {
    retour: 'Revenir en arrière',
    filAriane: "Fil d'Ariane",
    monde: 'Monde',
  },

  carte: {
    description: (pays) => `Carte des régions culinaires : ${pays}`,
    regionSansFiche: 'Cette région n’a pas encore de fiche',
    villeBientot: 'Fiche de ville bientôt disponible',
    villeSansFiche: (nom) => `${nom} : fiche bientôt disponible`,
  },

  panneau: {
    nom: 'Fiche',
    poignee: 'Agrandir ou réduire la fiche',
    rubriques: 'Rubriques',
    etiquettePays: 'Pays',
    etiquetteRegion: 'Région culinaire',
    etiquetteVille: (region) => `Ville · ${region}`,
    onglets: { histoire: 'Histoire', plats: 'Plats', produits: 'Produits', recettes: 'Recettes' },
    textesAVenir: 'Texte à venir.',
    enSavoirPlus: 'En savoir plus',
    reduire: 'Réduire',
    ceQuOnRaconte: 'Ce qu’on raconte',
    platsEmblematiques: 'Plats emblématiques',
    voirLaRecette: 'Voir la recette',
    produitsTypiques: 'Produits typiques',
    lieuxGourmands: 'Lieux gourmands',
    nombreRecettes: (n) => `${n} recette${n > 1 ? 's' : ''}`,
    aucuneRecette: 'Pas encore de recette ici.',
  },

  favoris: {
    titre: 'Favoris',
    chapo: 'Enregistrés sur ce téléphone, sans compte.',
    recettes: 'Recettes',
    lieux: 'Lieux',
    vide: 'Aucun favori pour l’instant. Touchez le cœur sur une recette ou une fiche pour la retrouver ici.',
    chargement: 'Chargement de vos favoris…',
    ajouterLieu: (nom) => `Ajouter ${nom} aux favoris`,
    retirerLieu: (nom) => `Retirer ${nom} des favoris`,
    ajoute: 'Ajouté aux favoris',
    retire: 'Retiré des favoris',
  },

  recette: {
    nom: 'Recette',
    difficulte: { facile: 'Facile', moyenne: 'Moyenne', difficile: 'Difficile' },
    piquant: ['Pas piquant', 'Légèrement piquant', 'Piquant', 'Très piquant'],
    piquantSur3: (n) => `Piquant ${n} sur 3`,
    dureeVide: '–',
    jours: (n) => `${n} jours`,
    semaines: (n) => (n > 1 ? `${n} semaines` : '1 semaine'),
    preparation: 'Préparation',
    cuisson: 'Cuisson',
    repos: 'Repos',
    difficulteTitre: 'Difficulté',
    piquantTitre: 'Piquant',
    regimes: { vegetarien: 'Végétarien', vegan: 'Vegan', 'sans-gluten': 'Sans gluten', 'sans-lactose': 'Sans lactose' },
    saisons: { printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver', 'toute-annee': 'Toute l’année' },
    saison: (liste) => `Saison : ${liste}`,
    origine: 'Origine',
    ingredients: 'Ingrédients',
    securite: 'Sécurité alimentaire',
    ustensiles: 'Ustensiles',
    etapes: 'Étapes',
    conseils: 'Conseils du chef',
    sinon: (texte) => `Sinon : ${texte}`,
    voirRecetteLiee: (nom) => `Voir la recette : ${nom}`,
    portionsParDefaut: 'pers.',
    portions: 'Nombre de portions',
    moins: 'Une portion de moins',
    plus: 'Une portion de plus',
    minuteur: (duree) => `Minuteur ${duree}`,
    minuteurLance: (duree) => `Minuteur lancé : ${duree}`,
    minuteurArrete: 'Minuteur arrêté',
    minuteurFini: 'Minuteur terminé',
    termine: 'Terminé',
    ajouterFavori: (nom) => `Ajouter ${nom} aux favoris`,
    retirerFavori: (nom) => `Retirer ${nom} des favoris`,
  },

  recherche: {
    titre: 'Rechercher',
    chapo: 'Un plat, un ingrédient ou un lieu.',
    champ: 'Rechercher un plat, un ingrédient ou un lieu',
    exemple: 'Ex. tofu, raviolis, Chengdu, safran…',
    filtres: 'Filtres',
    filtre: {
      vegetarien: 'Végétarien',
      vegan: 'Vegan',
      facile: 'Facile',
      doux: 'Pas piquant',
      rapide: 'Moins de 30 min',
    },
    chargement: 'Chargement des recettes…',
    recettes: (n) => `Recettes · ${n}`,
    lieux: 'Lieux',
    produits: 'Produits',
    lieuPays: 'Pays',
    lieuRegion: (pays) => `Région culinaire · ${pays}`,
    lieuVille: (region, pays) => `Ville · ${region} · ${pays}`,
    aucunResultat: (mot) => `Aucun résultat${mot ? ` pour « ${mot} »` : ''}. Essayez un autre mot ou retirez un filtre.`,
    annonce: (n) => (n ? `${n} résultat${n > 1 ? 's' : ''}` : 'Aucun résultat'),
  },

  aPropos: {
    titre: 'À propos',
    ouvrir: 'À propos',
    fermer: 'Fermer',
    // Texte du prototype validé (§ 3.7), complété par les mentions du § 8 du cahier des charges
    presentation: (nom) => `<strong>${nom}</strong>, « la route des épices », fait voyager de pays en région et de région en ville pour découvrir l’histoire des cuisines du monde, leurs plats et leurs produits, et cuisiner leurs recettes chez soi.`,
    methodeTitre: 'Notre méthode',
    methode: [
      'Les faits établis et les légendes sont séparés : les histoires incertaines apparaissent dans l’encadré « Ce qu’on raconte ».',
      'Les recettes sont rédigées pour l’application et testables à la maison, avec des substitutions pour les produits difficiles à trouver.',
      'Les photos des plats sont générées par IA, puis vérifiées une à une par rapport à la recette.',
      'Aucune recette n’utilise d’espèce menacée ou protégée : quand un plat traditionnel en contient, la fiche le mentionne et la recette proposée est adaptée.',
    ],
    cartesTitre: 'Cartes',
    frontieres: 'Les frontières affichées proviennent des données libres Natural Earth, qui représentent la situation de fait sur le terrain. Elles ne prennent pas position sur les territoires contestés.',
    versionTitre: 'Cette version',
    // noms : liste des pays disponibles (data/pays.json)
    version: (noms) => {
      const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms.join('');
      return `Cette version contient ${noms.length} pays : ${liste}. Les autres pays sont signalés « Bientôt disponible ». Les favoris sont enregistrés uniquement sur cet appareil, sans compte.`;
    },
    mentionsTitre: 'Mentions et licences',
    mentions: [
      { nom: 'Données cartographiques', texte: 'Natural Earth, domaine public.', lien: 'https://www.naturalearthdata.com/' },
      { nom: 'Drapeaux', texte: 'flag-icons, © 2013 Panayiotis Lipiridis, licence MIT.', lien: 'https://github.com/lipis/flag-icons/blob/main/LICENSE' },
      { nom: 'Polices', texte: 'Bricolage Grotesque, Inter, Noto Sans SC et Noto Sans Devanagari, sous licence SIL Open Font License.', lien: 'https://openfontlicense.org/' },
      { nom: 'Bibliothèques', texte: 'D3 et topojson-client, © Mike Bostock, licence ISC.', lien: 'https://d3js.org/' },
      { nom: 'Images des plats', texte: 'Générées par IA, puis vérifiées une à une.' },
    ],
    lienExterne: (nom) => `${nom} (s’ouvre dans un nouvel onglet)`,
  },

  unites: {
    pincee: 'pincée',
    pincees: 'pincées',
  },

  onglets: {
    navigation: 'Navigation principale',
    explorer: 'Explorer',
    rechercher: 'Rechercher',
    favoris: 'Favoris',
  },

  erreurs: {
    chargement: 'Impossible de charger les données. Vérifiez votre connexion internet, puis rechargez la page.',
  },
};

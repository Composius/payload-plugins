import type { Translation } from './index.js'

export const fr: Translation = {
  jobs: {
    fields: {
      applicationPassword: 'Mot de passe d’application',
      applicationPasswordDescription:
        'À créer dans WordPress sous Utilisateurs → Profil → Mots de passe d’application. Stocké sur ce document — supprimez le travail (ou videz ce champ) après l’import.',
      authorsReport: 'Auteurs importés',
      categoriesReport: 'Catégories importées',
      credentials: 'Identifiants (optionnel)',
      credentialsDescription:
        'Utilisateur WordPress + mot de passe d’application optionnels. Une fois définis, les requêtes sont authentifiées pour importer des données non publiques (ex. e-mails des auteurs).',
      dateFrom: 'À partir du',
      dateTo: "Jusqu'au",
      dryRun: 'Simulation',
      dryRunDescription:
        'Aperçu uniquement : indique ce qui serait importé sans rien écrire. Limité à la ou les premières pages.',
      errorsReport: 'Erreurs',
      finishedAt: 'Terminé à',
      limit: 'Nombre max. d’articles',
      limitDescription: 'Limite optionnelle du nombre d’articles importés lors de cette exécution.',
      linksReport: 'Correspondance des liens',
      mediaReport: 'Médias importés',
      postsReport: 'Articles importés',
      progress: 'Progression',
      resume: 'Reprendre / réessayer',
      resumeDescription:
        'Remettre ce travail en file pour continuer là où il s’est arrêté (les éléments déjà importés sont ignorés).',
      runs: 'Historique des exécutions',
      sourceUrl: 'URL du site WordPress',
      sourceUrlDescription:
        'URL de base du site WordPress, ex. https://example.com — son API REST (/wp-json) est lue.',
      startedAt: 'Démarré à',
      status: 'Statut',
      username: 'Nom d’utilisateur',
    },
    plural: 'Imports WordPress',
    singular: 'Import WordPress',
    status: {
      completed: 'Terminé',
      failed: 'Échoué',
      paused: 'En pause',
      queued: 'En file',
      running: 'En cours',
    },
    tabs: {
      authors: 'Auteurs',
      categories: 'Catégories',
      configuration: 'Configuration',
      links: 'Liens et redirections',
      media: 'Médias',
      posts: 'Articles',
      report: 'Rapport',
    },
  },
  records: {
    fields: {
      error: 'Erreur',
      job: 'Travail d’import',
      site: 'Site',
      sourceId: 'ID source',
      sourceKey: 'Clé source',
      sourceType: 'Type de source',
      status: 'Statut',
      targetCollection: 'Collection cible',
      targetId: 'ID cible',
    },
    plural: 'Enregistrements d’import WordPress',
    singular: 'Enregistrement d’import WordPress',
  },
}

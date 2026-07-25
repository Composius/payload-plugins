import type { Translation } from './index.js'

export const fr: Translation = {
  jobs: {
    singular: 'Import WordPress',
    plural: 'Imports WordPress',
    tabs: {
      configuration: 'Configuration',
      authors: 'Auteurs',
      categories: 'Catégories',
      media: 'Médias',
      posts: 'Articles',
      links: 'Liens et redirections',
      report: 'Rapport',
    },
    fields: {
      sourceUrl: 'URL du site WordPress',
      sourceUrlDescription:
        'URL de base du site WordPress, ex. https://example.com — son API REST (/wp-json) est lue.',
      credentials: 'Identifiants (optionnel)',
      credentialsDescription:
        'Utilisateur WordPress + mot de passe d’application optionnels. Une fois définis, les requêtes sont authentifiées pour importer des données non publiques (ex. e-mails des auteurs).',
      username: 'Nom d’utilisateur',
      applicationPassword: 'Mot de passe d’application',
      applicationPasswordDescription:
        'À créer dans WordPress sous Utilisateurs → Profil → Mots de passe d’application. Stocké sur ce document — supprimez le travail (ou videz ce champ) après l’import.',
      dateFrom: 'À partir du',
      dateTo: "Jusqu'au",
      limit: 'Nombre max. d’articles',
      limitDescription: 'Limite optionnelle du nombre d’articles importés lors de cette exécution.',
      dryRun: 'Simulation',
      dryRunDescription:
        'Aperçu uniquement : indique ce qui serait importé sans rien écrire. Limité à la ou les premières pages.',
      resume: 'Reprendre / réessayer',
      resumeDescription:
        'Remettre ce travail en file pour continuer là où il s’est arrêté (les éléments déjà importés sont ignorés).',
      status: 'Statut',
      progress: 'Progression',
      runs: 'Historique des exécutions',
      authorsReport: 'Auteurs importés',
      categoriesReport: 'Catégories importées',
      mediaReport: 'Médias importés',
      postsReport: 'Articles importés',
      linksReport: 'Correspondance des liens',
      errorsReport: 'Erreurs',
      startedAt: 'Démarré à',
      finishedAt: 'Terminé à',
    },
    status: {
      queued: 'En file',
      running: 'En cours',
      paused: 'En pause',
      completed: 'Terminé',
      failed: 'Échoué',
    },
  },
  records: {
    singular: 'Enregistrement d’import WordPress',
    plural: 'Enregistrements d’import WordPress',
    fields: {
      job: 'Travail d’import',
      site: 'Site',
      sourceType: 'Type de source',
      sourceId: 'ID source',
      sourceKey: 'Clé source',
      targetCollection: 'Collection cible',
      targetId: 'ID cible',
      status: 'Statut',
      error: 'Erreur',
    },
  },
}

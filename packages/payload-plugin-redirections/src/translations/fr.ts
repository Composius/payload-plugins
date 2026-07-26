import type { Translation } from './index.js'

export const fr: Translation = {
  descriptions: {
    from: "Le chemin à faire correspondre, commençant par une barre oblique — ou une expression régulière lorsque le type de correspondance est Regex.",
    preserveQuery:
      "Transmet la chaîne de requête de la requête entrante, sauf si la destination en possède déjà une.",
    priority:
      "Les valeurs les plus élevées sont évaluées en premier. À priorité égale, la règle la plus ancienne passe d'abord.",
    to: "Une URL absolue (https://…) ou un chemin commençant par une barre oblique. Les règles Regex peuvent utiliser $1, $2 et $& pour réutiliser les groupes capturés.",
  },
  errors: {
    duplicate: 'Une redirection avec ce chemin et ce type de correspondance existe déjà.',
    invalidRegex: 'Expression régulière invalide',
    malformedUrl: 'Saisissez une URL absolue valide.',
    mustBeAbsoluteOrRooted:
      'Saisissez une URL absolue (https://…) ou un chemin commençant par une barre oblique.',
    mustBeRelative:
      'Saisissez un chemin commençant par une barre oblique, et non une URL complète.',
    mustStartWithSlash: 'Saisissez un chemin commençant par une barre oblique.',
    noQueryOrHash:
      "Supprimez la chaîne de requête et le fragment — seul le chemin est comparé.",
    selfRedirect:
      'La destination est identique au chemin à faire correspondre, ce qui créerait une boucle.',
    unsupportedProtocol: 'Seules les destinations http:// et https:// sont prises en charge.',
  },
  fields: {
    enabled: 'Activée',
    from: 'Chemin à faire correspondre',
    matchType: 'Type de correspondance',
    preserveQuery: 'Conserver la chaîne de requête',
    priority: 'Priorité',
    status: 'Code de statut',
    to: 'Destination',
  },
  matchTypes: {
    exact: 'Exact — le chemin entier',
    prefix: 'Préfixe — le chemin et tout ce qu’il contient',
    regex: 'Regex — une expression régulière',
  },
  redirections: {
    plural: 'Redirections',
    singular: 'Redirection',
  },
  statuses: {
    301: '301 — Déplacé définitivement',
    302: '302 — Trouvé (temporaire)',
    307: '307 — Redirection temporaire',
    308: '308 — Redirection permanente',
  },
}

import type { Translation } from './index.js'

export const fr: Translation = {
  umami: {
    title: 'Statistiques',
    timeRange: 'Période',
    chartMetric: 'Métrique du graphique',
    ranges: {
      '24h': 'Dernières 24 heures',
      '7d': '7 derniers jours',
      '30d': '30 derniers jours',
      '90d': '90 derniers jours',
    },
    stats: {
      bounces: 'Rebonds',
      bouncesPrev: 'Rebonds (période précédente)',
      duration: 'Durée moyenne de visite',
      durationPrev: 'Durée moyenne de visite (période précédente)',
      views: 'Pages vues',
      viewsPrev: 'Pages vues (période précédente)',
      visitors: 'Visiteurs',
      visitorsPrev: 'Visiteurs (période précédente)',
      visits: 'Visites',
      visitsPrev: 'Visites (période précédente)',
    },
    topPages: 'Pages les plus vues',
    topCountries: 'Principaux pays',
    messages: {
      error: 'Impossible de charger les statistiques. Vérifiez la configuration Umami.',
      loading: 'Chargement des statistiques…',
      noCountries: 'Aucun pays sur cette période.',
      noPages: 'Aucune page sur cette période.',
    },
  },
}

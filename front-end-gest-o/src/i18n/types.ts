export type Locale = 'pt-BR'

export type TranslationKeys = {
  // Auth
  'auth.login': string
  'auth.logout': string
  'auth.email': string
  'auth.user': string
  'auth.password': string
  'auth.submit': string
  'auth.sessionExpired': string
  'auth.tooManyAttempts': string
  'auth.welcome': string
  'auth.invalidCredentials': string
  'auth.attemptsRemaining': string

  // Nav
  'nav.dashboard': string
  'nav.overview': string
  'nav.analysisBI': string
  'nav.detailedData': string
  'nav.salesAnalytic': string
  'nav.financial': string
  'nav.reports': string
  'nav.users': string
  'nav.audit': string
  'nav.admin': string
  'nav.analysisAndReports': string
  'nav.more': string

  // Finance tabs
  'finance.overview': string
  'finance.reconciliation': string
  'finance.accountsPayable': string
  'finance.accountsReceivable': string
  'finance.rawMaterialStock': string
  'finance.foamStock': string
  'finance.foamSales': string

  // Filters
  'filter.search': string
  'filter.status': string
  'filter.category': string
  'filter.type': string
  'filter.period': string
  'filter.presets': string
  'filter.all': string
  'filter.flow': string
  'filter.paymentMethod': string

  // Status
  'status.paid': string
  'status.due': string
  'status.overdue': string
  'status.received': string
  'status.reconciled': string
  'status.pending': string
  'status.divergent': string
  'status.normal': string
  'status.low': string
  'status.critical': string

  // Actions
  'action.export': string
  'action.reload': string
  'action.copyLink': string
  'action.save': string

  // Common
  'common.total': string
  'common.filters': string
  'common.error': string
  'common.errorReload': string
  'common.errorCode': string
  'common.loading': string
  'common.noData': string
  'common.lightTheme': string
  'common.darkTheme': string
}

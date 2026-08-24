export type Lang = 'FR' | 'EN'

const fr = {
  // nav
  nav_dashboard:    'Tableau de bord',
  nav_clinic:       'Ma Clinique',
  nav_botMessages:  'Messages du Bot',
  nav_faqs:         'FAQ',
  nav_handoff:      'Sessions en direct',
  nav_campaigns:    'Campagnes',
  nav_complaints:   'Plaintes',
  nav_logout:       'Déconnexion',

  // common actions
  save:          'Enregistrer',
  saving:        'Enregistrement...',
  cancel:        'Annuler',
  delete:        'Supprimer',
  edit:          'Modifier',
  search:        'Rechercher...',

  // status
  active:   'Actif',
  inactive: 'Inactif',
  all:      'Tous',

  // empty & errors
  noData:        'Aucune donnée à afficher',
  errorLoading:  'Erreur lors du chargement',
  errorSaving:   'Erreur lors de l\'enregistrement',
  tryAgain:      'Réessayer',

  // login
  login_welcome:    'Bon retour',
  login_subtitle:   'Connectez-vous à votre espace d\'administration',
  login_email:      'Adresse email',
  login_password:   'Mot de passe',
  login_btn:        'Se connecter',
  login_error:      'Email ou mot de passe incorrect',
  lang_switch:      'Passer en anglais',
  lang_switchEn:    'Switch to French',

  // clinic
  clinic_title:        'Informations de la clinique',
  clinic_subtitle:     'Ces informations sont utilisées par le bot dans ses réponses.',
  clinic_name:         'Nom de la clinique',
  clinic_address:      'Adresse',
  clinic_timezone:     'Fuseau horaire',
  clinic_defaultLang:  'Langue par défaut',
  clinic_saved:        'Clinique mise à jour avec succès',

  // bot messages
  msg_title:    'Messages du bot',
  msg_subtitle: 'Personnalisez chaque message envoyé par le bot à vos patients.',
  msg_fr:       'Français',
  msg_en:       'Anglais',
  msg_saved:    'Message enregistré',
  msg_hint:     'Variables disponibles',

  // specialties
  spec_reactivate: 'Réactiver',
  spec_missing_fr: 'Traduction française manquante',
  spec_missing_en: 'Traduction anglaise manquante',
  toTranslate:    'À traduire',
  toTranslateEn:  'To translate',

  // language
  french:  'Français',
  english: 'Anglais',

  // faqs
  faq_title:    'Questions fréquentes',
  faq_subtitle: 'Le bot utilise ces réponses pour répondre automatiquement aux patients.',
  faq_add:      'Nouvelle FAQ',
  faq_question: 'Question',
  faq_answer:   'Réponse',
  faq_keywords: 'Mots-clés',
  faq_keywords_hint: 'Séparés par des virgules, ex: horaires, ouverture',
  faq_order:    'Ordre',
  faq_created:  'FAQ créée',
  faq_updated:  'FAQ mise à jour',
  faq_deleted:  'FAQ désactivée',
  faq_hard_deleted: 'FAQ supprimée',

  // booking requests
  nav_bookingRequests: 'Demandes de RDV',
  bookingRequests_title: 'Demandes de rendez-vous',
  bookingRequests_subtitle: 'Demandes collectées par le bot auprès des patients',
  bookingRequests_patient: 'Patient',
  bookingRequests_phone: 'Téléphone',
  bookingRequests_preferredDate: 'Date souhaitée',
  bookingRequests_requestedAt: 'Demandé le',
  bookingRequests_status: 'Statut',
  bookingRequests_empty: 'Aucune demande de rendez-vous',
  bookingRequests_status_pending: 'En attente',
  bookingRequests_status_confirmed: 'Confirmé',
  bookingRequests_status_rejected: 'Rejeté',
}

const en: typeof fr = {
  nav_dashboard:    'Dashboard',
  nav_clinic:       'My Clinic',
  nav_botMessages:  'Bot Messages',
  nav_faqs:         'FAQs',
  nav_handoff:      'Live Sessions',
  nav_campaigns:    'Campaigns',
  nav_complaints:   'Complaints',
  nav_logout:       'Log out',

  save:          'Save changes',
  saving:        'Saving...',
  cancel:        'Cancel',
  delete:        'Delete',
  edit:          'Edit',
  search:        'Search...',

  active:   'Active',
  inactive: 'Inactive',
  all:      'All',

  noData:        'Nothing to show here yet',
  errorLoading:  'Failed to load data',
  errorSaving:   'Failed to save changes',
  tryAgain:      'Try again',

  login_welcome:    'Welcome back',
  login_subtitle:   'Sign in to your admin dashboard',
  login_email:      'Email address',
  login_password:   'Password',
  login_btn:        'Sign in',
  login_error:      'Invalid email or password',
  lang_switch:      'Switch to French',
  lang_switchEn:    'Switch to French',

  clinic_title:        'Clinic Information',
  clinic_subtitle:     'This information is used by the bot in its responses to patients.',
  clinic_name:         'Clinic name',
  clinic_address:      'Address',
  clinic_timezone:     'Timezone',
  clinic_defaultLang:  'Default language',
  clinic_saved:        'Clinic updated successfully',

  msg_title:    'Bot Messages',
  msg_subtitle: 'Customize every message the bot sends to your patients.',
  msg_fr:       'French',
  msg_en:       'English',
  msg_saved:    'Message saved',
  msg_hint:     'Available variables',

  spec_reactivate: 'Reactivate',
  spec_missing_fr: 'Missing French translation',
  spec_missing_en: 'Missing English translation',
  toTranslate:    'To translate',
  toTranslateEn:  'To translate',

  french:  'French',
  english: 'English',

  faq_title:    'Frequently Asked Questions',
  faq_subtitle: 'The bot uses these to automatically answer patient questions.',
  faq_add:      'New FAQ',
  faq_question: 'Question',
  faq_answer:   'Answer',
  faq_keywords: 'Keywords',
  faq_keywords_hint: 'Comma separated, e.g. hours, opening',
  faq_order:    'Order',
  faq_created:  'FAQ created',
  faq_updated:  'FAQ updated',
  faq_deleted:  'FAQ deactivated',
  faq_hard_deleted: 'FAQ deleted',

  // booking requests
  nav_bookingRequests: 'Booking Requests',
  bookingRequests_title: 'Booking Requests',
  bookingRequests_subtitle: 'Booking requests collected by the bot from patients',
  bookingRequests_patient: 'Patient',
  bookingRequests_phone: 'Phone',
  bookingRequests_preferredDate: 'Preferred date',
  bookingRequests_requestedAt: 'Requested at',
  bookingRequests_status: 'Status',
  bookingRequests_empty: 'No booking requests',
  bookingRequests_status_pending: 'Pending',
  bookingRequests_status_confirmed: 'Confirmed',
  bookingRequests_status_rejected: 'Rejected',
}

const translations = { FR: fr, EN: en }

export type TKey = keyof typeof fr

export const t = (lang: Lang, key: TKey): any => translations[lang][key] ?? key
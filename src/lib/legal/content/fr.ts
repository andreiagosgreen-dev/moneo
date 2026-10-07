import { PRO_PRICES } from '../../billing/pricingConfig';
import { DISCOUNT_CODE_VALID_DAYS } from '../../billing/rankDiscount';
import {
  ADULT_AGE,
  DIGITAL_CONSENT_AGE,
  MERCHANT_OF_RECORD,
  MIN_ACCOUNT_AGE,
  REFUND_DAYS,
  SELLER,
  SITE_URL,
  formatLegalDate,
  legalVersion,
} from '../seller';
import type { LegalSet } from '../types';

const OPERATOR = `${SELLER.name}, ${SELLER.entity.fr} établie en ${SELLER.country.fr}`;
const UPDATED = `Version ${legalVersion()} · Dernière mise à jour : ${formatLegalDate('fr')}`;
const MOR = MERCHANT_OF_RECORD;

/** French translation. The English version (en.ts) is the legally binding one. */
export const legalFr: LegalSet = {
  terms: {
    title: 'Conditions d’utilisation',
    updated: UPDATED,
    intro: [
      `Les présentes Conditions d’utilisation (les « Conditions ») régissent ton utilisation de Moneo, le minuteur de concentration et planificateur disponible sur ${SITE_URL} et sous forme d’application web installable (le « Service »). Lis-les avec notre {privacy} et notre {refund}.`,
    ],
    sections: [
      {
        heading: '1. Qui exploite Moneo',
        blocks: [`Moneo est exploité par ${OPERATOR} (« nous »). Tu peux nous joindre à {email}.`],
      },
      {
        heading: '2. Acceptation des Conditions et qui peut utiliser Moneo',
        blocks: [
          'En utilisant le Service ou en créant un compte, tu acceptes les présentes Conditions. Si tu n’es pas d’accord, n’utilise pas le Service.',
          'Moneo s’adresse aux élèves, aux étudiants et aux adultes. Tu peux l’utiliser sans compte : tes données restent alors sur ton appareil et rien ne nous est envoyé. C’est l’option la plus sûre pour les plus jeunes.',
          {
            list: [
              `Pour créer un compte, tu dois avoir au moins ${MIN_ACCOUNT_AGE} ans.`,
              `Si tu as moins de ${ADULT_AGE} ans, tu ne peux utiliser Moneo qu’avec l’autorisation d’un parent ou d’un représentant légal.`,
              `Si tu es en dessous de l’âge du consentement numérique dans ton pays (${DIGITAL_CONSENT_AGE} ans dans de nombreux pays de l’UE), un parent ou un représentant légal doit donner son accord avant la création du compte.`,
              `Un abonnement Pro pour une personne de moins de ${ADULT_AGE} ans doit être souscrit par un parent ou un représentant légal, ou avec son autorisation.`,
            ],
          },
          'Le parent ou représentant légal qui autorise un mineur à utiliser Moneo accepte les présentes Conditions au nom de celui-ci et est responsable de la supervision de cette utilisation. La capacité d’un mineur à conclure des contrats est régie par le droit applicable.',
        ],
      },
      {
        heading: '3. Le Service',
        blocks: [
          'Moneo t’aide à planifier ta journée et à faire des sessions de concentration. Il fonctionne en « local-first » : la plupart des fonctions marchent sans compte, et tes données sont stockées dans ton navigateur, sur ton appareil.',
          'Avec un compte, tu peux synchroniser tes sessions de concentration, tes domaines de concentration et tes réglages avec notre base de données cloud. Avec Pro, tes autres données de planification (projets, tâches, plans, objectifs, habitudes, entrées de journal, etc.) sont aussi enregistrées dans ton compte et synchronisées entre tes appareils. Avec la formule gratuite, ces données restent sur ton appareil.',
          'De l’aide, pas des résultats : Moneo est un outil qui t’aide à organiser ton temps, tes plans, tes habitudes et tes objectifs. Nous fournissons les outils et les suggestions ; ce que tu accomplis dépend de toi. Nous ne promettons aucun résultat particulier — par exemple de meilleures notes, la réussite d’un examen, un emploi, des revenus plus élevés, une perte de poids ou un niveau de productivité donné.',
          'Santé et exercice : Mouvement, la bibliothèque d’exercices et les programmes d’entraînement sont des informations générales, pas des conseils médicaux, de kinésithérapie ou de nutrition, et ne remplacent pas un médecin ni un coach qualifié. Parle à un médecin avant de commencer un nouveau programme d’exercice, surtout si tu as un problème de santé, une blessure ou si tu es enceinte. Arrête-toi si tu ressens une douleur, un vertige ou un essoufflement. Tu t’entraînes à tes propres risques et nous ne promettons aucun résultat particulier.',
        ],
      },
      {
        heading: '4. Ton compte',
        blocks: [
          'Tu peux t’inscrire avec une adresse e-mail et un mot de passe, ou avec Google. Indique une adresse valide, garde ton mot de passe en sécurité et préviens-nous à {email} si tu penses que quelqu’un d’autre a accédé à ton compte. Tu es responsable de l’activité de ton compte.',
          'Tu peux supprimer ton compte à tout moment depuis la page Compte (« Supprimer le compte »).',
        ],
      },
      {
        heading: '5. Formules gratuite et Pro',
        blocks: [
          'La formule gratuite n’a pas de limite de durée. Elle comprend le minuteur de concentration et un nombre limité de projets, d’objectifs, d’habitudes et d’autres éléments. Nous pouvons ajuster ces limites à l’avenir ; nous ne supprimerons pas les données que tu as déjà créées à cause d’un changement de limite.',
          `Pro est un abonnement payant : ${PRO_PRICES.monthly} par mois ou ${PRO_PRICES.yearly} par an. Selon ton lieu de résidence, des taxes comme la TVA peuvent s’ajouter au paiement. La liste à jour des fonctions Pro figure sur la page des tarifs.`,
          'Essai Pro gratuit : chaque nouveau compte bénéficie de Pro gratuitement pendant 7 jours à partir de l’inscription, sans carte. À la fin des 7 jours, le compte repasse au plan gratuit si tu ne t’abonnes pas ; rien n’est prélevé automatiquement et tes données restent. L’essai est proposé une seule fois par compte.',
          `Réductions de rang : lorsqu’un compte sans Pro atteint certains rangs XP, nous pouvons proposer un code de réduction pour le premier mois de Pro mensuel. Chaque code est à usage unique, valable ${DISCOUNT_CODE_VALID_DAYS} jours, s’applique uniquement au premier paiement mensuel et est limité à un par compte. Le rang pris en compte est calculé par nous à partir de l’activité synchronisée avec ton compte. Les codes de réduction n’ont aucune valeur monétaire, ne sont pas transférables et ne constituent pas un droit ; nous pouvons modifier, suspendre ou arrêter ces offres à tout moment, sans affecter un code déjà émis et encore valable.`,
        ],
      },
      {
        heading: `6. Paiements via ${MOR}`,
        blocks: [
          `Les abonnements Pro sont vendus par ${MOR}, notre revendeur et Merchant of Record. ${MOR} traite ton paiement, perçoit et reverse les taxes applicables, émet tes reçus et factures et traite les remboursements. En achetant Pro, tu acceptes également les conditions acheteur de ${MOR}, qui s’appliquent à l’achat lui-même.`,
          'Nous ne voyons ni ne stockons jamais l’intégralité des données de ta carte. Nous recevons uniquement les informations nécessaires pour relier l’abonnement à ton compte Moneo (par exemple le statut, la formule et la date de renouvellement).',
        ],
      },
      {
        heading: '7. Renouvellement automatique et résiliation',
        blocks: [
          'Les abonnements se renouvellent automatiquement à la fin de chaque période de facturation (mensuelle ou annuelle) et sont prélevés sur ton moyen de paiement jusqu’à ce que tu résilies.',
          'Tu peux résilier à tout moment depuis le portail client (Compte → Gérer l’abonnement) ou en écrivant à {email}. La résiliation arrête les renouvellements futurs ; tu gardes Pro jusqu’à la fin de la période déjà payée, puis ton compte repasse en formule gratuite.',
          'Si nous modifions le prix de Pro, nous te prévenons à l’avance. Le nouveau prix ne s’applique qu’à partir de ton prochain renouvellement, et tu peux résilier avant son entrée en vigueur.',
        ],
      },
      {
        heading: '8. Remboursements',
        blocks: [
          `Tu peux obtenir un remboursement intégral dans les ${REFUND_DAYS} jours suivant un paiement, sans justification. Les détails et la démarche figurent dans notre {refund}.`,
        ],
      },
      {
        heading: '9. Utilisation acceptable',
        blocks: [
          'Tu t’engages à ne pas :',
          {
            list: [
              'enfreindre la loi ou les droits d’autrui en utilisant le Service ;',
              'tenter d’accéder aux données d’autres utilisateurs, ni sonder, scanner ou attaquer nos systèmes ;',
              'contourner les limites des formules, les paiements ou les mesures de sécurité, ni revendre le Service ;',
              'surcharger le Service par des requêtes automatisées ni l’utiliser pour envoyer du spam ou des logiciels malveillants.',
            ],
          },
        ],
      },
      {
        heading: '10. Ton contenu',
        blocks: [
          'Tout ce que tu crées dans Moneo t’appartient : sessions, tâches, notes et autres données. Nous n’en revendiquons pas la propriété.',
          'Tu nous accordes uniquement l’autorisation limitée nécessaire pour stocker, synchroniser et t’afficher ton contenu afin de faire fonctionner le Service. Nous ne vendons pas tes données et ne les utilisons pas à des fins publicitaires.',
        ],
      },
      {
        heading: '11. Fonctions d’IA',
        blocks: [
          'Certaines fonctions suggèrent des plans, des étapes ou des réponses. Elles peuvent utiliser des règles sur l’appareil ou un modèle d’IA. Les résultats de l’IA peuvent être erronés, incomplets ou obsolètes. Ils ne constituent pas un conseil professionnel (médical, juridique, financier ou autre). Vérifie les suggestions avant de t’y fier.',
          'Pro inclut jusqu’à 3 plans IA par jour, générés via notre serveur avec Cloudflare Workers AI. Nous pouvons ajuster ce quota pour que le Service reste viable ; une fois épuisé, ou si l’IA est indisponible, les plans sont créés sur ton appareil.',
          'Les utilisateurs Pro peuvent aussi connecter leur propre clé API d’un fournisseur d’IA (par exemple Google Gemini, OpenAI ou DeepSeek). Ta clé est stockée uniquement dans ton navigateur. Les requêtes partent directement de ton navigateur vers ce fournisseur, dans le cadre de ton propre accord avec lui. Tu es responsable de ta clé, des éventuels frais du fournisseur et du respect de ses conditions. Évite d’envoyer des données personnelles sensibles aux fonctions d’IA.',
        ],
      },
      {
        heading: '12. Services tiers',
        blocks: [
          'Les intégrations facultatives, comme la connexion avec Google ou Google Agenda, sont fournies par des tiers selon leurs propres conditions. Nous ne sommes pas responsables des services que nous ne contrôlons pas.',
        ],
      },
      {
        heading: '13. Disponibilité et évolution du Service',
        blocks: [
          'Nous faisons notre possible pour que Moneo reste disponible et que tes données soient en sécurité, mais nous ne pouvons pas garantir un Service toujours ininterrompu ou sans erreur. Comme les données sont d’abord stockées sur ton appareil, effacer les données de ton navigateur peut les supprimer. Garde tes propres sauvegardes de tout ce qui est important (par exemple avec l’export JSON gratuit dans les Réglages).',
          'Nous pouvons ajouter, modifier ou retirer des fonctions. Si nous cessons totalement de proposer Pro, nous remboursons la part non utilisée de tout abonnement prépayé.',
        ],
      },
      {
        heading: '14. Absence de garantie',
        blocks: [
          'Dans la mesure permise par la loi, le Service est fourni « en l’état » et « selon disponibilité », sans garantie d’aucune sorte, expresse ou implicite, y compris d’adéquation à un usage particulier. Rien dans les présentes Conditions ne limite les droits dont tu disposes en tant que consommateur en vertu de dispositions impératives.',
        ],
      },
      {
        heading: '15. Limitation de responsabilité',
        blocks: [
          'Dans la mesure permise par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives, telles que la perte de bénéfices, de données ou d’opportunités. Notre responsabilité totale pour toute réclamation liée au Service est limitée au montant que tu as payé pour Moneo au cours des 12 mois précédant la réclamation.',
          'Ces limites ne s’appliquent pas à la responsabilité qui ne peut être limitée par la loi, comme la faute intentionnelle, la faute lourde, ou le décès ou les dommages corporels causés par négligence.',
        ],
      },
      {
        heading: '16. Résiliation',
        blocks: [
          'Tu peux arrêter d’utiliser Moneo à tout moment et supprimer ton compte depuis la page Compte.',
          'Nous pouvons suspendre ou fermer un compte qui enfreint gravement ou de façon répétée les présentes Conditions, ou lorsque la loi l’exige. Lorsque c’est raisonnable, nous te prévenons d’abord et te laissons la possibilité d’exporter tes données. Si nous fermons ton compte sans manquement de ta part, nous remboursons la part non utilisée de tout abonnement prépayé.',
        ],
      },
      {
        heading: '17. Modification des présentes Conditions',
        blocks: [
          'Nous pouvons mettre à jour les présentes Conditions. En cas de changement important, nous te prévenons dans l’application ou par e-mail avant son entrée en vigueur. La date de « Dernière mise à jour » ci-dessus indique la version en vigueur. Si tu continues d’utiliser le Service après l’entrée en vigueur d’un changement, les nouvelles Conditions s’appliquent ; si tu n’es pas d’accord, tu peux résilier et supprimer ton compte.',
        ],
      },
      {
        heading: '18. Droit applicable',
        blocks: [
          `Les présentes Conditions sont régies par le droit de la ${SELLER.country.fr}, et les litiges relèvent de ses tribunaux compétents.`,
          'Si tu es un consommateur résidant dans l’Union européenne ou dans l’Espace économique européen, tu conserves également la protection des lois impératives de protection des consommateurs de ton pays de résidence et tu peux saisir les tribunaux de ce pays.',
        ],
      },
      {
        heading: '19. Contact',
        blocks: [`Des questions sur ces Conditions ? Écris à ${SELLER.initials} à {email}.`],
      },
    ],
  },

  privacy: {
    title: 'Politique de confidentialité',
    updated: UPDATED,
    intro: [
      'Cette politique explique quelles données personnelles Moneo traite, pourquoi, qui nous aide à les traiter, et quels sont tes choix et tes droits. Moneo fonctionne en « local-first » : par défaut, tes données restent dans ton navigateur, sur ton appareil.',
    ],
    sections: [
      {
        heading: '1. Qui est responsable de tes données',
        blocks: [`Le responsable du traitement est ${OPERATOR}. Contact : {email}.`],
      },
      {
        heading: '2. Les données qui restent sur ton appareil',
        blocks: [
          'Tout ce que tu crées est d’abord enregistré dans le stockage local de ton navigateur, sur ton appareil : sessions de concentration, domaines de concentration, réglages, projets, tâches, plans du jour, blocs de temps, objectifs, OKR, compétences, habitudes, entrées de journal et d’énergie, historique de discussion avec l’assistant et données similaires. Nous ne voyons pas ces données. Elles restent sur ton appareil tant que tu n’actives pas la synchronisation cloud (voir ci-dessous).',
          'Si tu ajoutes ta propre clé API d’un fournisseur d’IA, elle est également stockée uniquement dans ton navigateur. Elle n’est jamais envoyée aux serveurs de Moneo.',
        ],
      },
      {
        heading: '3. Les données que nous traitons',
        blocks: [
          {
            list: [
              'Compte : ton adresse e-mail, un mot de passe haché (si tu en utilises un), la méthode de connexion et les horodatages du compte, gérés par notre fournisseur d’authentification. Si tu te connectes avec Google, nous recevons de Google ton adresse e-mail et des données de profil de base.',
              'Profil : ton fuseau horaire, pour compter correctement tes journées.',
              'Synchronisation cloud (avec un compte, seulement après l’avoir activée) : sessions de concentration (durée, heure, texte d’intention, domaine), domaines de concentration, tes réglages et un identifiant d’appareil aléatoire servant à fusionner les modifications entre appareils.',
              'Synchronisation complète (Pro uniquement, si la synchronisation est activée) : tes autres données de planification — projets, tâches, objectifs, OKR, habitudes et validations d’habitudes, entrées de journal et d’énergie, domaines de vie et carte de vie, compétences, blocs de temps, plans du jour, sprints, réglages du tableau, plans en cascade, liens, filtres enregistrés et feuilles de route — avec l’heure de dernière modification ou suppression de chaque élément. L’historique de discussion avec l’assistant et les clés d’IA ne sont pas synchronisés. Si Pro prend fin, la copie déjà présente dans ton compte est conservée mais n’est plus mise à jour, et les données de ton appareil ne sont pas touchées.',
              'Abonnement : formule, statut, date de renouvellement et identifiants client et d’abonnement Lemon Squeezy, reçus de Lemon Squeezy pour savoir si tu as Pro.',
              'Focus buddy (facultatif, Pro) : si tu te jumelles avec un buddy, un code d’invitation et le jumelage ; ton buddy ne voit que tes minutes de concentration du jour.',
              'Google Agenda (facultatif, Pro) : si tu le connectes, un jeton qui nous permet de lire tes événements (lecture seule) pour signaler les conflits avec ton plan. Les événements sont récupérés au besoin et ne sont pas stockés par nous. Tu peux le déconnecter à tout moment.',
              'Rapports d’erreur : si l’application plante, un message d’erreur technique et une trace de pile. Les rapports ne sont pas liés à ton compte et ne sont pas censés contenir ton contenu.',
              'Données de sécurité : adresse IP et données de requête, traitées brièvement par notre hébergeur et par la protection anti-robots du formulaire de connexion, pour protéger le Service contre les abus.',
              'Statistiques d’utilisation : Cloudflare Web Analytics compte les pages vues et mesure la vitesse des pages. Il enregistre l’adresse de la page, le site référent, le pays ainsi que le type de navigateur et d’appareil, et ne nous montre que des totaux agrégés. Il n’utilise pas de cookies, n’utilise pas le stockage de ton navigateur pour te suivre, ne t’identifie pas et ne te suit pas sur d’autres sites.',
              'Compteurs produit anonymes : lorsque tu atteins certaines étapes dans l’application (par exemple terminer les étapes de bienvenue, ta première session de concentration ou l’ouverture du paiement), Moneo compte l’étape uniquement avec la formule choisie et la langue de l’interface — sans identifiant de compte, adresse IP, identifiant d’appareil ni contenu — afin de voir quelles parties de Moneo fonctionnent. Nous notons aussi le canal qui t’a amené — un libellé de campagne dans le lien (par exemple utm_source=tiktok) ou le nom du site d’origine — et ne gardons ce court libellé que dans la page ouverte, sans l’enregistrer dans ton navigateur, pour voir quels canaux mènent aux inscriptions et aux abonnements ; il ne t’identifie pas. Activer Do Not Track ou Global Privacy Control dans ton navigateur arrête ces compteurs.',
              'Messages que tu nous envoies : ton adresse e-mail et le contenu de ton message.',
            ],
          },
          'Les données de facturation (nom, adresse de facturation, données de carte) sont collectées et conservées par Lemon Squeezy en tant que Merchant of Record, et non par Moneo.',
        ],
      },
      {
        heading: '4. Fonctions d’IA',
        blocks: [
          'Par défaut, les plans de type IA sont créés sur ton appareil par des règles simples, et rien n’est envoyé nulle part.',
          'Plans IA inclus (Pro) : seuls le texte de l’objectif (jusqu’à 500 caractères), l’horizon, les heures par semaine et le niveau sont envoyés via notre serveur à Cloudflare Workers AI. Aucune session, tâche, entrée de journal ni donnée de compte ; la requête et la réponse ne sont pas conservées par nous, et Cloudflare ne les utilise pas pour entraîner des modèles. Nous comptons seulement combien de plans chaque compte a créés par jour (supprimé après deux jours).',
          'Séances avec IA (Pro) : seuls la description que tu tapes (jusqu’à 300 caractères) et la liste des exercices que tu peux faire (nom, muscle principal, matériel, niveau) sont envoyés via notre serveur à Cloudflare Workers AI. Rien n’est conservé et le texte n’est pas journalisé. En gratuit, le même texte est lu sur ton appareil et n’est envoyé nulle part.',
          'Si tu as Pro et ajoutes ta propre clé API pour Google Gemini, OpenAI ou DeepSeek, l’objectif que tu saisis et tes paramètres de planification (horizon, heures par semaine, niveau) sont envoyés directement de ton navigateur à ce fournisseur. Ce fournisseur les traite selon sa propre politique de confidentialité, en tant que ton prestataire, et non le nôtre.',
          'La saisie vocale de l’assistant utilise la reconnaissance vocale intégrée de ton navigateur. Certains navigateurs (par exemple Chrome) envoient l’audio aux serveurs de l’éditeur du navigateur pour le transcrire.',
        ],
      },
      {
        heading: '5. Pourquoi nous utilisons tes données (bases légales)',
        blocks: [
          'Nous traitons les données personnelles conformément au Règlement général sur la protection des données (RGPD) pour les utilisateurs de l’UE/EEE, et à la loi de la République de Moldavie n° 195/2024 sur la protection des données à caractère personnel, en vigueur depuis le 23 août 2026 (elle a remplacé la loi n° 133/2011).',
          {
            list: [
              'Pour fournir le Service que tu as demandé — compte, synchronisation, fonctions Pro et statut de facturation (exécution du contrat).',
              'Pour garder le Service sûr et opérationnel — protection anti-robots, limitation du débit et rapports d’erreur (notre intérêt légitime à disposer d’une application sûre et fiable).',
              'Pour comprendre, de manière agrégée, quelles pages sont utilisées et à quelle vitesse elles se chargent — Cloudflare Web Analytics sans cookies (notre intérêt légitime à améliorer le Service).',
              'Pour les fonctions facultatives que tu actives — Google Agenda, focus buddy, ta propre clé d’IA (ton consentement, que tu peux retirer à tout moment en désactivant la fonction).',
              'Pour respecter nos obligations légales, par exemple conserver des documents lorsque la loi l’exige.',
              'Pour t’envoyer un e-mail de bienvenue après la création de ton compte, un e-mail le 5e jour de l’essai Pro gratuit (seulement si tu ne t’es pas abonné) et, si tu n’as pas utilisé Moneo pendant une semaine, un seul rappel. Chacun contient un lien de désabonnement en un clic (notre intérêt légitime à t’aider à bien démarrer ; tu peux t’y opposer à tout moment).',
            ],
          },
        ],
      },
      {
        heading: '6. Prestataires (sous-traitants)',
        blocks: [
          'Nous faisons appel à ces prestataires pour faire fonctionner Moneo. Ils traitent les données uniquement sur nos instructions ou, lorsque c’est indiqué, en tant que responsables indépendants :',
          {
            list: [
              'Supabase — authentification et base de données cloud (hébergée dans l’UE, en Irlande). Envoie aussi les e-mails de connexion, de confirmation et de réinitialisation du mot de passe, directement ou via un service d’envoi d’e-mails que nous configurons.',
              'Cloudflare — hébergement, diffusion de contenu, sécurité, protection anti-robots Turnstile sur les formulaires de connexion et Web Analytics sans cookies (réseau mondial).',
              'Lemon Squeezy — paiement, transactions, taxes, factures et remboursements en tant que Merchant of Record (responsable indépendant pour les données de facturation ; États-Unis).',
              'Google — connexion avec Google et, si tu le connectes, Google Agenda (États-Unis).',
              'Sentry (Functional Software, Inc.) — rapports d’erreur (données stockées dans l’UE, en Allemagne).',
              'GitHub (Microsoft) — stocke nos sauvegardes hebdomadaires chiffrées de la base de données (États-Unis).',
              'Les fournisseurs d’IA que tu choisis toi-même (Google Gemini, OpenAI, DeepSeek) — uniquement si tu ajoutes ta propre clé.',
              'Resend — envoie les e-mails de Moneo : connexion, confirmation et réinitialisation du mot de passe, ainsi que les e-mails de bienvenue, d’essai et de rappel (États-Unis).',
              'Cloudflare Workers AI — génère les plans IA inclus dans Pro (reçoit seulement le texte de l’objectif et les réglages du plan ; rien n’est conservé).',
            ],
          },
          'Nous ne vendons pas tes données personnelles et ne les partageons ni avec des annonceurs ni avec des courtiers en données.',
        ],
      },
      {
        heading: '7. Transferts internationaux',
        blocks: [
          'Certains prestataires sont situés hors de ton pays, notamment aux États-Unis et, pour DeepSeek si tu le choisis, en Chine. Lorsque le RGPD s’applique, les transferts reposent sur des décisions d’adéquation (comme le Data Privacy Framework UE–États-Unis pour les prestataires certifiés) ou sur les clauses contractuelles types de la Commission européenne.',
          'Pour les utilisateurs en République de Moldavie, les mêmes garanties s’appliquent aux transferts, conformément à la loi n° 195/2024.',
        ],
      },
      {
        heading: '8. Durée de conservation',
        blocks: [
          {
            list: [
              'Données sur ton appareil : jusqu’à ce que tu les supprimes ou effaces les données de ton navigateur.',
              'Données du compte et du cloud : jusqu’à la suppression de ton compte. La suppression les retire immédiatement de notre base de données active ; les copies dans les sauvegardes chiffrées expirent sous 30 jours.',
              'Rapports d’erreur : jusqu’à 90 jours.',
              'Statistiques d’utilisation : conservées par Cloudflare uniquement sous forme de totaux agrégés qui ne t’identifient pas.',
              'Journaux de sécurité chez notre hébergeur : de courtes durées, généralement quelques jours.',
              'E-mails au support : le temps nécessaire pour traiter ta demande, et au maximum 2 ans.',
              'Documents de facturation : conservés par Lemon Squeezy aussi longtemps que l’exigent les lois fiscales et comptables.',
              'Compteurs anonymes du produit (par étape, formule, langue et canal) : jusqu’à 3 mois, puis supprimés automatiquement.',
            ],
          },
        ],
      },
      {
        heading: '9. Tes droits et tes choix',
        blocks: [
          'Tu disposes des droits suivants sur tes données personnelles :',
          {
            list: [
              'Accès : obtenir une copie des données personnelles que nous détenons sur toi.',
              'Rectification : faire corriger les données inexactes ou incomplètes.',
              'Effacement (« droit à l’oubli ») : faire supprimer tes données.',
              'Limitation du traitement : faire limiter la manière dont nous traitons tes données.',
              'Portabilité : recevoir tes données dans un format structuré et lisible par machine.',
              'Opposition : t’opposer au traitement fondé sur notre intérêt légitime.',
              'Retrait du consentement : à tout moment, sans remettre en cause le traitement effectué avant.',
              'Ne pas faire l’objet d’une décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques ou similaires (Moneo ne prend aucune décision de ce type à ton sujet).',
            ],
          },
          'Comment les exercer :',
          {
            list: [
              'Supprimer les données de cet appareil : Réglages → « Supprimer toutes les données de cet appareil ».',
              'Supprimer ton compte et tes données cloud : Compte → « Supprimer le compte ». Si tu as un abonnement actif, résilie-le d’abord dans le portail client.',
              'Accès et portabilité : dans les Réglages, chacun peut exporter gratuitement toutes ses données Moneo dans un fichier JSON et les importer sur un autre appareil. Pro ajoute des formats de rapport supplémentaires (CSV/PDF). Pour toute autre demande, écris à {email}.',
              'Arrête la synchronisation cloud en te déconnectant ; tes données restent sur ton appareil.',
            ],
          },
          'Nous répondons aux demandes dans un délai d’un mois. Tu peux aussi déposer une plainte auprès d’une autorité de protection des données : en République de Moldavie, le Centre national pour la protection des données à caractère personnel (CNPDCP) ; dans l’UE/EEE, l’autorité de ton pays de résidence (en France, la CNIL).',
        ],
      },
      {
        heading: '10. Cookies et stockage local',
        blocks: [
          'Moneo n’utilise ni cookies publicitaires, ni traceurs publicitaires, ni pixels de suivi, ni suivi intersites. Pour les statistiques d’utilisation, nous utilisons Cloudflare Web Analytics, qui fonctionne sans cookies et ne stocke rien dans ton navigateur pour te reconnaître. Nous utilisons le stockage local de ton navigateur pour enregistrer tes données et ta session de connexion, ce qui est strictement nécessaire au fonctionnement de l’application. Cloudflare et Turnstile peuvent déposer des cookies de sécurité strictement nécessaires pour distinguer les humains des robots. Le paiement Lemon Squeezy, qui s’ouvre sur le site de Lemon Squeezy, utilise ses propres cookies.',
          'Les polices sont servies depuis notre propre domaine ; nous ne chargeons ni Google Fonts ni d’autres traceurs tiers.',
        ],
      },
      {
        heading: '11. Sécurité',
        blocks: [
          'Les données transitent par des connexions chiffrées (HTTPS/TLS). Les données cloud sont protégées par des règles d’accès afin que seul ton compte puisse les lire, et les sauvegardes de la base de données sont chiffrées. Moneo n’est pas chiffré de bout en bout, et aucun système n’est sûr à 100 % ; utilise donc un mot de passe fort et unique.',
          'Si un incident de sécurité met des données personnelles en danger, nous le notifions à l’autorité compétente — en République de Moldavie, le Centre national pour la protection des données à caractère personnel (CNPDCP) — dans les 72 heures après en avoir pris connaissance, et nous informons sans retard injustifié les utilisateurs concernés lorsque le risque pour eux est élevé. Nous tenons un registre interne des activités de traitement et des éventuels incidents.',
        ],
      },
      {
        heading: '12. Enfants et élèves',
        blocks: [
          `Moneo est utilisé par des élèves, des étudiants et des adultes. Un compte nécessite un âge minimum de ${MIN_ACCOUNT_AGE} ans. Les utilisateurs de moins de ${ADULT_AGE} ans ont besoin de l’autorisation d’un parent ou d’un représentant légal et, en dessous de l’âge du consentement numérique de leur pays (${DIGITAL_CONSENT_AGE} ans dans de nombreux pays de l’UE), un parent ou un représentant légal doit consentir à la création du compte.`,
          {
            list: [
              'Sans compte, rien ne nous est envoyé : toutes les données restent sur l’appareil. C’est la façon la plus sûre pour les plus jeunes d’utiliser Moneo.',
              'Avec un compte, nous collectons auprès des mineurs les mêmes données minimales que pour tout le monde (voir la section 3) — rien de plus.',
              'Pas de publicité, pas de profilage et pas de vente de données — pour personne, mineurs compris.',
              'Les parents et représentants légaux peuvent demander à consulter, exporter ou supprimer les données de leur enfant en écrivant à {email}.',
              `Si nous apprenons qu’un enfant de moins de ${MIN_ACCOUNT_AGE} ans a créé un compte, nous supprimons le compte et ses données.`,
            ],
          },
        ],
      },
      {
        heading: '13. Modifications de cette politique',
        blocks: [
          'Nous pouvons mettre à jour cette politique. En cas de changement important, nous te prévenons dans l’application ou par e-mail. La date de « Dernière mise à jour » ci-dessus indique la version en vigueur.',
        ],
      },
      {
        heading: '14. Contact',
        blocks: [
          `Pour toute question ou demande relative à la confidentialité, écris à ${SELLER.initials} à {email}.`,
        ],
      },
    ],
  },

  refund: {
    title: 'Politique de remboursement',
    updated: UPDATED,
    intro: [
      `Nous voulons que tu sois satisfait de Moneo Pro. Si ce n’est pas le cas, tu peux être remboursé dans les ${REFUND_DAYS} jours — sans justification.`,
    ],
    sections: [
      {
        heading: `1. Garantie satisfait ou remboursé de ${REFUND_DAYS} jours`,
        blocks: [
          `Tu peux demander le remboursement intégral de tout paiement Pro — premier achat ou renouvellement, mensuel ou annuel — dans les ${REFUND_DAYS} jours suivant la date du paiement. Tu n’as pas à donner de raison.`,
        ],
      },
      {
        heading: '2. Comment demander un remboursement',
        blocks: [
          {
            list: [
              'Écris à {email} depuis l’adresse utilisée lors du paiement, ou indique cette adresse et ton numéro de commande (il figure dans l’e-mail de reçu de Lemon Squeezy).',
              'Ou retrouve ta commande dans l’e-mail de reçu de Lemon Squeezy ou sur {orders} et demande le remboursement depuis là.',
            ],
          },
        ],
      },
      {
        heading: '3. Qui traite le remboursement',
        blocks: [
          `Les paiements sont gérés par ${MOR}, notre Merchant of Record. Une fois ta demande approuvée, ${MOR} reverse l’argent sur ton moyen de paiement d’origine, taxes comprises. Le remboursement apparaît généralement sous 5 à 10 jours ouvrés, selon ta banque ou l’émetteur de ta carte.`,
        ],
      },
      {
        heading: '4. Ce qu’il advient de Pro après un remboursement',
        blocks: [
          'Un remboursement résilie aussi l’abonnement : tu ne seras plus débité. Les fonctions Pro prennent fin lorsque le remboursement est traité, et ton compte repasse en formule gratuite.',
          'Tes données ne sont pas supprimées : tout ce qui se trouve sur ton appareil y reste, et les données déjà synchronisées avec ton compte y restent jusqu’à la suppression du compte. La synchronisation complète de toutes tes données est une fonction Pro ; elle cesse donc d’être mise à jour. Les sessions de concentration, les domaines de concentration et les réglages continuent d’être synchronisés.',
        ],
      },
      {
        heading: '5. Résilier n’est pas se faire rembourser',
        blocks: [
          {
            list: [
              'Résilier : arrête les renouvellements futurs. Tu gardes Pro jusqu’à la fin de la période déjà payée. Aucun argent n’est rendu. Tu peux résilier à tout moment dans le portail client (Compte → Gérer l’abonnement).',
              `Remboursement : rend l’argent d’un paiement effectué au cours des ${REFUND_DAYS} derniers jours et met fin à Pro immédiatement.`,
            ],
          },
        ],
      },
      {
        heading: `6. Après ${REFUND_DAYS} jours`,
        blocks: [
          `Après ${REFUND_DAYS} jours, les paiements ne sont en principe pas remboursables, mais tu peux toujours résilier à tout moment pour arrêter les prélèvements futurs. Nous corrigeons toujours les erreurs de facturation, comme un double prélèvement, et nous remboursons lorsque la loi l’exige. Si nous cessons de proposer Pro, nous remboursons la part non utilisée de toute période prépayée.`,
          `Cette politique ne limite aucun des droits que te confère le droit impératif de la consommation, y compris le droit de rétractation de l’UE, déjà couvert par cette garantie de ${REFUND_DAYS} jours.`,
        ],
      },
      {
        heading: '7. Contact',
        blocks: [
          `Des questions sur la facturation ou les remboursements ? Écris à {email}. Voir aussi nos {terms}.`,
        ],
      },
    ],
  },
};

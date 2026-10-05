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
} from '../seller';
import type { LegalSet } from '../types';

const OPERATOR = `${SELLER.name}, ${SELLER.entity.es} con domicilio en la ${SELLER.country.es}`;
const UPDATED = `Última actualización: ${formatLegalDate('es')}`;
const MOR = MERCHANT_OF_RECORD;

/** Spanish translation. The English version (en.ts) is the legally binding one. */
export const legalEs: LegalSet = {
  terms: {
    title: 'Términos del servicio',
    updated: UPDATED,
    intro: [
      `Estos Términos del servicio (los «Términos») regulan el uso de Moneo, el temporizador de enfoque y planificador disponible en ${SITE_URL} y como aplicación web instalable (el «Servicio»). Léelos junto con nuestra {privacy} y nuestra {refund}.`,
    ],
    sections: [
      {
        heading: '1. Quién opera Moneo',
        blocks: [`Moneo está operado por ${OPERATOR} («nosotros»). Puedes escribirnos a {email}.`],
      },
      {
        heading: '2. Aceptación de estos Términos y quién puede usar Moneo',
        blocks: [
          'Al usar el Servicio o crear una cuenta, aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.',
          'Moneo está pensado para estudiantes de escuela, universitarios y adultos. Puedes usarlo sin cuenta: tus datos se quedan en tu dispositivo y no se nos envía nada. Es la opción más segura para los usuarios más jóvenes.',
          {
            list: [
              `Para crear una cuenta debes tener al menos ${MIN_ACCOUNT_AGE} años.`,
              `Si tienes menos de ${ADULT_AGE} años, solo puedes usar Moneo con el permiso de tu madre, padre o tutor legal.`,
              `Si estás por debajo de la edad de consentimiento digital de tu país (${DIGITAL_CONSENT_AGE} años en muchos países de la UE), tu madre, padre o tutor legal debe aceptarlo antes de crear la cuenta.`,
              `Una suscripción Pro para una persona menor de ${ADULT_AGE} años debe contratarla su madre, padre o tutor legal, o hacerse con su permiso.`,
            ],
          },
          'La madre, el padre o el tutor legal que permite a un menor usar Moneo acepta estos Términos en su nombre y es responsable de supervisar ese uso. La capacidad de un menor para celebrar contratos se rige por la ley aplicable.',
        ],
      },
      {
        heading: '3. El Servicio',
        blocks: [
          'Moneo te ayuda a planificar tu día y a hacer sesiones de enfoque. Funciona como «local-first»: la mayoría de las funciones van sin cuenta y tus datos se guardan en tu navegador, en tu dispositivo.',
          'Con una cuenta puedes sincronizar tus sesiones de enfoque, áreas de enfoque y ajustes con nuestra base de datos en la nube. Con Pro, el resto de tus datos de planificación (proyectos, tareas, planes, objetivos, hábitos, entradas del diario y similares) también se guardan en tu cuenta y se sincronizan entre tus dispositivos. En el plan gratuito, esos datos se quedan en tu dispositivo.',
          'Ayuda, no resultados: Moneo es una herramienta que te ayuda a organizar tu tiempo, tus planes, tus hábitos y tus objetivos. Nosotros damos las herramientas y las sugerencias; lo que consigas depende de ti. No prometemos ningún resultado concreto, por ejemplo mejores notas, aprobar un examen, un empleo, más ingresos, perder peso o un nivel determinado de productividad.',
          'Salud y ejercicio: Movimiento, la biblioteca de ejercicios y los programas de entrenamiento son información general, no consejo médico, de fisioterapia ni de nutrición, y no sustituyen a un médico ni a un entrenador cualificado. Consulta a un médico antes de empezar un nuevo programa de ejercicio, sobre todo si tienes una enfermedad, una lesión o estás embarazada. Detente si sientes dolor, mareo o falta de aire. Haces ejercicio bajo tu propia responsabilidad y no prometemos ningún resultado concreto.',
        ],
      },
      {
        heading: '4. Tu cuenta',
        blocks: [
          'Puedes registrarte con un correo electrónico y una contraseña o con Google. Indica un correo válido, guarda tu contraseña de forma segura y avísanos en {email} si crees que otra persona ha accedido a tu cuenta. Eres responsable de la actividad de tu cuenta.',
          'Puedes eliminar tu cuenta en cualquier momento desde la página Cuenta («Eliminar cuenta»).',
        ],
      },
      {
        heading: '5. Planes gratuito y Pro',
        blocks: [
          'El plan gratuito no tiene límite de tiempo. Incluye el temporizador de enfoque y un número limitado de proyectos, objetivos, hábitos y otros elementos. Podemos ajustar los límites del plan gratuito en el futuro; no eliminaremos datos que ya hayas creado por un cambio de límite.',
          `Pro es una suscripción de pago: ${PRO_PRICES.monthly} al mes o ${PRO_PRICES.yearly} al año. Según dónde vivas, al pagar pueden añadirse impuestos como el IVA. La lista actual de funciones Pro aparece en la página de precios.`,
          'Prueba gratuita: cuando la página de precios ofrece una prueba, está disponible una sola vez para cada cuenta que nunca haya tenido suscripción. No se te cobra si cancelas antes de que termine la prueba; en caso contrario, la suscripción empieza y se renueva al precio indicado.',
          `Descuentos por rango: cuando una cuenta sin Pro alcanza ciertos rangos de XP, podemos ofrecer un código de descuento para el primer mes de Pro mensual. Cada código es de un solo uso, válido durante ${DISCOUNT_CODE_VALID_DAYS} días, se aplica solo al primer pago mensual y está limitado a uno por cuenta. El rango que se usa lo calculamos nosotros a partir de la actividad sincronizada con tu cuenta. Los códigos de descuento no tienen valor monetario, no son transferibles y no constituyen un derecho; podemos cambiar, pausar o terminar estas ofertas en cualquier momento, sin afectar a un código ya emitido y todavía válido.`,
        ],
      },
      {
        heading: `6. Pagos a través de ${MOR}`,
        blocks: [
          `Las suscripciones Pro las vende ${MOR}, nuestro revendedor y Merchant of Record. ${MOR} procesa tu pago, cobra y liquida los impuestos aplicables, emite tus recibos y facturas y tramita los reembolsos. Al comprar Pro, también aceptas las condiciones para compradores de ${MOR}, que se aplican a la propia compra.`,
          'Nunca vemos ni guardamos los datos completos de tu tarjeta. Solo recibimos la información necesaria para vincular la suscripción con tu cuenta de Moneo (por ejemplo, el estado, el plan y la fecha de renovación).',
        ],
      },
      {
        heading: '7. Renovación automática y cancelación',
        blocks: [
          'Las suscripciones se renuevan automáticamente al final de cada periodo de facturación (mensual o anual) y se cargan a tu método de pago hasta que canceles.',
          'Puedes cancelar en cualquier momento desde el portal de cliente (Cuenta → Gestionar suscripción) o escribiendo a {email}. La cancelación detiene las renovaciones futuras; mantienes Pro hasta el final del periodo ya pagado y después tu cuenta vuelve al plan gratuito.',
          'Si cambiamos el precio de Pro, te avisaremos con antelación. El nuevo precio solo se aplica a partir de tu próxima renovación, y puedes cancelar antes de que entre en vigor.',
        ],
      },
      {
        heading: '8. Reembolsos',
        blocks: [
          `Puedes obtener el reembolso total dentro de los ${REFUND_DAYS} días siguientes a un pago, sin dar explicaciones. Los detalles y cómo solicitarlo están en nuestra {refund}.`,
        ],
      },
      {
        heading: '9. Uso aceptable',
        blocks: [
          'Te comprometes a no:',
          {
            list: [
              'infringir la ley ni los derechos de otras personas al usar el Servicio;',
              'intentar acceder a datos de otros usuarios, ni sondear, escanear o atacar nuestros sistemas;',
              'eludir los límites de los planes, los pagos o las medidas de seguridad, ni revender el Servicio;',
              'sobrecargar el Servicio con solicitudes automatizadas ni usarlo para enviar spam o software malicioso.',
            ],
          },
        ],
      },
      {
        heading: '10. Tu contenido',
        blocks: [
          'Todo lo que creas en Moneo es tuyo: sesiones, tareas, notas y otros datos. No reclamamos su propiedad.',
          'Solo nos concedes el permiso limitado necesario para guardar, sincronizar y mostrarte tu contenido, de modo que podamos prestar el Servicio. No vendemos tus datos ni los usamos para publicidad.',
        ],
      },
      {
        heading: '11. Funciones de IA',
        blocks: [
          'Algunas funciones sugieren planes, pasos o respuestas. Pueden usar reglas en el dispositivo o un modelo de IA. Los resultados de la IA pueden ser erróneos, incompletos o estar desactualizados. No son asesoramiento profesional (médico, jurídico, financiero ni de otro tipo). Revisa las sugerencias antes de confiar en ellas.',
          'Pro incluye hasta 3 planes de IA al día, generados a través de nuestro servidor con Cloudflare Workers AI. Podemos ajustar este cupo para que el Servicio sea sostenible; cuando se agota, o la IA no está disponible, los planes se crean en tu dispositivo.',
          'Los usuarios Pro también pueden conectar su propia clave API de un proveedor de IA (por ejemplo, Google Gemini, OpenAI o DeepSeek). Tu clave se guarda solo en tu navegador. Las solicitudes van directamente de tu navegador a ese proveedor, conforme a tu propio acuerdo con él. Eres responsable de tu clave, de los costes que cobre el proveedor y de cumplir sus condiciones. Evita enviar datos personales sensibles a las funciones de IA.',
        ],
      },
      {
        heading: '12. Servicios de terceros',
        blocks: [
          'Las integraciones opcionales, como el inicio de sesión con Google o Google Calendar, las prestan terceros conforme a sus propias condiciones. No somos responsables de servicios que no controlamos.',
        ],
      },
      {
        heading: '13. Disponibilidad y cambios en el Servicio',
        blocks: [
          'Trabajamos para que Moneo esté disponible y tus datos seguros, pero no podemos prometer que el Servicio funcione siempre sin interrupciones ni errores. Como los datos se guardan primero en tu dispositivo, borrar los datos del navegador puede eliminarlos. Guarda tus propias copias de seguridad de lo importante (por ejemplo, con la exportación JSON gratuita en Ajustes).',
          'Podemos añadir, cambiar o eliminar funciones. Si dejamos de ofrecer Pro por completo, reembolsaremos la parte no utilizada de cualquier suscripción prepagada.',
        ],
      },
      {
        heading: '14. Sin garantía',
        blocks: [
          'En la medida en que lo permita la ley, el Servicio se ofrece «tal cual» y «según disponibilidad», sin garantías de ningún tipo, expresas o implícitas, incluida la idoneidad para un fin determinado. Nada en estos Términos limita los derechos que tengas como consumidor según la legislación imperativa.',
        ],
      },
      {
        heading: '15. Limitación de responsabilidad',
        blocks: [
          'En la medida en que lo permita la ley, no somos responsables de pérdidas indirectas o consecuentes, como lucro cesante, pérdida de datos u oportunidades perdidas. Nuestra responsabilidad total por cualquier reclamación relacionada con el Servicio se limita al importe que hayas pagado por Moneo en los 12 meses anteriores a la reclamación.',
          'Estos límites no se aplican a la responsabilidad que la ley no permite limitar, como la derivada de dolo, negligencia grave, o muerte o lesiones personales causadas por negligencia.',
        ],
      },
      {
        heading: '16. Terminación',
        blocks: [
          'Puedes dejar de usar Moneo en cualquier momento y eliminar tu cuenta desde la página Cuenta.',
          'Podemos suspender o cerrar una cuenta que incumpla estos Términos de forma grave o reiterada, o cuando la ley lo exija. Cuando sea razonable, te avisaremos primero y te daremos la oportunidad de exportar tus datos. Si cerramos tu cuenta sin que hayas incumplido nada, reembolsaremos la parte no utilizada de cualquier suscripción prepagada.',
        ],
      },
      {
        heading: '17. Cambios en estos Términos',
        blocks: [
          'Podemos actualizar estos Términos. Si un cambio es importante, te avisaremos en la aplicación o por correo electrónico antes de que entre en vigor. La fecha de «Última actualización» de arriba indica la versión vigente. Si sigues usando el Servicio después de que un cambio entre en vigor, se aplican los nuevos Términos; si no estás de acuerdo, puedes cancelar y eliminar tu cuenta.',
        ],
      },
      {
        heading: '18. Ley aplicable',
        blocks: [
          `Estos Términos se rigen por las leyes de la ${SELLER.country.es}, y los litigios se resolverán ante sus tribunales competentes.`,
          'Si eres consumidor y resides en la Unión Europea o en el Espacio Económico Europeo, conservas además la protección de las leyes imperativas de consumo de tu país de residencia y puedes presentar una reclamación ante los tribunales de ese país.',
        ],
      },
      {
        heading: '19. Contacto',
        blocks: [`¿Preguntas sobre estos Términos? Escribe a ${SELLER.initials} a {email}.`],
      },
    ],
  },

  privacy: {
    title: 'Política de privacidad',
    updated: UPDATED,
    intro: [
      'Esta política explica qué datos personales trata Moneo, para qué, quién nos ayuda a tratarlos y qué opciones y derechos tienes. Moneo funciona como «local-first»: por defecto, tus datos se quedan en tu navegador, en tu dispositivo.',
    ],
    sections: [
      {
        heading: '1. Quién es responsable de tus datos',
        blocks: [`El responsable del tratamiento es ${OPERATOR}. Contacto: {email}.`],
      },
      {
        heading: '2. Datos que se quedan en tu dispositivo',
        blocks: [
          'Todo lo que creas se guarda primero en el almacenamiento local de tu navegador, en tu dispositivo: sesiones de enfoque, áreas de enfoque, ajustes, proyectos, tareas, planes diarios, bloques de tiempo, objetivos, OKR, habilidades, hábitos, entradas del diario y de energía, historial del chat con el asistente y datos similares. No podemos ver estos datos. Se quedan en tu dispositivo a menos que actives la sincronización en la nube (ver más abajo).',
          'Si añades tu propia clave API de un proveedor de IA, también se guarda solo en tu navegador. Nunca se envía a los servidores de Moneo.',
        ],
      },
      {
        heading: '3. Datos que tratamos',
        blocks: [
          {
            list: [
              'Cuenta: tu correo electrónico, una contraseña cifrada con hash (si usas una), el método de inicio de sesión y las marcas de tiempo de la cuenta, gestionados por nuestro proveedor de autenticación. Si inicias sesión con Google, recibimos de Google tu correo y datos básicos de perfil.',
              'Perfil: tu zona horaria, para contar bien tus días.',
              'Sincronización en la nube (con cuenta, solo después de activarla): sesiones de enfoque (duración, hora, texto de intención, área de enfoque), áreas de enfoque, tus ajustes y un identificador aleatorio del dispositivo para combinar cambios entre dispositivos.',
              'Sincronización completa (solo Pro, con la sincronización activada): el resto de tus datos de planificación — proyectos, tareas, objetivos, OKR, hábitos y registros de hábitos, entradas del diario y de energía, áreas de vida y mapa de vida, habilidades, bloques de tiempo, planes diarios, sprints, ajustes del tablero, planes en cascada, vínculos, filtros guardados y hojas de ruta —, junto con la hora del último cambio o eliminación de cada elemento. El historial del chat con el asistente y las claves de IA no se sincronizan. Si Pro termina, la copia ya guardada en tu cuenta se conserva pero deja de actualizarse, y los datos de tu dispositivo no se tocan.',
              'Suscripción: plan, estado, fecha de renovación e identificadores de cliente y suscripción de Lemon Squeezy, que recibimos de Lemon Squeezy para saber si tienes Pro.',
              'Focus buddy (opcional, Pro): si te emparejas con un compañero, un código de invitación y el emparejamiento; tu compañero solo ve tus minutos de enfoque de hoy.',
              'Google Calendar (opcional, Pro): si lo conectas, un token que nos permite leer tus eventos (solo lectura) para mostrar conflictos con tu plan. Los eventos se obtienen cuando hace falta y no los guardamos. Puedes desconectarlo en cualquier momento.',
              'Informes de errores: si la aplicación falla, un mensaje técnico de error y una traza de pila. Los informes no están vinculados a tu cuenta y no están pensados para contener tu contenido.',
              'Datos de seguridad: dirección IP y datos de la solicitud, tratados brevemente por nuestro proveedor de alojamiento y por la protección antibots del formulario de inicio de sesión, para proteger el Servicio frente a abusos.',
              'Estadísticas de uso: Cloudflare Web Analytics cuenta las visitas a páginas y mide su rendimiento. Registra la dirección de la página, el sitio de procedencia, el país y el tipo de navegador y dispositivo, y solo nos muestra totales agregados. No usa cookies, no usa el almacenamiento del navegador para seguirte, no te identifica ni te sigue por otros sitios.',
              'Contadores de producto anónimos: cuando llegas a algunos pasos en la aplicación (por ejemplo, terminar los pasos de bienvenida, tu primera ronda de enfoque o abrir el pago), Moneo cuenta el paso solo junto con el plan elegido y el idioma de la interfaz —sin identificador de cuenta, dirección IP, identificador de dispositivo ni contenido— para ver qué partes de Moneo funcionan. También anotamos el canal por el que llegaste —una etiqueta de campaña del enlace (por ejemplo utm_source=tiktok) o el nombre del sitio de origen— y guardamos solo esa etiqueta corta en tu navegador durante 30 días, para ver qué canales llevan a registros y suscripciones; no te identifica. Activar Do Not Track o Global Privacy Control en tu navegador detiene estos contadores.',
              'Mensajes que nos envías: tu correo electrónico y el contenido del mensaje.',
            ],
          },
          'Los datos de facturación (nombre, dirección de facturación, datos de la tarjeta) los recoge y conserva Lemon Squeezy como Merchant of Record, no Moneo.',
        ],
      },
      {
        heading: '4. Funciones de IA',
        blocks: [
          'Por defecto, los planes de estilo IA se crean en tu dispositivo con reglas sencillas y no se envía nada a ningún sitio.',
          'Planes de IA incluidos (Pro): a través de nuestro servidor solo se envían a Cloudflare Workers AI el texto del objetivo (hasta 500 caracteres), el horizonte, las horas por semana y el nivel. No se incluyen sesiones, tareas, diario ni datos de la cuenta; ni la solicitud ni la respuesta se guardan por nuestra parte, y Cloudflare no las usa para entrenar modelos. Solo contamos cuántos planes ha creado cada cuenta al día (se borra a los dos días).',
          'Paquetes de entrenamiento con IA (Pro): a través de nuestro servidor solo se envían a Cloudflare Workers AI la descripción que escribes (hasta 300 caracteres) y la lista de ejercicios que puedes hacer (nombre, músculo principal, equipo, nivel). No se guarda nada y el texto no se registra. En el plan gratuito, el mismo texto se lee en tu dispositivo y no se envía a ninguna parte.',
          'Si tienes Pro y añades tu propia clave API de Google Gemini, OpenAI o DeepSeek, el objetivo que escribes y tus datos de planificación (horizonte, horas por semana, nivel) se envían directamente desde tu navegador a ese proveedor. Ese proveedor los trata según su propia política de privacidad, como proveedor tuyo y no nuestro.',
          'La entrada por voz del asistente usa el reconocimiento de voz integrado en tu navegador. Algunos navegadores (por ejemplo, Chrome) envían el audio a los servidores del fabricante del navegador para transcribirlo.',
        ],
      },
      {
        heading: '5. Para qué usamos tus datos (bases jurídicas)',
        blocks: [
          'Tratamos los datos personales conforme al Reglamento General de Protección de Datos de la UE (RGPD) para los usuarios de la UE/EEE, y conforme a la Ley n.º 195/2024 de la República de Moldavia sobre protección de datos personales, vigente desde el 23 de agosto de 2026 (que sustituyó a la Ley n.º 133/2011).',
          {
            list: [
              'Para prestar el Servicio que has solicitado — cuenta, sincronización, funciones Pro y estado de facturación (ejecución de un contrato).',
              'Para mantener el Servicio seguro y operativo — protección antibots, límites de frecuencia e informes de errores (nuestro interés legítimo en una aplicación segura y fiable).',
              'Para entender, de forma agregada, qué páginas se usan y lo rápido que cargan — Cloudflare Web Analytics sin cookies (nuestro interés legítimo en mejorar el Servicio).',
              'Para las funciones opcionales que activas — Google Calendar, focus buddy, tu propia clave de IA (tu consentimiento, que puedes retirar en cualquier momento desactivando la función).',
              'Para cumplir obligaciones legales, por ejemplo conservar registros cuando la ley lo exija.',
              'Para enviarte un correo de bienvenida después de crear tu cuenta y, si no has usado Moneo durante una semana, un único recordatorio. Cada uno incluye un enlace para darte de baja con un clic (nuestro interés legítimo en ayudarte a empezar; puedes oponerte en cualquier momento).',
            ],
          },
        ],
      },
      {
        heading: '6. Proveedores de servicios (encargados del tratamiento)',
        blocks: [
          'Usamos estos proveedores para hacer funcionar Moneo. Tratan los datos solo siguiendo nuestras instrucciones o, cuando se indica, como responsables independientes:',
          {
            list: [
              'Supabase — autenticación y base de datos en la nube (alojada en la UE, Irlanda). También envía los correos de inicio de sesión, confirmación y restablecimiento de contraseña, directamente o a través de un proveedor de envío de correo que configuramos.',
              'Cloudflare — alojamiento, distribución de contenido, seguridad, protección antibots Turnstile en los formularios de inicio de sesión y Web Analytics sin cookies (red global).',
              'Lemon Squeezy — pago, cobros, impuestos, facturas y reembolsos como Merchant of Record (responsable independiente de los datos de facturación; EE. UU.).',
              'Google — inicio de sesión con Google y, si lo conectas, Google Calendar (EE. UU.).',
              'Sentry (Functional Software, Inc.) — informes de errores (datos almacenados en la UE, Alemania).',
              'GitHub (Microsoft) — guarda nuestras copias de seguridad semanales cifradas de la base de datos (EE. UU.).',
              'Los proveedores de IA que eliges tú (Google Gemini, OpenAI, DeepSeek) — solo si añades tu propia clave.',
              'Resend — envía los correos de Moneo: inicio de sesión, confirmación y restablecimiento de contraseña, y los correos de bienvenida y de recordatorio (EE. UU.).',
              'Cloudflare Workers AI — genera los planes de IA incluidos en Pro (recibe solo el texto del objetivo y los ajustes del plan; no se guarda nada).',
            ],
          },
          'No vendemos tus datos personales ni los compartimos con anunciantes ni con intermediarios de datos.',
        ],
      },
      {
        heading: '7. Transferencias internacionales',
        blocks: [
          'Algunos proveedores están fuera de tu país, incluidos Estados Unidos y, en el caso de DeepSeek si lo eliges, China. Cuando se aplica el RGPD, las transferencias se basan en decisiones de adecuación (como el Marco de Privacidad de Datos UE-EE. UU. para proveedores certificados) o en las cláusulas contractuales tipo de la Comisión Europea.',
          'Para los usuarios en la República de Moldavia, en las transferencias se aplican las mismas garantías conforme a la Ley n.º 195/2024.',
        ],
      },
      {
        heading: '8. Cuánto tiempo conservamos los datos',
        blocks: [
          {
            list: [
              'Datos en tu dispositivo: hasta que los borres o elimines los datos de tu navegador.',
              'Datos de la cuenta y de la nube: hasta que elimines tu cuenta. La eliminación los borra de inmediato de nuestra base de datos activa; las copias en las copias de seguridad cifradas caducan en un plazo de 30 días.',
              'Informes de errores: hasta 90 días.',
              'Estadísticas de uso: Cloudflare solo las conserva como totales agregados que no te identifican.',
              'Registros de seguridad de nuestro proveedor de alojamiento: periodos cortos, normalmente de días.',
              'Correos al soporte: el tiempo necesario para atender tu solicitud y, como máximo, 2 años.',
              'Registros de facturación: los conserva Lemon Squeezy durante el tiempo que exijan las leyes fiscales y contables.',
              'Contadores anónimos del producto (por paso, plan, idioma y canal): hasta 3 meses; después se borran automáticamente.',
            ],
          },
        ],
      },
      {
        heading: '9. Tus derechos y opciones',
        blocks: [
          'Tienes derecho a acceder a tus datos personales, rectificarlos, exportarlos o suprimirlos, a oponerte a determinados tratamientos o limitarlos, a retirar tu consentimiento en cualquier momento y a la portabilidad de los datos.',
          {
            list: [
              'Borrar los datos de este dispositivo: Ajustes → «Eliminar todos los datos de este dispositivo».',
              'Eliminar tu cuenta y tus datos en la nube: Cuenta → «Eliminar cuenta». Si tienes una suscripción activa, cancélala primero en el portal de cliente.',
              'Acceso y portabilidad: en Ajustes, cualquier persona puede exportar gratis todos sus datos de Moneo en un archivo JSON e importarlos en otro dispositivo. Pro añade formatos de informe adicionales (CSV/PDF). Para cualquier otra solicitud, escribe a {email}.',
              'Detén la sincronización en la nube cerrando sesión; tus datos se quedan en tu dispositivo.',
            ],
          },
          'Respondemos a las solicitudes en el plazo de un mes. También puedes presentar una reclamación ante una autoridad de protección de datos: en la República de Moldavia, el Centro Nacional de Protección de Datos Personales; en la UE/EEE, la autoridad de tu país de residencia (en España, la AEPD).',
        ],
      },
      {
        heading: '10. Cookies y almacenamiento local',
        blocks: [
          'Moneo no usa cookies publicitarias, rastreadores publicitarios, píxeles de seguimiento ni seguimiento entre sitios. Para las estadísticas de uso empleamos Cloudflare Web Analytics, que funciona sin cookies y no guarda nada en tu navegador para reconocerte. Usamos el almacenamiento local de tu navegador para guardar tus datos y tu sesión, lo cual es estrictamente necesario para que la aplicación funcione. Cloudflare y Turnstile pueden instalar cookies de seguridad estrictamente necesarias para distinguir personas de bots. El pago de Lemon Squeezy, que se abre en el propio sitio de Lemon Squeezy, usa sus propias cookies.',
          'Las fuentes se sirven desde nuestro propio dominio; no cargamos Google Fonts ni otros rastreadores de terceros.',
        ],
      },
      {
        heading: '11. Seguridad',
        blocks: [
          'Los datos viajan por conexiones cifradas (HTTPS/TLS). Los datos en la nube están protegidos por reglas de acceso para que solo tu cuenta pueda leerlos, y las copias de seguridad de la base de datos están cifradas. Moneo no tiene cifrado de extremo a extremo y ningún sistema es 100 % seguro, así que usa una contraseña fuerte y única.',
          'Si un incidente de seguridad pone en riesgo datos personales, lo notificamos a la autoridad competente —en la República de Moldavia, el Centro Nacional de Protección de Datos Personales— en un plazo de 72 horas desde que tengamos conocimiento, e informamos sin dilación indebida a los usuarios afectados cuando el riesgo para ellos sea alto. Llevamos un registro interno de las actividades de tratamiento y de los posibles incidentes.',
        ],
      },
      {
        heading: '12. Niños y estudiantes',
        blocks: [
          `Moneo lo usan estudiantes de escuela, universitarios y adultos. Una cuenta exige una edad mínima de ${MIN_ACCOUNT_AGE} años. Los usuarios menores de ${ADULT_AGE} años necesitan el permiso de su madre, padre o tutor legal y, por debajo de la edad de consentimiento digital de su país (${DIGITAL_CONSENT_AGE} años en muchos países de la UE), su madre, padre o tutor legal debe consentir la creación de la cuenta.`,
          {
            list: [
              'Sin cuenta, no se nos envía nada: todos los datos se quedan en el dispositivo. Es la forma más segura de usar Moneo para los más jóvenes.',
              'Con cuenta, recogemos de los menores los mismos datos mínimos que de cualquier otra persona (ver la sección 3), nada más.',
              'Sin publicidad, sin elaboración de perfiles y sin venta de datos, para nadie, incluidos los menores.',
              'Las madres, padres y tutores legales pueden pedir ver, exportar o eliminar los datos de su hijo o hija escribiendo a {email}.',
              `Si sabemos que un niño menor de ${MIN_ACCOUNT_AGE} años ha creado una cuenta, eliminamos la cuenta y sus datos.`,
            ],
          },
        ],
      },
      {
        heading: '13. Cambios en esta política',
        blocks: [
          'Podemos actualizar esta política. Si un cambio es importante, te avisaremos en la aplicación o por correo electrónico. La fecha de «Última actualización» de arriba indica la versión vigente.',
        ],
      },
      {
        heading: '14. Contacto',
        blocks: [
          `Para preguntas o solicitudes sobre privacidad, escribe a ${SELLER.initials} a {email}.`,
        ],
      },
    ],
  },

  refund: {
    title: 'Política de reembolsos',
    updated: UPDATED,
    intro: [
      `Queremos que estés contento con Moneo Pro. Si no lo estás, puedes recuperar tu dinero dentro de los ${REFUND_DAYS} días, sin preguntas.`,
    ],
    sections: [
      {
        heading: `1. Garantía de devolución de ${REFUND_DAYS} días`,
        blocks: [
          `Puedes pedir el reembolso total de cualquier pago de Pro —tu primera compra o una renovación, mensual o anual— dentro de los ${REFUND_DAYS} días siguientes a la fecha del pago. No tienes que dar ningún motivo.`,
        ],
      },
      {
        heading: '2. Cómo solicitar un reembolso',
        blocks: [
          {
            list: [
              'Escribe a {email} desde la dirección que usaste al pagar, o indica esa dirección y tu número de pedido (aparece en el correo de recibo de Lemon Squeezy).',
              'O busca tu pedido en el correo de recibo de Lemon Squeezy o en {orders} y solicita allí el reembolso.',
            ],
          },
        ],
      },
      {
        heading: '3. Quién tramita el reembolso',
        blocks: [
          `Los pagos los gestiona ${MOR}, nuestro Merchant of Record. Cuando aprobamos tu solicitud, ${MOR} devuelve el dinero a tu método de pago original, incluidos los impuestos pagados. Los reembolsos suelen aparecer en 5–10 días hábiles, según tu banco o el emisor de tu tarjeta.`,
        ],
      },
      {
        heading: '4. Qué pasa con Pro tras un reembolso',
        blocks: [
          'Un reembolso también cancela la suscripción, así que no se te volverá a cobrar. Las funciones Pro terminan cuando se procesa el reembolso y tu cuenta vuelve al plan gratuito.',
          'Tus datos no se eliminan: todo lo que hay en tu dispositivo se queda allí, y los datos ya sincronizados con tu cuenta permanecen en ella hasta que la elimines. La sincronización completa de todos tus datos es una función Pro, así que deja de actualizarse; las sesiones de enfoque, las áreas de enfoque y los ajustes siguen sincronizándose.',
        ],
      },
      {
        heading: '5. Cancelar no es lo mismo que un reembolso',
        blocks: [
          {
            list: [
              'Cancelar: detiene las renovaciones futuras. Mantienes Pro hasta el final del periodo ya pagado. No se devuelve dinero. Puedes cancelar en cualquier momento en el portal de cliente (Cuenta → Gestionar suscripción).',
              `Reembolso: devuelve el dinero de un pago realizado en los últimos ${REFUND_DAYS} días y termina Pro de inmediato.`,
            ],
          },
        ],
      },
      {
        heading: `6. Pasados ${REFUND_DAYS} días`,
        blocks: [
          `Pasados ${REFUND_DAYS} días, por lo general los pagos no son reembolsables, pero puedes cancelar en cualquier momento para detener los cobros futuros. Siempre corregiremos errores de facturación, como un cargo duplicado, y reembolsaremos cuando la ley lo exija. Si dejamos de ofrecer Pro, reembolsaremos la parte no utilizada de cualquier periodo prepagado.`,
          `Esta política no limita ningún derecho que te otorgue la legislación imperativa de consumo, incluido el derecho de desistimiento de la UE, que esta garantía de ${REFUND_DAYS} días ya cubre.`,
        ],
      },
      {
        heading: '7. Contacto',
        blocks: [
          `¿Preguntas sobre facturación o reembolsos? Escribe a {email}. Consulta también nuestros {terms}.`,
        ],
      },
    ],
  },
};

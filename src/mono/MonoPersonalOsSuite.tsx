import { memo, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Locale } from '../lib/i18n/types';
import { levelFromXp, type XpBreakdown } from '../lib/xp';
import { rankLabel } from './rankLabel';
import MonoBodyMap from './MonoBodyMap';
import type { MonoTab } from './MonoNav';
import type { Session } from '../lib/store';
import { fitKey, type Muscle } from '../lib/fitness/library';
import { heatLevels, muscleLoad, type WorkoutStore } from '../lib/fitness/workouts';
import {
  compute5AxisRadar,
  computeAtomicMetrics,
  computeFitbodMuscleCurve,
  computeMacroFactorBudget,
  computeMindBodySynergy,
  computeMuscleRecovery48h,
  cycleIngredientSwap,
  loadFuelState,
  mealsForGoal,
  saveFuelState,
  toggleMealEaten,
  type FuelDayState,
  type MealSlot,
  type NutritionGoal,
} from '../lib/personalOsEngine';

interface OsCopy {
  briefBtn: string;
  briefStop: string;
  shareBtn: string;
  shareDone: string;
  fuelSectionTitle: string;
  fuelSectionSub: string;
  bodySectionTitle: string;
  bodySectionSub: string;
  atomicSectionTitle: string;
  atomicSectionSub: string;
  goalCut: string;
  goalBulk: string;
  goalEnergy: string;
  goalBalance: string;
  slotMorning: string;
  slotLunch: string;
  slotDinner: string;
  swapHint: string;
  adaptiveBonusLine: (p: number, c: number) => string;
  eatenDone: string;
  eatenMark: string;
  idBuilder: string;
  idAthlete: string;
  idPerformer: string;
  votesLabel: string;
  compoundLabel: string;
  twoMinTitle: string;
  twoMinActions: readonly [string, string, string];
  twoMinBtn: string;
  twoMinDone: string;
  neverMissAlert: string;
  stackRule: string;
  radarTitle: string;
  radarAxes: readonly [string, string, string, string, string];
  cadenceTitle: string;
  recoveryReady: string;
  recoveryActive: string;
  muscleDetailLine: (name: string, pct: number, h: number) => string;
  synergyLine: (pct: number) => string;
  openMoveCta: string;
  voiceText: (score: number, openTasks: number, m1: string, m2: string) => string;
}

const COPY: Record<Locale, OsCopy> = {
  en: {
    briefBtn: '🔊 Daily Briefing',
    briefStop: '⏹ Stop Voice',
    shareBtn: '⬡ Save Day Card',
    shareDone: '✓ Card Saved',
    fuelSectionTitle: 'Daily Nutrition & Smart Swaps',
    fuelSectionSub: 'Choose your goal · tap any ingredient to swap with an equal-macro analog',
    bodySectionTitle: 'Muscle Recovery & Body Map (0–100%)',
    bodySectionSub: 'Tap any muscle to see its 0–100% recovery curve',
    atomicSectionTitle: '1% Daily Habits & 30-Day Evolution',
    atomicSectionSub: 'Identity votes · 2-Minute rescue actions · 5-axis radar',
    goalCut: '🔥 Fat Loss',
    goalBulk: '💪 Muscle Gain',
    goalEnergy: '⚡ Brain Energy',
    goalBalance: '⚖️ Balance',
    slotMorning: '🌅 Morning · 5m',
    slotLunch: '☀️ Lunch · 10m',
    slotDinner: '🌙 Dinner · 8m',
    swapHint: 'Missing an ingredient at home? Tap any item below to swap with an equivalent food ⇄',
    adaptiveBonusLine: (p, c) =>
      `Adaptive Target: +${p}g Protein & +${c}g Carbs added for today’s activity`,
    eatenDone: '✓ Eaten',
    eatenMark: '+ Mark Eaten',
    idBuilder: '🧠 Deep Focus',
    idAthlete: '🏋️ Athlete',
    idPerformer: '⚡ Consistent',
    votesLabel: 'Habit Votes',
    compoundLabel: '1% Compound Growth',
    twoMinTitle: '2-MINUTE QUICK WINS (NEVER MISS TWICE)',
    twoMinActions: [
      '2 min: Write 1 clear priority for today',
      '2 min: 15 squats or shoulder mobility stretch',
      '2 min: Drink a full glass of water & breathe',
    ],
    twoMinBtn: '⚡ Complete 2-Minute Rule',
    twoMinDone: '✓ 2-Minute Rule Completed (Streak Safe)',
    neverMissAlert:
      '🛡️ Never Miss Twice: Do at least one 2-minute action today to keep your chain!',
    stackRule: 'Habit Stack: After [Morning Coffee] → [25m Focus] → [High-Protein Breakfast]',
    radarTitle: '30-DAY 5-AXIS BALANCE (BEFORE → NOW)',
    radarAxes: ['Focus', 'Plan', 'Body', 'Nutrition', 'Habits'],
    cadenceTitle: 'LAST 28 DAYS CONSISTENCY',
    recoveryReady: '100% Rested — Best to Train Today:',
    recoveryActive: 'Recovering (48h Curve):',
    muscleDetailLine: (name, pct, h) =>
      h === 0
        ? `${name}: ${pct}% recovered · Ready for full training`
        : `${name}: ${pct}% recovered · ~${h}h until 100%`,
    synergyLine: (pct) => `Mind × Body Insight: +${pct}% deeper focus on active days`,
    openMoveCta: 'Open Workouts →',
    voiceText: (score, openTasks, m1, m2) =>
      `Hello! Your daily score is ${score} out of 100. You have ${openTasks} open priorities today. Your ${m1} and ${m2} are 100 percent recovered and ready for training.`,
  },
  ro: {
    briefBtn: '🔊 Rezumat Vocal',
    briefStop: '⏹ Oprește Vocea',
    shareBtn: '⬡ Salvează Cardul Zilei',
    shareDone: '✓ Card Descărcat',
    fuelSectionTitle: 'Alimentația Zilei & Înlocuitori Analogici',
    fuelSectionSub:
      'Alege categoria · apasă pe orice produs dacă nu îl ai acasă ca să-l înlocuiești ⇄',
    bodySectionTitle: 'Mușchii Corpului & Recuperarea 0–100%',
    bodySectionSub: 'Apasă pe orice mușchi pe siluetă pentru procentul exact de refacere',
    atomicSectionTitle: 'Obiceiuri Bune (+1% pe Zi) & Evoluție',
    atomicSectionSub: 'Regula de 2 minute · Matricea 28 zile · Radarul pe 5 axe',
    goalCut: '🔥 Scădere Greutate',
    goalBulk: '💪 Creștere Masă',
    goalEnergy: '⚡ Energie & Focus',
    goalBalance: '⚖️ Echilibru',
    slotMorning: '🌅 Dimineața · 5 min',
    slotLunch: '☀️ Amiaza · 10 min',
    slotDinner: '🌙 Seara · 8 min',
    swapHint:
      'Nu găsești un produs în frigider? Apasă direct pe el pentru un înlocuitor echivalent ⇄',
    adaptiveBonusLine: (p, c) =>
      `Țintă ajustată automat: +${p}g Proteine & +${c}g Carbohidrați pentru efortul de azi`,
    eatenDone: '✓ Mâncat',
    eatenMark: '+ Marchează',
    idBuilder: '🧠 Focus Profund',
    idAthlete: '🏋️ Corp & Sport',
    idPerformer: '⚡ Disciplină Zilnică',
    votesLabel: 'Acțiuni Bune (Voturi)',
    compoundLabel: 'Creștere Compusă 1%',
    twoMinTitle: 'REGULA DE 2 MINUTE (PENTRU ZILELE AGLOMERATE)',
    twoMinActions: [
      '2 min: Scrie o singură prioritate clară pentru azi',
      '2 min: 15 genuflexiuni sau dezmorțire umeri & spate',
      '2 min: Bea un pahar mare cu apă și respiră adânc',
    ],
    twoMinBtn: '⚡ Activează Regula de 2 Minute',
    twoMinDone: '✓ Regula de 2 Minute Activă (Lanțul e Protejat)',
    neverMissAlert: '🛡️ Nu rata de 2 ori la rând: Bifează măcar o acțiune de 2 minute azi!',
    stackRule:
      'Legarea obiceiurilor: După [Cafeaua de dimineață] → [25m Focus] → [Mic Dejun Proteic]',
    radarTitle: 'ECHILIBRUL PE 5 AXE (ACUM 30 ZILE → AZI)',
    radarAxes: ['Focus', 'Plan', 'Corp', 'Alimentație', 'Obiceiuri'],
    cadenceTitle: 'CONSISTENȚA ULTIMELOR 28 DE ZILE',
    recoveryReady: '100% Odihniți — Ideali de antrenat azi:',
    recoveryActive: 'În refacere (curba 48h):',
    muscleDetailLine: (name, pct, h) =>
      h === 0
        ? `${name}: ${pct}% refăcut · Gata de antrenament complet`
        : `${name}: ${pct}% refăcut · ~${h} ore până la 100%`,
    synergyLine: (pct) => `Legătura Minte × Corp: +${pct}% focus mai bun în zilele cu mișcare`,
    openMoveCta: 'Deschide Antrenamentele →',
    voiceText: (score, openTasks, m1, m2) =>
      `Salut! Scorul zilei este ${score} din 100. Mai ai ${openTasks} sarcini deschise astăzi. Mușchii ${m1} și ${m2} sunt 100% refăcuți și pregătiți pentru mișcare.`,
  },
  ru: {
    briefBtn: '🔊 Голосовой обзор',
    briefStop: '⏹ Стоп',
    shareBtn: '⬡ Сохранить карточку',
    shareDone: '✓ Сохранено',
    fuelSectionTitle: 'Питание на день и замена продуктов',
    fuelSectionSub: 'Выберите цель · нажмите на продукт, чтобы заменить его аналогом ⇄',
    bodySectionTitle: 'Мышцы тела и восстановление 0–100%',
    bodySectionSub: 'Нажмите на любую мышцу для точного процента восстановления',
    atomicSectionTitle: 'Хорошие привычки (+1% в день) и Рост',
    atomicSectionSub: 'Правило 2 минут · Матрица 28 дней · Радар 5 осей',
    goalCut: '🔥 Снижение веса',
    goalBulk: '💪 Набор массы',
    goalEnergy: '⚡ Энергия и Фокус',
    goalBalance: '⚖️ Баланс',
    slotMorning: '🌅 Утро · 5 мин',
    slotLunch: '☀️ Обед · 10 мин',
    slotDinner: '🌙 Ужин · 8 мин',
    swapHint: 'Нет продукта дома? Нажмите на ингредиент для равноценной замены ⇄',
    adaptiveBonusLine: (p, c) => `Адаптивная цель: +${p}г белка и +${c}г углеводов за активность`,
    eatenDone: '✓ Съедено',
    eatenMark: '+ Отметить',
    idBuilder: '🧠 Глубокий фокус',
    idAthlete: '🏋️ Спорт и сила',
    idPerformer: '⚡ Дисциплина',
    votesLabel: 'Полезные действия',
    compoundLabel: 'Сложный рост 1%',
    twoMinTitle: 'ПРАВИЛО 2 МИНУТ (ДЛЯ СЛОЖНЫХ ДНЕЙ)',
    twoMinActions: [
      '2 мин: Записать 1 главную задачу на сегодня',
      '2 мин: 15 приседаний или разминка плеч',
      '2 мин: Выпить стакан воды и глубоко вдохнуть',
    ],
    twoMinBtn: '⚡ Выполнить правило 2 минут',
    twoMinDone: '✓ Правило 2 минут выполнено',
    neverMissAlert: '🛡️ Не пропускай дважды: выполни хотя бы 2 минуты сегодня!',
    stackRule: 'Цепочка привычек: После [Утреннего кофе] → [25м Фокуса] → [Завтрак]',
    radarTitle: 'БАЛАНС ПО 5 ОСЯМ (30 ДНЕЙ НАЗАД → СЕЙЧАС)',
    radarAxes: ['Фокус', 'План', 'Тело', 'Питание', 'Привычки'],
    cadenceTitle: 'СТАБИЛЬНОСТЬ ЗА 28 ДНЕЙ',
    recoveryReady: '100% Отдохнули — Идеально сегодня:',
    recoveryActive: 'Восстановление (48ч):',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name}: ${pct}% · Готов к тренировке` : `${name}: ${pct}% · ~${h}ч до 100%`,
    synergyLine: (pct) => `Связь Разум × Тело: +${pct}% к фокусу в дни тренировок`,
    openMoveCta: 'Открыть Тренировки →',
    voiceText: (score, openTasks, m1, m2) =>
      `Ваш результат дня ${score} из 100. Открытых задач: ${openTasks}. Мышцы ${m1} и ${m2} полностью восстановились.`,
  },
  uk: {
    briefBtn: '🔊 Голосовий огляд',
    briefStop: '⏹ Стоп',
    shareBtn: '⬡ Зберегти картку',
    shareDone: '✓ Збережено',
    fuelSectionTitle: 'Харчування на день та заміна продуктів',
    fuelSectionSub: 'Оберіть ціль · натисніть на продукт для заміни аналогом ⇄',
    bodySectionTitle: 'М’язи тіла та відновлення 0–100%',
    bodySectionSub: 'Натисніть на м’яз для точного відсотка відновлення',
    atomicSectionTitle: 'Добрі звички (+1% на день) та Ріст',
    atomicSectionSub: 'Правило 2 хвилин · Матриця 28 днів · Радар 5 осей',
    goalCut: '🔥 Зниження ваги',
    goalBulk: '💪 Набір маси',
    goalEnergy: '⚡ Енергія та Фокус',
    goalBalance: '⚖️ Баланс',
    slotMorning: '🌅 Ранок · 5 хв',
    slotLunch: '☀️ Обід · 10 хв',
    slotDinner: '🌙 Вечеря · 8 хв',
    swapHint: 'Немає продукту вдома? Натисніть на інгредієнт для аналогічної заміни ⇄',
    adaptiveBonusLine: (p, c) => `Адаптивна ціль: +${p}г білка та +${c}г вуглеводів сьогодні`,
    eatenDone: '✓ З’їдено',
    eatenMark: '+ Відмітити',
    idBuilder: '🧠 Глибокий фокус',
    idAthlete: '🏋️ Спорт і сила',
    idPerformer: '⚡ Дисципліна',
    votesLabel: 'Корисні дії',
    compoundLabel: 'Складний ріст 1%',
    twoMinTitle: 'ПРАВИЛО 2 ХВИЛИН (ДЛЯ СКЛАДНИХ ДНІВ)',
    twoMinActions: [
      '2 хв: Записати 1 головну задачу на сьогодні',
      '2 хв: 15 присідань або розминка плечей',
      '2 хв: Випити склянку води та глибоко вдихнути',
    ],
    twoMinBtn: '⚡ Виконати правило 2 хвилин',
    twoMinDone: '✓ Правило 2 хвилин виконано',
    neverMissAlert: '🛡️ Не пропускай двічі: виконай хоча б правило 2 хвилин сьогодні!',
    stackRule: 'Ланцюжок звичок: Після [Ранкової кави] → [25хв Фокусу] → [Сніданок]',
    radarTitle: 'БАЛАНС ЗА 5 ОСЯМИ (БУЛО → ЗАРАЗ)',
    radarAxes: ['Фокус', 'План', 'Тіло', 'Харчування', 'Звички'],
    cadenceTitle: 'СТАБІЛЬНІСТЬ ЗА 28 ДНІВ',
    recoveryReady: '100% Відновилися — Ідеально сьогодні:',
    recoveryActive: 'Відновлення (48г):',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name}: ${pct}% · Готовий до тренування` : `${name}: ${pct}% · ~${h}г до 100%`,
    synergyLine: (pct) => `Зв’язок Розум × Тіло: +${pct}% до фокусу в дні тренувань`,
    openMoveCta: 'Відкрити Тренування →',
    voiceText: (score, openTasks, m1, m2) =>
      `Ваш результат дня ${score} зі 100. Відкритих задач: ${openTasks}. Готові до тренування: ${m1} та ${m2}.`,
  },
  de: {
    briefBtn: '🔊 Tages-Briefing',
    briefStop: '⏹ Stopp',
    shareBtn: '⬡ Tageskarte speichern',
    shareDone: '✓ Gespeichert',
    fuelSectionTitle: 'Tagesernährung & Zutaten-Tausch',
    fuelSectionSub: 'Ziel wählen · Zutat antippen für gleichwertigen Ersatz ⇄',
    bodySectionTitle: 'Muskel-Erholung & Körperkarte (0–100%)',
    bodySectionSub: 'Tippe auf einen Muskel für den genauen Erholungswert',
    atomicSectionTitle: '1% Gewohnheiten & 30-Tage-Evolution',
    atomicSectionSub: '2-Minuten-Regel · 28-Tage-Matrix · 5-Achsen-Radar',
    goalCut: '🔥 Fettabbau',
    goalBulk: '💪 Muskelaufbau',
    goalEnergy: '⚡ Energie & Fokus',
    goalBalance: '⚖️ Balance',
    slotMorning: '🌅 Morgen · 5m',
    slotLunch: '☀️ Mittag · 10m',
    slotDinner: '🌙 Abend · 8m',
    swapHint: 'Zutat fehlt? Tippe direkt darauf für einen gleichwertigen Ersatz ⇄',
    adaptiveBonusLine: (p, c) =>
      `Adaptives Ziel: +${p}g Protein & +${c}g Carbs für heutiges Training`,
    eatenDone: '✓ Gegessen',
    eatenMark: '+ Loggen',
    idBuilder: '🧠 Deep Focus',
    idAthlete: '🏋️ Athlet',
    idPerformer: '⚡ Disziplin',
    votesLabel: 'Gute Aktionen',
    compoundLabel: '1% Wachstum',
    twoMinTitle: '2-MINUTEN-REGEL (FÜR VOLLGEPACKTE TAGE)',
    twoMinActions: [
      '2 Min: 1 klare Priorität für heute notieren',
      '2 Min: 15 Kniebeugen oder Schulter-Dehnung',
      '2 Min: Ein großes Glas Wasser trinken',
    ],
    twoMinBtn: '⚡ 2-Minuten-Regel abschließen',
    twoMinDone: '✓ 2-Minuten-Regel aktiv (Serie geschützt)',
    neverMissAlert: '🛡️ Nie zweimal aussetzen: Heute mindestens eine 2-Minuten-Aktion abhaken!',
    stackRule: 'Gewohnheits-Kette: Nach [Kaffee] → [25m Fokus] → [Protein-Frühstück]',
    radarTitle: '30-TAGE 5-ACHSEN-BALANCE (VORHER → JETZT)',
    radarAxes: ['Fokus', 'Plan', 'Körper', 'Ernährung', 'Habits'],
    cadenceTitle: 'KONSTANZ DER LETZTEN 28 TAGE',
    recoveryReady: '100% Erholt — Heute ideal:',
    recoveryActive: 'In Erholung (48h):',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name}: ${pct}% erholt · Bereit` : `${name}: ${pct}% erholt · ~${h}h bis 100%`,
    synergyLine: (pct) => `Geist × Körper: +${pct}% tieferer Fokus an aktiven Tagen`,
    openMoveCta: 'Workouts öffnen →',
    voiceText: (score, openTasks, m1, m2) =>
      `Dein Tageswert liegt bei ${score} von 100. Du hast ${openTasks} offene Aufgaben. ${m1} und ${m2} sind vollständig regeneriert.`,
  },
  it: {
    briefBtn: '🔊 Briefing Vocale',
    briefStop: '⏹ Stop',
    shareBtn: '⬡ Salva Card',
    shareDone: '✓ Salvata',
    fuelSectionTitle: 'Alimentazione & Sostituzioni Analoghe',
    fuelSectionSub: 'Scegli l’obiettivo · tocca un ingrediente per sostituirlo ⇄',
    bodySectionTitle: 'Recupero Muscolare & Mappa Corpo (0–100%)',
    bodySectionSub: 'Tocca un muscolo per vedere la percentuale di recupero',
    atomicSectionTitle: 'Abitudini 1% & Evoluzione 30 Giorni',
    atomicSectionSub: 'Regola dei 2 minuti · Matrice 28 giorni · Radar 5 assi',
    goalCut: '🔥 Definizione',
    goalBulk: '💪 Massa',
    goalEnergy: '⚡ Energia & Focus',
    goalBalance: '⚖️ Equilibrio',
    slotMorning: '🌅 Mattina · 5m',
    slotLunch: '☀️ Pranzo · 10m',
    slotDinner: '🌙 Cena · 8m',
    swapHint: 'Manca un prodotto? Tocca un ingrediente per un sostituto equivalente ⇄',
    adaptiveBonusLine: (p, c) => `Target adattivo: +${p}g Proteine & +${c}g Carboidrati oggi`,
    eatenDone: '✓ Mangiato',
    eatenMark: '+ Registra',
    idBuilder: '🧠 Focus Profondo',
    idAthlete: '🏋️ Atleta',
    idPerformer: '⚡ Costanza',
    votesLabel: 'Azioni Positive',
    compoundLabel: 'Crescita 1%',
    twoMinTitle: 'REGOLA DEI 2 MINUTI (GIORNI INTENSI)',
    twoMinActions: [
      '2 min: Scrivi 1 priorità chiara per oggi',
      '2 min: 15 squat o mobilità spalle',
      '2 min: Bevi un bicchiere d’acqua',
    ],
    twoMinBtn: '⚡ Completa Regola 2 Minuti',
    twoMinDone: '✓ Regola 2 Minuti Attiva',
    neverMissAlert: '🛡️ Non saltare due volte: completa almeno un’azione da 2 minuti oggi!',
    stackRule: 'Catena: Dopo [Caffè] → [25m Focus] → [Colazione Proteica]',
    radarTitle: 'EQUILIBRIO SU 5 ASSI (PRIMA → ORA)',
    radarAxes: ['Focus', 'Piano', 'Corpo', 'Nutrizione', 'Abitudini'],
    cadenceTitle: 'COSTANZA ULTIMI 28 GIORNI',
    recoveryReady: '100% Recuperati — Ideali oggi:',
    recoveryActive: 'In recupero (48h):',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name}: ${pct}% · Pronto` : `${name}: ${pct}% · ~${h}h al 100%`,
    synergyLine: (pct) => `Mente × Corpo: +${pct}% focus nei giorni di allenamento`,
    openMoveCta: 'Apri Allenamenti →',
    voiceText: (score, openTasks, m1, m2) =>
      `Punteggio del giorno ${score} su 100. Hai ${openTasks} priorità aperte. ${m1} e ${m2} sono pronti per l'allenamento.`,
  },
  fr: {
    briefBtn: '🔊 Briefing Vocal',
    briefStop: '⏹ Stop',
    shareBtn: '⬡ Enregistrer Carte',
    shareDone: '✓ Enregistrée',
    fuelSectionTitle: 'Alimentation & Équivalents Rapides',
    fuelSectionSub: 'Choisissez l’objectif · touchez un aliment pour le remplacer ⇄',
    bodySectionTitle: 'Récupération Musculaire & Corps (0–100%)',
    bodySectionSub: 'Touchez un muscle pour voir son pourcentage de récupération',
    atomicSectionTitle: 'Habitudes 1% & Évolution 30 Jours',
    atomicSectionSub: 'Règle des 2 minutes · Matrice 28 jours · Radar 5 axes',
    goalCut: '🔥 Sèche',
    goalBulk: '💪 Prise de Masse',
    goalEnergy: '⚡ Énergie & Focus',
    goalBalance: '⚖️ Équilibre',
    slotMorning: '🌅 Matin · 5m',
    slotLunch: '☀️ Midi · 10m',
    slotDinner: '🌙 Soir · 8m',
    swapHint: 'Un produit manque ? Touchez un ingrédient pour un équivalent nutritionnel ⇄',
    adaptiveBonusLine: (p, c) => `Cible adaptée : +${p}g Protéines & +${c}g Glucides aujourd’hui`,
    eatenDone: '✓ Mangé',
    eatenMark: '+ Valider',
    idBuilder: '🧠 Focus Profond',
    idAthlete: '🏋️ Athlète',
    idPerformer: '⚡ Discipline',
    votesLabel: 'Actions Positives',
    compoundLabel: 'Croissance 1%',
    twoMinTitle: 'RÈGLE DES 2 MINUTES (JOURS CHARGÉS)',
    twoMinActions: [
      '2 min : Écrire 1 priorité claire pour aujourd’hui',
      '2 min : 15 squats ou mobilité des épaules',
      '2 min : Boire un grand verre d’eau',
    ],
    twoMinBtn: '⚡ Valider la Règle des 2 Minutes',
    twoMinDone: '✓ Règle des 2 Minutes Active',
    neverMissAlert: '🛡️ Ne jamais manquer deux fois : faites une action de 2 minutes !',
    stackRule: 'Enchaînement : Après [Café] → [25m Focus] → [Petit-déjeuner Protéiné]',
    radarTitle: 'ÉQUILIBRE SUR 5 AXES (AVANT → MAINTENANT)',
    radarAxes: ['Focus', 'Plan', 'Corps', 'Nutrition', 'Habitudes'],
    cadenceTitle: 'RÉGULARITÉ SUR 28 JOURS',
    recoveryReady: '100% Reposés — Idéal aujourd’hui :',
    recoveryActive: 'En récupération (48h) :',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name} : ${pct}% · Prêt` : `${name} : ${pct}% · ~${h}h avant 100%`,
    synergyLine: (pct) => `Esprit × Corps : +${pct}% de focus les jours actifs`,
    openMoveCta: 'Ouvrir l’Entraînement →',
    voiceText: (score, openTasks, m1, m2) =>
      `Score du jour ${score} sur 100. Vous avez ${openTasks} priorités ouvertes. ${m1} et ${m2} sont prêts pour l'entraînement.`,
  },
  es: {
    briefBtn: '🔊 Resumen de Voz',
    briefStop: '⏹ Parar',
    shareBtn: '⬡ Guardar Tarjeta',
    shareDone: '✓ Guardada',
    fuelSectionTitle: 'Alimentación del Día y Equivalentes',
    fuelSectionSub:
      'Elige tu objetivo · toca cualquier ingrediente para cambiarlo por un análogo ⇄',
    bodySectionTitle: 'Recuperación Muscular y Mapa Corporal (0–100%)',
    bodySectionSub: 'Toca cualquier músculo para ver su porcentaje exacto de recuperación',
    atomicSectionTitle: 'Buenos Hábitos (+1% Diario) y Evolución',
    atomicSectionSub: 'Regla de 2 minutos · Matriz de 28 días · Radar de 5 ejes',
    goalCut: '🔥 Pérdida de Grasa',
    goalBulk: '💪 Ganar Músculo',
    goalEnergy: '⚡ Energía y Enfoque',
    goalBalance: '⚖️ Equilibrio',
    slotMorning: '🌅 Mañana · 5m',
    slotLunch: '☀️ Mediodía · 10m',
    slotDinner: '🌙 Noche · 8m',
    swapHint: '¿No tienes un producto en casa? Tócalo para cambiarlo por un alimento equivalente ⇄',
    adaptiveBonusLine: (p, c) => `Meta adaptativa: +${p}g Proteína y +${c}g Carbohidratos hoy`,
    eatenDone: '✓ Comido',
    eatenMark: '+ Registrar',
    idBuilder: '🧠 Enfoque Profundo',
    idAthlete: '🏋️ Atleta',
    idPerformer: '⚡ Constancia',
    votesLabel: 'Acciones Positivas',
    compoundLabel: 'Crecimiento 1%',
    twoMinTitle: 'REGLA DE 2 MINUTOS (DÍAS OCUPADOS)',
    twoMinActions: [
      '2 min: Escribir 1 prioridad clara para hoy',
      '2 min: 15 sentadillas o movilidad de hombros',
      '2 min: Beber un vaso grande de agua',
    ],
    twoMinBtn: '⚡ Completar Regla de 2 Minutos',
    twoMinDone: '✓ Regla de 2 Minutos Activa',
    neverMissAlert: '🛡️ Nunca falles dos veces: ¡marca al menos una acción de 2 minutos hoy!',
    stackRule: 'Cadena: Tras [Café] → [25m Enfoque] → [Desayuno Proteico]',
    radarTitle: 'EQUILIBRIO EN 5 EJES (ANTES → AHORA)',
    radarAxes: ['Enfoque', 'Plan', 'Cuerpo', 'Nutrición', 'Hábitos'],
    cadenceTitle: 'CONSTANCIA ÚLTIMOS 28 DÍAS',
    recoveryReady: '100% Recuperados — Ideal hoy:',
    recoveryActive: 'En recuperación (48h):',
    muscleDetailLine: (name, pct, h) =>
      h === 0 ? `${name}: ${pct}% · Listo` : `${name}: ${pct}% · ~${h}h para 100%`,
    synergyLine: (pct) => `Mente × Cuerpo: +${pct}% enfoque en días de entreno`,
    openMoveCta: 'Abrir Entrenamientos →',
    voiceText: (score, openTasks, m1, m2) =>
      `Puntuación del día ${score} de 100. Tienes ${openTasks} prioridades abiertas. ${m1} y ${m2} están listos para entrenar.`,
  },
};

export interface MonoTopOsBarProps {
  xp: XpBreakdown;
  osScore: number;
  mindPct: number;
  execPct: number;
  bodyPct: number;
  openTasks: number;
  workoutStore: WorkoutStore;
  activeTab?: MonoTab;
  onTab?: (t: MonoTab) => void;
  onGoGrowth: () => void;
  onOpenAi?: () => void;
}

/**
 * Clean, human-centered Status Strip (Ideas #2 Voice Briefing, #4 Day Card PNG, #7 XP Level Progress).
 * No duplicated navigation buttons and no internal code labels.
 */
function MonoTopOsBarBase({
  xp,
  osScore,
  mindPct,
  execPct,
  bodyPct,
  openTasks,
  workoutStore,
  onGoGrowth,
  onOpenAi,
}: MonoTopOsBarProps) {
  const { t, locale, tag, fmtNum } = useI18n();
  const copy = COPY[locale] ?? COPY.en;
  const info = levelFromXp(xp.total);
  const rankName = rankLabel(t, info.level);
  const pct = Math.max(6, Math.min(100, Math.round(info.progress * 100)));

  const [speaking, setSpeaking] = useState(false);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [sharedToast, setSharedToast] = useState(false);

  const levels7d = useMemo(() => heatLevels(muscleLoad(workoutStore.log, 7)), [workoutStore.log]);
  const recovery = useMemo(() => computeMuscleRecovery48h(levels7d), [levels7d]);

  const handleVoiceBriefing = () => {
    const m1 = t(fitKey.muscle(recovery.recommendedPair[0]));
    const m2 = t(fitKey.muscle(recovery.recommendedPair[1]));
    const message = copy.voiceText(osScore, openTasks, m1, m2);

    if (speaking || briefingText) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
      setSpeaking(false);
      setBriefingText(null);
      return;
    }

    setBriefingText(message);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(message);
        utter.lang = tag;
        utter.rate = 1.02;
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utter);
      } catch {
        setSpeaking(false);
      }
    }
  };

  const handleShareCard = () => {
    if (typeof document === 'undefined') return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
      bg.addColorStop(0, '#040711');
      bg.addColorStop(0.5, '#080d1c');
      bg.addColorStop(1, '#050813');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1350);

      const drawArc = (r: number, ratio: number, color: string) => {
        ctx.beginPath();
        ctx.arc(540, 480, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148,163,184,0.14)';
        ctx.lineWidth = 22;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(540, 480, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ratio / 100));
        ctx.strokeStyle = color;
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.stroke();
      };

      drawArc(220, mindPct, '#38bdf8');
      drawArc(182, execPct, '#f59e0b');
      drawArc(144, bodyPct, '#34d399');

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 32px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MONEO', 540, 130);

      ctx.fillStyle = '#f8fbff';
      ctx.font = '800 132px "JetBrains Mono", monospace';
      ctx.fillText(String(osScore), 540, 515);

      ctx.fillStyle = '#34d399';
      ctx.font = '800 38px Inter, system-ui, sans-serif';
      ctx.fillText(`${rankName.toUpperCase()} · LEVEL ${info.level} · ${xp.total} XP`, 540, 840);

      ctx.fillStyle = '#eaf2ff';
      ctx.font = '600 32px Inter, system-ui, sans-serif';
      ctx.fillText(`FOCUS ${mindPct}%   ·   PLAN ${execPct}%   ·   BODY ${bodyPct}%`, 540, 930);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 28px "JetBrains Mono", monospace';
      ctx.fillText('moneo.bond', 540, 1230);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `moneo-${osScore}.png`;
      a.click();
      setSharedToast(true);
      window.setTimeout(() => setSharedToast(false), 2600);
    } catch {
      /* ignore in headless test environments */
    }
  };

  return (
    <div className="mono-top-os-bar" data-testid="mono-top-os-bar">
      <button
        type="button"
        className="mono-top-xp-pill"
        onClick={onGoGrowth}
        title={`${rankName} · ${fmtNum(xp.total)} XP`}
      >
        <span className="mono-top-xp-badge">LVL {fmtNum(info.level)}</span>
        <span className="mono-top-xp-copy">
          <span className="mono-top-xp-line">
            <strong>{rankName}</strong> · {fmtNum(xp.total)} XP
          </span>
          <span className="mono-top-xp-track" aria-hidden="true">
            <span className="mono-top-xp-fill" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </button>

      <div className="mono-top-os-actions">
        {onOpenAi && (
          <button
            type="button"
            className="mono-top-os-btn mono-top-ai-btn"
            onClick={onOpenAi}
            data-testid="top-open-ai-btn"
          >
            ✦ Moneo AI
          </button>
        )}
        <button
          type="button"
          className={`mono-top-os-btn${speaking || briefingText ? ' is-live' : ''}`}
          onClick={handleVoiceBriefing}
          data-testid="jarvis-voice-btn"
        >
          {speaking || briefingText ? copy.briefStop : copy.briefBtn}
        </button>
        <button
          type="button"
          className="mono-top-os-btn"
          onClick={handleShareCard}
          data-testid="share-os-card-btn"
        >
          {sharedToast ? copy.shareDone : copy.shareBtn}
        </button>
      </div>
      {briefingText && (
        <div className="mono-briefing-banner" role="status" aria-live="polite">
          <span>{briefingText}</span>
          <button
            type="button"
            className="mono-briefing-close"
            onClick={handleVoiceBriefing}
            aria-label={t('timer.close')}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export const MonoTopOsBar = memo(MonoTopOsBarBase);

export interface MonoOsCommandDeckProps {
  dayKey: string;
  history: Session[];
  workoutStore: WorkoutStore;
  mindPct: number;
  execPct: number;
  bodyPct: number;
  habitsDoneToday: number;
  habitsTotalToday: number;
  onGo: (tab: MonoTab) => void;
  defaultTab?: 'fuel' | 'atomic' | 'body';
  /**
   * 'open' renders all 3 cards;
   * 'tabs' renders a 3-tab switcher;
   * 'fuel' | 'body' | 'atomic' renders ONLY that dedicated domain module on its home screen!
   */
  layout?: 'open' | 'tabs' | 'fuel' | 'body' | 'atomic';
}

function SectionIcon({ kind }: { kind: 'fuel' | 'body' | 'atomic' }) {
  if (kind === 'fuel') {
    return (
      <svg className="mono-os-sec-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c4.5 0 8 3.5 8 8 0 5.5-5 10-8 10s-8-4.5-8-10c0-4.5 3.5-8 8-8z" />
        <path d="M12 3v18M8 10l4 4 4-4" />
      </svg>
    );
  }
  if (kind === 'body') {
    return (
      <svg className="mono-os-sec-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
      </svg>
    );
  }
  return (
    <svg className="mono-os-sec-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19c4-1 8-4 11-9 2-3.5 3-6 5-6M15 4h5v5" />
    </svg>
  );
}

function MonoOsCommandDeckBase({
  dayKey,
  history,
  workoutStore,
  mindPct,
  execPct,
  bodyPct,
  habitsDoneToday,
  habitsTotalToday,
  onGo,
  defaultTab = 'fuel',
  layout = 'open',
}: MonoOsCommandDeckProps) {
  const { t, locale } = useI18n();
  const copy = COPY[locale] ?? COPY.en;

  const [activeTab, setActiveTab] = useState<'fuel' | 'atomic' | 'body'>(defaultTab);
  const [fuelState, setFuelState] = useState<FuelDayState>(() => loadFuelState());
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle>('chest');

  const updateFuel = (next: FuelDayState) => {
    setFuelState(next);
    saveFuelState(next);
  };

  const meals = useMemo(() => mealsForGoal(fuelState.goal), [fuelState.goal]);
  const mealsEatenToday = useMemo(() => {
    const slots: MealSlot[] = ['morning', 'lunch', 'dinner'];
    return slots.filter((s) => fuelState.eaten[`${dayKey}:${s}`]).length;
  }, [fuelState.eaten, dayKey]);

  const focusMinToday = useMemo(() => Math.round((mindPct / 100) * 90), [mindPct]);
  const macroBudget = useMemo(
    () =>
      computeMacroFactorBudget({
        goal: fuelState.goal,
        focusMinToday,
        workouts: workoutStore.log,
      }),
    [fuelState.goal, focusMinToday, workoutStore.log],
  );

  const twoMinChecksToday = useMemo(
    () => [0, 1, 2].map((idx) => Boolean(fuelState.twoMinChecks?.[`${dayKey}:act:${idx}`])),
    [fuelState.twoMinChecks, dayKey],
  );
  const twoMinDoneToday =
    Boolean(fuelState.twoMinDone?.[`${dayKey}:2min`]) || twoMinChecksToday.some(Boolean);

  const atomic = useMemo(
    () =>
      computeAtomicMetrics({
        history,
        workouts: workoutStore.log,
        habitsDoneToday,
        mealsEatenToday,
        twoMinDoneToday,
      }),
    [history, workoutStore.log, habitsDoneToday, mealsEatenToday, twoMinDoneToday],
  );

  const fuelPct = Math.round((mealsEatenToday / 3) * 100);
  const habitPct =
    habitsTotalToday > 0
      ? Math.round((habitsDoneToday / habitsTotalToday) * 100)
      : twoMinDoneToday
        ? 100
        : 0;

  const radar = useMemo(
    () =>
      compute5AxisRadar({
        mindPct,
        execPct,
        bodyPct,
        fuelPct,
        habitPct,
      }),
    [mindPct, execPct, bodyPct, fuelPct, habitPct],
  );

  const levels7d = useMemo(() => heatLevels(muscleLoad(workoutStore.log, 7)), [workoutStore.log]);
  const recovery = useMemo(() => computeMuscleRecovery48h(levels7d), [levels7d]);
  const fitbodCurve = useMemo(() => computeFitbodMuscleCurve(workoutStore.log), [workoutStore.log]);
  const synergyPct = useMemo(
    () => computeMindBodySynergy(history, workoutStore.log),
    [history, workoutStore.log],
  );

  const cadence28 = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const focusDays = new Set(history.map((s) => Math.floor((now - s.at) / dayMs)));
    const trainDays = new Set(workoutStore.log.map((w) => Math.floor((now - w.startedAt) / dayMs)));
    return Array.from({ length: 28 }, (_, idx) => {
      const daysAgo = 27 - idx;
      if (daysAgo === 0 && (habitsDoneToday > 0 || mealsEatenToday > 0 || twoMinDoneToday)) {
        return 'apex';
      }
      if (trainDays.has(daysAgo) && focusDays.has(daysAgo)) return 'apex';
      if (trainDays.has(daysAgo)) return 'body';
      if (focusDays.has(daysAgo)) return 'mind';
      return 'off';
    });
  }, [history, workoutStore.log, habitsDoneToday, mealsEatenToday, twoMinDoneToday]);

  const slotLabel = (slot: MealSlot) =>
    slot === 'morning' ? copy.slotMorning : slot === 'lunch' ? copy.slotLunch : copy.slotDinner;

  const radarPoint = (axisIdx: number, valPct: number) => {
    const angle = (Math.PI * 2 * axisIdx) / 5 - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, valPct)) / 100) * 66;
    const x = Number((110 + r * Math.cos(angle)).toFixed(1));
    const y = Number((102 + r * Math.sin(angle)).toFixed(1));
    return `${x},${y}`;
  };

  const hasAnyRadarData = radar.current.some((v) => v > 0);
  const currentPoly = radar.current.map((v, i) => radarPoint(i, v)).join(' ');
  const basePoly = radar.baseline.map((v, i) => radarPoint(i, v)).join(' ');

  const selectedDetail = fitbodCurve[selectedMuscle] ?? {
    muscle: selectedMuscle,
    pct: 100,
    hoursToFull: 0,
    status: 'fresh' as const,
  };

  const isSingle = layout === 'fuel' || layout === 'body' || layout === 'atomic';
  const showFuel =
    layout === 'open' || layout === 'fuel' || (layout === 'tabs' && activeTab === 'fuel');
  const showBody =
    layout === 'open' || layout === 'body' || (layout === 'tabs' && activeTab === 'body');
  const showAtomic =
    layout === 'open' || layout === 'atomic' || (layout === 'tabs' && activeTab === 'atomic');

  return (
    <section
      className={`mono-os-deck${layout === 'open' ? ' is-open-bento' : ''}${
        isSingle ? ' is-single-module' : ''
      }`}
      data-testid="mono-os-command-deck"
    >
      {/* Quick jump pills (shown only in multi-card or tabs mode) */}
      {!isSingle && (
        <div className="mono-os-deck-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'fuel'}
            className={`mono-os-deck-tab${activeTab === 'fuel' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('fuel')}
            data-testid="os-tab-fuel"
          >
            <SectionIcon kind="fuel" />
            <span>{copy.fuelSectionTitle}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'body'}
            className={`mono-os-deck-tab${activeTab === 'body' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('body')}
            data-testid="os-tab-body"
          >
            <SectionIcon kind="body" />
            <span>{copy.bodySectionTitle}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'atomic'}
            className={`mono-os-deck-tab${activeTab === 'atomic' ? ' is-on' : ''}`}
            onClick={() => setActiveTab('atomic')}
            data-testid="os-tab-atomic"
          >
            <SectionIcon kind="atomic" />
            <span>{copy.atomicSectionTitle}</span>
          </button>
        </div>
      )}

      <div className="mono-os-open-grid">
        {/* CARD 1: SMART NUTRITION & ANALOG INGREDIENT SWAPS (Idea #9 — MacroFactor Style) */}
        {showFuel && (
          <div className="mono-os-card-box" data-testid="os-panel-fuel">
            <div className="mono-os-card-head">
              <div className="mono-os-title-wrap">
                <SectionIcon kind="fuel" />
                <div>
                  <h3 className="mono-os-card-title">{copy.fuelSectionTitle}</h3>
                  <p className="mono-os-card-sub">{copy.fuelSectionSub}</p>
                </div>
              </div>
              <span className="mono-fuel-progress-badge">{mealsEatenToday} / 3</span>
            </div>

            <div className="mono-fuel-head">
              <div className="mono-fuel-goals" role="group">
                {(
                  [
                    ['cut', copy.goalCut],
                    ['bulk', copy.goalBulk],
                    ['energy', copy.goalEnergy],
                    ['balance', copy.goalBalance],
                  ] as Array<[NutritionGoal, string]>
                ).map(([g, label]) => (
                  <button
                    key={g}
                    type="button"
                    className={`mono-fuel-goal-pill${fuelState.goal === g ? ' is-on' : ''}`}
                    aria-pressed={fuelState.goal === g}
                    onClick={() => updateFuel({ ...fuelState, goal: g })}
                    data-testid={`fuel-goal-${g}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mono-fuel-macros">
                <span>
                  <strong>{macroBudget.targetKcal}</strong> kcal
                </span>
                <span>
                  <strong>{macroBudget.targetProteinG}g</strong> P
                </span>
                <span>
                  <strong>{macroBudget.targetCarbsG}g</strong> C
                </span>
                <span>
                  <strong>{macroBudget.targetFatG}g</strong> F
                </span>
              </div>
            </div>

            {(macroBudget.trainedToday || macroBudget.deepFocusToday) && (
              <div className="mono-fuel-adaptive-banner">
                ⚡{' '}
                {copy.adaptiveBonusLine(
                  macroBudget.workoutBonusProteinG,
                  macroBudget.focusBonusCarbsG,
                )}
              </div>
            )}

            <p className="mono-fuel-hint">{copy.swapHint}</p>

            <div className="mono-fuel-grid">
              {meals.map((meal) => {
                const eaten = Boolean(fuelState.eaten[`${dayKey}:${meal.slot}`]);
                return (
                  <article
                    key={meal.id}
                    className={`mono-fuel-card${eaten ? ' is-eaten' : ''}`}
                    data-testid={`meal-card-${meal.slot}`}
                  >
                    <div className="mono-fuel-card-top">
                      <span className="mono-fuel-slot">{slotLabel(meal.slot)}</span>
                      <button
                        type="button"
                        className={`mono-fuel-eat-btn${eaten ? ' is-on' : ''}`}
                        onClick={() => updateFuel(toggleMealEaten(fuelState, dayKey, meal.slot))}
                        data-testid={`meal-eaten-${meal.slot}`}
                      >
                        {eaten ? copy.eatenDone : copy.eatenMark}
                      </button>
                    </div>
                    <h4 className="mono-fuel-title">{meal.title[locale] ?? meal.title.en}</h4>
                    <p className="mono-fuel-meta">
                      {meal.kcal} kcal · {meal.proteinG}g P · {meal.carbsG}g C · {meal.fatG}g F
                    </p>
                    <div className="mono-fuel-ingredients">
                      {meal.ingredients.map((ing) => {
                        const swapIdx = fuelState.swaps[`${meal.id}:${ing.id}`] ?? 0;
                        const tuple = ing.options[locale] ?? ing.options.en;
                        const currentText = tuple[swapIdx] ?? tuple[0];
                        return (
                          <button
                            key={ing.id}
                            type="button"
                            className="mono-fuel-ing-chip"
                            onClick={() =>
                              updateFuel(cycleIngredientSwap(fuelState, meal.id, ing.id))
                            }
                            data-testid={`swap-${meal.slot}-${ing.id}`}
                          >
                            <span className="mono-fuel-ing-name">{currentText}</span>
                            <span className="mono-fuel-ing-swap">⇄ {swapIdx + 1}/4</span>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* CARD 2: BIOMETRIC HUMAN MUSCLE SCANNER & FITBOD 0-100% RECOVERY CURVE (Ideas #1, #3, #6) */}
        {showBody && (
          <div className="mono-os-card-box" data-testid="os-panel-body">
            <div className="mono-os-card-head">
              <div className="mono-os-title-wrap">
                <SectionIcon kind="body" />
                <div>
                  <h3 className="mono-os-card-title">{copy.bodySectionTitle}</h3>
                  <p className="mono-os-card-sub">{copy.bodySectionSub}</p>
                </div>
              </div>
              <span className="mono-fuel-progress-badge">{selectedDetail.pct}%</span>
            </div>

            <div className="mono-body-hud-grid">
              <div className="mono-body-hud-scanner-box">
                <div className="mono-body-hud-scanner">
                  <MonoBodyMap
                    levels={levels7d}
                    selected={selectedMuscle}
                    onPick={(m) => setSelectedMuscle(m)}
                    label="Biometric Muscle & Recovery Scanner"
                    className="mono-body-hud-svg"
                  />
                </div>
                <div className="mono-body-detail-bar">
                  <strong>
                    {copy.muscleDetailLine(
                      t(fitKey.muscle(selectedDetail.muscle)),
                      selectedDetail.pct,
                      selectedDetail.hoursToFull,
                    )}
                  </strong>
                </div>
              </div>

              <div className="mono-body-hud-info">
                {(() => {
                  const latestWithSet = [...workoutStore.log]
                    .sort((a, b) => b.startedAt - a.startedAt)
                    .find((w) => w.sets.length > 0);
                  const bestSet = latestWithSet?.sets[0];
                  const overloadHint = bestSet
                    ? {
                        en: `Progressive Overload: Next session, beat your last set (${bestSet.reps ?? 10} reps${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) by +1 rep or +2.5kg.`,
                        ro: `Supraîncărcare Progresivă: La următorul antrenament, depășește ultima serie (${bestSet.reps ?? 10} rep.${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) cu +1 rep. sau +2.5kg.`,
                        ru: `Прогрессия нагрузок: На следующей тренировке превзойдите последний подход (${bestSet.reps ?? 10} повт.${bestSet.kg ? ` × ${bestSet.kg}кг` : ''}) на +1 повт. или +2.5кг.`,
                        uk: `Прогресія навантажень: Наступного разу перевершіть останній підхід (${bestSet.reps ?? 10} повт.${bestSet.kg ? ` × ${bestSet.kg}кг` : ''}) на +1 повт. або +2.5кг.`,
                        de: `Progressive Überlastung: Übertriff beim nächsten Training deinen letzten Satz (${bestSet.reps ?? 10} Wdh.${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) um +1 Wdh. oder +2,5kg.`,
                        fr: `Surcharge progressive : À la prochaine séance, dépassez votre dernière série (${bestSet.reps ?? 10} rép.${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) de +1 rép. ou +2,5kg.`,
                        it: `Sovraccarico progressivo: Alla prossima sessione supera l'ultima serie (${bestSet.reps ?? 10} rip.${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) di +1 rip. o +2,5kg.`,
                        es: `Sobrecarga progresiva: En tu próxima sesión supera tu última serie (${bestSet.reps ?? 10} reps${bestSet.kg ? ` × ${bestSet.kg}kg` : ''}) con +1 rep o +2,5kg.`,
                      }[locale]
                    : {
                        en: 'Progressive Overload: Log your first workout to receive automatic +1 rep / +2.5kg next-session targets.',
                        ro: 'Supraîncărcare Progresivă: Salvează primul antrenament ca să primești automat ținte de progres (+1 rep. / +2.5kg).',
                        ru: 'Прогрессия нагрузок: Сохраните первую тренировку, чтобы получать точные цели (+1 повт. / +2.5кг).',
                        uk: 'Прогресія навантажень: Збережіть перше тренування для автоматичних цілей (+1 повт. / +2.5кг).',
                        de: 'Progressive Überlastung: Speichere dein erstes Workout für automatische +1 Wdh. / +2,5kg Ziele.',
                        fr: 'Surcharge progressive : Enregistrez votre première séance pour recevoir vos objectifs (+1 rép. / +2,5kg).',
                        it: 'Sovraccarico progressivo: Registra il primo allenamento per ricevere obiettivi automatici (+1 rip. / +2,5kg).',
                        es: 'Sobrecarga progresiva: Registra tu primer entrenamiento para recibir metas automáticas (+1 rep / +2,5kg).',
                      }[locale];
                  return <div className="mono-body-synergy-pill">{overloadHint}</div>;
                })()}

                {synergyPct !== null && (
                  <div className="mono-body-synergy-pill">{copy.synergyLine(synergyPct)}</div>
                )}

                <div className="mono-body-rec-group">
                  <span className="mono-os-kicker">{copy.recoveryReady}</span>
                  <div className="mono-body-muscle-chips">
                    {recovery.fresh.slice(0, 6).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`mono-body-mchip is-fresh${selectedMuscle === m ? ' is-sel' : ''}`}
                        onClick={() => setSelectedMuscle(m)}
                      >
                        ● {t(fitKey.muscle(m))} ({fitbodCurve[m]?.pct ?? 100}%)
                      </button>
                    ))}
                  </div>
                </div>

                {recovery.recovering.length > 0 || recovery.hot.length > 0 ? (
                  <div className="mono-body-rec-group">
                    <span className="mono-os-kicker">{copy.recoveryActive}</span>
                    <div className="mono-body-muscle-chips">
                      {[...recovery.hot, ...recovery.recovering].slice(0, 6).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`mono-body-mchip is-rec${selectedMuscle === m ? ' is-sel' : ''}`}
                          onClick={() => setSelectedMuscle(m)}
                        >
                          ◐ {t(fitKey.muscle(m))} ({fitbodCurve[m]?.pct ?? 64}%)
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {layout !== 'body' && (
                  <button
                    type="button"
                    className="mono-atomic-rescue-btn"
                    onClick={() => onGo('move')}
                    data-testid="body-open-move-btn"
                  >
                    {copy.openMoveCta}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CARD 3: 1% DAILY HABITS, 2-MINUTE RULE & 5-AXIS EVOLUTION RADAR (Ideas #10, #8) */}
        {showAtomic && (
          <div className="mono-os-card-box" data-testid="os-panel-atomic">
            <div className="mono-os-card-head">
              <div className="mono-os-title-wrap">
                <SectionIcon kind="atomic" />
                <div>
                  <h3 className="mono-os-card-title">{copy.atomicSectionTitle}</h3>
                  <p className="mono-os-card-sub">{copy.atomicSectionSub}</p>
                </div>
              </div>
              <span className="mono-fuel-progress-badge">{atomic.compoundMultiplier}×</span>
            </div>

            <div className="mono-atomic-grid">
              <div className="mono-atomic-col">
                <div className="mono-atomic-identities" role="group">
                  {(
                    [
                      ['builder', copy.idBuilder],
                      ['athlete', copy.idAthlete],
                      ['performer', copy.idPerformer],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mono-fuel-goal-pill${fuelState.identityId === id ? ' is-on' : ''}`}
                      aria-pressed={fuelState.identityId === id}
                      onClick={() => updateFuel({ ...fuelState, identityId: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mono-atomic-stats">
                  <div className="mono-atomic-stat">
                    <span className="mono-atomic-val">{atomic.identityVotes}</span>
                    <span className="mono-atomic-lbl">{copy.votesLabel}</span>
                  </div>
                  <div className="mono-atomic-stat">
                    <span className="mono-atomic-val is-lime">{atomic.compoundMultiplier}×</span>
                    <span className="mono-atomic-lbl">{copy.compoundLabel}</span>
                  </div>
                </div>

                {/* 3 Concrete 2-Minute Micro-Actions (James Clear 2-Minute Rule) */}
                <div className="mono-twomin-box">
                  <span className="mono-os-kicker">{copy.twoMinTitle}</span>
                  <div className="mono-twomin-list">
                    {copy.twoMinActions.map((actText, idx) => {
                      const k = `${dayKey}:act:${idx}`;
                      const checked = Boolean(fuelState.twoMinChecks?.[k]);
                      return (
                        <button
                          key={k}
                          type="button"
                          className={`mono-twomin-item${checked ? ' is-done' : ''}`}
                          onClick={() =>
                            updateFuel({
                              ...fuelState,
                              twoMinChecks: {
                                ...(fuelState.twoMinChecks ?? {}),
                                [k]: !checked,
                              },
                            })
                          }
                        >
                          <span className="mono-twomin-check">{checked ? '✓' : '○'}</span>
                          <span>{actText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="mono-atomic-stack">{copy.stackRule}</p>

                {atomic.neverMissTwiceAlert && (
                  <div className="mono-atomic-alert">{copy.neverMissAlert}</div>
                )}

                <button
                  type="button"
                  className={`mono-atomic-rescue-btn${twoMinDoneToday ? ' is-on' : ''}`}
                  onClick={() =>
                    updateFuel({
                      ...fuelState,
                      twoMinDone: {
                        ...(fuelState.twoMinDone ?? {}),
                        [`${dayKey}:2min`]: !twoMinDoneToday,
                      },
                    })
                  }
                  data-testid="atomic-2min-btn"
                >
                  {twoMinDoneToday ? copy.twoMinDone : copy.twoMinBtn}
                </button>
              </div>

              {/* Right Column: 5-Axis 30-Day Evolution Radar + 28-Day Consistency Matrix */}
              <div className="mono-atomic-radar-col">
                <span className="mono-os-kicker">{copy.radarTitle}</span>
                <svg
                  className="mono-radar-svg"
                  viewBox="0 0 220 205"
                  role="img"
                  aria-label={copy.radarTitle}
                >
                  {[25, 50, 75, 100].map((rPct) => (
                    <polygon
                      key={rPct}
                      points={[0, 1, 2, 3, 4].map((i) => radarPoint(i, rPct)).join(' ')}
                      fill="none"
                      stroke="var(--mono-border-2)"
                      strokeWidth="1"
                    />
                  ))}
                  {hasAnyRadarData ? (
                    <>
                      <polygon
                        points={basePoly}
                        fill="rgba(147,167,198,0.12)"
                        stroke="var(--mono-muted)"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                      />
                      <polygon
                        points={currentPoly}
                        fill="var(--mono-accent-soft)"
                        stroke="var(--mono-tint)"
                        strokeWidth="2.2"
                      />
                    </>
                  ) : (
                    <circle cx="110" cy="102" r="5" fill="var(--mono-tint)" fillOpacity="0.45" />
                  )}
                  {copy.radarAxes.map((label, i) => {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const lx = Number((110 + 88 * Math.cos(angle)).toFixed(1));
                    const ly = Number((105 + 88 * Math.sin(angle)).toFixed(1));
                    return (
                      <text
                        key={label}
                        x={lx}
                        y={ly}
                        textAnchor="middle"
                        fill="var(--mono-fg-2)"
                        fontSize="9.5"
                        fontFamily="var(--mono-font-mono)"
                        fontWeight="700"
                      >
                        {label} {radar.current[i]}%
                      </text>
                    );
                  })}
                </svg>

                <div className="mono-cadence-box" style={{ width: '100%' }}>
                  <div className="mono-cadence-head">
                    <span className="mono-os-kicker">{copy.cadenceTitle}</span>
                    <span className="mono-cadence-pct">{atomic.consistency28Pct}%</span>
                  </div>
                  <div className="mono-cadence-grid" aria-hidden="true">
                    {cadence28.map((tone, idx) => (
                      <span key={idx} className={`mono-cadence-led is-${tone}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export const MonoOsCommandDeck = memo(MonoOsCommandDeckBase);
export default MonoOsCommandDeck;

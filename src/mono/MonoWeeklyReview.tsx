import { memo, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Locale } from '../lib/i18n/types';
import type { Session } from '../lib/store';
import type { WorkoutEntry } from '../lib/fitness/workouts';
import { safeRead, safeWrite } from '../lib/storage/storageAdapter';

const STORAGE_KEY = 'moneo:weekly-review';

interface ReviewEntry {
  win: string;
  adjust: string;
  savedAt: number;
}

type ReviewStore = Record<string, ReviewEntry>;

interface ReviewCopy {
  kicker: string;
  title: string;
  sub: string;
  focusLbl: string;
  workoutsLbl: string;
  tasksLbl: string;
  winLbl: string;
  winPh: string;
  adjustLbl: string;
  adjustPh: string;
  saveBtn: string;
  savedBadge: string;
}

const COPY: Record<Locale, ReviewCopy> = {
  en: {
    kicker: 'WEEKLY REVIEW · 3 MIN',
    title: 'Close the week with clarity',
    sub: 'Review your real numbers, capture one win, and pick one adjustment for next week.',
    focusLbl: 'Focused (7d)',
    workoutsLbl: 'Workouts (7d)',
    tasksLbl: 'Tasks done',
    winLbl: 'Biggest win this week',
    winPh: 'e.g. Finished chapter 3 and trained 3 times',
    adjustLbl: 'One adjustment for next week',
    adjustPh: 'e.g. Start my #1 task before checking messages',
    saveBtn: 'Save weekly review',
    savedBadge: '✓ Saved for this week',
  },
  ro: {
    kicker: 'REVIZIE SĂPTĂMÂNALĂ · 3 MIN',
    title: 'Încheie săptămâna cu claritate',
    sub: 'Verifică cifrele reale, notează o reușită și alege o singură ajustare pentru săptămâna viitoare.',
    focusLbl: 'Focus (7 zile)',
    workoutsLbl: 'Antrenamente (7z)',
    tasksLbl: 'Sarcini gata',
    winLbl: 'Cea mai mare reușită a săptămânii',
    winPh: 'ex. Am terminat capitolul 3 și m-am antrenat de 3 ori',
    adjustLbl: 'O ajustare pentru săptămâna viitoare',
    adjustPh: 'ex. Încep prioritatea #1 înainte să verific mesajele',
    saveBtn: 'Salvează revizia',
    savedBadge: '✓ Salvată pe această săptămână',
  },
  ru: {
    kicker: 'ИТОГИ НЕДЕЛИ · 3 МИН',
    title: 'Закройте неделю с ясностью',
    sub: 'Оцените реальные цифры, зафиксируйте победу и выберите 1 улучшение на следующую неделю.',
    focusLbl: 'Фокус (7 дн.)',
    workoutsLbl: 'Тренировки (7д)',
    tasksLbl: 'Задачи',
    winLbl: 'Главная победа недели',
    winPh: 'напр. Завершил главу 3 и провёл 3 тренировки',
    adjustLbl: 'Одно улучшение на следующую неделю',
    adjustPh: 'напр. Начинать задачу #1 до проверки сообщений',
    saveBtn: 'Сохранить итоги',
    savedBadge: '✓ Сохранено на эту неделю',
  },
  uk: {
    kicker: 'ПІДСУМКИ ТИЖНЯ · 3 ХВ',
    title: 'Завершіть тиждень із ясністю',
    sub: 'Перегляньте реальні показники, зафіксуйте перемогу та оберіть 1 покращення.',
    focusLbl: 'Фокус (7 дн.)',
    workoutsLbl: 'Тренування (7д)',
    tasksLbl: 'Завдання',
    winLbl: 'Головна перемога тижня',
    winPh: 'напр. Завершив розділ 3 і провів 3 тренування',
    adjustLbl: 'Одне покращення на наступний тиждень',
    adjustPh: 'напр. Починати задачу #1 до перевірки повідомлень',
    saveBtn: 'Зберегти підсумки',
    savedBadge: '✓ Збережено на цей тиждень',
  },
  de: {
    kicker: 'WOCHENRÜCKBLICK · 3 MIN',
    title: 'Woche klar abschließen',
    sub: 'Prüfe deine echten Zahlen, halte einen Erfolg fest und wähle 1 Anpassung für nächste Woche.',
    focusLbl: 'Fokus (7T)',
    workoutsLbl: 'Workouts (7T)',
    tasksLbl: 'Erledigt',
    winLbl: 'Größter Erfolg dieser Woche',
    winPh: 'z. B. Kapitel 3 beendet und 3× trainiert',
    adjustLbl: 'Eine Anpassung für nächste Woche',
    adjustPh: 'z. B. Aufgabe #1 vor Nachrichten starten',
    saveBtn: 'Rückblick speichern',
    savedBadge: '✓ Für diese Woche gespeichert',
  },
  fr: {
    kicker: 'BILAN HEBDO · 3 MIN',
    title: 'Clôturer la semaine avec clarté',
    sub: 'Vérifiez vos chiffres réels, notez une réussite et choisissez un ajustement.',
    focusLbl: 'Focus (7j)',
    workoutsLbl: 'Séances (7j)',
    tasksLbl: 'Tâches finies',
    winLbl: 'Plus grande réussite de la semaine',
    winPh: 'ex. Chapitre 3 terminé et 3 entraînements',
    adjustLbl: 'Un ajustement pour la semaine prochaine',
    adjustPh: 'ex. Lancer la priorité #1 avant les messages',
    saveBtn: 'Enregistrer le bilan',
    savedBadge: '✓ Enregistré cette semaine',
  },
  it: {
    kicker: 'REVISIONE SETTIMANALE · 3 MIN',
    title: 'Chiudi la settimana con chiarezza',
    sub: 'Guarda i dati reali, registra un successo e scegli un solo miglioramento.',
    focusLbl: 'Focus (7g)',
    workoutsLbl: 'Allenamenti (7g)',
    tasksLbl: 'Attività fatte',
    winLbl: 'Miglior risultato della settimana',
    winPh: 'es. Finito il capitolo 3 e 3 allenamenti',
    adjustLbl: 'Un miglioramento per la prossima settimana',
    adjustPh: 'es. Iniziare la priorità #1 prima dei messaggi',
    saveBtn: 'Salva revisione',
    savedBadge: '✓ Salvata per questa settimana',
  },
  es: {
    kicker: 'REVISIÓN SEMANAL · 3 MIN',
    title: 'Cierra la semana con claridad',
    sub: 'Revisa tus datos reales, anota un logro y elige un ajuste para la próxima semana.',
    focusLbl: 'Enfoque (7d)',
    workoutsLbl: 'Entrenos (7d)',
    tasksLbl: 'Tareas listas',
    winLbl: 'Mayor logro de esta semana',
    winPh: 'ej. Terminé el capítulo 3 y entrené 3 veces',
    adjustLbl: 'Un ajuste para la próxima semana',
    adjustPh: 'ej. Empezar la prioridad #1 antes de mirar mensajes',
    saveBtn: 'Guardar revisión',
    savedBadge: '✓ Guardada esta semana',
  },
};

function isoWeekKey(now = Date.now()): string {
  const d = new Date(now);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface MonoWeeklyReviewProps {
  history: Session[];
  workouts: WorkoutEntry[];
  doneTasksCount: number;
}

function MonoWeeklyReviewBase({ history, workouts, doneTasksCount }: MonoWeeklyReviewProps) {
  const { locale, fmtDur, fmtNum } = useI18n();
  const copy = COPY[locale] ?? COPY.en;
  const weekKey = useMemo(() => isoWeekKey(), []);

  const initial = useMemo(() => {
    const store = safeRead<ReviewStore>(STORAGE_KEY);
    return store && typeof store === 'object' ? store[weekKey] : undefined;
  }, [weekKey]);

  const [win, setWin] = useState(initial?.win ?? '');
  const [adjust, setAdjust] = useState(initial?.adjust ?? '');
  const [savedToast, setSavedToast] = useState(Boolean(initial?.savedAt));

  const stats7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const focusMin = history
      .filter((s) => s.at >= cutoff)
      .reduce((sum, s) => sum + Math.max(0, s.min), 0);
    const workoutCount = workouts.filter((w) => w.startedAt >= cutoff).length;
    return { focusMin, workoutCount };
  }, [history, workouts]);

  const handleSave = () => {
    const prev = safeRead<ReviewStore>(STORAGE_KEY) ?? {};
    const next: ReviewStore = {
      ...prev,
      [weekKey]: { win: win.trim(), adjust: adjust.trim(), savedAt: Date.now() },
    };
    safeWrite(STORAGE_KEY, next);
    setSavedToast(true);
  };

  return (
    <section className="mono-os-card-box mono-weekly-review" data-testid="mono-weekly-review">
      <div className="mono-os-card-head">
        <div>
          <span className="mono-os-kicker">{copy.kicker}</span>
          <h3 className="mono-os-card-title">{copy.title}</h3>
          <p className="mono-os-card-sub">{copy.sub}</p>
        </div>
        <span className="mono-fuel-progress-badge">{weekKey}</span>
      </div>

      <div className="mono-wr-metrics">
        <div className="mono-wr-stat">
          <strong>{fmtDur(stats7d.focusMin)}</strong>
          <span>{copy.focusLbl}</span>
        </div>
        <div className="mono-wr-stat">
          <strong>{fmtNum(stats7d.workoutCount)}</strong>
          <span>{copy.workoutsLbl}</span>
        </div>
        <div className="mono-wr-stat">
          <strong>{fmtNum(doneTasksCount)}</strong>
          <span>{copy.tasksLbl}</span>
        </div>
      </div>

      <div className="mono-wr-fields">
        <label className="mono-wr-field">
          <span>{copy.winLbl}</span>
          <input
            type="text"
            value={win}
            onChange={(e) => {
              setWin(e.target.value);
              setSavedToast(false);
            }}
            placeholder={copy.winPh}
            maxLength={180}
          />
        </label>
        <label className="mono-wr-field">
          <span>{copy.adjustLbl}</span>
          <input
            type="text"
            value={adjust}
            onChange={(e) => {
              setAdjust(e.target.value);
              setSavedToast(false);
            }}
            placeholder={copy.adjustPh}
            maxLength={180}
          />
        </label>
      </div>

      <div className="mono-wr-foot">
        <button type="button" className="mono-btn mono-btn-primary" onClick={handleSave}>
          {copy.saveBtn}
        </button>
        {savedToast && <span className="mono-wr-saved">{copy.savedBadge}</span>}
      </div>
    </section>
  );
}

export const MonoWeeklyReview = memo(MonoWeeklyReviewBase);
export default MonoWeeklyReview;

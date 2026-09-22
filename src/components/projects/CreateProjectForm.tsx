import type { ProjectCategory } from '../../lib/projects';
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_KEYS } from '../../lib/projects';
import { useI18n } from '../../lib/i18n/LocaleContext';
import type { TKey } from '../../lib/i18n/types';

export interface CreateProjectFormProps {
  name: string;
  onName: (v: string) => void;
  category: ProjectCategory;
  onCategory: (c: ProjectCategory) => void;
  onCreate: () => void;
}

/** Inline "new project" form (moved verbatim out of ProjectsCard). */
export default function CreateProjectForm({
  name,
  onName,
  category,
  onCategory,
  onCreate,
}: CreateProjectFormProps) {
  const { t } = useI18n();
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-ink/60 p-4">
      <input
        type="text"
        value={name}
        maxLength={50}
        onChange={(e) => onName(e.target.value)}
        placeholder={t('proj.ph')}
        className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        autoFocus
      />
      <div className="flex items-center gap-3">
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value as ProjectCategory)}
          className="w-full rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
        >
          {PROJECT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(PROJECT_CATEGORY_KEYS[c] as TKey)}
            </option>
          ))}
        </select>
        <button
          onClick={onCreate}
          disabled={!name.trim()}
          className="press btn-accent flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
        >
          {t('proj.add')}
        </button>
      </div>
    </div>
  );
}

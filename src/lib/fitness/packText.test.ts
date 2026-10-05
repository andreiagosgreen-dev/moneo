import { describe, expect, it } from 'vitest';
import { nearestMinutes, parsePackRequest } from './packText';

const p = (s: string) => parsePackRequest(s);

describe('parsePackRequest', () => {
  it('reads Romanian', () => {
    expect(p('abdomen 15 minute cu roata, nivel mediu')).toEqual({
      choice: { zone: 'core', minutes: 15, level: 2 },
      gear: ['abWheel'],
    });
    expect(p('Vreau picioare și fesieri, 30 min, cu benzi mini, tabata').choice).toMatchObject({
      zone: 'lower',
      minutes: 30,
      format: 'tabata',
    });
    expect(p('picioare cu benzi mini').gear).toEqual(['miniBand']);
    expect(p('spate cu bandă elastică și gantere de 5 kg').gear).toEqual(['band', 'dumbbell']);
  });

  it('reads Russian and Ukrainian', () => {
    expect(p('пресс 20 минут, новичок')).toEqual({
      choice: { zone: 'core', minutes: 20, level: 1 },
      gear: [],
    });
    expect(p('спина 45 мин с турником, продвинутый').choice).toMatchObject({
      zone: 'back',
      level: 3,
    });
    expect(p('спина з турником').gear).toEqual(['pullupBar']);
    expect(p('розтяжка 10 хв').choice).toMatchObject({ zone: 'mobility', minutes: 10 });
    // "много" must not read as legs ("ног").
    expect(p('много работы').choice.zone).toBeUndefined();
  });

  it('reads English, German, French, Spanish and Italian', () => {
    expect(p('Full body, 1 hour, hard, sets with dumbbells')).toEqual({
      choice: { zone: 'full', minutes: 60, level: 3, format: 'sets' },
      gear: ['dumbbell'],
    });
    expect(p('Bauch 15 Min mit Bauchroller').choice.zone).toBe('core');
    expect(p('Bauch 15 Min mit Bauchroller').gear).toEqual(['abWheel']);
    expect(p('pompes et bras, 20 min, débutant').choice).toMatchObject({
      zone: 'upper',
      level: 1,
    });
    expect(p('glúteos con minibanda en circuito').choice).toMatchObject({
      zone: 'glutes',
      format: 'circuit',
    });
    expect(p('addominali 10 minuti').choice).toMatchObject({ zone: 'core', minutes: 10 });
  });

  it('avoids short-word false matches', () => {
    expect(p('corect, fără grabă').choice.zone).toBeUndefined();
    expect(p('massage roller for the back').gear).toEqual(['foamRoller']);
  });

  it('snaps minutes to the offered lengths', () => {
    expect(nearestMinutes(12)).toBe(10);
    expect(nearestMinutes(25)).toBe(30);
    expect(nearestMinutes(90)).toBe(60);
  });
});

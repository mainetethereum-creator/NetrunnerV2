'use client';

import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {VEGETATION_KEY, validateAsset, type VegetationAsset} from '../vegetation/format';
import type {BakeSettings} from './bake';
import styles from './VegetationEditor.module.css';

type FocusTarget = 'all' | 'grass' | 0 | 1 | 2;
type PreviewApi = {
  generate: (settings: BakeSettings) => VegetationAsset;
  focus: (target: FocusTarget) => void;
  dispose: () => void;
};

const initialSettings: BakeSettings = {seed: 724, height: 3.8, density: 40, gnarl: .65};

export default function VegetationEditor() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<PreviewApi | null>(null);
  const asset = useRef<VegetationAsset | null>(null);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settings, setSettings] = useState<BakeSettings>(initialSettings);
  const [notice, setNotice] = useState('Загрузка редактора…');
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<FocusTarget>('all');

  useEffect(() => {
    let stopped = false;
    import('./preview').then(({createPreview}) => {
      if (stopped || !host.current) return;
      api.current = createPreview(host.current);
      asset.current = api.current.generate(initialSettings);
      setReady(true);
      setNotice('Выберите дерево или траву. Ползунки обновляют модели автоматически.');
    }).catch(() => setNotice('Не удалось загрузить редактор. Обновите страницу.'));
    return () => {
      stopped = true;
      if (liveTimer.current) clearTimeout(liveTimer.current);
      api.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => {
      try {
        asset.current = api.current?.generate(settings) ?? null;
        api.current?.focus(focus);
        setNotice('Предпросмотр обновлён. Нажмите «Применить», чтобы сохранить вариант для зоны.');
      } catch {
        setNotice('Не удалось обновить модели. Уменьшите плотность.');
      }
    }, 120);
    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, [settings, ready, focus]);

  function chooseFocus(target: FocusTarget) {
    setFocus(target);
    api.current?.focus(target);
  }

  function apply() {
    if (!validateAsset(asset.current)) return;
    try {
      localStorage.setItem(VEGETATION_KEY, JSON.stringify(asset.current));
      setNotice('Модели сохранены для этого браузера и будут использованы в зоне вылазки.');
    } catch {
      setNotice('Недостаточно места в браузере. Скачайте JSON для сохранения.');
    }
  }

  function download() {
    if (!asset.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(asset.current)], {type: 'application/json'}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'test-patch.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const variants: Array<[FocusTarget, string]> = [
    ['all', 'Все варианты'],
    [0, 'Дерево 01'],
    [1, 'Дерево 02'],
    [2, 'Дерево 03'],
    ['grass', 'Трава'],
  ];

  return <main className={styles.root}>
    <div ref={host} className={styles.preview}/>
    <aside className={styles.panel}>
      <small>CYBERBASE / РЕДАКТОР КАРТЫ</small>
      <h1>Растительность</h1>
      <p>Выберите модель для осмотра. Изменения высоты, листвы и ветвей сразу появляются в окне слева.</p>
      <b>LOW POLY · INSTANCING · WORLD CHUNKS</b>
      <div className={styles.variants} aria-label="Варианты растительности">
        {variants.map(([target, label]) => <button key={String(target)} type="button" aria-pressed={focus === target} onClick={() => chooseFocus(target)}>{label}</button>)}
      </div>
      {([['seed', 'Seed', 1, 9999, 1], ['height', 'Высота дерева', 2, 5, .1], ['density', 'Плотность листвы', 8, 60, 1], ['gnarl', 'Изгиб ветвей', 0, 1, .05]] as const).map(([key, label, min, max, step]) => <label key={key}>
        {label}<span>{settings[key]}</span>
        <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => setSettings(current => ({...current, [key]: Number(event.target.value)}))}/>
      </label>)}
      <button disabled={!ready} onClick={apply}>Применить модели к зоне</button>
      <button disabled={!ready} onClick={download}>Скачать готовые модели · JSON</button>
      <button onClick={() => {try {localStorage.removeItem(VEGETATION_KEY); setNotice('Восстановлен опубликованный вариант растительности.');} catch {setNotice('Хранилище недоступно.');}}}>Сбросить локальный вариант</button>
      <Link href="/expedition?debug=1&vegetation=1">Открыть лесной участок в игре →</Link>
      <Link href="/">← На базу</Link>
      <p role="status">{notice}</p>
      <footer><a href="https://github.com/achrefelouafi/VegetationGeneratorThreeJS" target="_blank" rel="noreferrer">VegetationGeneratorThreeJS</a> · MIT<br/>Деревья: mohamedachrefelouafi. Трава: CyberBase.<br/>Перетаскивание — обзор · колесо — масштаб.</footer>
    </aside>
  </main>;
}

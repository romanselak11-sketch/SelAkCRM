# Дизайн-система SelAkCRM — Swiss Brutalism v1.0

Канон для UI CRM. Реализация: `frontend/src/styles/tokens.css` и модули в `frontend/src/styles/`.  
Правило для агентов: `.cursor/rules/design-swiss-brutalism.mdc`.

## 1. Философия

| Принцип | Смысл |
|--------|--------|
| Функция > декор | Каждый визуальный элемент несёт смысл. Нет теней «для объёма», нет цвета без роли. |
| Читаемость данных | Оператор работает 6–8 ч/день: контраст, выравнивание, иерархия важнее украшений. |
| Один акцент бренда | При онбординге клиента меняются только `--accent` и `--accent-hover`. |
| Умеренная плотность | Строки таблицы 48–56px. Не «воздух ради воздуха» и не Excel 2003. |

## 2. Цвета (spec)

| Токен | Hex (light) | Роль |
|-------|-------------|------|
| `--bg-page` | `#F0F2F5` | Фон страницы |
| `--bg-surface` | `#FFFFFF` | Карточки, таблицы, модалки, инпуты |
| `--text-primary` | `#0D0D0D` | Основной текст |
| `--text-secondary` | `#6B7280` | Подписи, placeholder, мета |
| `--border-default` | `#E5E7EB` | Разделители строк/секций |
| `--border-input` | `#D1D5DB` | Границы полей |
| `--accent` | `#FF4F00` | Primary, активные состояния |
| `--accent-hover` | `#E04300` | Hover primary |
| `--danger` | `#DC2626` | Ошибки, деструктивные действия |
| `--success` | `#16A34A` | Успех / завершено |

Производные (`--accent-soft`, `--danger-soft`, …) строятся от базовых.  
Legacy-алиасы в коде: `--bg` → `--bg-page`, `--fg` → `--text-primary`, `--surface` → `--bg-surface` и т.д.

Тёмная тема: нейтрали адаптируются, **`--accent` остаётся брендом** (`#FF4F00`).

### White-label

```css
:root {
  --accent: /* цвет клиента */;
  --accent-hover: /* ~10% темнее */;
}
```

## 3. Типографика

| Роль | Шрифт | Размер | Weight | LH / tracking |
|------|--------|--------|--------|----------------|
| H1 страница | Inter | 24px | 700 | 32px / -0.02em |
| H2 секция | Inter | 20px | 600 | 28px / -0.01em |
| H3 карточка | Inter | 16px | 600 | 24px / 0 |
| Body UI | Inter | **14px** | 400 | 20px |
| Caption / label | Inter | 12px | 500 | 16px / 0.01em |
| Числа в таблицах / KPI | JetBrains Mono | 14px | 400 | 20px |

Подключение: `frontend/index.html` (Google Fonts). Токены: `--font`, `--mono`, `--text-*`, `--lh-*`.

## 4. Сетка и отступы

- Базовый шаг: **4px** (`--space-*`).
- Контент: max-width **1440px**, padding **24px**.
- Карточка: padding **20px**, зазор между карточками **16px**.
- Поля формы: **16px** между полями; секции формы **24px**.
- Радиусы: **6px** контроли, до **8px** поверхности. Больше — запрещено. Тени: **none**.

## 5. Компоненты

### Кнопки (`Btn`, `buttons.css`)

| Вариант | Фон | Граница | Текст | Hover |
|---------|-----|---------|-------|-------|
| Primary | `--accent` | как фон | `--on-accent` | `--accent-hover` |
| Secondary (default) | `--bg-surface` | 1px `--text-primary` | `--text-primary` | фон `--bg-page` |
| Ghost | transparent | none | `--text-secondary` | фон `--bg-page`, текст primary |
| Danger | `--bg-surface` | 1px `--danger` | `--danger` | фон `#FEF2F2` |

Padding primary/secondary: 10×16px; ghost: 8×12px. Без градиентов и inset-теней.

### Таблицы (`DataTable*`, `tables.css`)

- Высота строки: 56px (default) / 48px (compact).
- Только горизонтальные разделители `--border-default`.
- Hover строки: `--bg-page`. Выбранная: inset 3px слева `--accent`.
- Заголовок: Caption, secondary, uppercase, tracking 0.05em, **не bold 700**.
- `numeric` — mono + вправо (суммы).
- `date` — mono, заголовок слева (короткие даты).
- `fit` — фиксированная узкая колонка + **ellipsis** (сроки на главной); полный текст в модалке / `title`.
- Действия (`DataTableActionCell` / `col--narrow`): ширина **≥9rem**, `overflow: visible`, выравнивание вправо — кнопки («В архив», «Изменить») не уезжают за край.
- Не раздувать таблицу горизонтальным скроллом ради полного срока.

### Формы

- Высота контрола: **40px** (compact 32px).
- Label над полем: Caption, `--text-primary`, зазор 4px.
- Placeholder: `--text-secondary`, не замена label.
- Focus: border `--text-primary` + ring 2px accent 20%.
- Ошибка: border `--danger`, фон поля не менять; текст ошибки под полем.
- `ValidatedInput` kind `money` \| `decimal`: автовыделение значения по клику/фокусу.

### Навигация (сайдбар)

- Ширина 240px / 64px.
- Фон `--bg-surface`, разделитель 1px `--border-default`.
- Активный пункт: фон `--bg-page` + левая полоса 3px `--accent` + semibold primary.
- Неактивный: `--text-secondary`; hover → primary.
- Иконки 20×20, stroke **1.5**; активная иконка = `--accent`.

### Статусы задач

- Только **точка + текст** (`TaskStatusBadge` + `.task-status-badge__dot`).
- Цвет несёт точка; текст — `--text-primary`. Не цветные «плашки».

### Пустые состояния

- Ориентир + следующий шаг (не голое «Нет данных»), где уместно.
- Длинные значения в списках можно обрезать; детали — в карточке/модалке.

## 6. Слои CSS (порядок импорта)

`tokens.css` → `primitives.css` → `index.css` →  
`layout` → `forms` → `buttons` → `tables` → `components` → `analytics`.

Новые стили страниц — в существующий слой или точечный модуль, **не** в раздутый монолит и не inline-цвета.

## 7. Чек-лист приёмки

- [ ] Интерфейс понятен без акцентного цвета
- [ ] Числовые столбцы: mono + вправо
- [ ] Нет теней, градиентов, radius >8px
- [ ] Есть hover / `:focus-visible` / disabled / error
- [ ] Контраст primary-текста на surface ≥ 7:1
- [ ] Placeholder не единственный label
- [ ] Статусы = точка + текст
- [ ] Money/decimal выделяются при клике

## 8. Связанные файлы

| Файл | Назначение |
|------|------------|
| `frontend/src/styles/tokens.css` | Токены |
| `frontend/src/styles/buttons.css` | Кнопки, badge |
| `frontend/src/styles/tables.css` | Таблицы, toolbar |
| `frontend/src/styles/forms.css` | Поля, focus, ошибки |
| `frontend/src/styles/layout.css` | Shell, sidebar, card, page |
| `frontend/src/components/Btn.tsx` | Кнопка |
| `frontend/src/components/DataTable.tsx` | Таблица |
| `frontend/src/components/TaskStatusBadge.tsx` | Статус |
| `frontend/src/styles/primitives.test.ts` | Регрессия DS |

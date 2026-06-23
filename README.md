# CSM Wiki

Статическая корпоративная wiki на Next.js для деплоя в GitHub Pages.

## Как это работает

- Контент хранится по локалям: `content/ru/**/*.md` и `content/en/**/*.md`.
- URL всегда начинается с локали: `/ru/...` или `/en/...`.
- Каждый Markdown-файл становится отдельной страницей wiki внутри своей локали.
- Главная (`/`) редиректит на дефолтную локаль (`/ru`).
- Приложение собирается в статический `out/` через `next build` (`output: export`).

## Формат контента

Пример файла `content/ru/getting-started.md`:

```md
---
title: Быстрый старт
description: Как начать работу с вики
order: 10
updatedAt: 2026-03-06
---

# Добро пожаловать в CSM Wiki
```

- `title` обязателен только для красивого названия. Если нет, заголовок будет собран из slug.
- `description` показывается в каталоге и на странице документа.
- `order` используется для сортировки в каталоге (меньше = выше).
- `icon` показывает иконку в навигации (берется из `public/assets/icons`).

### Иконки в навигации

Иконка задается через `icon` во frontmatter страницы или `index.md` папки:

```md
---
title: Быстрый старт
icon: summary
---
```

Правила:

- Если `icon` — это простое имя (`summary`), берется файл `public/assets/icons/summary.svg`.
- Можно указать путь явно: `icon: /assets/icons/summary.svg`.
- Любой текст/эмодзи тоже поддерживается и будет показан как есть.
- Цвет иконки наследуется от `color` ссылки (например `text-secondary`).

## Структура папок и index.md

- Папка в `content/<locale>/...` считается разделом в навигации.
- Название папки по умолчанию формируется из slug, но его можно переопределить.
- Чтобы задать красивое название раздела, добавьте файл `index.md` внутри папки и укажите `title` в frontmatter.
- Чтобы добавить описание раздела, укажите `description` в `index.md`.
- `title` и `description` из `index.md` используются в навигации и списках.
- `index.md` не отображается в списке страниц, но доступен по URL папки.
- Страница `index.md` остается доступной по URL папки.

Пример:

- `content/ru/guide/index.md` -> `/ru/guide`
- `content/en/guide/index.md` -> `/en/guide`
- `title` в `index.md` будет использован как имя раздела для каждой локали.
- `description` в `index.md` будет показан под названием раздела.

## Работа с локалями для контент-редактора

1. Создайте страницу на русском в `content/ru/...`.
2. Скопируйте файл в такой же путь внутри `content/en/...`.
3. Переведите только текст, `slug` в пути должен остаться одинаковым между языками.
4. Технический писатель обязан задублировать страницу в обеих локалях, даже если перевод еще не готов.
5. Если для второй локали не хватает времени или нужно доп. ревью перевода, используйте Empty State.

Пример:

- `content/ru/getting-started.md` -> `/ru/getting-started`
- `content/en/getting-started.md` -> `/en/getting-started`

## Empty State в Markdown

Чтобы показать заглушку в Markdown, добавьте на отдельной строке:

```md
[[empty-state]]
```

Можно задать свой текст (обычно на нужной локали):

```md
[[empty-state: This page is being drafted, we will publish it soon.]]
```

## Картинки в Markdown

Где хранить:

- Складывайте изображения в `public/<locale>/images/...`.
- Так ссылки остаются относительными и корректно работают и локально, и на GitHub Pages (из-за `basePath`).
- Поддерживаются обычные статичные форматы и анимированные GIF.

Как ссылаться:

- Используйте относительные пути до папки `images` внутри своей локали.
- Абсолютные пути вида `/images/...` не подходят для GitHub Pages.
- В альтернативном тексте (`![…]`) описывайте, что на изображении.

Примеры:

- Файл `content/ru/getting-started.md` (URL `/ru/getting-started`):
  `![Схема](../images/getting-started/overview.png)`
- Файл `content/ru/guide/setup.md` (URL `/ru/guide/setup`):
  `![Схема](../../images/guide/setup/overview.png)`
- Для GIF используйте те же относительные пути:
  `![Демонстрация](../images/getting-started/demo.gif)`

Если картинка нужна в двух языках, положите копию в обе папки:

- `public/ru/images/...`
- `public/en/images/...`

## Галерея изображений

Используйте блок с явным началом и концом:

```md
[[gallery columns=3 gap=12]]
![Скрин 1](../images/mock.jpg)
![Скрин 2](../images/mock.jpg)
![Скрин 3](../images/mock.jpg)
[[/gallery]]
```

Параметры:

- `columns` — количество колонок в сетке (по умолчанию `3`).
- `gap` — расстояние между карточками (по умолчанию `12px`).
- `layout` — вариант раскладки: `grid` (по умолчанию) или `carousel`.

Внутри галереи можно использовать обычный markdown для изображений, включая `alt`‑тексты.

## Инфо-блоки (note / tip / warning / custom)

Базовые варианты:

```md
[[info note]]
Это заметка.
[[/info]]

[[info tip]]
Это подсказка.
[[/info]]

[[info warning]]
Это предупреждение.
[[/info]]
```

Вариант с иконкой:

```md
[[info tip hasIcon]]
Подсказка с иконкой.
[[/info]]
```

Кастомный вариант с иконкой и цветом:

```md
[[info type=custom hasIcon icon=summary color=#ff5a3c]]
Кастомный блок с иконкой и цветом.
[[/info]]
```

Параметры:

- `type`: `note` | `tip` | `warning` | `custom` (по умолчанию `note`).
- `icon`: имя иконки или путь (правила такие же, как у `icon` во frontmatter).
- `color`: hex‑цвет `#rgb` или `#rrggbb`.
- `hasIcon`: если указан, иконка будет показана (по умолчанию иконки нет).

Цвета и дефолтные иконки для `note/tip/warning` настраиваются в теме через CSS‑переменные:
`--colors-info-note`, `--colors-info-tip`, `--colors-info-warning`.

## Кнопки-ссылки на сторы

Чтобы показать store badges в стиле лендингов, используйте обычные markdown-ссылки в строках `Ссылка на ...:` или `Link to ...:`.

Пример:

```md
Ссылка на iOS: [App Store](https://apps.apple.com/app/id123456789)
Ссылка на Android: [Google Play](https://play.google.com/store/apps/details?id=com.example.app)
```

Поддерживаемые платформы:

- `iOS`
- `Android`
- `AppGallery`
- `RuStore`

Правила:

- После `Ссылка на ...:` должна идти обычная markdown-ссылка `[текст](url)`.
- Если несколько таких строк идут подряд, они автоматически собираются в один блок бейджей.
- Текст ссылки можно писать любой, но визуально будет показан фирменный badge платформы.
- Если URL нет, бейдж не соберется: нужна именно markdown-ссылка, а не просто текст.

Пример для английской локали:

```md
Link to iOS: [App Store](https://apps.apple.com/app/id123456789)
Link to Android: [Google Play](https://play.google.com/store/apps/details?id=com.example.app)
```

## Delimiter (пустые строки)

Чтобы добавить вертикальный отступ (пустые строки) в Markdown, используйте `[[delimiter]]` на отдельной строке.

```md
[[delimiter]]
```

Можно задать количество строк через параметр `rows`:

```md
[[delimiter rows=3]]
```

Если в одном абзаце написано несколько токенов `[[delimiter ...]]`, они суммируются.

## Локальный запуск

```bash
npm ci
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Сборка и деплой на GitHub Pages

- Workflow: `.github/workflows/deploy.yml`
- Запуск: push в `main`
- Артефакт деплоя: папка `out/`

Важно:

- В `next.config.ts` `basePath` вычисляется автоматически из `GITHUB_REPOSITORY` в CI.
- Для локальной разработки `basePath` пустой.
- Для `gh-pages` используется статический экспорт (`output: export`) и `trailingSlash: true`, поэтому локализованные маршруты (`/ru/...`, `/en/...`) деплоятся без middleware.

Проверка перед push:

```bash
npm run lint
npm run build
```

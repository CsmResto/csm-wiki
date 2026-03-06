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

## Работа с локалями для контент-редактора

1. Создайте страницу на русском в `content/ru/...`.
2. Скопируйте файл в такой же путь внутри `content/en/...`.
3. Переведите только текст, `slug` в пути должен остаться одинаковым между языками.

Пример:

- `content/ru/getting-started.md` -> `/ru/getting-started`
- `content/en/getting-started.md` -> `/en/getting-started`

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

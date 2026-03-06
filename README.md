# CSM Wiki

Статическая корпоративная wiki на Next.js для деплоя в GitHub Pages.

## Как это работает

- Контент хранится в `content/**/*.md`.
- Каждый Markdown-файл становится отдельной страницей wiki.
- Главная страница автоматически строит каталог документов.
- Приложение собирается в статический `out/` через `next build` (`output: export`).

## Формат контента

Пример файла `content/getting-started.md`:

```md
---
title: Быстрый старт
description: Как начать работу с вики
order: 10
updatedAt: 2026-03-06
---

# Добро пожаловать
```

- `title` обязателен только для красивого названия. Если нет, заголовок будет собран из slug.
- `description` показывается в каталоге и на странице документа.
- `order` используется для сортировки в каталоге (меньше = выше).

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

Проверка перед push:

```bash
npm run lint
npm run build
```

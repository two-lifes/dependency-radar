# Как вести проект с Claude Code

Шпаргалка для себя. Главный принцип: **вы решаете, что и как делать, а Claude реализует маленькими проверяемыми шагами.**

## 0. Один раз перед стартом

1. `git init`, первый коммит с `CLAUDE.md` и `docs/` («docs: spec, screens, design»). Создать публичный репозиторий на GitHub и запушить. История коммитов тоже часть портфолио.
2. Положить `.claude/commands/next-task.md` (лежит рядом с этим файлом в архиве) — команда `/next-task` для стандартного цикла.
3. Разрешить безопасные команды, чтобы Claude не спрашивал каждый раз: в `/permissions` добавить `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git status`, `git diff`. Не разрешать заранее `git push`, `rm -rf`, работу с `.env`.
4. Ключи (`DATABASE_URL`, `GITHUB_TOKEN`, ключи авторизации) — только в `.env.local`, в чат их не вставлять.

## 1. Первая сессия: план, без кода

Включить plan mode (Shift+Tab) и написать:

> Read CLAUDE.md and every file in docs/. Do not write code. 1) List contradictions or gaps between spec.md, screens.md, decisions.md and the design docs. 2) Ask me questions about anything ambiguous. 3) Propose an MVP implementation plan as small tasks: each task fits one session, ends with lint/typecheck/tests green and something visible or testable. Then write it to docs/plan.md as a checklist.

Ответить на вопросы, поправить порядок задач, убрать лишнее. Закоммитить `docs/plan.md`. С этого момента план — общая память между сессиями.

Ориентировочный порядок задач MVP:
1. Каркас: Next.js, TS strict, Tailwind + `theme.css`, шрифты Geist, ESLint/Prettier, Vitest, Playwright, CI в GitHub Actions.
2. Пустой деплой на Vercel (деплой с первого дня).
3. Схема БД (Drizzle) и авторизация (Better Auth: GitHub + magic link).
4. Чистая логика анализа с тестами: semver-отставание, оценка здоровья, поиск breaking changes.
5. Клиенты источников (npm, OSV, GitHub) с кэшем и моками MSW.
6. Запуск проверки и стриминг прогресса (SSE).
7. Лендинг и гостевая проверка.
8. Отчёт: шапка, сводка, вкладки, таблица, фильтры в URL.
9. Карточка пакета.
10. Сохранение гостевого отчёта, дашборд, создание проекта, настройки.
11. Демо-аккаунт и сид.
12. Проход по состояниям, доступности и мобильной версии.
13. e2e-сценарии из критериев приёмки ТЗ, README.

## 2. Цикл на каждую задачу

1. `/clear` — новая задача начинается с чистого контекста.
2. `/next-task` (или вручную: plan mode → «Take the next unchecked task from docs/plan.md, propose a plan»).
3. Прочитать план. Править его до того, как разрешите писать код. Главные вопросы: какие файлы, откуда данные, какие крайние случаи, какие тесты.
4. Разрешить реализацию. Если Claude пошёл не туда — Esc сразу, не ждать конца.
5. Claude прогоняет `pnpm lint && pnpm typecheck && pnpm test`.
6. **Прочитать дифф самому.** Непонятная строка → «Explain why this is done this way» или переписать.
7. Открыть результат в браузере и сравнить с `screens.md` и `wireframes.png`.
8. Коммит (Conventional Commits), отметить задачу в `docs/plan.md`.
9. Если появилось архитектурное решение — запись в `docs/decisions.md`.

## 3. Привычки, которые экономят время

- **Одна задача — одна сессия.** Длинная сессия на несколько задач «пачкает» контекст, и качество падает. Если задача всё-таки длинная — `/compact`.
- **Маленькие шаги.** Если дифф больше нескольких сотен строк, задача была слишком крупной: разбейте её.
- **Тесты для логики — вперёд.** Для `src/server/analysis` сначала просите тесты на крайние случаи, потом реализацию.
- **Повторилась ошибка — правило в CLAUDE.md.** Агент второй раз захардкодил цвет или забыл пустое состояние → одна строка в CLAUDE.md, и это перестаёт повторяться.
- **Сверка с эталоном.** Раз в несколько задач: «Compare the current UI against docs/screens.md section X and list every mismatch».
- **Одна сложная часть руками** в каждом крупном блоке (например, оптимистичное обновление или хук фильтров в URL). Её вы и рассказываете на собеседовании.
- **Ветки и PR.** Ветка на этап (`mvp/report-table`), PR в main. Для портфолио история из осмысленных PR выглядит сильнее, чем сотня коммитов в main.
- **Продолжить вчерашнюю работу:** `claude --continue` возвращает последнюю сессию, но для новой задачи лучше начать с нуля и опереться на `docs/plan.md`.

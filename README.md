# СЕРЖ ГРИН. ЖИВОПИСЬ

Статическая галерея из 58 работ, подготовленная для GitHub Pages. Серверная часть, база данных, npm-пакеты и сборка не требуются. Изображения и Manrope Regular включены в проект.

## Перенос в другую папку

Распакуй подготовленный архив `serzh-green-github-pages.zip` в новую папку. Архив содержит только файлы нового репозитория, без истории Git и настроек прежнего хостинга.

Структура корня нового репозитория:

```text
.github/
  workflows/pages.yml
.gitattributes
.gitignore
README.md
scripts/
  check-site.mjs
dist/
  .nojekyll
  index.html
  app.js
  style.css
  artworks.json
  artworks-data.js
  artwork-layout.js
  fonts/
  pics/
```

Можно копировать всю эту структуру в папку с любым именем и на любой диск. Сохрани относительное расположение файлов и каталоги с именами `.github` и `dist`. В корне репозитория должны находиться `.github`, `scripts` и `dist`, а не дополнительная внешняя папка проекта.

При ручном копировании из исходного проекта перенеси перечисленные выше файлы и каталоги. **Не переноси старую `.git`**: она содержит историю и адрес репозитория прежнего хостинга. Каталог `.openai` новому репозиторию не нужен. Папки `work`, внешний `outputs`, скриншоты и архивы также не относятся к сайту. В подготовленном ZIP их нет.

Все используемые сайтом пути относительные: нет зависимости от диска C, имени локальной папки, localhost, прежнего домена или имени нового репозитория. Галерея рассчитана и на адрес `https://USER.github.io/REPOSITORY/`, и на корень пользовательского сайта `https://USER.github.io/`.

## Публикация на GitHub Pages

1. Создай на GitHub новый репозиторий. Для GitHub Free используй публичный репозиторий.
2. Загрузи в него содержимое распакованной папки с указанной выше структурой. Сохрани `.github/workflows/pages.yml`.
3. Открой **Settings → Pages → Build and deployment → Source** и выбери **GitHub Actions**. Пункт `Deploy from a branch` для этой структуры не используется: сайт находится в `dist`, а workflow публикует её содержимое.
4. Открой **Actions → Deploy gallery to GitHub Pages → Run workflow** и запусти процесс для основной ветки репозитория. Первый запуск вручную удобен, если файлы были загружены до включения Pages.
5. После успешного запуска адрес сайта появится в **Settings → Pages** и в результате задания **Deploy to GitHub Pages**.

Дальнейшие изменения в основной ветке публикуются автоматически. Workflow определяет основную ветку из настроек репозитория и не привязан к имени `main` или `master`. Персональный токен и ручная настройка секретов не нужны: используется встроенный `GITHUB_TOKEN` с разрешениями `contents: read`, `pages: write` и `id-token: write`.

При переносе через Git команды выполняются **в новой папке**, куда распакован архив:

```sh
git init
git add .
git commit -m "Prepare gallery for GitHub Pages"
git branch -M main
git remote add origin https://github.com/USER/REPOSITORY.git
git push -u origin main
```

Замени `USER` и `REPOSITORY` своим логином и именем созданного репозитория. После этого выполни шаги 3–5 выше.

## Локальная проверка

Из корня проекта, если установлен Node.js 18 или новее:

```sh
node scripts/check-site.mjs
```

Проверка не требует зависимостей. Она сверяет оба каталога, размеры изображений, существование файлов, точный регистр имён, относительные ссылки, синтаксис JavaScript и размер статического сайта. Та же проверка выполняется в GitHub Actions перед публикацией.

Для локального просмотра достаточно открыть `dist/index.html`. Если нужен HTTP-предпросмотр и установлен Python:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Затем открой `http://127.0.0.1:4173/`.

## Содержимое галереи

- Экспозиция — бесконечная лента с крупной центральной работой.
- Поле — свободная композиция: можно переставлять картины и перемещать всё пространство. Раскладка сохраняется до перезагрузки страницы.
- Просмотр работы — изображение, описание, материалы, размер и год. За год создания принят год публикации; дата показана только числом.
- Названия показаны капсом, «без названия» — строчными.

Данные находятся в `dist/artworks.json` и `dist/artworks-data.js`; они должны совпадать. Размеры изображений для раскладки — в `dist/artwork-layout.js`. Лицензия шрифта сохранена в `dist/fonts/OFL-Manrope.txt`. Права на произведения принадлежат их правообладателям.

## Документация GitHub

- [Публикация с помощью GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Выбор источника публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Создание сайта и расположение index.html](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Лимиты GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

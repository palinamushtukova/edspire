# EdSpire

> Рассылка коротких интерактивных уроков по химии для подростков 14–16 лет.
> Один урок — одна идея, разобранная так, чтобы её было интересно читать, а не зубрить.

🔗 **Сайт:** [edspire.by](https://edspire.by)

---

## О чём проект

EdSpire — это статический сайт-архив + email-рассылка. Каждую неделю выходит
новый урок. Все уроки доступны бесплатно, навсегда. Сайт сделан без фреймворков
и сборщиков — чистые HTML, CSS и немного ванильного JavaScript для интерактивов.

## Структура репозитория

```
edspire/
├── index.html                            ← главная: каталог уроков
├── 404.html                              ← страница "не нашли"
├── about/
│   └── index.html                        ← страница «о проекте» (история Полины)
├── lessons/
│   └── 01-what-is-chemistry/
│       ├── index.html                    ← урок №01
│       └── images/                       ← картинки этого урока
└── assets/
    ├── css/
    │   ├── base.css                      ← общие стили: палитра, шапка, footer
    │   ├── lesson.css                    ← стили страницы урока
    │   └── about.css                     ← стили страницы /about/
    ├── js/
    │   └── chem-finder.js                ← интерактив «найди химию» (урок №01)
    └── images/                           ← общие картинки (фото для /about/ и т.д.)
```

## Как добавить новый урок

1. Создай папку: `lessons/02-substances/` (slug любой, главное — без пробелов).
2. Скопируй в неё `lessons/01-what-is-chemistry/index.html`.
3. Поменяй внутри: title, meta description, заголовок, текст.
4. Если нужен новый интерактив — добавь JS в `assets/js/` и подключи в конце страницы.
5. На главной (`index.html`) найди карточку с `lesson-card--soon` и преврати её в активную:
   - убери класс `lesson-card--soon`
   - оберни `.lesson-card-content` в `<a href="lessons/02-substances/">`
   - убери тег «скоро», добавь нужные теги

## Как заменить плейсхолдеры на настоящие картинки

### Урок 01 (яичница и листья)

В `lessons/01-what-is-chemistry/index.html` найди блоки:

```html
<figure class="lesson-figure">
  <div class="image-placeholder">
    <span class="placeholder-icon">🍳</span>
    <span class="placeholder-caption">сюда — фото яичницы / images/eggs.jpg</span>
  </div>
</figure>
```

Положи свою картинку в `lessons/01-what-is-chemistry/images/eggs.jpg` и замени блок на:

```html
<figure class="lesson-figure">
  <img src="images/eggs.jpg" alt="Яичница на сковороде" />
</figure>
```

То же самое для `leaves.jpg`.

### Страница /about/ (фото Полины)

Положи фото в `assets/images/polina.jpg`. В `about/index.html` найди:

```html
<div class="intro-photo">
  <div class="image-placeholder">
    <span class="placeholder-icon">📷</span>
    <span class="placeholder-caption">сюда — твоё фото / images/polina.jpg</span>
  </div>
</div>
```

И замени внутренний `<div class="image-placeholder">…</div>` на:

```html
<img src="../assets/images/polina.jpg" alt="Полина Муштукова" />
```

### Tally-квиз в уроке 01

Найди блок `<div class="embed-placeholder">` и замени на:

```html
<div class="embed-wrap">
  <iframe
    src="https://tally.so/embed/wdjeWK?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
    width="100%" height="500" frameborder="0"
    title="Викторина: какая область химии?"></iframe>
</div>
```

Добавь в `assets/css/lesson.css` стили для `.embed-wrap` (рамка + radius — по аналогии с другими блоками).

### Видеоуроки на /about/

Найди три `<a class="youtube-card" href="#">` и проставь настоящие URL и названия.

### Email подписки

Найди по всему проекту `hello@edspire.example` и замени на свой адрес.
Файлы для проверки: `index.html`, `about/index.html`.

---

## Запуск локально

Сайт статический, никакой сборки. Два способа смотреть превью:

**1. Двойной клик** по `index.html` — откроется в браузере. Этого достаточно для проверки текста и стилей.

**2. Локальный сервер** (нужен, если хочется проверить пути и поведение как на GitHub Pages):

```bash
# Python (обычно уже стоит)
cd edspire
python3 -m http.server 8000

# или Node
npx serve
```

Открыть `http://localhost:8000`.

---

## Деплой на GitHub Pages

1. Создай новый репозиторий на GitHub — например, `edspire`.
2. Залей содержимое этой папки:

   ```bash
   cd edspire
   git init
   git add .
   git commit -m "first lesson"
   git branch -M main
   git remote add origin https://github.com/ТВОЙ-НИК/edspire.git
   git push -u origin main
   ```

3. В настройках репозитория: **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
   - Save

4. Через 1-2 минуты сайт будет на `https://ТВОЙ-НИК.github.io/edspire/`.

### Свой домен (опционально)

В **Settings → Pages → Custom domain** введи свой домен (например, `edspire.com`),
у регистратора домена добавь CNAME-запись на `ТВОЙ-НИК.github.io`. Файл `CNAME`
автоматически создастся в репозитории.

---

## Как делать рассылку

Сам урок живёт на сайте. В письме — короткий тизер:

- цепляющий заголовок,
- 2–3 абзаца «о чём этот выпуск»,
- большая кнопка **«Читать урок →»** со ссылкой на страницу.

В письма не имеет смысла пихать сложный интерактив — там почти не работает
JavaScript. Поэтому интерактивы живут на странице, а в письме — мотивация
кликнуть.

Рассылочные платформы, которые хорошо подходят:
- **Buttondown** (минимализм, Markdown + HTML)
- **MailerLite** (визуальный конструктор)
- **Resend** (если хочется отправлять через API)

---

## Стек и зависимости

- HTML + CSS + ванильный JavaScript
- Шрифты: [Unbounded](https://fonts.google.com/specimen/Unbounded) (display),
  [Manrope](https://fonts.google.com/specimen/Manrope) (текст),
  [Caveat](https://fonts.google.com/specimen/Caveat) (рукописные акценты),
  [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (мета)
- Никаких npm-пакетов, никакой сборки

## Палитра

| Цвет     | HEX       | Применение                                |
|----------|-----------|-------------------------------------------|
| Коралл   | `#E64D36` | основной фон, акценты                     |
| Кремовый | `#F5F4EE` | карточки, основной текст на коралле       |
| Графит   | `#2B3A4A` | везде, где был бы чёрный (текст, обводки) |
| Синий    | `#155EA9` | глобальный hover-цвет                     |
| Мандарин | `#EF8733` | вторичный тёплый акцент                   |
| Бирюза   | `#ACD8DC` | мягкие блоки (цитаты, награды)            |

## Лицензия

См. [LICENSE](LICENSE). Код — MIT. Тексты уроков и личная история — копирайт автора.

---

Сделано Полиной Муштуковой ✦ 2026

# AngelBite: деплой на Cloudflare Pages

Структура: `public/` — сайт, `functions/api/[[path]].js` — API, `schema.sql` — таблицы D1.
В `public/` лежит только то, что видно всем; схема, конфиг и код API наружу не отдаются.

## 1. База данных
```
npm i -g wrangler && wrangler login
wrangler d1 create angelbite          # скопируй database_id в wrangler.toml
wrangler d1 execute angelbite --remote --file=schema.sql
```

## 2. Проект
```
wrangler pages project create angelbite --production-branch main
wrangler pages secret put ADMIN_PASSWORD --project-name angelbite   # пароль аккаунта «Администрация»
wrangler pages deploy
```
Если подключаешь через GitHub/дашборд: Build output directory = `public`,
затем Settings → Functions → D1 bindings: переменная `DB` → база `angelbite`,
и Settings → Variables and Secrets: секрет `ADMIN_PASSWORD`.

## 3. Аккаунт администрации
Создаётся автоматически при первом входе под ником `Администрация` с паролем из `ADMIN_PASSWORD`.
Сменить пароль позже: удали строку админа
(`wrangler d1 execute angelbite --remote --command "DELETE FROM users WHERE is_admin=1"`),
поменяй секрет и войди заново.

## Дата вайпа
В `functions/api/[[path]].js` константа `WIPE_TS` (срок привилегии «1 вайп»), на сайте — `public/index.html`.

## Обновление экономики аккаунта
Для уже работающей базы добавь таблицу ежедневных сундуков перед использованием этой функции:
```
npx wrangler d1 execute angelbite-site --remote --file=migrations/0002_daily_claims.sql
```
Для стикерпаков примени следующую миграцию:
```
npx wrangler d1 execute angelbite-site --remote --file=migrations/0003_profile_stickers.sql
```
Для галереи, которую можно пополнять из аккаунта администрации, примени миграцию:
```
npx wrangler d1 execute angelbite-site --remote --file=migrations/0004_gallery.sql
```
Новые базы уже получают эту таблицу через `schema.sql`. Загруженные снимки автоматически уменьшаются в браузере и хранятся в D1; лимит галереи — 60 снимков.
Для новой базы все таблицы включены в `schema.sql`.

## Донат-прайс и рубины
В аккаунте отображаются цены PLUS / PRIME / ECLIPSE в рубинах. Купить рубины можно в Telegram-боте доната; оплату подтверждает, а рубины на сайт вручную зачисляет администрация. Сам сайт оплату не принимает. Заявки на привилегии также подтверждаются администрацией.

Новости, опубликованные администрацией в аккаунте, автоматически появляются в разделе «Обновления» на главной.

## Настройки, которые можно менять (в `functions/api/[[path]].js`, сверху)
- `DONATES` — названия и прайс в ⭐; онлайн-списание через сайт пока не включено
- `PRICE` — цены в кристаллах: цвет ника, значок, аватар (заглушки)
- `REWARD` — кристаллы за регистрацию и за голосование
- `COLORS`, `BADGES` — доступные цвета и значки
Если базу уже создавал по старой `schema.sql`, а аккаунтов ещё нет — удали базу и создай заново; `schema.sql` теперь содержит новые таблицы и поля в `users`.

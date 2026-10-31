// AngelBite API: Cloudflare Pages Functions + D1 (binding DB). Секрет ADMIN_PASSWORD задаётся в Cloudflare.
const ADMIN_NAME = 'Администрация';
const WIPE_TS = Date.parse('2026-12-14T00:00:00+01:00'); // дата вайпа — поменяй при переносе
const DAY = 86400000;
// Витринные цены в рубинах: 1 ⭐ = 2 ♦️. Заявки пока подтверждаются администрацией.
const DONATES = { plus: { name: 'PLUS', prices: { month: 100, three: 280, six: 540, year: 1000 } }, prime: { name: 'PRIME', prices: { month: 300, three: 800, six: 1400, year: 2000 } }, eclipse: { name: 'ECLIPSE', prices: { month: 500, three: 1500, six: 2400, year: 3000 } } };
const COLORS = ['#ff6b5f', '#d8a448', '#77b9d4', '#f07eae', '#70bd83', '#f2d15c', '#8276d8', '#eee7d6', '#c26f4d', '#63b6a5', '#a879c7', '#8b9d61'];
const BADGES = ['⭐', '🔥', '💎', '👑', '🦊', '🐱', '🌸', '⚡', '🎮', '🌙', '🍀', '👼', '🪶', '🪷', '🧭', '🕯️', '🪵', '🪨', '🐈‍⬛', '🦉', '🍄', '🫖', '🪻', '🪙', '💫', '🌟', '🪽', '🦋', '🐺', '🐼', '🐸', '🐙', '🪼', '🦄', '🧸', '🎀', '🪐', '☄️', '🌌', '🛸', '🎧', '🎨', '🧋', '🍓', '🍒', '🧁', '🦇', '🕸️', '🖤', '🤍', '❤️‍🔥', '🥀', '🔮', '🗝️', '🧿', '🏹', '🪄', '🧪', '📌', '🧷', '🪡'];
const PRICE = { color: 50, badge: 80, avatar: 100 }; // в кристаллах
const REWARD = { first: 50, vote: 10 };              // в кристаллах
const DAILY = { base: 20, streakStep: 5, streakCap: 6, weekBonus: 50 };
const localDay = (time = Date.now()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  const get = t => parts.find(x => x.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const previousDay = day => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const MAX_IMG = 400000; // длина base64 одной картинки
const enc = s => new TextEncoder().encode(s);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
const err = (m, s = 400) => json({ error: m }, s);

async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc(salt), iterations: 100000 }, k, 256));
}
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc(s)));
const rnd = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const cookie = (req, n) => (req.headers.get('cookie') || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === n)?.[1];

async function ensureAdmin(env) {
  if (!env.ADMIN_PASSWORD) return;
  const ex = await env.DB.prepare('SELECT id FROM users WHERE is_admin=1').first();
  if (ex) return;
  const salt = rnd(16);
  await env.DB.prepare('INSERT OR IGNORE INTO users(username,username_lc,mc,salt,pass_hash,is_admin,created) VALUES(?,?,?,?,?,1,?)')
    .bind(ADMIN_NAME, ADMIN_NAME.toLowerCase(), null, salt, await hashPw(env.ADMIN_PASSWORD, salt), Date.now()).run();
}
async function getUser(req, env) {
  const t = cookie(req, 'ab_session'); if (!t) return null;
  return await env.DB.prepare('SELECT u.id,u.username,u.mc,u.crystals,u.rubies,u.is_admin,u.nick_color,u.badge,u.avatar_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?')
    .bind(await sha(t), Date.now()).first();
}
async function privs(env, uid) {
  return (await env.DB.prepare('SELECT id,name,expires FROM privileges WHERE user_id=? AND expires>? ORDER BY expires').bind(uid, Date.now()).all()).results;
}
async function startSession(env, uid) {
  const t = rnd(32);
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await sha(t), uid, Date.now() + 30 * DAY).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();
  return { 'set-cookie': `ab_session=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 86400}` };
}
const publicUser = async (env, u) => ({ id: u.id, username: u.username, mc: u.mc, crystals: u.crystals, rubies: u.rubies, admin: !!u.is_admin, color: u.nick_color, badge: u.badge, avatar: u.avatar_id, privileges: await privs(env, u.id),
  items: (await env.DB.prepare('SELECT kind,value FROM user_items WHERE user_id=?').bind(u.id).all()).results });
const MAGIC = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': [0x52, 0x49, 0x46, 0x46] };

export async function onRequest({ request, env }) {
  if (!env.DB) return err('База данных не подключена', 500);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const m = request.method;
  let b = {};
  if (m === 'POST' || m === 'DELETE') {
    if (!(request.headers.get('content-type') || '').includes('application/json')) return err('Bad request');
    try { b = await request.json(); } catch { return err('Bad JSON'); }
  }
  const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  try {
    if (path === 'register' && m === 'POST') {
      const username = str(b.username, 24), mc = str(b.mc, 16), pw = typeof b.password === 'string' ? b.password : '';
      if (!/^[\p{L}\p{N}_\-]{3,24}$/u.test(username)) return err('Ник на сайте: 3–24 символа, буквы, цифры, _ и -');
      if (username.toLowerCase() === ADMIN_NAME.toLowerCase()) return err('Этот ник занят');
      if (!/^[A-Za-z0-9_]{3,16}$/.test(mc)) return err('Ник в Minecraft: 3–16 символов, латиница, цифры, _');
      if (pw.length < 6 || pw.length > 100) return err('Пароль: от 6 до 100 символов');
      if (pw !== b.password2) return err('Пароли не совпадают');
      const salt = rnd(16);
      try {
        const r = await env.DB.prepare('INSERT INTO users(username,username_lc,mc,salt,pass_hash,crystals,created) VALUES(?,?,?,?,?,?,?)').bind(username, username.toLowerCase(), mc, salt, await hashPw(pw, salt), REWARD.first, Date.now()).run();
        return json({ ok: true }, 200, await startSession(env, r.meta.last_row_id));
      } catch (e) {
        if (String(e).includes('UNIQUE')) return err('Такой ник на сайте или в Minecraft уже зарегистрирован', 409);
        throw e;
      }
    }
    if (path === 'login' && m === 'POST') {
      await ensureAdmin(env);
      const u = await env.DB.prepare('SELECT * FROM users WHERE username_lc=?').bind(str(b.username, 24).toLowerCase()).first();
      const pw = typeof b.password === 'string' ? b.password.slice(0, 100) : '';
      const h = await hashPw(pw, u ? u.salt : 'x'.repeat(32));
      if (!u || !same(h, u.pass_hash)) return err('Неверный ник или пароль', 401);
      return json({ ok: true }, 200, await startSession(env, u.id));
    }
    if (path === 'logout' && m === 'POST') {
      const t = cookie(request, 'ab_session');
      if (t) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(t)).run();
      return json({ ok: true }, 200, { 'set-cookie': 'ab_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
    }
    const me = await getUser(request, env);
    if (path === 'me' && m === 'GET') return json({ user: me ? await publicUser(env, me) : null });

    if (path === 'news' && m === 'GET') {
      const posts = (await env.DB.prepare('SELECT id,body,created FROM posts ORDER BY id DESC LIMIT 50').all()).results;
      const ids = posts.map(p => p.id);
      let opts = [], mine = [];
      if (ids.length) {
        const q = ids.join(',');
        opts = (await env.DB.prepare(`SELECT o.id,o.post_id,o.text,(SELECT COUNT(*) FROM votes v WHERE v.option_id=o.id) AS votes FROM poll_options o WHERE o.post_id IN (${q}) ORDER BY o.id`).all()).results;
        if (me) mine = (await env.DB.prepare(`SELECT post_id,option_id FROM votes WHERE user_id=? AND post_id IN (${q})`).bind(me.id).all()).results;
      }
      return json({ posts: posts.map(p => ({ ...p, options: opts.filter(o => o.post_id === p.id), myVote: mine.find(x => x.post_id === p.id)?.option_id ?? null })) });
    }
    if (path === 'vote' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const o = await env.DB.prepare('SELECT id FROM poll_options WHERE id=? AND post_id=?').bind(+b.option, +b.post).first();
      if (!o) return err('Нет такого варианта', 404);
      const r = await env.DB.prepare('INSERT OR IGNORE INTO votes(post_id,user_id,option_id) VALUES(?,?,?)').bind(+b.post, me.id, o.id).run();
      if (r.meta.changes > 0) await env.DB.prepare('UPDATE users SET crystals=crystals+? WHERE id=?').bind(REWARD.vote, me.id).run();
      return json({ ok: true, reward: r.meta.changes > 0 ? REWARD.vote : 0 });
    }


    if (path === 'config' && m === 'GET') return json({ donates: DONATES, colors: COLORS, badges: BADGES, price: PRICE, reward: REWARD, daily: DAILY });
    if (path === 'profile/sticker' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const image = Number(b.image);
      if (!Number.isSafeInteger(image) || image < 1) return err('Стикер не найден');
      const own = await env.DB.prepare('SELECT 1 AS x FROM sticker_packs p JOIN stickers s ON s.pack_id=p.id WHERE s.image_id=? AND p.user_id=? LIMIT 1').bind(image, me.id).first();
      if (!own) return err('Можно выбрать только свой стикер', 403);
      await env.DB.prepare('UPDATE users SET badge=? WHERE id=?').bind(`sticker:${image}`, me.id).run();
      return json({ ok: true });
    }

    // ---- бесплатные пользовательские стикерпаки ----
    if (path === 'stickers' && m === 'GET') {
      if (!me) return err('Нужно войти', 401);
      const packs = (await env.DB.prepare('SELECT id,name,created FROM sticker_packs WHERE user_id=? ORDER BY id DESC').bind(me.id).all()).results;
      const stickers = packs.length ? (await env.DB.prepare(`SELECT s.id,s.pack_id,s.label,s.image_id,i.mime FROM stickers s JOIN images i ON i.id=s.image_id WHERE s.pack_id IN (${packs.map(p => p.id).join(',')}) ORDER BY s.id DESC`).all()).results : [];
      return json({ packs: packs.map(p => ({ ...p, stickers: stickers.filter(s => s.pack_id === p.id) })) });
    }
    if (path === 'stickers/pack' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const name = str(b.name, 32);
      if (name.length < 2) return err('Название — от 2 до 32 символов');
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sticker_packs WHERE user_id=?').bind(me.id).first();
      if (count.n >= 5) return err('Можно создать не больше 5 паков');
      try {
        const r = await env.DB.prepare('INSERT INTO sticker_packs(user_id,name,created) VALUES(?,?,?)').bind(me.id, name, Date.now()).run();
        return json({ ok: true, id: r.meta.last_row_id });
      } catch (e) { if (String(e).includes('UNIQUE')) return err('Пак с таким названием уже есть'); throw e; }
    }
    if (path === 'stickers/add' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const pack = await env.DB.prepare('SELECT id FROM sticker_packs WHERE id=? AND user_id=?').bind(+b.pack, me.id).first();
      if (!pack) return err('Стикерпак не найден', 404);
      const im = await env.DB.prepare("SELECT id FROM images WHERE id=? AND owner_id=? AND kind='sticker'").bind(+b.image, me.id).first();
      if (!im) return err('Загрузи картинку для стикера');
      const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM stickers s JOIN sticker_packs p ON p.id=s.pack_id WHERE p.user_id=?').bind(me.id).first();
      const inPack = await env.DB.prepare('SELECT COUNT(*) AS n FROM stickers WHERE pack_id=?').bind(pack.id).first();
      if (total.n >= 100 || inPack.n >= 24) return err('Лимит: 24 стикера в паке и 100 на аккаунт');
      await env.DB.prepare('INSERT INTO stickers(pack_id,image_id,label,created) VALUES(?,?,?,?)').bind(pack.id, im.id, str(b.label, 32) || 'Стикер', Date.now()).run();
      return json({ ok: true });
    }
    if (path === 'stickers/delete' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const pack = await env.DB.prepare('SELECT id FROM sticker_packs WHERE id=? AND user_id=?').bind(+b.pack, me.id).first();
      if (!pack) return err('Стикерпак не найден', 404);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET badge=NULL WHERE badge LIKE 'sticker:%' AND CAST(SUBSTR(badge,9) AS INTEGER) IN (SELECT image_id FROM stickers WHERE pack_id=?)").bind(pack.id),
        env.DB.prepare('DELETE FROM images WHERE id IN (SELECT image_id FROM stickers WHERE pack_id=?) AND id NOT IN (SELECT image_id FROM messages WHERE image_id IS NOT NULL)').bind(pack.id),
        env.DB.prepare('DELETE FROM stickers WHERE pack_id=?').bind(pack.id),
        env.DB.prepare('DELETE FROM sticker_packs WHERE id=? AND user_id=?').bind(pack.id, me.id)
      ]);
      return json({ ok: true });
    }

    // ---- ежедневный сундук (кристаллы) ----
    if (path === 'daily' && m === 'GET') {
      if (!me) return err('Войди в аккаунт, чтобы забрать сундук', 401);
      const last = await env.DB.prepare('SELECT day,streak,crystals FROM daily_claims WHERE user_id=? ORDER BY day DESC LIMIT 1').bind(me.id).first();
      const today = localDay();
      const active = last && (last.day === today || last.day === previousDay(today));
      return json({ claimed: !!last && last.day === today, streak: active ? last.streak : 0, reward: DAILY, nextAt: today });
    }
    if (path === 'daily' && m === 'POST') {
      if (!me) return err('Войди в аккаунт, чтобы забрать сундук', 401);
      const today = localDay();
      const last = await env.DB.prepare('SELECT day,streak FROM daily_claims WHERE user_id=? ORDER BY day DESC LIMIT 1').bind(me.id).first();
      if (last?.day === today) return err('Сундук уже забран сегодня. Загляни завтра.');
      const streak = last?.day === previousDay(today) ? last.streak + 1 : 1;
      const crystals = DAILY.base + Math.min(streak - 1, DAILY.streakCap) * DAILY.streakStep + (streak % 7 === 0 ? DAILY.weekBonus : 0);
      try {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO daily_claims(user_id,day,streak,crystals,created) VALUES(?,?,?,?,?)').bind(me.id, today, streak, crystals, Date.now()),
          env.DB.prepare('UPDATE users SET crystals=crystals+? WHERE id=?').bind(crystals, me.id)
        ]);
      } catch (e) {
        if (String(e).includes('UNIQUE')) return err('Сундук уже забран сегодня. Загляни завтра.');
        throw e;
      }
      return json({ ok: true, crystals, streak, weekBonus: streak % 7 === 0 ? DAILY.weekBonus : 0 });
    }

    if (path === 'gallery' && m === 'GET') {
      const items = (await env.DB.prepare('SELECT id,image_id,title,alt,created FROM gallery_items ORDER BY created DESC,id DESC LIMIT 60').all()).results;
      return json({ items });
    }

    // ---- картинки ----
    if (path === 'img' && m === 'GET') {
      const id = +url.searchParams.get('id');
      const im = await env.DB.prepare('SELECT kind,mime,data FROM images WHERE id=?').bind(id).first();
      if (!im) return err('Not found', 404);
      if (im.kind === 'dm') {
        if (!me) return err('Нужно войти', 401);
        const ok = await env.DB.prepare('SELECT 1 AS x FROM messages WHERE image_id=? AND (from_id=? OR to_id=?)').bind(id, me.id, me.id).first();
        if (!ok) return err('Нет доступа', 403);
      }
      if (im.kind === 'sticker') {
        const ok = await env.DB.prepare('SELECT 1 AS x FROM sticker_packs p JOIN stickers s ON s.pack_id=p.id WHERE s.image_id=? AND p.user_id=? UNION SELECT 1 AS x FROM messages WHERE image_id=? AND (from_id=? OR to_id=?) UNION SELECT 1 AS x FROM users WHERE badge=? LIMIT 1').bind(id, me?.id || -1, id, me?.id || -1, me?.id || -1, `sticker:${id}`).first();
        if (!ok) return err('Нет доступа', 403);
      }
      if (im.kind === 'gallery') {
        const published = await env.DB.prepare('SELECT 1 AS x FROM gallery_items WHERE image_id=?').bind(id).first();
        if (!published) return err('Not found', 404);
      }
      const bin = Uint8Array.from(atob(im.data), c => c.charCodeAt(0));
      const cache = im.kind === 'dm' || im.kind === 'sticker' ? 'private, max-age=3600' : im.kind === 'gallery' ? 'public, max-age=86400' : 'public, max-age=300';
      return new Response(bin, { headers: { 'content-type': im.mime, 'x-content-type-options': 'nosniff', 'cache-control': cache, 'content-security-policy': "default-src 'none'" } });
    }
    if (path === 'upload' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const kind = b.kind === 'avatar' ? 'avatar' : b.kind === 'sticker' ? 'sticker' : 'dm';
      const mm = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(typeof b.data === 'string' ? b.data : '');
      if (!mm) return err('Нужна картинка JPEG, PNG или WebP');
      if (mm[2].length > MAX_IMG) return err('Картинка слишком большая');
      let head; try { head = Uint8Array.from(atob(mm[2].slice(0, 16)), c => c.charCodeAt(0)); } catch { return err('Битая картинка'); }
      if (!MAGIC[mm[1]].every((x, i) => head[i] === x)) return err('Файл не похож на картинку');
      if (kind === 'avatar' && !(await env.DB.prepare("SELECT 1 AS x FROM user_items WHERE user_id=? AND kind='avatar'").bind(me.id).first())) return err('Сначала купи аватар в магазине', 403);
      if (kind === 'sticker') {
        const owned = await env.DB.prepare('SELECT COUNT(*) AS n FROM stickers s JOIN sticker_packs p ON p.id=s.pack_id WHERE p.user_id=?').bind(me.id).first();
        if (owned.n >= 100) return err('На аккаунте уже 100 стикеров');
      }
      const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM images WHERE owner_id=?').bind(me.id).first();
      if (cnt.n >= 300) return err('Достигнут лимит картинок');
      const r = await env.DB.prepare('INSERT INTO images(owner_id,kind,mime,data,created) VALUES(?,?,?,?,?)').bind(me.id, kind, mm[1], mm[2], Date.now()).run();
      const id = r.meta.last_row_id;
      if (kind === 'avatar') await env.DB.prepare('UPDATE users SET avatar_id=? WHERE id=?').bind(id, me.id).run();
      return json({ ok: true, id });
    }

    // ---- донаты (рубины) ----
    if (path === 'donate' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      if (me.is_admin) return err('Администрации донат не нужен');
      const d = DONATES[b.plan], price = d?.prices?.[b.term]; if (!d || !Number.isInteger(price)) return err('Нет такого доната или срока', 404);
      await env.DB.prepare('INSERT INTO notes(user_id,kind,detail,created) VALUES(?,?,?,?)').bind(me.id, 'donate', `Заявка: ${d.name}, ${b.term} (${price} ♦️)`, Date.now()).run();
      return json({ ok: true });
    }

    // ---- магазин (кристаллы) ----
    if (path === 'shop/buy' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const kind = b.kind, value = kind === 'avatar' ? 'unlock' : str(b.value, 8);
      if (!PRICE[kind] || (kind === 'color' && !COLORS.includes(value)) || (kind === 'badge' && !BADGES.includes(value))) return err('Нет такого товара', 404);
      if (await env.DB.prepare('SELECT 1 AS x FROM user_items WHERE user_id=? AND kind=? AND value=?').bind(me.id, kind, value).first()) return err('Уже куплено');
      const r = await env.DB.prepare('UPDATE users SET crystals=crystals-? WHERE id=? AND crystals>=?').bind(PRICE[kind], me.id, PRICE[kind]).run();
      if (!r.meta.changes) return err('Не хватает кристаллов');
      await env.DB.prepare('INSERT OR IGNORE INTO user_items(user_id,kind,value) VALUES(?,?,?)').bind(me.id, kind, value).run();
      if (kind === 'color') await env.DB.prepare('UPDATE users SET nick_color=? WHERE id=?').bind(value, me.id).run();
      if (kind === 'badge') await env.DB.prepare('UPDATE users SET badge=? WHERE id=?').bind(value, me.id).run();
      return json({ ok: true });
    }
    if (path === 'shop/equip' && m === 'POST') {
      if (!me) return err('Нужно войти', 401);
      const col = { color: 'nick_color', badge: 'badge' }[b.kind]; if (!col) return err('Нельзя');
      const value = str(b.value, 8);
      if (value) {
        if (!(await env.DB.prepare('SELECT 1 AS x FROM user_items WHERE user_id=? AND kind=? AND value=?').bind(me.id, b.kind, value).first())) return err('Это не куплено', 403);
      }
      await env.DB.prepare(`UPDATE users SET ${col}=? WHERE id=?`).bind(value || null, me.id).run();
      return json({ ok: true });
    }

    // ---- личные сообщения ----
    if (path.startsWith('dm') || path === 'block') {
      if (!me) return err('Нужно войти', 401);
      const other = async n => env.DB.prepare('SELECT id,username,nick_color,badge,avatar_id FROM users WHERE username_lc=?').bind(str(n, 24).toLowerCase()).first();
      if (path === 'dm/list' && m === 'GET') {
        const rows = (await env.DB.prepare(`SELECT u.username,u.nick_color AS color,u.badge,u.avatar_id AS avatar, MAX(m.id) AS last_id, SUM(CASE WHEN m.to_id=? AND m.is_read=0 THEN 1 ELSE 0 END) AS unread
          FROM messages m JOIN users u ON u.id=CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END
          WHERE m.from_id=? OR m.to_id=? GROUP BY u.id ORDER BY last_id DESC LIMIT 50`).bind(me.id, me.id, me.id, me.id).all()).results;
        return json({ chats: rows });
      }
      if (path === 'dm' && m === 'GET') {
        const o = await other(url.searchParams.get('with')); if (!o) return err('Игрок не найден', 404);
        const rows = (await env.DB.prepare('SELECT id,from_id,body,image_id,created FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100').bind(me.id, o.id, o.id, me.id).all()).results.reverse();
        await env.DB.prepare('UPDATE messages SET is_read=1 WHERE to_id=? AND from_id=? AND is_read=0').bind(me.id, o.id).run();
        const bl = await env.DB.prepare('SELECT 1 AS x FROM blocks WHERE user_id=? AND blocked_id=?').bind(me.id, o.id).first();
        return json({ with: { username: o.username, color: o.nick_color, badge: o.badge, avatar: o.avatar_id }, blocked: !!bl, messages: rows.map(r => ({ id: r.id, mine: r.from_id === me.id, body: r.body, image: r.image_id, created: r.created })) });
      }
      if (path === 'dm' && m === 'POST') {
        const o = await other(b.to); if (!o) return err('Игрок не найден', 404);
        if (o.id === me.id) return err('Нельзя писать самому себе');
        const body = str(b.body, 1000), imageId = b.image ? +b.image : null;
        if (!body && !imageId) return err('Пустое сообщение');
        if (imageId && !(await env.DB.prepare("SELECT 1 AS x FROM images WHERE id=? AND owner_id=? AND kind='dm' UNION SELECT 1 AS x FROM stickers s JOIN sticker_packs p ON p.id=s.pack_id JOIN images i ON i.id=s.image_id WHERE i.id=? AND p.user_id=? LIMIT 1").bind(imageId, me.id, imageId, me.id).first())) return err('Картинка не найдена');
        if (await env.DB.prepare('SELECT 1 AS x FROM blocks WHERE user_id=? AND blocked_id=?').bind(o.id, me.id).first()) return err('Игрок не принимает от тебя сообщения', 403);
        const last = await env.DB.prepare('SELECT MAX(created) AS t FROM messages WHERE from_id=?').bind(me.id).first();
        if (last && last.t && Date.now() - last.t < 1500) return err('Не так быстро', 429);
        await env.DB.prepare('INSERT INTO messages(from_id,to_id,body,image_id,created) VALUES(?,?,?,?,?)').bind(me.id, o.id, body, imageId, Date.now()).run();
        return json({ ok: true });
      }
      if (path === 'block' && m === 'POST') {
        const o = await other(b.user); if (!o || o.id === me.id) return err('Игрок не найден', 404);
        if (b.on) await env.DB.prepare('INSERT OR IGNORE INTO blocks(user_id,blocked_id) VALUES(?,?)').bind(me.id, o.id).run();
        else await env.DB.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').bind(me.id, o.id).run();
        return json({ ok: true });
      }
    }

    if (path.startsWith('admin/') || (path === 'news' && m !== 'GET')) {
      if (!me || !me.is_admin) return err('Только для администрации', 403);
      if (path === 'admin/gallery' && m === 'GET') {
        const items = (await env.DB.prepare("SELECT g.id,g.image_id,g.title,g.alt,g.created FROM gallery_items g JOIN images i ON i.id=g.image_id WHERE i.owner_id=? AND i.kind='gallery' ORDER BY g.created DESC,g.id DESC LIMIT 60").bind(me.id).all()).results;
        return json({ items });
      }
      if (path === 'admin/gallery/add' && m === 'POST') {
        const title = str(b.title, 80), alt = str(b.alt, 180) || title;
        if (!title) return err('Добавь подпись к снимку');
        const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM gallery_items').first();
        if (count.n >= 60) return err('В галерее достигнут лимит в 60 снимков');
        const mm = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(typeof b.data === 'string' ? b.data : '');
        if (!mm) return err('Нужна картинка JPEG, PNG или WebP');
        if (mm[2].length > MAX_IMG) return err('Картинка слишком большая — попробуй файл поменьше');
        let head; try { head = Uint8Array.from(atob(mm[2].slice(0, 16)), c => c.charCodeAt(0)); } catch { return err('Битая картинка'); }
        if (!MAGIC[mm[1]].every((x, i) => head[i] === x)) return err('Файл не похож на картинку');
        const image = await env.DB.prepare("INSERT INTO images(owner_id,kind,mime,data,created) VALUES(?,'gallery',?,?,?)").bind(me.id, mm[1], mm[2], Date.now()).run();
        const imageId = image.meta.last_row_id;
        try {
          const created = Date.now();
          const item = await env.DB.prepare('INSERT INTO gallery_items(image_id,title,alt,created) VALUES(?,?,?,?)').bind(imageId, title, alt, created).run();
          return json({ ok: true, id: item.meta.last_row_id, image_id: imageId });
        } catch (e) {
          await env.DB.prepare("DELETE FROM images WHERE id=? AND owner_id=? AND kind='gallery'").bind(imageId, me.id).run();
          throw e;
        }
      }
      if (path === 'admin/gallery/delete' && m === 'POST') {
        const id = Number(b.id);
        if (!Number.isSafeInteger(id) || id < 1) return err('Снимок не найден');
        const item = await env.DB.prepare("SELECT g.image_id FROM gallery_items g JOIN images i ON i.id=g.image_id WHERE g.id=? AND i.owner_id=? AND i.kind='gallery'").bind(id, me.id).first();
        if (!item) return err('Снимок не найден', 404);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM gallery_items WHERE id=?').bind(id),
          env.DB.prepare("DELETE FROM images WHERE id=? AND owner_id=? AND kind='gallery'").bind(item.image_id, me.id)
        ]);
        return json({ ok: true });
      }
      if (path === 'news' && m === 'POST') {
        const body = str(b.body, 4000);
        if (!body) return err('Пустой текст');
        const options = Array.isArray(b.options) ? b.options.map(x => str(x, 100)).filter(Boolean).slice(0, 10) : [];
        if (options.length === 1) return err('Для опроса нужно минимум 2 варианта');
        const r = await env.DB.prepare('INSERT INTO posts(body,created) VALUES(?,?)').bind(body, Date.now()).run();
        for (const t of options) await env.DB.prepare('INSERT INTO poll_options(post_id,text) VALUES(?,?)').bind(r.meta.last_row_id, t).run();
        return json({ ok: true });
      }
      if (path === 'news' && m === 'DELETE') {
        const id = +b.id;
        await env.DB.batch([
          env.DB.prepare('DELETE FROM votes WHERE post_id=?').bind(id),
          env.DB.prepare('DELETE FROM poll_options WHERE post_id=?').bind(id),
          env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id)]);
        return json({ ok: true });
      }
      if (path === 'admin/notes' && m === 'GET') {
        const rows = (await env.DB.prepare('SELECT n.id,n.kind,n.detail,n.created,u.username,u.mc FROM notes n JOIN users u ON u.id=n.user_id ORDER BY n.id DESC LIMIT 100').all()).results;
        return json({ notes: rows });
      }
      if (path === 'admin/note-del' && m === 'POST') {
        await env.DB.prepare('DELETE FROM notes WHERE id=?').bind(+b.id).run();
        return json({ ok: true });
      }
      if (path === 'admin/users' && m === 'GET') {
        const us = (await env.DB.prepare('SELECT id,username,mc,crystals,rubies,is_admin FROM users ORDER BY id').all()).results;
        const ps = (await env.DB.prepare('SELECT id,user_id,name,expires FROM privileges WHERE expires>?').bind(Date.now()).all()).results;
        return json({ users: us.map(u => ({ ...u, privileges: ps.filter(p => p.user_id === u.id) })) });
      }
      const target = async () => env.DB.prepare('SELECT id FROM users WHERE username_lc=?').bind(str(b.user, 24).toLowerCase()).first();
      if (path === 'admin/grant' && m === 'POST') {
        const col = b.currency === 'rubies' ? 'rubies' : b.currency === 'crystals' ? 'crystals' : null;
        const n = Math.trunc(+b.amount);
        if (!col || !Number.isFinite(n) || n === 0 || Math.abs(n) > 1e9) return err('Неверная валюта или сумма');
        const t = await target(); if (!t) return err('Игрок не найден', 404);
        await env.DB.prepare(`UPDATE users SET ${col}=MAX(0,${col}+?) WHERE id=?`).bind(n, t.id).run();
        return json({ ok: true });
      }
      if (path === 'admin/priv' && m === 'POST') {
        const name = str(b.name, 40); if (!name) return err('Укажи привилегию');
        const days = { month: 30, half: 182, year: 365 }[b.duration];
        const exp = b.duration === 'wipe' ? WIPE_TS : days ? Date.now() + days * DAY : 0;
        if (!exp || exp <= Date.now()) return err('Неверный срок');
        const t = await target(); if (!t) return err('Игрок не найден', 404);
        await env.DB.prepare('INSERT INTO privileges(user_id,name,expires,created) VALUES(?,?,?,?)').bind(t.id, name, exp, Date.now()).run();
        return json({ ok: true });
      }
      if (path === 'admin/revoke' && m === 'POST') {
        await env.DB.prepare('DELETE FROM privileges WHERE id=?').bind(+b.id).run();
        return json({ ok: true });
      }
    }
    return err('Not found', 404);
  } catch (e) {
    return err('Ошибка сервера', 500);
  }
}

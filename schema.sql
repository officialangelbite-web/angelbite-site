CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_lc TEXT NOT NULL UNIQUE,
  mc TEXT UNIQUE COLLATE NOCASE,
  salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  crystals INTEGER NOT NULL DEFAULT 0,
  rubies INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  nick_color TEXT,
  badge TEXT,
  avatar_id INTEGER,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS privileges(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_options(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS votes(
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS user_items(
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(user_id,kind,value)
);
CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS images(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL,
  to_id INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS msg_pair ON messages(from_id,to_id);
CREATE INDEX IF NOT EXISTS msg_to ON messages(to_id,is_read);
CREATE TABLE IF NOT EXISTS blocks(
  user_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  PRIMARY KEY(user_id,blocked_id)
);
CREATE TABLE IF NOT EXISTS daily_claims(
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  streak INTEGER NOT NULL,
  crystals INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(user_id,day)
);
CREATE INDEX IF NOT EXISTS daily_claims_recent ON daily_claims(user_id,day DESC);
CREATE TABLE IF NOT EXISTS sticker_packs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created INTEGER NOT NULL,
  UNIQUE(user_id,name)
);
CREATE INDEX IF NOT EXISTS sticker_packs_user ON sticker_packs(user_id);
CREATE TABLE IF NOT EXISTS stickers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id INTEGER NOT NULL,
  image_id INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Стикер',
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stickers_pack ON stickers(pack_id);
CREATE TABLE IF NOT EXISTS gallery_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gallery_items_created ON gallery_items(created DESC);

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

CREATE TABLE IF NOT EXISTS gallery_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gallery_items_created ON gallery_items(created DESC);

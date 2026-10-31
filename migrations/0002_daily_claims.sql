CREATE TABLE IF NOT EXISTS daily_claims(
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  streak INTEGER NOT NULL,
  crystals INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(user_id,day)
);
CREATE INDEX IF NOT EXISTS daily_claims_recent ON daily_claims(user_id,day DESC);

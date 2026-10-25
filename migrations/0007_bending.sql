CREATE TABLE IF NOT EXISTS bending_companies (
  id TEXT PRIMARY KEY,
  rating REAL NOT NULL DEFAULT 1500,
  matches INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO bending_companies(id) VALUES
('notion'),('discord'),('dropbox'),('medium'),('canva'),('figma'),
('zoom'),('soundcloud'),('pinterest'),('calendly'),('todoist'),('strava');

CREATE TABLE IF NOT EXISTS bending_rounds (
  id TEXT PRIMARY KEY,
  pairs TEXT NOT NULL CHECK(json_valid(pairs)),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bending_rounds_created ON bending_rounds(created_at);

CREATE TABLE IF NOT EXISTS bending_votes (
  round_id TEXT NOT NULL REFERENCES bending_rounds(id),
  duel INTEGER NOT NULL CHECK(duel BETWEEN 0 AND 3),
  winner TEXT NOT NULL REFERENCES bending_companies(id),
  loser TEXT NOT NULL REFERENCES bending_companies(id),
  delta REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK(winner <> loser),
  PRIMARY KEY(round_id, duel)
);

-- The trigger calculates and applies Elo in the same serialized SQL statement.
-- Retries hit the primary key and cannot apply a vote twice.
CREATE TRIGGER IF NOT EXISTS bending_apply_elo AFTER INSERT ON bending_votes
BEGIN
  UPDATE bending_votes SET delta = 32.0 * (
    1.0 - 1.0 / (1.0 + pow(10.0, (
      (SELECT rating FROM bending_companies WHERE id=NEW.loser) -
      (SELECT rating FROM bending_companies WHERE id=NEW.winner)
    ) / 400.0))
  ) WHERE round_id=NEW.round_id AND duel=NEW.duel;

  UPDATE bending_companies SET
    rating = rating + CASE WHEN id=NEW.winner THEN 1 ELSE -1 END *
      (SELECT delta FROM bending_votes WHERE round_id=NEW.round_id AND duel=NEW.duel),
    matches = matches + 1,
    wins = wins + CASE WHEN id=NEW.winner THEN 1 ELSE 0 END
  WHERE id IN (NEW.winner, NEW.loser);
END;

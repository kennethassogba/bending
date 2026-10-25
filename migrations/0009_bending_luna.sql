CREATE TABLE IF NOT EXISTS bending_luna_companies (
  id TEXT PRIMARY KEY REFERENCES bending_companies(id),
  rating REAL NOT NULL DEFAULT 1500,
  matches INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO bending_luna_companies(id) SELECT id FROM bending_companies;

CREATE TABLE IF NOT EXISTS bending_luna_requests (
  round_id TEXT NOT NULL,
  duel INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(round_id,duel),
  FOREIGN KEY(round_id,duel) REFERENCES bending_votes(round_id,duel)
);

CREATE TABLE IF NOT EXISTS bending_luna_votes (
  round_id TEXT NOT NULL,
  duel INTEGER NOT NULL,
  winner TEXT NOT NULL REFERENCES bending_luna_companies(id),
  loser TEXT NOT NULL REFERENCES bending_luna_companies(id),
  delta REAL NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  provider_id TEXT,
  created_at INTEGER NOT NULL,
  CHECK(winner <> loser),
  PRIMARY KEY(round_id,duel),
  FOREIGN KEY(round_id,duel) REFERENCES bending_votes(round_id,duel)
);

CREATE TRIGGER IF NOT EXISTS bending_luna_apply_elo AFTER INSERT ON bending_luna_votes
BEGIN
  UPDATE bending_luna_votes SET delta = 32.0 * (
    1.0 - 1.0 / (1.0 + pow(10.0, (
      (SELECT rating FROM bending_luna_companies WHERE id=NEW.loser) -
      (SELECT rating FROM bending_luna_companies WHERE id=NEW.winner)
    ) / 400.0))
  ) WHERE round_id=NEW.round_id AND duel=NEW.duel;
  UPDATE bending_luna_companies SET
    rating = rating + CASE WHEN id=NEW.winner THEN 1 ELSE -1 END *
      (SELECT delta FROM bending_luna_votes WHERE round_id=NEW.round_id AND duel=NEW.duel),
    matches = matches + 1,
    wins = wins + CASE WHEN id=NEW.winner THEN 1 ELSE 0 END
  WHERE id IN (NEW.winner,NEW.loser);
END;

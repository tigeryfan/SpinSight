CREATE TABLE refresh_attempts (
  client_key TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX refresh_attempts_by_client_and_time ON refresh_attempts (client_key, attempted_at);
CREATE INDEX refresh_attempts_by_time ON refresh_attempts (attempted_at);

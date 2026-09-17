export interface Env {
  /** D1 binding defined in wrangler.toml */
  DB: D1Database;
  /** Greenwald API auth key */
  GREENWALD_AUTHKEY: string;
  /** Greenwald session cookie */
  GREENWALD_COOKIE: string;
  /** User-Agent string for Greenwald requests */
  GREENWALD_UA: string;
}
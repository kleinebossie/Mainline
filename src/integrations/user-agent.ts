// Descriptive User-Agent for every outbound platform call. Both platforms require
// it: Chess.com returns 403 without a proper UA (§6.3) and Lichess asks for a
// descriptive one (§6.2). This is an INFRASTRUCTURE constant (not a chess/learning
// value), so it lives in code; override per-deployment via CHESS_API_USER_AGENT.
// `||` (not `??`) so an empty CHESS_API_USER_AGENT="" in .env still uses the default
// (an empty User-Agent makes Chess.com return 403).
export const PLATFORM_USER_AGENT =
  process.env.CHESS_API_USER_AGENT?.trim() ||
  "mainline/0.1.0 (personalized chess training; closed beta)";

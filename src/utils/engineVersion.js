// Engines often put their version in the name, as in "id name syntaks 0.1.0".
// A trailing dotted number (optionally prefixed with "v" or followed by a
// pre-release suffix) is the version; a bare number, as in "Stockfish 16",
// is left alone since it can just as well be part of the name.
const versionPattern =
  /^(.*\S)\s+(v?\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?|v\d+)$/i;

export const splitEngineVersion = (name) => {
  const match = versionPattern.exec(String(name || "").trim());
  return match
    ? { name: match[1], version: match[2].replace(/^v(?=\d)/i, "") }
    : { name: String(name || "").trim(), version: "" };
};

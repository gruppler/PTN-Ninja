export const GIF_URL = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/gif`
  : "https://tps.ptn.ninja/gif";

export const PNG_URL = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/png`
  : "https://tps.ptn.ninja/png";

export const SHORTENER_SERVICE = process.env.DEV
  ? `http://localhost:5001/${process.env.projectId}/us-central1/short`
  : "https://us-central1-ptn-ninja.cloudfunctions.net/short";

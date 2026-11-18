/**
 * What went wrong with a request, in words people can act on.
 *
 * A browser reports a request that never got an answer (offline, blocked, a
 * server that refuses this site) only as a TypeError, "Failed to fetch" in
 * Chrome, "NetworkError when attempting to fetch resource" in Firefox and
 * "Load failed" in Safari, whatever the cause.
 */

export class HTTPError extends Error {
  constructor(status) {
    super("HTTP " + status);
    this.status = status;
  }
}

// Throw for a response that isn't OK, so callers handle it with the rest
export const checkResponse = (response) => {
  if (!response.ok) {
    throw new HTTPError(response.status);
  }
  return response;
};

const NETWORK_ERROR =
  /failed to fetch|networkerror|load failed|network request failed/i;

/**
 * "unreachable", "server" (with `status`) or "response"
 */
export function fetchErrorKind(error) {
  if (error instanceof HTTPError) {
    return { kind: "server", status: error.status };
  }
  if (error instanceof SyntaxError) {
    return { kind: "response" };
  }
  const message = (error && (error.message || String(error))) || "";
  if (error instanceof TypeError || NETWORK_ERROR.test(message)) {
    return { kind: "unreachable" };
  }
  return { kind: "unknown", message };
}

/**
 * A sentence about `source` (already translated, e.g. "the PlayTak opening
 * database") and what went wrong with it
 */
export function describeFetchError(i18n, source, error) {
  const { kind, status, message } = fetchErrorKind(error);
  switch (kind) {
    case "unreachable":
      return i18n.t("error.fetch.unreachable", { source });
    case "server":
      return i18n.t("error.fetch.server", { source, status });
    case "response":
      return i18n.t("error.fetch.response", { source });
    default:
      return message
        ? i18n.t("error.fetch.other", { source, message })
        : i18n.t("error.fetch.unknown", { source });
  }
}

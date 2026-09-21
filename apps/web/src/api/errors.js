/** A message fit to show a user for a failed request. */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const fromServer = err?.response?.data?.error;
  if (fromServer) return fromServer;
  if (err?.response) return fallback;
  return "Can't reach the server. Check your connection and try again.";
}

/** Test-only teardown after statement/connection cleanup. Fetch pools may retain
 * HTTP sockets (including an unread body after an expected acquisition error).
 * Stop accepting requests first, then release those sockets; never use this to
 * interrupt SQL or disguise an assertion failure. */
export function closeTestServer(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

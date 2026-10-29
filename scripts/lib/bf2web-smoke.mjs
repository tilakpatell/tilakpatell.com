// Only known optional frontend resources may be absent during the publication smoke check.
export const optionalPlayPath = (pathname) => /^\/profile\//.test(pathname) ||
  /^\/(?:battlefront\/engine\/[A-Za-z0-9._-]+\/)?ui-data\/backdrop\//.test(pathname);

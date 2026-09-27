// Browser modules cache-bust with `./file.js?v=x.y.z`. Node only needs the path.
export async function resolve(specifier, context, nextResolve) {
  const queryIndex = specifier.indexOf("?");
  if (queryIndex !== -1 && !specifier.startsWith("node:") && !/^[a-z]+:/i.test(specifier)) {
    return nextResolve(specifier.slice(0, queryIndex), context);
  }
  return nextResolve(specifier, context);
}

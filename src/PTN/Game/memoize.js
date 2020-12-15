// Stripped-down version of lodash's implementation of memoize.
// Limits cache size to 1.
export default function (func, resolver) {
  var memoized = function () {
    var args = arguments,
      key = resolver ? resolver.apply(this, args) : args[0],
      cache = memoized.cache;

    if (cache[0] === key) {
      return cache[1];
    }
    var result = func.apply(this, args);
    memoized.cache = [key, result];
    return result;
  };
  memoized.cache = [];
  return memoized;
}

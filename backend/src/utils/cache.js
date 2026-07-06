let cache = {};

module.exports = {
  get: (key) => {
    return cache[key];
  },
  set: (key, value) => {
    cache[key] = value;
  },
  clear: () => {
    console.log("Clearing all analytical caches.");
    cache = {};
  }
};

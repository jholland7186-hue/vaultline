module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Zustand v5 ESM uses import.meta.env; Expo web serves a classic
          // script, so without this transform the page stays blank.
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};

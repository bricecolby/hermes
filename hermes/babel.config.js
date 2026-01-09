module.exports = function (api) {
    require('esbuild-register'); // Ensure TypeScript files are transpiled
    api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
        [
          "module-resolver",
          {
            root: ["./src"],
            alias: {
              "@": "./src",
            },
          },
        ],
        [
          "@tamagui/babel-plugin", // This should be a separate plugin entry
          {
            config: "./tamagui.config.ts",
            components: ["tamagui"],
            logTimings: true,
          },
        ],
        "react-native-reanimated/plugin", 
    ],
  };
};
  

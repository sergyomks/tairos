module.exports = {
  apps: [
    {
      name: "tairos-runner",
      script: "./index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

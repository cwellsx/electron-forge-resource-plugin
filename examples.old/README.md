# Old configuration example

This is an example of the old style of configuration.

- [`package.json`](./package.json) defines the Electron Forge configuration using JSON

Or:

- [`forge.config.ts`](./forge.config.ts) defines the Electron Forge configuration as a filename (i.e. a string)

  ```ts
  new WebpackPlugin({
      mainConfig: "./webpack.main.config.js",
  ```

  instead of:

  ```ts
  new WebpackPlugin({
      mainConfig,
  ```

In these cases:

- When the resource plugin's hooks are run, the Webpack configuration is defined in files,
  instead of instantiated as a JavaScript object.
- So the Webpack configuration is not easy for this plugin to edit.
- So instead you must manually edit `webpack.main.config.js` to add the `webpack.DefinePlugin` --
  so that the environment variable defined by the resource plugin is passed to the application.

Here's an example of that:

- [`webpack.main.config.js`](./webpack.main.config.js)

  ```js
  plugins: [
    new webpack.DefinePlugin({
      CORE_EXE: JSON.stringify(process.env.CORE_EXE),
    }),
  ],
  ```

And for completeness here are the examples of the other webpack configuration files, which you do not need to edit:

- [`webpack.renderer.config.js`](./webpack.renderer.config.js)
- [`webpack.plugins.js`](./webpack.plugins.js)
- [`webpack.rules.js`](./webpack.rules.js)

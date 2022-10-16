# Electron Forge Resource Plugin

This is a plugin for Electron Forge.

- [Purpose](#purpose)
- [How to use it](#how-to-use-it)
  - [Configure it in `package.json`](#configure-it-in-packagejson)
  - [Add the environment variable to `webpack.main.config.js`](#add-the-environment-variable-to-webpackmainconfigjs)
  - [Use the environment variable in your application](#use-the-environment-variable-in-your-application)
- [Configuration](#configuration)
  - [`env`](#env)
  - [`path`](#path)
  - [`build.command`](#buildcommand)
  - [`build.sources`](#buildsources)
  - [`package.dirname`](#packagedirname)
  - [`package.copydir`](#packagecopydir)
- [Packaging a directory](#packaging-a-directory)
- [Notes](#notes)
  - [Using hooks instead of a plugin](#using-hooks-instead-of-a-plugin)
  - [Error when installing the plugin locally](#error-when-installing-the-plugin-locally)

## Purpose

Use this if you have:

- An Electron application built using Electron Forge, and
- A resource, whose path is needed by your application, and which isn't built by Electron Forge

For example:

- I have a .NET executable which I want to invoke --
  it is built using `dotnet`, not by Electron Forge, and it exists outside the application's normal `src` directory.
- As well as executables, you could also use this for building documentation; media files; etc.

This lets you specify:

- The resource's path
- How to build it, and when to rebuild it
- Whether to package either only the specified file, or the whole directory in which it is contained

The plugin will then:

- Integrate with the Electron Forge build
- Rebuild the resource when needed
- Hook the [Packager Config](https://www.electronforge.io/configuration#packager-config) to package the resource
- Define the resource path as an environment variable when the application is built --
  this environment variable varies, depending on whether the application is run locally or is packaged

## How to use it

To use this plugin:

1. Include it as a development tool dependency of your project, for example using

   ```
   npm install -D electron-forge-resource-plugin
   ```

2. Configure it by adding to the `config.forge.plugins` array in your `package.json`
3. Add to your `webpack.main.config.js` to make the new environment variable available to your application
4. Use the new environment in your application

### Configure it in `package.json`

Add a new element to the `config.forge.plugins` array of your `package.json`, for example:

```json
"plugins": [
  [
    "electron-forge-resource-plugin",
    {
      "env": "CORE_EXE",
      "path": "./src.dotnet/bin/Release/net5.0/Core.exe",
      "build": {
        "command": "dotnet.exe build ./src.dotnet/Core.csproj --verbosity normal --configuration Release",
        "sources": "./src.dotnet/"
      },
      "package": {
        "dirname": "core"
      },
      "verbose": true
    }
  ],
  [
    "@electron-forge/plugin-webpack",
```

The above configuration, which is shown as an example, is copied from the `dotnet` branch of this project:

- [Electron Forge Template](https://github.com/cwellsx/electron_forge_template/blob/dotnet/BOILERPLATE.md#add-ipc-to-an-external-process)

### Add the environment variable to `webpack.main.config.js`

Add the `webpack.DefinePlugin` to `webpack.main.config.js`
so that the environment variable defined by the resource plugin is passed to the application.

```js
const webpack = require("webpack");

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/index.ts",
  // Put your normal webpack config below here
  module: {
    rules: require("./webpack.rules"),
  },
  plugins: [
    new webpack.DefinePlugin({
      CORE_EXE: JSON.stringify(process.env.CORE_EXE),
    }),
  ],
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
  },
};
```

Ideally this plugin would do this for you automatically,
however the `@electron-forge/plugin-webpack` plugin is already launching and controlling webpack --
it is configurable, e.g. by editing `webpack.main.config.js` as shown above,
but it doesn't seem to be extensible programmatically.

### Use the environment variable in your application

Your main application can now read the value, for example:

```ts
declare const CORE_EXE: string;
log(`CORE_EXE is ${CORE_EXE}`);
```

This is like how Electron Forge defines
[`_WEBPACK_ENTRY`](https://www.electronforge.io/config/plugins/webpack#project-setup) values.

## Configuration

This is the configuration interface as it's declared in the source code.

```ts
export interface ResourcePluginConfig {
  env: string;
  path: string;
  build?: {
    command: string;
    sources?: string | string[] | { always: boolean };
  };
  package?: {
    dirname?: string;
    copydir?: boolean;
  };
  verbose?: boolean;
}
```

To configure it you define values in the `package.json` of your project,
for example [as shown above](#configure-it-in-packagejson).

### `env`

The name of the environment variable which the plugin will define.

- This should match the name which you pass to the `DefinePlugin` in `webpack.plugins.js`, and use in your application.

### `path`

The path to the resource (a file), when the application is started locally or packaged.

- The hook will throw an exception, if the specified path is non-existent and the `build.command` is undefined.

### `build.command`

Optional: the command to build the resource.

- If defined, this command will be run using
  [child_process.exec](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback).

### `build.sources`

Optional: the source from which the resource is built.

- If defined, this will rerun the `build.command`
  when the the contents of `build.sources` are more recent that the file specified by the `path`.
- If `build.sources` is undefined, then by default the `build.command` is run only when `path` does not already exist.
- The `build.sources` can specify one or more files and/or directories.
- Or the `build.sources` can specify `{ always: boolean }` to specify that the `build.command` should be run every time.

### `package.dirname`

Optional: the name of the subdirectory in the packaged `resources` directory

### `package.copydir`

Optional: whether to package only the file specified by `path`, or package the whole directory which contains that file.

- If `package.copydir` is undefined, then the default is `true` if `package.dirname` is defined, otherwise `false`.

## Packaging a directory

When the resource is an executable and the application is started locally, it only needs the `path` of the executable,
for example:

- `./src.dotnet/bin/Release/net5.0/Core.exe`

When the application is packaged, the package must also include the executable's dependencies,
i.e. the whole directory in which the file is contained:

- `./src.dotnet/bin/Release/net5.0/*.*`

You can configure this scenario using the optional `package.dirname` and `package.copydir` entries.

| dirname   | copydir   | Meaning                                                                                   |
| --------- | --------- | ----------------------------------------------------------------------------------------- |
| undefined | undefined | Only the resource file is packaged:<br/>`./resources/Core.exe`                            |
| defined   | undefined | The whole directory is copied into the specified subdirectory:<br/>`./resources/core/*.*` |
| undefined | `= true`  | The whole directory is copied with its name unaltered:<br/>`./resources/net5.0/*.*`       |
| defined   | `= false` | Only the file is copied into the specified subdirectory:<br/>`./resources/core/Core.exe`  |

## Notes

### Using hooks instead of a plugin

Instead of writing or using a plugin, it's possible to configure the build using "Hooks" e.g. as follows:

```js
// https://www.electronforge.io/configuration#hooks
// https://stackoverflow.com/questions/64097951/electron-forge-how-to-specify-hooks
// https://github.com/electron-userland/electron-forge/issues/197

const execFileSync = require("child_process").execFileSync;

module.exports = {
  generateAssets: async (forgeConfig, platform, arch) => {
    console.log("\r\nWe should generate some assets here\r\n");
    execFileSync("dotnet.exe", [
      "build",
      "./src.dotnet/Core.csproj",
      "--verbosity",
      "normal",
      "--configuration",
      "Release",
    ]);
    console.log("\r\nAssets generated\r\n");
  },
};
```

The benefit of a plugin like this one, instead of hooks, is that a plugin is easily configurable and therefore reusable.

### Error when installing the plugin locally

When developing the plugin it's convenient to install it into your application locally:

```bash
npm install -D ../electron-forge-resource-plugin
```

If you do then there's an error when you try to run it:

```
An unhandled rejection has occurred inside Forge:
Error: Multiple plugins tried to take control of the start command, please remove one of them
 --> resource, webpack

Electron Forge was terminated.
```

To fix this you must add a line of code to your application's
`./node_modules/@electron-forge/core/dist/util/plugin-interface.js`:

```js
    async overrideStartLogic(opts) {
        let newStartFn;
        const claimed = [];
        for (const plugin of this.plugins){
            if (typeof plugin.startLogic === 'function' && plugin.startLogic !== _pluginBase.default.prototype.startLogic) {
                if (plugin.name === "resource") continue; // <== allow the resource plugin to be installed locally
                claimed.push(plugin.name);
                newStartFn = plugin.startLogic;
            }
        }
        if (claimed.length > 1) {
            throw new Error(`Multiple plugins tried to take control of the start command, please remove one of them\n --> ${claimed.join(', ')}`);
        }
```

This is because when you install this resource plugin locally,
it loads and uses its own copy of the the plugin base class.

I thought that instead you could temporarily rename the application's
`./node_modules/electron-forge-resource-plugin/node_modules` folder to hide it --
but that doesn't work because the resource plugin still doesn't use the original copy of plugin_base
(and I don't know why not) -- so I alter `plugin-interface.js` as shown above.

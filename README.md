# Electron Forge Resource Plugin

This is a plugin for Electron Forge.

- [Purpose](#purpose)
- [How to use it](#how-to-use-it)
  - [Configure it in `forge.config.ts`](#configure-it-in-forgeconfigts)
  - [Use the path in your application](#use-the-path-in-your-application)
- [Configuration](#configuration)
  - [`env`](#env)
  - [`path`](#path)
  - [`build.command`](#buildcommand)
  - [`build.sources`](#buildsources)
  - [`package.dirname`](#packagedirname)
  - [`package.copydir`](#packagecopydir)
  - [`verbose`](#verbose)
- [Packaging a directory](#packaging-a-directory)
- [Notes](#notes)
  - [Using hooks instead of a plugin](#using-hooks-instead-of-a-plugin)
  - [Error message `Multiple plugins tried to take control of the start command, please remove one of them`](#error-message-multiple-plugins-tried-to-take-control-of-the-start-command-please-remove-one-of-them)
  - [Older configuration](#older-configuration)

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

2. Configure it by adding to the `config.plugins` array of your `forge.config.ts`
3. Use the new symbol in your application

### Configure it in `forge.config.ts`

Add a new element to the `config.plugins` array of your `forge.config.ts`, for example:

```ts
new ResourcePlugin({
  env: "CORE_EXE",
  path: "./src.dotnet/bin/Release/net5.0/Core.exe",
  build: {
    command: "dotnet.exe build ./src.dotnet/Core.csproj --verbosity normal --configuration Release",
    sources: "./src.dotnet/",
  },
  package: {
    dirname: "core",
  },
  verbose: true,
});
```

The above configuration, which is shown as an example, is copied from the `dotnet` branch of this project:

- [Electron Forge Template](https://github.com/cwellsx/electron_forge_template/blob/dotnet/BOILERPLATE.md#add-ipc-to-an-external-process)

See [the `examples.new` folder](./examples.new) for a complete example of the configuration files.

### Use the path in your application

Your main application can now read the value of the symbol, for example:

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

To configure the plugin you pass this data to the plugin's constructor in your `forge.config.ts`
for example [as shown above](#configure-it-in-forgeconfigts).

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

### `verbose`

Optional: enables the `log` method which writes progress messages to `console.log` which is helpful for debugging.

To use this option you must also set the `DEBUG` environment variable to include `electron-forge` -- because otherwise
the output is overwritten by the `listr2` package, which Electron Forge scripts use to write their progress messages.

Set that environment variable before the scripts are run, for example on Windows by editing `package.json` as follow:

```json
  "scripts": {
    "start": "set DEBUG=electron-forge&& electron-forge start",
```

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

### Error message `Multiple plugins tried to take control of the start command, please remove one of them`

When you install this plugin into an Electron Forge project, you may get an error like the following when you
run the `npm run start` comment:

```
An unhandled rejection has occurred inside Forge:
Error: Multiple plugins tried to take control of the start command, please remove one of them
 --> resource, webpack

Electron Forge was terminated.
```

The reason for this error message is:

- This plugin is a subclass of the Electron Forge `PluginBase` class,
  and therefore defines a version of that class as a dependency
- The `PluginBase` class is also used by other plugins including the Webpack plugin
- If this plugin depends on a newer version of the `PluginBase` class than is already used in your project,
  then it's installed with its own private copy of the `PluginBase` class
- Having two installed instances of the `PluginBase` class triggers this error

To fix it, ensure that the version of Electron Forge used by your project is the same or later than the version
used by this plugin -- if not, update the dependencies of your project to use a newer version.

### Older configuration

The resource plugin is able to define the new symbol automatically, but only
if the Webpack configuration is imported (i.e. instantiated) as JavaScript objects in the `forge.config.ts` file.

In either of the following cases it cannot do this automatically:

- Electron forge configuration is defined as JSON in `package.json` instead of as JavaScript in `forge.config.ts`
- The Webpack Plugin configuration references Webpack configurations as filenames, which are loaded
  by the Webpack Plugin instead of being imported into `forge.config.ts` before the plugins' hook methods are called

In these cases you must edit a Webpack configuration file manually:
see [the `examples.old` folder](./examples.old) for details.

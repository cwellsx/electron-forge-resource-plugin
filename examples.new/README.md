# New configuration example

This is an example of the new style of configuration.

- [`package.json`](./package.json) is clean, without any Electron Forge configuration.
- [`forge.config.ts`](./forge.config.ts) defines the Electron Forge configuration using TypeScript (not JSON).

To use this plugin you add it (i.e. instantiate it) into the `plugins` array in `forge.config.ts`.

`forge.config.ts` imports objects, notably Webpack configurations, from various other TypeScript files.
You don't need to edit these:

- [`webpack.main.config.ts`](./webpack.main.config.ts)
- [`webpack.renderer.config.ts`](./webpack.renderer.config.ts)
- [`webpack.plugins.ts`](./webpack.plugins.ts)
- [`webpack.rules.ts`](./webpack.rules.ts)

These examples are taken from a version of the `dotnet` branch of this project:

- [Electron Forge Template](https://github.com/cwellsx/electron_forge_template/blob/dotnet/BOILERPLATE.md#add-ipc-to-an-external-process)

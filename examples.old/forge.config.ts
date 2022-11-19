import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { ResourcePlugin } from "electron-forge-resource-plugin";

// import { rendererConfig } from './webpack.renderer.config';

// import { mainConfig } from './webpack.main.config';
import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    extraResource: "./LICENSE",
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ["darwin"]), new MakerRpm({}), new MakerDeb({})],
  plugins: [
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
    }),
    new WebpackPlugin({
      mainConfig: "./webpack.main.config.js",
      renderer: {
        config: "./webpack.renderer.config.js",
        entryPoints: [
          {
            html: "./src/renderer/index.html",
            js: "./src/renderer/index.ts",
            name: "main_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default config;

import { PluginBase } from "@electron-forge/plugin-base";
import { WebpackPluginConfig } from "@electron-forge/plugin-webpack";
import { WebpackConfiguration } from "@electron-forge/plugin-webpack/dist/Config";
import { IForgePlugin, ResolvedForgeConfig } from "@electron-forge/shared-types";
import { Configuration as RawWebpackConfiguration, DefinePlugin } from "webpack";

/*
  This edits the configuration of the WebpackPlugin
  It's called from the resolveForgeConfig hook.
*/

// copy-and-pasted from packages\api\core\src\util\plugin-interface.ts
function isForgePlugin(plugin: IForgePlugin | unknown): plugin is IForgePlugin {
  return (plugin as IForgePlugin).__isElectronForgePlugin;
}

function isWebpackConfiguration(mainConfig: string | WebpackConfiguration): mainConfig is RawWebpackConfiguration {
  if (typeof mainConfig === "string") return false;
  if (typeof mainConfig === "function") return false;
  return true;
}

export function addDefine(
  forgeConfig: ResolvedForgeConfig,
  defineKey: string,
  defineValue: string,
  log: (message: string) => void
): boolean {
  const webpackPlugin = forgeConfig.plugins.find((plugin) => plugin.name === "webpack");
  if (!webpackPlugin) {
    log("addDefine - WebpackPlugin is not configured");
    return false;
  }
  if (!isForgePlugin(webpackPlugin)) {
    log("addDefine - WebpackPlugin is not instantiated");
    return false;
  }
  const config = (webpackPlugin as PluginBase<WebpackPluginConfig>).config;
  const mainConfig = config.mainConfig;
  if (!isWebpackConfiguration(mainConfig)) {
    log("addDefine - mainConfig is not instantiated");
    return false;
  }
  const definitions: Record<string, string> = {};
  // when the value is a string the Define plugin interprets it as code so it needs to be stringified
  definitions[defineKey] = JSON.stringify(defineValue);
  if (!mainConfig.plugins) mainConfig.plugins = [];
  mainConfig.plugins.push(new DefinePlugin(definitions));
  log(`addDefine - Added to Webpack configuration: ${JSON.stringify(definitions)}`);
  return true;
}

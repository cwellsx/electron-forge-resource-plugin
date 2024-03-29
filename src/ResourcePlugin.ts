import { PluginBase } from "@electron-forge/plugin-base";
import { ForgeArch, ForgeConfig, ForgeHookMap, ForgePlatform, ResolvedForgeConfig } from "@electron-forge/shared-types";
import { exec } from "child_process";
import { Stats } from "fs";
import * as fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

import { addDefine } from "./EditWebpackConfig";

/*
  ResourcePlugin defines the API required of any plugin.
  Implementation defines the implementation of this plugin.
  ResourcePluginConfig declares the format of this plugin's configuration which the user defines in their package.json.
*/

function logif(b: boolean | undefined, message: string): void {
  // note the instructions in the README about setting the DEBUG environment variable, otherwise this output is hidden
  if (b) console.log(`ResourcePlugin: ${message}`);
}

type script = "import" | "init" | "make" | "package" | "publish" | "start";
// determine which of the @electron-forge/cli/dist is being run
function isScript(scripts: script[]): boolean {
  const cli = process.argv[1];
  return scripts.some((s) => cli.includes(`electron-forge-${s}`));
}

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

function isAlways(arg: any): arg is { always: boolean } {
  return arg.always !== undefined;
}

class Implementation {
  // these are mutable state values
  private dir!: string; // because init() is the first method called, dir is not undefined when hook methods are called
  private isPredefined: boolean = false;

  // these are flattened config values
  private readonly env: string;
  private readonly path: string;
  private readonly command?: string;
  private readonly sources?: string | string[] | { always: boolean };
  private readonly copydir: boolean;
  private readonly dirname?: string;
  private readonly verbose?: boolean;

  // these are derived config values
  private readonly tmpdir?: string;
  private readonly copied: string;

  constructor(config: ResourcePluginConfig) {
    this.env = config.env;
    this.path = config.path;
    this.command = config.build?.command;
    this.sources = config.build?.sources;
    this.copydir = config?.package?.copydir ?? !!config.package?.dirname;
    this.dirname = config?.package?.dirname;
    this.verbose = config.verbose;

    if (this.dirname) this.tmpdir = path.join(os.tmpdir(), "electron-forge-resource-plugin", this.dirname);
    this.copied = this.copydir ? path.dirname(this.path) : this.path;
  }

  init(dir: string): void {
    this.log(`init(${dir})`);
    this.dir = dir;
  }

  async resolveForgeConfig(forgeConfig: ResolvedForgeConfig): Promise<ResolvedForgeConfig> {
    this.log(`resolveForgeConfig`);
    // edit the forgeConfig to add the resource to packagerConfig.extraResource
    this.addPackagerExtraResource(forgeConfig);
    // edit the forgeConfig to add the define to packagerConfig.extraResource
    this.addWebpackDefine(forgeConfig);
    return Promise.resolve(forgeConfig);
  }

  async generateAssets(forgeConfig: ForgeConfig, platform: ForgePlatform, arch: ForgeArch): Promise<void> {
    this.log(`generateAssets`);

    // build if needed
    if (await this.needsBuilding()) {
      if (!this.command) {
        throw new Error("Target `path` needs building but the `build.command` is not specified.");
      }
      await this.build(this.command);
      if (await this.needsBuilding()) {
        throw new Error("Target `path` still needs building after the `buildCommand` has been run.");
      }
    }

    // set the environment variable
    const environmentVariableValue = this.getEnvironmentVariableValue(true);
    this.setEnvironmentVariableValue(this.path);
  }

  async prePackage(forgeConfig: ForgeConfig, platform: ForgePlatform, arch: ForgeArch): Promise<void> {
    this.log(`prePackage`);

    // generateAssets has already been called
    await this.copyToTmpdir();

    const environmentVariableValue = this.getEnvironmentVariableValue(false);
    this.setEnvironmentVariableValue(environmentVariableValue);
  }

  private getEnvironmentVariableValue(isStart: boolean): string {
    if (isStart) return this.path;
    // when it's packaged the filename specified by path will be in the resources directory or subdirectory
    var filename = path.basename(this.path);
    var dirname = this.dirname ?? (this.copydir ? path.basename(path.dirname(this.path)) : undefined);
    return dirname ? path.join("resources", dirname, filename) : path.join("resources", filename);
  }

  private addPackagerExtraResource(forgeConfig: ResolvedForgeConfig): void {
    var resource = this.tmpdir ?? this.copied;

    var extraResource = forgeConfig.packagerConfig.extraResource;

    if (
      (typeof extraResource === "string" && extraResource === resource) ||
      (Array.isArray(extraResource) && extraResource.some((element) => element === resource))
    ) {
      this.log(`not setting extraResource again`);
      return;
    }

    if (!extraResource) extraResource = resource;
    else if (typeof extraResource === "string") extraResource = [extraResource, resource];
    else if (Array.isArray(extraResource)) extraResource.push(resource);
    else throw new Error(`Unexpected extraResource value ${extraResource}`);

    this.log(`setting extraResource=${extraResource}`);
    forgeConfig.packagerConfig.extraResource = extraResource;
  }

  private addWebpackDefine(forgeConfig: ResolvedForgeConfig): void {
    // the path we want depends on whether it's being started locally or whether it's being packaged
    var environmentVariableValue: string;
    if (isScript(["make", "package", "publish"])) environmentVariableValue = this.getEnvironmentVariableValue(false);
    else if (isScript(["start"])) environmentVariableValue = this.getEnvironmentVariableValue(true);
    else {
      this.log("Unknown electron-forge script");
      return;
    }
    this.isPredefined = addDefine(forgeConfig, this.env, environmentVariableValue, this.log.bind(this));
  }

  private setEnvironmentVariableValue(value: string): void {
    // setting the environment variable is needed if the user must edit the Webpack Plugin configuration file,
    // but not if the addWebpackDefine method was able to edit the Webpack configuration programmatically
    if (this.isPredefined) return;
    // set the environment variable
    this.log(`setting 'process.env[${this.env}] = ${value};'`);
    process.env[this.env] = value;
  }

  private async copyToTmpdir(): Promise<void> {
    if (!this.tmpdir) return;
    var tmpdir = this.tmpdir;
    await fs.rm(tmpdir, { force: true, recursive: true });
    await fs.mkdir(tmpdir, { recursive: true });
    var destination = this.copydir ? tmpdir : path.join(tmpdir, path.basename(this.path));
    var opts = this.copydir ? { recursive: true } : undefined;
    this.log(`cp("${this.copied}", "${destination}")`);
    await fs.cp(this.copied, destination, opts);
  }

  private async build(buildCommand: string): Promise<void> {
    this.log(`Build using: '${buildCommand}'`);
    const execAsync = promisify(exec);
    await execAsync(buildCommand);
    this.log(`Build complete.`);
  }

  private async needsBuilding(): Promise<boolean> {
    // if the file doesn't exist
    try {
      await fs.access(this.path);
    } catch {
      this.log(`Need to build because it does not exist: '${this.path}'`);
      return true;
    }

    // if it's older than sources
    if (this.sources) {
      let targetDate = (await fs.stat(this.path)).mtime;

      let sources = this.sources;

      // {always: boolean}
      if (isAlways(sources)) {
        let always = sources.always;
        if (always) {
          this.log(`Need to build because 'sources' specifies '{always: true}'`);
          return true;
        }
        return false;
      }

      // string | string[]
      let isNewer = (path: string, stats: Stats): boolean => {
        if (stats.mtime > targetDate) {
          this.log(`Need to build because source file is newer: '${path}'`);
          return true;
        }
        return false;
      };

      let array: string[] = Array.isArray(sources) ? sources : [sources];
      for (let source of array) {
        this.log(`checking date of ${source}`);
        // ensure it exists
        try {
          await fs.access(source);
        } catch {
          throw new Error(`Source path not found: ${source}`);
        }
        // test whether isNewer
        const sourceStat = await fs.stat(source);
        if (sourceStat.isFile()) {
          // it's a file
          if (isNewer(source, sourceStat)) return true;
        } else if (sourceStat.isDirectory()) {
          // else read the directory
          for (const name of await fs.readdir(source)) {
            const found = path.join(source, name);
            try {
              const foundStat = await fs.stat(found);
              if (foundStat.isFile() && isNewer(found, foundStat)) return true;
            } catch {
              this.log(`Cannot stat(${found})`);
            }
          }
        } else {
          // else it's a link or maybe a device or something
          throw new Error(`Source is neither a file nor a directory: ${source}`);
        }
      }
    }

    // else
    this.log(`Not rebuilding: '${this.path}'`);
    return false;
  }

  log(message: string): void {
    logif(this.verbose, message);
  }
}

export default class ResourcePlugin extends PluginBase<ResourcePluginConfig> {
  name = "resource";

  private impl: Implementation;

  constructor(c: ResourcePluginConfig) {
    logif(c.verbose, "constructor");
    super(c);
    this.impl = new Implementation(c);
    this.init = this.init.bind(this);
    this.getHooks = this.getHooks.bind(this);
  }

  init(dir: string, config: ResolvedForgeConfig): void {
    this.impl.init(dir);
    super.init(dir, config);
  }

  getHooks(): ForgeHookMap {
    this.impl.log(`getHooks()`);
    // see https://www.electronforge.io/configuration#hooks for a list of the hook names
    // the parameters passed to different hook functions can be seen by searching electron forge source for "runHook"
    return {
      resolveForgeConfig: this.impl.resolveForgeConfig.bind(this.impl),
      generateAssets: this.impl.generateAssets.bind(this.impl),
      prePackage: this.impl.prePackage.bind(this.impl),
    };
  }
}

export { ResourcePlugin };

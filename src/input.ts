import * as core from '@actions/core';
import path from 'path';
import { readFileSync } from 'fs';

interface EnvironmentVariable {
  key: string;
  value: string;
}

interface RenovateConfigFile {
  baseDir: string;
}

class Input {
  readonly options = {
    envRegex:
      /^(?:RENOVATE_\w+|LOG_LEVEL|GITHUB_COM_TOKEN|NODE_OPTIONS|(?:HTTPS?|NO)_PROXY|(?:https?|no)_proxy)$/,
    configurationFile: {
      input: 'configurationFile',
      env: 'RENOVATE_CONFIG_FILE',
      optional: true,
    },
    baseDir: {
      input: 'baseDir',
      env: 'RENOVATE_BASE_DIR',
      optional: true,
    },
    token: {
      input: 'token',
      env: 'RENOVATE_TOKEN',
      optional: false,
    },
  } as const;
  readonly token: Readonly<EnvironmentVariable>;

  private readonly _environmentVariables: Map<string, string>;
  private readonly _configurationFile: Readonly<EnvironmentVariable>;
  private readonly _baseDir: Readonly<EnvironmentVariable>;

  constructor() {
    const envRegexInput = core.getInput('env-regex');
    const envRegex = envRegexInput
      ? new RegExp(envRegexInput)
      : this.options.envRegex;
    this._environmentVariables = new Map(
      Object.entries(process.env)
        .filter(([key]) => envRegex.test(key))
        .filter((pair): pair is [string, string] => pair[1] !== undefined)
    );

    this.token = this.get(
      this.options.token.input,
      this.options.token.env,
      this.options.token.optional
    );
    this._configurationFile = this.get(
      this.options.configurationFile.input,
      this.options.configurationFile.env,
      this.options.configurationFile.optional
    );
    this._baseDir = this.get(
      this.options.baseDir.input,
      this.options.baseDir.env,
      this.options.baseDir.optional
    );
  }

  configurationFile(): EnvironmentVariable | null {
    if (this._configurationFile.value !== '') {
      return {
        key: this._configurationFile.key,
        value: path.resolve(this._configurationFile.value),
      };
    }

    return null;
  }

  baseDir(): string | null {
    if (this._baseDir.value !== '') {
      return this._baseDir.value;
    }

    if (this._configurationFile.value !== '') {
      const buffer = readFileSync(this._configurationFile.value);
      const configFileJson = JSON.parse(
        buffer.toString()
      ) as RenovateConfigFile;
      return configFileJson.baseDir === undefined
        ? null
        : configFileJson.baseDir;
    }

    return null;
  }

  getDockerImage(): string | null {
    return core.getInput('renovate-image') || null;
  }

  getVersion(): string | null {
    const version = core.getInput('renovate-version');
    return !!version && version !== '' ? version : null;
  }

  mountDockerSocket(): boolean {
    return core.getInput('mount-docker-socket') === 'true';
  }

  getDockerCmdFile(): string | null {
    const cmdFile = core.getInput('docker-cmd-file');
    return !!cmdFile && cmdFile !== '' ? path.resolve(cmdFile) : null;
  }

  getDockerUser(): string | null {
    return core.getInput('docker-user') || null;
  }

  /**
   * Convert to environment variables.
   *
   * @note The environment variables listed below are filtered out.
   * - Token, available with the `token` property.
   * - Configuration file, available with the `configurationFile()` method.
   */
  toEnvironmentVariables(): EnvironmentVariable[] {
    return [...this._environmentVariables].map(([key, value]) => ({
      key,
      value,
    }));
  }

  private get(
    input: string,
    env: string,
    optional: boolean
  ): EnvironmentVariable {
    const fromInput = core.getInput(input);
    const fromEnv = this._environmentVariables.get(env);

    if (fromInput === '' && fromEnv === undefined && !optional) {
      throw new Error(
        [
          `'${input}' MUST be passed using its input or the '${env}'`,
          'environment variable',
        ].join(' ')
      );
    }

    this._environmentVariables.delete(env);
    if (fromInput !== '') {
      return { key: env, value: fromInput };
    }
    return { key: env, value: fromEnv !== undefined ? fromEnv : '' };
  }
}

export default Input;
export { EnvironmentVariable, Input };

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/** Settings manager providing type-safe access to application settings. */
export class SettingsManager {
  private static _instance: SettingsManager;
  private _settings: Gio.Settings;

  private constructor() {
    this._settings = new Gio.Settings({
      schema_id: 'org.redvulps.nandu',
    });
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager._instance) {
      SettingsManager._instance = new SettingsManager();
    }
    return SettingsManager._instance;
  }

  public isSetupComplete(): boolean {
    return this._settings.get_boolean('setup-complete');
  }

  public setSetupComplete(complete: boolean): void {
    this._settings.set_boolean('setup-complete', complete);
  }

  public getConnectionType(): string {
    return this._settings.get_string('connection-type');
  }

  public setConnectionType(type: string): void {
    this._settings.set_string('connection-type', type);
  }

  public getSocketPath(): string {
    return this._settings.get_string('socket-path');
  }

  public setSocketPath(path: string): void {
    this._settings.set_string('socket-path', path);
  }

  public getEffectiveSocketPath(): string {
    const type = this.getConnectionType();

    if (type === 'local') {
      const isFlatpak = GLib.file_test('/.flatpak-info', GLib.FileTest.EXISTS);
      const prefix = isFlatpak ? '/run' : '/var/run';

      return `${prefix}/docker.sock`;
    }

    return this.getSocketPath();
  }

  public reset(): void {
    this._settings.reset('setup-complete');
    this._settings.reset('connection-type');
    this._settings.reset('socket-path');
  }
}

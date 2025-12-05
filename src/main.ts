import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { MainDialog } from './dialogs/main/main-dialog.js';
import { SettingsManager } from './settings-manager.js';
import { SetupDialog } from './dialogs/setup/setup-dialog.js';

/**
 * Main application class for Nandu.
 * Handles application lifecycle, actions, and window management.
 */
export class Application extends Adw.Application {
  private window?: MainDialog;

  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      application_id: 'org.redvulps.nandu',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    const quitAction = new Gio.SimpleAction({ name: 'quit' });
    quitAction.connect('activate', () => {
      this.quit();
    });

    this.add_action(quitAction);
    this.set_accels_for_action('app.quit', ['<Control>q']);
    this.set_accels_for_action('win.toggle-search', ['<Control>f']);

    const aboutAction = new Gio.SimpleAction({ name: 'about' });
    aboutAction.connect('activate', () => {
      const aboutDialog = new Adw.AboutDialog({
        application_name: _('Nandu'),
        application_icon: 'org.redvulps.nandu',
        developer_name: 'Fabio Pereira',
        version: '0.1',
        developers: ['Fabio Pereira <fabio@fabiopereira.dev>'],
        copyright: '© 2025 Fabio Pereira',
      });

      aboutDialog.present(this.active_window);
    });

    this.add_action(aboutAction);

    Gio._promisify(Gtk.UriLauncher.prototype, 'launch', 'launch_finish');
  }

  public vfunc_activate(): void {
    this.activateAsync().catch((e) => {
      console.error(`Error during activation: ${e}`);
      this.quit();
    });
  }

  private async activateAsync(): Promise<void> {
    this.hold();
    try {
      const settings = SettingsManager.getInstance();

      if (!settings.isSetupComplete()) {
        await this.showSetupDialog();
      } else {
        this.showMainWindow();
      }
    } catch (e) {
      console.error(`Failed to activate application: ${e}`);
      this.quit();
    } finally {
      this.release();
    }
  }

  private async showSetupDialog(): Promise<void> {
    return new Promise((resolve) => {
      const dialog = new SetupDialog();

      dialog.connect('closed', () => {
        const settings = SettingsManager.getInstance();

        if (settings.isSetupComplete()) {
          this.showMainWindow();
        } else {
          this.quit();
        }

        resolve();
      });

      dialog.present(null);
    });
  }

  private showMainWindow(): void {
    if (!this.window) {
      this.window = new MainDialog({ application: this });
    }

    this.window.present();
  }
}

export function main(argv: string[]): Promise<number> {
  const app = new Application();

  return app.runAsync(argv);
}

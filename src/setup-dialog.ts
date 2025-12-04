import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { DockerClient } from './docker/client.js';
import { SettingsManager } from './settings-manager.js';

/** First-run dialog for configuring Docker connection. */
export class SetupDialog extends Adw.Dialog {
  private _localRadio!: Gtk.CheckButton;
  private _customRadio!: Gtk.CheckButton;
  private _customPathEntry!: Gtk.Entry;
  private _connectButton!: Gtk.Button;
  private _statusLabel!: Gtk.Label;

  private settings: SettingsManager;

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduSetupDialog',
        Template: 'resource:///org/redvulps/nandu/setup-dialog.ui',
        InternalChildren: [
          'localRadio',
          'customRadio',
          'customPathEntry',
          'connectButton',
          'statusLabel',
        ],
      },
      this
    );
  }

  constructor() {
    super();

    this.settings = SettingsManager.getInstance();

    this._customRadio.connect('toggled', () => {
      const isCustom = this._customRadio.get_active();
      this._customPathEntry.set_sensitive(isCustom);
    });

    this._connectButton.connect('clicked', () => {
      void this.testAndSaveConnection();
    });
  }

  /**
   * Test the Docker connection and save settings if successful
   */
  private async testAndSaveConnection(): Promise<void> {
    this._connectButton.set_sensitive(false);
    this._statusLabel.set_visible(true);
    this._statusLabel.set_label('Testing connection...');
    this._statusLabel.remove_css_class('error');
    this._statusLabel.remove_css_class('success');

    try {
      const isCustom = this._customRadio.get_active();
      const socketPath = isCustom
        ? this._customPathEntry.get_text()
        : '/var/run/docker.sock';

      if (isCustom && (!socketPath || socketPath.trim() === '')) {
        this.showError('Please enter a socket path');
        this._connectButton.set_sensitive(true);
        return;
      }

      const client = new DockerClient(socketPath);
      const connected = await client.ping();

      if (!connected) {
        this.showError(
          'Failed to connect to Docker daemon. Please check the socket path and ensure Docker is running.'
        );
        this._connectButton.set_sensitive(true);
        return;
      }

      this.settings.setConnectionType(isCustom ? 'custom' : 'local');
      if (isCustom) {
        this.settings.setSocketPath(socketPath);
      }
      this.settings.setSetupComplete(true);

      this._statusLabel.set_label('Connected successfully!');
      this._statusLabel.add_css_class('success');

      setTimeout(() => {
        this.close();
      }, 500);
    } catch (error) {
      this.showError(`Connection error: ${error}`);
      this._connectButton.set_sensitive(true);
    }
  }

  /**
   * Show error message in the status label
   */
  private showError(message: string): void {
    this._statusLabel.set_visible(true);
    this._statusLabel.set_label(message);
    this._statusLabel.add_css_class('error');
    this._statusLabel.remove_css_class('success');
  }
}

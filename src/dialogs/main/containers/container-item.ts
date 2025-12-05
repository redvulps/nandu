import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ContainerInfo } from '../../../models/container-info.js';

/** Custom widget that displays container information and handles user actions. */
export class ContainerItem extends Gtk.Box {
  private _statusIcon!: Gtk.Image;
  private _nameLabel!: Gtk.Label;
  private _imageLabel!: Gtk.Label;
  private _statusLabel!: Gtk.Label;
  private _composeBadge!: Gtk.Image;
  private _composeLabel!: Gtk.Label;
  private _portsLabel!: Gtk.Label;

  private _actionSpinner!: Gtk.Spinner;
  private _startButton!: Gtk.Button;
  private _stopButton!: Gtk.Button;
  private _restartButton!: Gtk.Button;

  private _containerInfo: ContainerInfo | null = null;
  private _isLoading = false;

  public get containerInfo(): ContainerInfo | null {
    return this._containerInfo;
  }

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduContainerItem',
        Template: 'resource:///org/redvulps/nandu/container-item.ui',
        InternalChildren: [
          'statusIcon',
          'nameLabel',
          'imageLabel',
          'statusLabel',
          'composeBadge',
          'composeLabel',
          'portsLabel',
          'actionSpinner',
          'startButton',
          'stopButton',
          'restartButton',
        ],
        Signals: {
          'action-start': {},
          'action-stop': {},
          'action-restart': {},
          'open-manager': {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this
    );
  }

  constructor() {
    super();

    // Connect button signals
    this._startButton.connect('clicked', () => this.emit('action-start'));
    this._stopButton.connect('clicked', () => this.emit('action-stop'));
    this._restartButton.connect('clicked', () => this.emit('action-restart'));

    const clickController = new Gtk.GestureClick();
    clickController.connect('released', () => {
      if (this._containerInfo) {
        this.emit('open-manager', this._containerInfo.id);
      }
    });

    this.add_controller(clickController);
  }

  public bind(info: ContainerInfo): void {
    this._containerInfo = info;
    this.updateUI();

    info.connect('notify', () => {
      this.updateUI();
    });
  }

  public setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.updateUI();
  }

  private updateUI(): void {
    if (!this._containerInfo) {
      return;
    }

    this._nameLabel.set_label(this._containerInfo.name);
    this._imageLabel.set_label(this._containerInfo.image);
    this._statusLabel.set_label(this._containerInfo.status);

    if (this._containerInfo.isRunning) {
      this._statusIcon.set_from_icon_name('media-playback-start-symbolic');
      this._statusIcon.remove_css_class('error');
      this._statusIcon.add_css_class('success');
    } else {
      this._statusIcon.set_from_icon_name('media-playback-stop-symbolic');
      this._statusIcon.remove_css_class('success');
      this._statusIcon.add_css_class('error');
    }

    if (this._containerInfo.isCompose) {
      this._composeBadge.set_visible(true);
      this._composeLabel.set_visible(true);
      this._composeLabel.set_label(
        `📦 ${this._containerInfo.composeProject} › ${this._containerInfo.composeService}`
      );
    } else {
      this._composeBadge.set_visible(false);
      this._composeLabel.set_visible(false);
    }

    if (this._containerInfo.ports && this._containerInfo.ports.trim() !== '') {
      this._portsLabel.set_visible(true);
      this._portsLabel.set_label(`🔌 ${this._containerInfo.ports}`);
    } else {
      this._portsLabel.set_visible(false);
    }

    if (this._isLoading) {
      this._actionSpinner.set_visible(true);
      this._actionSpinner.start();
      this._startButton.set_visible(false);
      this._stopButton.set_visible(false);
      this._restartButton.set_visible(false);
    } else {
      this._actionSpinner.set_visible(false);
      this._actionSpinner.stop();

      if (this._containerInfo.isRunning) {
        this._startButton.set_visible(false);
        this._stopButton.set_visible(true);
        this._restartButton.set_visible(true);
      } else {
        this._startButton.set_visible(true);
        this._stopButton.set_visible(false);
        this._restartButton.set_visible(false);
      }
    }
  }
}

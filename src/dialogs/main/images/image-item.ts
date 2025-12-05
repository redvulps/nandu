import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ImageInfo } from '../../../models/image-info.js';

/** Custom widget that displays Docker image information and handles user actions. */
export class ImageItem extends Gtk.Box {
  private _nameLabel!: Gtk.Label;
  private _tagLabel!: Gtk.Label;
  private _idLabel!: Gtk.Label;
  private _sizeLabel!: Gtk.Label;
  private _inUseBadge!: Gtk.Box;
  private _deleteButton!: Gtk.Button;
  private _actionSpinner!: Gtk.Spinner;

  private _imageInfo: ImageInfo | null = null;
  private _isLoading = false;

  public get imageInfo(): ImageInfo | null {
    return this._imageInfo;
  }

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduImageItem',
        Template: 'resource:///org/redvulps/nandu/image-item.ui',
        InternalChildren: [
          'nameLabel',
          'tagLabel',
          'idLabel',
          'sizeLabel',
          'inUseBadge',
          'deleteButton',
          'actionSpinner',
        ],
        Signals: {
          'action-delete': {},
        },
      },
      this
    );
  }

  constructor() {
    super();

    this._deleteButton.connect('clicked', () => this.emit('action-delete'));
  }

  public bind(info: ImageInfo): void {
    this._imageInfo = info;
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
    if (!this._imageInfo) {
      return;
    }

    this._nameLabel.set_label(this._imageInfo.name);
    this._tagLabel.set_label(this._imageInfo.tag);
    this._idLabel.set_label(this._imageInfo.shortId);
    this._sizeLabel.set_label(this._imageInfo.sizeFormatted);
    this._inUseBadge.set_visible(this._imageInfo.inUse);

    if (this._isLoading) {
      this._actionSpinner.set_visible(true);
      this._actionSpinner.start();
      this._deleteButton.set_visible(false);
    } else {
      this._actionSpinner.set_visible(false);
      this._actionSpinner.stop();
      // Only show delete for images not in use
      this._deleteButton.set_visible(!this._imageInfo.inUse);
    }
  }
}

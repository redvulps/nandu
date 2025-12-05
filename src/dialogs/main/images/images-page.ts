import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ImageItem } from './image-item.js';
import { DockerClient } from '../../../docker/client.js';
import type { ImageData } from '../../../docker/types.js';
import { ImageInfo } from '../../../models/image-info.js';
import { formatBytes } from '../../../utils/formatBytes.js';

export class ImagesPage extends Gtk.Box {
  private _contentStack!: Gtk.Stack;
  private _imageListBox!: Gtk.ListBox;
  private _errorPage!: Adw.StatusPage;
  private _toastOverlay!: Adw.ToastOverlay;
  private _groupByTagButton!: Gtk.ToggleButton;

  private dockerClient: DockerClient | null = null;
  private images: ImageInfo[] = [];
  private searchQuery = '';
  private groupByTag = false;

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduImagesPage',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/images/images-page.ui',
        InternalChildren: [
          'contentStack',
          'imageListBox',
          'errorPage',
          'toastOverlay',
          'groupByTagButton',
        ],
        Signals: {
          'open-inspect': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
          },
        },
      },
      this
    );
  }

  constructor(params?: Partial<Gtk.Box.ConstructorProps>) {
    super(params);

    this._imageListBox.set_filter_func((row) => {
      if (!this.searchQuery) {
        return true;
      }

      const child = row.get_child();
      if (!(child instanceof ImageItem)) {
        return true;
      }

      const info = child.imageInfo;
      if (!info) {
        return false;
      }

      const searchableText = [info.name, info.tag, info.shortId, info.id]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(this.searchQuery);
    });

    this._groupByTagButton.connect('toggled', () => {
      this.groupByTag = this._groupByTagButton.get_active();
      this.rebuildList();
    });
  }

  public setDockerClient(client: DockerClient | null): void {
    this.dockerClient = client;
    if (client) {
      void this.loadImages();
    }
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase();
    this._imageListBox.invalidate_filter();
  }

  public async loadImages(): Promise<void> {
    if (!this.dockerClient) {
      console.error('Docker client not initialized');
      return;
    }

    if (this.images.length === 0) {
      this._contentStack.set_visible_child_name('loading');
    }

    try {
      const imageData = await this.dockerClient.listImages();
      this.updateImageList(imageData);

      if (imageData.length === 0) {
        this._contentStack.set_visible_child_name('empty');
      } else {
        this._contentStack.set_visible_child_name('list');
      }
    } catch (error) {
      const message = `Failed to load images: ${String(error)}`;
      console.error(message);
      this.showError(message);
    }
  }

  private updateImageList(imageData: ImageData[]): void {
    this.images = imageData.map((data) =>
      ImageInfo.fromImageData(data, formatBytes(data.size))
    );
    this.rebuildList();
  }

  private rebuildList(): void {
    // Clear existing list
    let child = this._imageListBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this._imageListBox.remove(child);
      child = next;
    }

    if (this.groupByTag) {
      this.buildGroupedList();
    } else {
      this.buildFlatList();
    }
  }

  private buildFlatList(): void {
    for (const info of this.images) {
      this.addImageRow(info);
    }
  }

  private buildGroupedList(): void {
    const tagGroups = new Map<string, ImageInfo[]>();

    for (const info of this.images) {
      const group = tagGroups.get(info.tag) ?? [];
      group.push(info);
      tagGroups.set(info.tag, group);
    }

    // Sort tags: 'latest' first, then alphabetically
    const sortedTags = Array.from(tagGroups.keys()).sort((a, b) => {
      if (a === 'latest') {
        return -1;
      }
      if (b === 'latest') {
        return 1;
      }
      return a.localeCompare(b);
    });

    let isFirst = true;
    for (const tag of sortedTags) {
      if (!isFirst) {
        this.addSeparatorRow();
      }

      for (const info of tagGroups.get(tag)!) {
        this.addImageRow(info);
      }

      isFirst = false;
    }
  }

  private addSeparatorRow(): void {
    const separator = new Gtk.Separator({
      orientation: Gtk.Orientation.HORIZONTAL,
      margin_top: 12,
      margin_bottom: 12,
    });
    const row = new Gtk.ListBoxRow({
      selectable: false,
      activatable: false,
    });
    row.set_child(separator);
    this._imageListBox.append(row);
  }

  private addImageRow(info: ImageInfo): void {
    const item = new ImageItem();
    item.bind(info);

    item.connect('action-delete', () => {
      void this.handleDeleteImage(info.id, item);
    });

    item.connect('action-inspect', () => {
      this.emit('open-inspect', info.id, info.name);
    });

    const row = new Gtk.ListBoxRow();
    row.set_child(item);
    this._imageListBox.append(row);
  }

  private handleDeleteImage(imageId: string, item: ImageItem): void {
    if (!this.dockerClient) {
      return;
    }

    const dialog = new Adw.AlertDialog({
      heading: 'Delete Image?',
      body: 'Are you sure you want to delete this image?',
    });

    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('delete', 'Delete');
    dialog.set_response_appearance(
      'delete',
      Adw.ResponseAppearance.DESTRUCTIVE
    );
    dialog.set_default_response('cancel');
    dialog.set_close_response('cancel');

    const parent = this.get_root() as Gtk.Window | null;
    if (!parent) {
      return;
    }

    dialog.connect('response', (_dialog, response) => {
      if (response === 'delete') {
        void this.executeDeleteImage(imageId, item);
      }
    });

    dialog.present(parent);
  }

  private async executeDeleteImage(
    imageId: string,
    item: ImageItem
  ): Promise<void> {
    if (!this.dockerClient) {
      return;
    }

    item.setLoading(true);

    try {
      await this.dockerClient.removeImage(imageId);
      this.showToast('Image deleted successfully');
      await this.loadImages();
    } catch (error) {
      console.error(`Failed to delete image: ${String(error)}`);
      this.showToast('Failed to delete image');
      item.setLoading(false);
    }
  }

  private showToast(message: string): void {
    const toast = new Adw.Toast({ title: message });
    this._toastOverlay.add_toast(toast);
  }

  private showError(message: string): void {
    this._errorPage.set_description(message);
    this._contentStack.set_visible_child_name('error');
  }
}

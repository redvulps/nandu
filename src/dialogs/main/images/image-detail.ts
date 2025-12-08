import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { DockerClient } from '../../../docker/client.js';
import type { DockerImageInspect } from '../../../docker/types.js';
import { formatBytes } from '../../../utils/formatBytes.js';
import { formatDate } from '../../../utils/formatDate.js';

/** Widget that displays detailed image information from docker inspect. */
export class ImageDetail extends Gtk.Box {
  private _contentStack!: Gtk.Stack;
  private _imageTitleLabel!: Gtk.Label;
  private _idRow!: Adw.ActionRow;
  private _tagsRow!: Adw.ActionRow;
  private _sizeRow!: Adw.ActionRow;
  private _createdRow!: Adw.ActionRow;
  private _architectureRow!: Adw.ActionRow;
  private _osRow!: Adw.ActionRow;
  private _layersRow!: Adw.ActionRow;
  private _labelsExpander!: Gtk.Expander;
  private _labelsListBox!: Gtk.ListBox;
  private _envExpander!: Gtk.Expander;
  private _envListBox!: Gtk.ListBox;
  private _copyIdButton!: Gtk.Button;
  private _errorPage!: Adw.StatusPage;

  private dockerClient: DockerClient;
  private imageId: string;
  private imageName = '';

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduImageDetail',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/images/image-detail.ui',
        InternalChildren: [
          'contentStack',
          'imageTitleLabel',
          'idRow',
          'tagsRow',
          'sizeRow',
          'createdRow',
          'architectureRow',
          'osRow',
          'layersRow',
          'labelsExpander',
          'labelsListBox',
          'envExpander',
          'envListBox',
          'copyIdButton',
          'errorPage',
        ],
      },
      this
    );
  }

  constructor(dockerClient: DockerClient, imageId: string, imageName: string) {
    super();

    this.dockerClient = dockerClient;
    this.imageId = imageId;
    this.imageName = imageName;

    this._imageTitleLabel.set_label(imageName);

    this._copyIdButton.connect('clicked', () => {
      this.copyToClipboard(imageId);
    });

    void this.loadImageDetails();
  }

  public getImageName(): string {
    return this.imageName;
  }

  private async loadImageDetails(): Promise<void> {
    this._contentStack.set_visible_child_name('loading');

    try {
      const info = await this.dockerClient.inspectImage(this.imageId);
      this.populateDetails(info);
      this._contentStack.set_visible_child_name('content');
    } catch (error) {
      this._errorPage.set_description(String(error));
      this._contentStack.set_visible_child_name('error');
    }
  }

  private populateDetails(info: DockerImageInspect): void {
    // ID
    const shortId = info.Id.replace('sha256:', '').substring(0, 12);
    this._idRow.set_subtitle(shortId);

    // Tags
    const tags = info.RepoTags?.join(', ') ?? '<none>';
    this._tagsRow.set_subtitle(tags);

    // Size
    this._sizeRow.set_subtitle(formatBytes(info.Size));

    // Created
    this._createdRow.set_subtitle(formatDate(info.Created, true));

    // Architecture
    this._architectureRow.set_subtitle(info.Architecture);

    // OS
    this._osRow.set_subtitle(info.Os);

    // Layers
    const layerCount = info.RootFS?.Layers?.length ?? 0;
    this._layersRow.set_subtitle(`${layerCount} layers`);

    // Labels
    this.populateLabels(info.Config?.Labels);

    // Environment
    this.populateEnv(info.Config?.Env);
  }

  private populateLabels(labels: Record<string, string> | null): void {
    if (!labels || Object.keys(labels).length === 0) {
      this._labelsExpander.set_visible(false);
      return;
    }

    this._labelsExpander.set_visible(true);

    for (const [key, value] of Object.entries(labels)) {
      const row = new Adw.ActionRow({
        title: key,
        subtitle: value,
        subtitleSelectable: true,
      });
      row.add_css_class('property');
      this._labelsListBox.append(row);
    }
  }

  private populateEnv(env: string[] | null): void {
    if (!env || env.length === 0) {
      this._envExpander.set_visible(false);
      return;
    }

    this._envExpander.set_visible(true);

    for (const entry of env) {
      const [key, ...valueParts] = entry.split('=');
      const value = valueParts.join('=');
      const row = new Adw.ActionRow({
        title: key,
        subtitle: value || '(empty)',
        subtitleSelectable: true,
      });
      row.add_css_class('property');
      this._envListBox.append(row);
    }
  }

  private copyToClipboard(text: string): void {
    const display = Gdk.Display.get_default();
    if (display) {
      const clipboard = display.get_clipboard();
      clipboard.set(text);
    }
  }
}

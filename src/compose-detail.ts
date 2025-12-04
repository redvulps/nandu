import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ContainerItem } from './container-item.js';
import { DockerClient } from './docker/client.js';
import { ContainerInfo } from './models/container-info.js';

/** Navigation page that displays containers within a compose project. */
export class ComposeDetail extends Adw.NavigationPage {
  private _projectTitleLabel!: Gtk.Label;
  private _projectTitleHeaderLabel!: Gtk.Label;
  private _containerListBox!: Gtk.ListBox;
  private _headerBar!: Adw.HeaderBar;
  private _searchEntry!: Gtk.SearchEntry;

  private projectName: string;
  private dockerClient: DockerClient;
  private containers: ContainerInfo[] = [];
  private searchQuery = '';

  static {
    const template = 'resource:///org/redvulps/nandu/compose-detail.ui';
    Gio.resources_lookup_data(
      '/org/redvulps/nandu/compose-detail.ui',
      Gio.ResourceLookupFlags.NONE
    );

    GObject.registerClass(
      {
        GTypeName: 'NanduComposeDetail',
        Template: template,
        InternalChildren: [
          'projectTitleLabel',
          'projectTitleHeaderLabel',
          'containerListBox',
          'headerBar',
          'searchEntry',
        ],
        Signals: {
          'container-action': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
          },
        },
      },
      this
    );
  }

  constructor(
    projectName: string,
    dockerClient: DockerClient,
    containers: ContainerInfo[]
  ) {
    super();

    this.projectName = projectName;
    this.dockerClient = dockerClient;
    this.containers = containers;

    this.set_title(projectName);
    this._projectTitleLabel.set_label(projectName);
    this._projectTitleHeaderLabel.set_label(projectName);

    this._searchEntry.connect('search-changed', () => {
      this.searchQuery = this._searchEntry.get_text().toLowerCase();
      this._containerListBox.invalidate_filter();
    });

    this._containerListBox.set_filter_func((row) => {
      if (!this.searchQuery) {
        return true;
      }

      const containerItem = row.get_child();

      if (containerItem instanceof ContainerItem) {
        const info = containerItem.containerInfo;
        if (!info) {
          return false;
        }

        const searchableText = [info.name].join(' ').toLowerCase();

        return searchableText.includes(this.searchQuery);
      }

      return true;
    });

    this.populateContainers();
  }

  public toggleSearch(): void {
    this._searchEntry.grab_focus();
  }

  private populateContainers(): void {
    this._containerListBox.remove_all();

    for (const info of this.containers) {
      const item = new ContainerItem();
      item.bind(info);

      item.connect('action-start', () => {
        this.emit('container-action', 'start', info.id);
      });

      item.connect('action-stop', () => {
        this.emit('container-action', 'stop', info.id);
      });

      item.connect('action-restart', () => {
        this.emit('container-action', 'restart', info.id);
      });

      item.connect('open-manager', (_item, id: string) => {
        this.emit('container-action', 'open-manager', id);
      });

      const row = new Gtk.ListBoxRow();
      row.set_child(item);
      this._containerListBox.append(row);
    }
  }

  public updateContainers(containers: ContainerInfo[]): void {
    this.containers = containers;
    this.populateContainers();
  }
}

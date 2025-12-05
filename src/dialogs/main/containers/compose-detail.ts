import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ContainerItem } from './container-item.js';
import { ContainerInfo } from '../../../models/container-info.js';

/** Widget that displays containers within a compose project. */
export class ComposeDetail extends Gtk.Box {
  private _projectTitleLabel!: Gtk.Label;
  private _containerListBox!: Gtk.ListBox;

  private projectName: string;
  private containers: ContainerInfo[] = [];
  private searchQuery = '';

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduComposeDetail',
        Template: 'resource:///org/redvulps/nandu/compose-detail.ui',
        InternalChildren: ['projectTitleLabel', 'containerListBox'],
        Signals: {
          'container-action': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
          },
        },
      },
      this
    );
  }

  constructor(projectName: string, containers: ContainerInfo[]) {
    super();

    this.projectName = projectName;
    this.containers = containers;

    this._projectTitleLabel.set_label(projectName);

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

        const searchableText = [info.name, info.composeService]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(this.searchQuery);
      }

      return true;
    });

    this.populateContainers();
  }

  public getProjectName(): string {
    return this.projectName;
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase();
    this._containerListBox.invalidate_filter();
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

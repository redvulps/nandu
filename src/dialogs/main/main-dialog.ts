import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ContainersPage } from './containers/containers-page.js';
import { ContainerManager } from './containers/container-manager.js';
import { ComposeDetail } from './containers/compose-detail.js';
import { ImagesPage } from './images/images-page.js';
import { NetworksPage } from './networks/networks-page.js';
import { VolumesPage } from './volumes/volumes-page.js';
import { DockerClient } from '../../docker/client.js';
import { SettingsManager } from '../../settings-manager.js';

/** Main application window with NavigationSplitView sidebar. */
export class MainDialog extends Adw.ApplicationWindow {
  private _splitView!: Adw.NavigationSplitView;
  private _sidebarListBox!: Gtk.ListBox;
  private _contentStack!: Gtk.Stack;
  private _contentPage!: Adw.NavigationPage;
  private _containersRow!: Gtk.ListBoxRow;
  private _imagesRow!: Gtk.ListBoxRow;
  private _networksRow!: Gtk.ListBoxRow;
  private _volumesRow!: Gtk.ListBoxRow;
  private _refreshButton!: Gtk.Button;
  private _backButton!: Gtk.Button;
  private _searchEntry!: Gtk.SearchEntry;
  private _searchButton!: Gtk.ToggleButton;
  private _titleStack!: Gtk.Stack;
  private _windowTitle!: Adw.WindowTitle;

  private dockerClient: DockerClient | null = null;
  private settings: SettingsManager;
  private containersPage: ContainersPage | null = null;
  private currentComposeDetail: ComposeDetail | null = null;

  static {
    const template =
      'resource:///org/redvulps/nandu/dialogs/main/main-dialog.ui';
    Gio.resources_lookup_data(
      '/org/redvulps/nandu/dialogs/main/main-dialog.ui',
      Gio.ResourceLookupFlags.NONE
    );

    GObject.registerClass(
      {
        GTypeName: 'NanduWindow',
        Template: template,
        InternalChildren: [
          'splitView',
          'sidebarListBox',
          'contentStack',
          'contentPage',
          'containersRow',
          'imagesRow',
          'networksRow',
          'volumesRow',
          'refreshButton',
          'backButton',
          'searchEntry',
          'searchButton',
          'titleStack',
          'windowTitle',
        ],
      },
      this
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
    super(params);

    this.settings = SettingsManager.getInstance();

    if (this.settings.isSetupComplete()) {
      const socketPath = this.settings.getEffectiveSocketPath();
      this.dockerClient = new DockerClient(socketPath);
    }

    this.setupPages();
    this.setupActions();

    this._sidebarListBox.connect('row-selected', (_listBox, row) => {
      if (!row) {
        return;
      }
      this.handleSidebarSelection(row);
    });

    this._refreshButton.connect('clicked', () => {
      if (this.containersPage) {
        void this.containersPage.loadContainers();
      }
    });

    this._backButton.connect('clicked', () => {
      this.navigateBack();
    });

    this._searchEntry.connect('search-changed', () => {
      const query = this._searchEntry.get_text();

      if (this.currentComposeDetail) {
        this.currentComposeDetail.setSearchQuery(query);
      } else if (this.containersPage) {
        this.containersPage.setSearchQuery(query);
      }
    });

    this._searchButton.connect('toggled', () => {
      this.setSearchMode(this._searchButton.get_active());
    });

    this._searchEntry.connect('stop-search', () => {
      this.setSearchMode(false);
    });

    // Exit search mode when focus leaves the empty search entry
    const focusController = new Gtk.EventControllerFocus();
    focusController.connect('leave', () => {
      if (!this._searchEntry.get_text()) {
        this.setSearchMode(false);
      }
    });

    this._searchEntry.add_controller(focusController);

    // Show containers page initially
    this._contentStack.set_visible_child_name('containers');
    this._contentPage.set_title('Containers');
    this._sidebarListBox.select_row(this._containersRow);
  }

  private setupPages(): void {
    this.containersPage = new ContainersPage();
    this.containersPage.setDockerClient(this.dockerClient);
    this.containersPage.connect(
      'open-manager',
      (_page, containerId: string) => {
        this.openContainerManager(containerId);
      }
    );
    this.containersPage.connect(
      'open-compose',
      (_page, projectName: string) => {
        this.openComposeDetail(projectName);
      }
    );
    this._contentStack.add_named(this.containersPage, 'containers');

    // Create and add other pages
    const imagesPage = new ImagesPage();
    this._contentStack.add_named(imagesPage, 'images');

    const networksPage = new NetworksPage();
    this._contentStack.add_named(networksPage, 'networks');

    const volumesPage = new VolumesPage();
    this._contentStack.add_named(volumesPage, 'volumes');
  }

  private setupActions(): void {
    const toggleSearchAction = new Gio.SimpleAction({
      name: 'toggle-search',
    });
    toggleSearchAction.connect('activate', () => {
      this.setSearchMode(!this._searchButton.get_active());
    });
    this.add_action(toggleSearchAction);
  }

  private setSearchMode(active: boolean): void {
    this._searchButton.set_active(active);
    if (active) {
      this._titleStack.set_visible_child_name('search');
      this._searchEntry.grab_focus();
    } else {
      this._titleStack.set_visible_child_name('title');
      this._searchEntry.set_text('');
    }
  }

  private setPageTitle(title: string): void {
    this._windowTitle.set_title(title);
    this._contentPage.set_title(title);
  }

  private handleSidebarSelection(row: Gtk.ListBoxRow): void {
    this.setSearchMode(false);
    this._backButton.set_visible(false);
    this.currentComposeDetail = null;
    if (row === this._containersRow) {
      this._contentStack.set_visible_child_name('containers');
      this.setPageTitle('Containers');
    } else if (row === this._imagesRow) {
      this._contentStack.set_visible_child_name('images');
      this.setPageTitle('Images');
    } else if (row === this._networksRow) {
      this._contentStack.set_visible_child_name('networks');
      this.setPageTitle('Networks');
    } else if (row === this._volumesRow) {
      this._contentStack.set_visible_child_name('volumes');
      this.setPageTitle('Volumes');
    }
  }

  private openContainerManager(containerId: string): void {
    if (!this.dockerClient) {
      return;
    }

    const manager = new ContainerManager(this.dockerClient, containerId, () => {
      if (this.containersPage) {
        void this.containersPage.loadContainers();
      }
    });
    manager.set_transient_for(this);
    manager.present();
  }

  private openComposeDetail(projectName: string): void {
    if (!this.containersPage) {
      return;
    }

    const containers = this.containersPage.getComposeContainers(projectName);
    const detail = new ComposeDetail(projectName, containers);

    detail.connect(
      'container-action',
      (_detail, action: string, id: string) => {
        if (action === 'open-manager') {
          this.openContainerManager(id);
        }
      }
    );

    this._contentStack.add_named(detail, `compose-${projectName}`);
    this._contentStack.set_visible_child_name(`compose-${projectName}`);
    this.setSearchMode(false);
    this.setPageTitle(projectName);
    this._backButton.set_visible(true);
    this.currentComposeDetail = detail;
  }

  private navigateBack(): void {
    this.setSearchMode(false);
    this._contentStack.set_visible_child_name('containers');
    this.setPageTitle('Containers');
    this._backButton.set_visible(false);
    this.currentComposeDetail = null;
  }

  public vfunc_show(): void {
    super.vfunc_show();
    this.set_focus(null);
  }
}

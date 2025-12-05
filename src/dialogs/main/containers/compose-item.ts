import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

/**
 * Represents a UI item for a Docker Compose project, displaying its name and container count.
 * It emits a 'clicked' signal when the item is activated.
 */
export class ComposeItem extends Gtk.Box {
  private _projectNameLabel!: Gtk.Label;
  private _statusLabel!: Gtk.Label;

  private _projectName = '';
  private _containerCount = 0;

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduComposeItem',
        Template: 'resource:///org/redvulps/nandu/compose-item.ui',
        InternalChildren: ['projectNameLabel', 'statusLabel'],
        Signals: {
          /**
           * Signal emitted when the ComposeItem is clicked.
           */
          clicked: {},
        },
      },
      this
    );
  }

  /**
   * Creates a new ComposeItem.
   * @param projectName - The name of the Docker Compose project.
   */
  constructor(projectName: string) {
    super();
    this._projectName = projectName;
    this._projectNameLabel.set_label(projectName);

    const clickController = new Gtk.GestureClick();
    clickController.connect('released', () => {
      this.emit('clicked');
    });

    this.add_controller(clickController);
  }

  /**
   * Sets the number of containers associated with this Compose project.
   * @param count The new number of containers.
   */
  public setContainerCount(count: number): void {
    this._containerCount = count;
    this._statusLabel.set_label(`${count} containers`);
  }

  /**
   * Retrieves the name of the Docker Compose project.
   * @returns The project name.
   */
  public getProjectName(): string {
    return this._projectName;
  }
}

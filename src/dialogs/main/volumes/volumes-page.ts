import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export class VolumesPage extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduVolumesPage',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/volumes/volumes-page.ui',
      },
      this
    );
  }

  constructor(params?: Partial<Gtk.Box.ConstructorProps>) {
    super(params);
  }
}
